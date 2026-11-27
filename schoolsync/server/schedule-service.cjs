/**
 * Hardened Schedule Service for SchoolSync: school-wide daily overview, live config/timing,
 * cell upsert/cancel/clear, conflict barrier, absence optimizer, and schedule profiles.
 */
const { id, fail } = require('./db.cjs');
const { periodWindow } = require('./state.cjs');

/** Resolve each class's primary Class Lead Teacher (homeroom / first assigned teacher). */
function getLeadTeachersBySection(ctx, schoolId) {
  const rows = ctx.all(
    `SELECT u.id, u.name, COALESCE(u.section, tc.class_name) AS class_name
     FROM users u
     LEFT JOIN teacher_classes tc ON tc.teacher_id = u.id AND tc.school_id = u.school_id
     WHERE u.school_id = ? AND u.role = 'teacher' AND COALESCE(u.section, tc.class_name) IS NOT NULL`,
    schoolId,
  );
  const map = {};
  for (const r of rows) {
    if (r.class_name && !map[r.class_name]) map[r.class_name] = { id: r.id, name: r.name };
  }
  return map;
}

/** Build structured school-wide schedule overview for a weekday (0..6). */
function buildScheduleOverview(ctx, schoolId, weekday) {
  const school = ctx.one('SELECT * FROM schools WHERE id=?', schoolId);
  const classes = ctx.all('SELECT id, name, grade_level, room, sort_order FROM classes WHERE school_id=? ORDER BY sort_order ASC, name ASC', schoolId);
  const teachers = ctx.all("SELECT id, name, email, section, is_absent FROM users WHERE school_id=? AND role='teacher' ORDER BY name ASC", schoolId);
  const leadTeachers = getLeadTeachersBySection(ctx, schoolId);
  const lessons = ctx.all(
    `SELECT l.id, l.section, l.teacher_id, u.name AS teacher, u.is_absent AS teacher_absent,
            l.subject, l.room, l.weekday, l.start, l.end, l.color, l.period_number, COALESCE(l.status,'active') AS status
     FROM lessons l JOIN users u ON u.id = l.teacher_id
     WHERE l.school_id=? AND l.weekday=?
     ORDER BY l.period_number ASC, l.start ASC, l.section ASC`,
    schoolId, weekday,
  );
  const profiles = ctx.all('SELECT id, name, created_at FROM schedule_profiles WHERE school_id=? ORDER BY created_at DESC', schoolId);
  const count = Math.max(1, Number(school.period_count || 7));
  const slots = [];
  for (let p = 1; p <= count; p++) {
    const win = periodWindow(school, p);
    if (win) slots.push({ periodNumber: p, start: win.start, end: win.end });
  }
  return {
    weekday,
    school: {
      start_time: school.start_time, end_time: school.end_time, timezone: school.timezone,
      period_minutes: Number(school.period_minutes || 45), break_minutes: Number(school.break_minutes || 5),
      period_count: count, schedule_mode: school.schedule_mode || 'manual',
      active_period: school.active_period ?? null, duty_notes: school.duty_notes || '',
    },
    slots, classes, teachers, leadTeachers, lessons, profiles,
  };
}

/** Update school day timing, manual/auto mode, active period, and duty notes. */
function updateScheduleConfig(ctx, user, input) {
  const school = ctx.one('SELECT * FROM schools WHERE id=?', user.school_id);
  const start = input.start_time ?? school.start_time;
  const pMin = input.period_minutes ?? Number(school.period_minutes || 45);
  const bMin = input.break_minutes ?? Number(school.break_minutes || 5);
  const pCount = input.period_count ?? Number(school.period_count || 7);
  const mode = input.schedule_mode ?? (school.schedule_mode || 'manual');
  const activePeriod = input.active_period === undefined ? (school.active_period ?? null) : input.active_period;
  const dutyNotes = input.duty_notes === undefined ? (school.duty_notes || '') : input.duty_notes;

  ctx.db.transaction(() => {
    ctx.run(
      'UPDATE schools SET start_time=?,period_minutes=?,break_minutes=?,period_count=?,schedule_mode=?,active_period=?,duty_notes=? WHERE id=?',
      start, pMin, bMin, pCount, mode, activePeriod, dutyNotes, user.school_id,
    );
    const updatedSchool = ctx.one('SELECT * FROM schools WHERE id=?', user.school_id);
    for (const l of ctx.all('SELECT id, period_number FROM lessons WHERE school_id=?', user.school_id)) {
      const win = periodWindow(updatedSchool, l.period_number || 1);
      if (win) ctx.run('UPDATE lessons SET start=?, end=? WHERE id=?', win.start, win.end, l.id);
    }
    ctx.audit(user, 'Updated master schedule configuration');
  })();
  return { ok: true };
}

