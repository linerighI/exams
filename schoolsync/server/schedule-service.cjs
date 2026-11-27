/**
 * Hardened Schedule Service for SchoolSync: school-wide daily overview, conflict detection,
 * atomic universal template broadcast, batch upsert, and lesson period swapping.
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
  const leadTeachers = getLeadTeachersBySection(ctx, schoolId);
  const lessons = ctx.all(
    `SELECT l.id, l.section, l.teacher_id, u.name AS teacher, l.subject, l.room, l.weekday, l.start, l.end, l.color, l.period_number
     FROM lessons l JOIN users u ON u.id = l.teacher_id
     WHERE l.school_id=? AND l.weekday=?
     ORDER BY l.start ASC, l.section ASC`,
    schoolId, weekday,
  );
  const count = Math.max(1, Number(school.period_count || 7));
  const slots = [];
  for (let p = 1; p <= count; p++) {
    const win = periodWindow(school, p);
    if (win) slots.push({ periodNumber: p, start: win.start, end: win.end });
  }
  return { weekday, school: { start_time: school.start_time, end_time: school.end_time, timezone: school.timezone }, slots, classes, leadTeachers, lessons };
}

/** Atomically broadcast a universal schedule template across target (or all) classes. */
function applyUniversalSchedule(ctx, user, input) {
  const school = ctx.one('SELECT * FROM schools WHERE id=?', user.school_id);
  const allClasses = ctx.all('SELECT name, room FROM classes WHERE school_id=? ORDER BY sort_order ASC, name ASC', user.school_id);
  const classes = input.targetSections?.length
    ? allClasses.filter((c) => input.targetSections.includes(c.name))
    : allClasses;
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
          ctx.run(
            "DELETE FROM lessons WHERE school_id=? AND section=? AND weekday=? AND period_number=? AND id NOT IN (SELECT COALESCE(lesson_id,'') FROM attendance)",
            user.school_id, cls.name, entry.weekday, entry.periodNumber,
          );
        }
        const conflict = ctx.one(
          'SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND start<? AND end>? AND (section=? OR teacher_id=?)',
          user.school_id, entry.weekday, derived.end, derived.start, cls.name, tid,
        );
        if (conflict) { skippedConflicts++; continue; }
        ctx.run(
          'INSERT INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
          id(), user.school_id, cls.name, tid, entry.subject, cls.room || cls.name,
          entry.weekday, derived.start, derived.end, entry.color || 'blue', entry.periodNumber,
        );
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
    const clashA = ctx.one(
      'SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND id NOT IN (?,?) AND start<? AND end>? AND (section=? OR teacher_id=?)',
      user.school_id, b.weekday, a.id, b.id, b.end, b.start, a.section, a.teacher_id,
    );
    const clashB = ctx.one(
      'SELECT 1 FROM lessons WHERE school_id=? AND weekday=? AND id NOT IN (?,?) AND start<? AND end>? AND (section=? OR teacher_id=?)',
      user.school_id, a.weekday, a.id, b.id, a.end, a.start, b.section, b.teacher_id,
    );
    if (clashA || clashB) fail('Schedule conflict: cannot swap overlapping teacher or class slot', 409);
    ctx.run('UPDATE lessons SET weekday=?,start=?,end=?,period_number=? WHERE id=?', b.weekday, b.start, b.end, b.period_number, a.id);
    ctx.run('UPDATE lessons SET weekday=?,start=?,end=?,period_number=? WHERE id=?', a.weekday, a.start, a.end, a.period_number, b.id);
    ctx.audit(user, `Swapped schedule slots ${a.id} <-> ${b.id}`);
  })();
  return { ok: true };
}

module.exports = { buildScheduleOverview, applyUniversalSchedule, swapLessons };