/** Upsert, cancel/restore, or clear a single cell in the master schedule with conflict barrier. */
function upsertScheduleCell(ctx, user, input) {
  const school = ctx.one('SELECT * FROM schools WHERE id=?', user.school_id);
  const win = periodWindow(school, input.periodNumber);
  if (!win) fail('Invalid period number', 400);

  if (input.action === 'clear') {
    const existing = ctx.one('SELECT id FROM lessons WHERE school_id=? AND section=? AND weekday=? AND period_number=?', user.school_id, input.section, input.weekday, input.periodNumber);
    if (existing && ctx.one('SELECT 1 FROM attendance WHERE lesson_id=?', existing.id)) fail('لا يمكن مسح حصة مسجّل بها حضور', 409);
    ctx.run('DELETE FROM lessons WHERE school_id=? AND section=? AND weekday=? AND period_number=?', user.school_id, input.section, input.weekday, input.periodNumber);
    return { ok: true };
  }

  if (input.action === 'cancel' || input.action === 'restore') {
    const nextStatus = input.action === 'cancel' ? 'canceled' : 'active';
    ctx.run('UPDATE lessons SET status=? WHERE school_id=? AND section=? AND weekday=? AND period_number=?', nextStatus, user.school_id, input.section, input.weekday, input.periodNumber);
    return { ok: true, status: nextStatus };
  }

  const teacherId = input.teacherId || getLeadTeachersBySection(ctx, user.school_id)[input.section]?.id;
  if (!teacherId) fail('Choose a teacher', 400);
  const conflict = ctx.one(
    "SELECT section FROM lessons WHERE school_id=? AND weekday=? AND period_number=? AND section<>? AND teacher_id=? AND COALESCE(status,'active')='active'",
    user.school_id, input.weekday, input.periodNumber, input.section, teacherId,
  );
  if (conflict) fail(`Schedule conflict: teacher already booked in ${conflict.section}`, 409);

  ctx.db.transaction(() => {
    const existing = ctx.one('SELECT id FROM lessons WHERE school_id=? AND section=? AND weekday=? AND period_number=?', user.school_id, input.section, input.weekday, input.periodNumber);
    if (existing) {
      ctx.run("UPDATE lessons SET subject=?,teacher_id=?,start=?,end=?,color=?,status='active' WHERE id=?", input.subject, teacherId, win.start, win.end, input.color || 'blue', existing.id);
    } else {
      ctx.run(
        "INSERT INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,'active')",
        id(), user.school_id, input.section, teacherId, input.subject, input.section, input.weekday, win.start, win.end, input.color || 'blue', input.periodNumber,
      );
    }
    ctx.run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', user.school_id, teacherId, input.section);
    ctx.run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', user.school_id, teacherId, input.subject);
  })();
  return { ok: true };
}

/** Shift active lessons earlier and move absent-teacher lessons to the end of the day as canceled. */
function optimizeSectionForAbsences(ctx, user, section, weekday) {
  const school = ctx.one('SELECT * FROM schools WHERE id=?', user.school_id);
  const absentIds = new Set(ctx.all("SELECT id FROM users WHERE school_id=? AND role='teacher' AND is_absent=1", user.school_id).map((r) => r.id));
  const secLessons = ctx.all('SELECT * FROM lessons WHERE school_id=? AND section=? AND weekday=? ORDER BY period_number ASC', user.school_id, section, weekday);
  if (!secLessons.length) return { ok: true, moved: 0 };

  const active = secLessons.filter((l) => !absentIds.has(l.teacher_id));
  const absent = secLessons.filter((l) => absentIds.has(l.teacher_id));
  if (!absent.length) return { ok: true, moved: 0 };

  const ordered = [...active.map((l) => ({ ...l, nextStatus: 'active' })), ...absent.map((l) => ({ ...l, nextStatus: 'canceled' }))];
  const count = Math.max(ordered.length, Number(school.period_count || 7));
  ctx.db.transaction(() => {
    for (let idx = 0; idx < ordered.length && idx < count; idx++) {
      const p = idx + 1;
      const win = periodWindow(school, p);
      if (win) ctx.run('UPDATE lessons SET period_number=?,start=?,end=?,status=? WHERE id=?', p, win.start, win.end, ordered[idx].nextStatus, ordered[idx].id);
    }
    ctx.audit(user, `Optimized absences for ${section} (weekday ${weekday})`);
  })();
  return { ok: true, moved: absent.length };
}

/**
 * Constraint-satisfaction + load-balanced schedule rewriter for absent teachers:
 * 1) Assigns qualified free substitute teachers (subject match + lowest daily load + zero clash).
 * 2) Shifts/compacts remaining un-coverable slots to the end of the day & marks canceled.
 */
function rewriteScheduleForAbsences(ctx, user, weekday) {
  const school = ctx.one('SELECT * FROM schools WHERE id=?', user.school_id);
  const allTeachers = ctx.all("SELECT id, name, section, is_absent FROM users WHERE school_id=? AND role='teacher'", user.school_id);
  const absentIds = new Set(allTeachers.filter((t) => t.is_absent).map((t) => t.id));
  if (!absentIds.size) return { ok: true, replacedCount: 0, shiftedCount: 0, canceledCount: 0 };

  const activeTeachers = allTeachers.filter((t) => !t.is_absent);
  const teacherSubjs = new Map();
  for (const ts of ctx.all('SELECT teacher_id, subject FROM teacher_subjects WHERE school_id=?', user.school_id)) {
    if (!teacherSubjs.has(ts.teacher_id)) teacherSubjs.set(ts.teacher_id, new Set());
    teacherSubjs.get(ts.teacher_id).add(ts.subject);
  }

  const dayLessons = ctx.all(
    "SELECT * FROM lessons WHERE school_id=? AND weekday=? ORDER BY period_number ASC, section ASC",
    user.school_id, weekday,
  );
  // Track busy teachers per period & daily load for optimal substitute scoring
  const busyAt = new Map();
  const loadCount = new Map(activeTeachers.map((t) => [t.id, 0]));
  for (const l of dayLessons) {
    if (l.status === 'canceled' || absentIds.has(l.teacher_id)) continue;
    const p = l.period_number || 1;
    if (!busyAt.has(p)) busyAt.set(p, new Set());
    busyAt.get(p).add(l.teacher_id);
    loadCount.set(l.teacher_id, (loadCount.get(l.teacher_id) || 0) + 1);
  }

  let replacedCount = 0;
  let shiftedCount = 0;
  let canceledCount = 0;

  ctx.db.transaction(() => {
    // Phase 1: Best-fit substitute replacement
    for (const l of dayLessons) {
      if (!absentIds.has(l.teacher_id)) continue;
      const p = l.period_number || 1;
      const busy = busyAt.get(p) || new Set();
      const candidates = activeTeachers
        .filter((t) => !busy.has(t.id))
        .map((t) => {
          const sameSubj = teacherSubjs.get(t.id)?.has(l.subject) ? 100 : 0;
          const sameSec = t.section === l.section ? 30 : 0;
          const loadPenalty = (loadCount.get(t.id) || 0) * 5;
          return { t, score: sameSubj + sameSec - loadPenalty };
        })
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        const chosen = candidates[0].t;
        ctx.run("UPDATE lessons SET teacher_id=?, status='active' WHERE id=?", chosen.id, l.id);
        busy.add(chosen.id);
        busyAt.set(p, busy);
        loadCount.set(chosen.id, (loadCount.get(chosen.id) || 0) + 1);
        l.teacher_id = chosen.id;
        l.status = 'active';
        replacedCount++;
      }
    }

    // Phase 2: Compact remaining un-covered absent lessons to end of each section's day
    const bySec = new Map();
    for (const l of dayLessons) {
      if (!bySec.has(l.section)) bySec.set(l.section, []);
      bySec.get(l.section).push(l);
    }
    const maxP = Math.max(1, Number(school.period_count || 7));
    for (const [, secList] of bySec) {
      const stillAbsent = secList.filter((l) => absentIds.has(l.teacher_id));
      if (!stillAbsent.length) continue;
      const okList = secList.filter((l) => !absentIds.has(l.teacher_id));
      const reordered = [...okList.map((l) => ({ ...l, st: 'active' })), ...stillAbsent.map((l) => ({ ...l, st: 'canceled' }))];
      for (let i = 0; i < reordered.length && i < maxP; i++) {
        const p = i + 1;
        const win = periodWindow(school, p);
        if (win) {
          if (reordered[i].period_number !== p) shiftedCount++;
          if (reordered[i].st === 'canceled') canceledCount++;
          ctx.run('UPDATE lessons SET period_number=?,start=?,end=?,status=? WHERE id=?', p, win.start, win.end, reordered[i].st, reordered[i].id);
        }
      }
    }
    ctx.audit(user, `Smart-rewrote weekday ${weekday}: ${replacedCount} replaced, ${shiftedCount} shifted, ${canceledCount} canceled`);
  })();
  return { ok: true, replacedCount, shiftedCount, canceledCount };
}

/** Atomically broadcast a universal schedule template across target (or all) classes. */
function applyUniversalSchedule(ctx, user, input) {
  const school = ctx.one('SELECT * FROM schools WHERE id=?', user.school_id);
  const allClasses = ctx.all('SELECT name, room FROM classes WHERE school_id=? ORDER BY sort_order ASC, name ASC', user.school_id);
  const classes = input.targetSections?.length ? allClasses.filter((c) => input.targetSections.includes(c.name)) : allClasses;
  if (!classes.length) fail('لا توجد صفوف دراسية مستهدفة', 400);
  const fallbackTeacher = ctx.one("SELECT id FROM users WHERE school_id=? AND role='teacher' LIMIT 1", user.school_id);
  if (!fallbackTeacher) fail('أضف معلماً واحداً على الأقل أولاً', 400);

  const leads = getLeadTeachersBySection(ctx, user.school_id);
  let createdCount = 0;
  let skippedConflicts = 0;
  let maxEnd = school.end_time;

  ctx.db.transaction(() => {
    for (const cls of classes) {
      const leadId = leads[cls.name]?.id || fallbackTeacher.id;
      for (const entry of input.entries) {
        const derived = periodWindow(school, entry.periodNumber);
        if (!derived) continue;
        const tid = entry.teacherId || leadId;
        if (input.replaceExisting) {
          ctx.run("DELETE FROM lessons WHERE school_id=? AND section=? AND weekday=? AND period_number=? AND id NOT IN (SELECT COALESCE(lesson_id,'') FROM attendance)", user.school_id, cls.name, entry.weekday, entry.periodNumber);
        }
        const conflict = ctx.one('SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND start<? AND end>? AND (section=? OR teacher_id=?)', user.school_id, entry.weekday, derived.end, derived.start, cls.name, tid);
        if (conflict) { skippedConflicts++; continue; }
        ctx.run("INSERT INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,'active')", id(), user.school_id, cls.name, tid, entry.subject, cls.room || cls.name, entry.weekday, derived.start, derived.end, entry.color || 'blue', entry.periodNumber);
        ctx.run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', user.school_id, tid, cls.name);
        ctx.run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', user.school_id, tid, entry.subject);
        if (derived.end > maxEnd) maxEnd = derived.end;
        createdCount++;
      }
    }
    if (maxEnd > school.end_time) ctx.run('UPDATE schools SET end_time=? WHERE id=?', maxEnd, user.school_id);
    ctx.audit(user, `Applied universal schedule (${createdCount} lessons, ${skippedConflicts} skipped)`);
  })();
  return { ok: true, createdCount, skippedConflicts, classCount: classes.length };
}

/** Atomically swap two lessons' time slots (period, start, end) with conflict checking. */
function swapLessons(ctx, user, lessonIdA, lessonIdB) {
  const a = ctx.lesson(user, lessonIdA);
  const b = ctx.lesson(user, lessonIdB);
  if (a.id === b.id) return { ok: true };
  ctx.db.transaction(() => {
    const clashA = ctx.one('SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND id NOT IN (?,?) AND start<? AND end>? AND (section=? OR teacher_id=?)', user.school_id, b.weekday, a.id, b.id, b.end, b.start, a.section, a.teacher_id);
    const clashB = ctx.one('SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND id NOT IN (?,?) AND start<? AND end>? AND (section=? OR teacher_id=?)', user.school_id, a.weekday, a.id, b.id, a.end, a.start, b.section, b.teacher_id);
    if (clashA || clashB) fail('Schedule conflict: cannot swap overlapping teacher or class slot', 409);
    ctx.run('UPDATE lessons SET weekday=?,start=?,end=?,period_number=? WHERE id=?', b.weekday, b.start, b.end, b.period_number, a.id);
    ctx.run('UPDATE lessons SET weekday=?,start=?,end=?,period_number=? WHERE id=?', a.weekday, a.start, a.end, a.period_number, b.id);
    ctx.audit(user, `Swapped schedule slots ${a.id} <-> ${b.id}`);
  })();
  return { ok: true };
}

module.exports = { buildScheduleOverview, updateScheduleConfig, upsertScheduleCell, optimizeSectionForAbsences, rewriteScheduleForAbsences, applyUniversalSchedule, swapLessons };
