/**
 * Transactional School Database Injector (`merge` / `replace`).
 * Safely clears/upserts classes, subjects, staff, guardians, students, and lessons
 * strictly scoped to a single school inside one atomic SQLite transaction.
 */
const { id, hash, fail } = require('./db.cjs');
const { periodWindow } = require('./state.cjs');
const { ImportSchema, makeInitials } = require('./db-snapshot.cjs');
const { provisionStudentAccount, syncClassSortOrders } = require('./school-helpers.cjs');

function clearSchoolForReplace(ctx, schoolId) {
  const { run } = ctx;
  const studentSub = 'SELECT id FROM students WHERE school_id=?';
  const nonMgrSub = "SELECT id FROM users WHERE school_id=? AND role IN ('student','parent','teacher')";
  run('DELETE FROM family_credentials WHERE school_id=?', schoolId);
  run(`DELETE FROM guardian_links WHERE student_id IN (${studentSub})`, schoolId);
  run(`DELETE FROM submissions WHERE student_id IN (${studentSub}) OR homework_id IN (SELECT id FROM homework WHERE school_id=?)`, schoolId, schoolId);
  run('DELETE FROM incident_events WHERE incident_id IN (SELECT id FROM incidents WHERE school_id=?)', schoolId);
  run('DELETE FROM incidents WHERE school_id=?', schoolId);
  run('DELETE FROM attendance WHERE school_id=?', schoolId);
  run('DELETE FROM daily_attendance WHERE school_id=?', schoolId);
  run('DELETE FROM grades WHERE school_id=?', schoolId);
  run('DELETE FROM notes WHERE school_id=?', schoolId);
  run('DELETE FROM homework WHERE school_id=?', schoolId);
  run('DELETE FROM lessons WHERE school_id=?', schoolId);
  run('DELETE FROM teacher_classes WHERE school_id=?', schoolId);
  run('DELETE FROM teacher_subjects WHERE school_id=?', schoolId);
  run('DELETE FROM students WHERE school_id=?', schoolId);
  run('DELETE FROM classes WHERE school_id=?', schoolId);
  run('DELETE FROM subjects WHERE school_id=?', schoolId);
  run('DELETE FROM announcements WHERE school_id=?', schoolId);
  run('DELETE FROM messages WHERE school_id=?', schoolId);
  run(`DELETE FROM notifications WHERE user_id IN (${nonMgrSub})`, schoolId);
  run(`DELETE FROM sessions WHERE user_id IN (${nonMgrSub})`, schoolId);
  run(`DELETE FROM audit_log WHERE actor_id IN (${nonMgrSub})`, schoolId);
  run("DELETE FROM users WHERE school_id=? AND role IN ('student','parent','teacher')", schoolId);
}

function importSchoolSnapshot(ctx, schoolId, actorUser, rawPayload, { nationalHash }) {
  const v = ImportSchema.parse(rawPayload);
  const { one, run, audit } = ctx;
  const resolvePw = (explicit, email) => {
    const pw = explicit || v.defaultPassword;
    if (!pw) fail(`يرجى تحديد كلمة مرور (١٢+ حرفاً) للحساب الجديد: ${email}`, 400);
    return hash(pw);
  };
  const upsertUser = ({ name, email, password, role, section = null }) => {
    const cleanEmail = email.toLowerCase();
    const existing = one('SELECT * FROM users WHERE email=?', cleanEmail);
    if (existing) {
      if (existing.school_id !== schoolId) fail(`البريد مستخدم في مدرسة أخرى: ${cleanEmail}`, 409);
      run('UPDATE users SET name=?, section=COALESCE(?, section) WHERE id=?', name, section, existing.id);
      if (password) run('UPDATE users SET password=? WHERE id=?', hash(password), existing.id);
      return existing.id;
    }
    const uid = id();
    run('INSERT INTO users(id,school_id,name,email,password,role,section) VALUES(?,?,?,?,?,?,?)', uid, schoolId, name, cleanEmail, resolvePw(password, cleanEmail), role, section);
    return uid;
  };

  return ctx.db.transaction(() => {
    if (v.mode === 'replace') clearSchoolForReplace(ctx, schoolId);
    const curSchool = one('SELECT * FROM schools WHERE id=?', schoolId);
    if (v.school) {
      const tz = v.school.timezone || curSchool.timezone;
      try { new Intl.DateTimeFormat('en', { timeZone: tz }).format(); } catch { fail('Invalid school timezone', 400); }
      const st = v.school.start_time || curSchool.start_time;
      const et = v.school.end_time || curSchool.end_time;
      if (st >= et) fail('End must be after start', 400);
      run('UPDATE schools SET name=?,timezone=?,start_time=?,end_time=?,period_minutes=?,break_minutes=?,period_count=?,workdays=?,duty_notes=? WHERE id=?', v.school.name || curSchool.name, tz, st, et, v.school.period_minutes ?? curSchool.period_minutes, v.school.break_minutes ?? curSchool.break_minutes, v.school.period_count ?? curSchool.period_count, v.school.workdays ?? curSchool.workdays, v.school.duty_notes ?? curSchool.duty_notes, schoolId);
      if (v.school.principalName) run("UPDATE users SET name=? WHERE school_id=? AND role='admin'", v.school.principalName, schoolId);
    }
    const school = one('SELECT * FROM schools WHERE id=?', schoolId);
    for (const [cIdx, c] of v.classes.entries()) {
      const cur = one('SELECT id FROM classes WHERE school_id=? AND name=?', schoolId, c.name);
      const sortOrd = c.sortOrder ?? cIdx + 1;
      if (cur) run('UPDATE classes SET grade_level=?,location=?,room=?,sort_order=COALESCE(?,sort_order) WHERE id=?', c.gradeLevel || '', c.location || '', c.room || '', c.sortOrder ?? null, cur.id);
      else run('INSERT INTO classes(id,school_id,name,grade_level,location,room,sort_order) VALUES(?,?,?,?,?,?,?)', id(), schoolId, c.name, c.gradeLevel || '', c.location || '', c.room || '', sortOrd);
    }
    for (const s of v.subjects) {
      const cur = one('SELECT id FROM subjects WHERE school_id=? AND name=?', schoolId, s.name);
      if (cur) run('UPDATE subjects SET description=?,color=? WHERE id=?', s.description || '', s.color || 'blue', cur.id);
      else run('INSERT INTO subjects(id,school_id,name,description,color) VALUES(?,?,?,?,?)', id(), schoolId, s.name, s.description || '', s.color || 'blue');
    }
    const teacherByEmail = new Map();
    const teacherByName = new Map();
    for (const t of v.teachers) {
      const tid = upsertUser({ name: t.name, email: t.email, password: t.password, role: 'teacher', section: t.classes[0] || null });
      teacherByEmail.set(t.email.toLowerCase(), tid);
      teacherByName.set(t.name.trim(), tid);
      for (const cls of new Set(t.classes)) {
        run('INSERT OR IGNORE INTO classes(id,school_id,name) VALUES(?,?,?)', id(), schoolId, cls);
        run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', schoolId, tid, cls);
      }
      for (const sub of new Set(t.subjects)) {
        run('INSERT OR IGNORE INTO subjects(id,school_id,name) VALUES(?,?,?)', id(), schoolId, sub);
        run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', schoolId, tid, sub);
      }
    }
    for (const p of v.parents) upsertUser({ name: p.name, email: p.email, password: p.password, role: 'parent' });
    for (const st of v.students) {
      run('INSERT OR IGNORE INTO classes(id,school_id,name) VALUES(?,?,?)', id(), schoolId, st.section);
      const studentUid = st.studentEmail ? upsertUser({ name: st.name, email: st.studentEmail, password: st.studentPassword, role: 'student', section: st.section }) : null;
      const existing = one('SELECT * FROM students WHERE school_id=? AND name=? AND section=?', schoolId, st.name, st.section);
      const sid = existing ? existing.id : id();
      const initials = st.initials || makeInitials(st.name);
      if (existing) run('UPDATE students SET user_id=COALESCE(?,user_id),initials=?,color=?,guardian_phone=? WHERE id=?', studentUid, initials, st.color || existing.color || 'mint', st.guardianPhone ?? existing.guardian_phone, sid);
      else run('INSERT INTO students(id,school_id,user_id,name,section,initials,color,guardian_phone) VALUES(?,?,?,?,?,?,?,?)', sid, schoolId, studentUid, st.name, st.section, initials, st.color || 'mint', st.guardianPhone || '');
      const gEmails = [...new Set([...(st.guardianEmails || []), ...(st.guardianEmail ? [st.guardianEmail] : [])])];
      let firstGuardianId = null;
      for (const ge of gEmails) {
        const gu = one("SELECT id FROM users WHERE school_id=? AND email=? AND role='parent'", schoolId, ge.toLowerCase());
        if (gu) {
          run('INSERT OR IGNORE INTO guardian_links(guardian_id,student_id) VALUES(?,?)', gu.id, sid);
          if (!firstGuardianId) firstGuardianId = gu.id;
        }
      }
      if (st.nationalId && !st.familyCode) {
        const curStudent = one('SELECT * FROM students WHERE id=?', sid);
        provisionStudentAccount({
          db: ctx.db,
          schoolId,
          studentRow: curStudent,
          nationalId: st.nationalId,
          nationalHash,
        });
      } else if (st.nationalId && st.familyCode && firstGuardianId) {
        const nh = nationalHash(st.nationalId);
        if (one('SELECT 1 FROM family_credentials WHERE national_id_hash=? AND student_id<>?', nh, sid)) fail('الرقم الوطني مرتبط بطالب آخر', 409);
        run('INSERT INTO family_credentials(student_id,school_id,guardian_id,national_id_hash,code_hash) VALUES(?,?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET guardian_id=excluded.guardian_id,national_id_hash=excluded.national_id_hash,code_hash=excluded.code_hash,updated=CURRENT_TIMESTAMP', sid, schoolId, firstGuardianId, nh, hash(st.familyCode));
      }
    }
    const fallbackTeacher = one("SELECT id FROM users WHERE school_id=? AND role='teacher' ORDER BY name LIMIT 1", schoolId)?.id || actorUser.id;
    let lessonCount = 0;
    for (const l of v.lessons) {
      const tid = (l.teacherEmail && (teacherByEmail.get(l.teacherEmail.toLowerCase()) || one("SELECT id FROM users WHERE school_id=? AND email=? AND role='teacher'", schoolId, l.teacherEmail.toLowerCase())?.id)) || (l.teacherName && teacherByName.get(l.teacherName.trim())) || fallbackTeacher;
      const win = l.periodNumber ? periodWindow(school, l.periodNumber) : null;
      const start = l.start || win?.start;
      const end = l.end || win?.end;
      if (!start || !end || start >= end) fail(`توقيت غير صالح للحصة: ${l.subject} (${l.section})`, 400);
      run('INSERT OR IGNORE INTO classes(id,school_id,name,room) VALUES(?,?,?,?)', id(), schoolId, l.section, l.room);
      run('INSERT OR IGNORE INTO subjects(id,school_id,name,color) VALUES(?,?,?,?)', id(), schoolId, l.subject, l.color || 'blue');
      run('INSERT OR IGNORE INTO teacher_classes(school_id,teacher_id,class_name) VALUES(?,?,?)', schoolId, tid, l.section);
      run('INSERT OR IGNORE INTO teacher_subjects(school_id,teacher_id,subject) VALUES(?,?,?)', schoolId, tid, l.subject);
      const dup = one('SELECT id FROM lessons WHERE school_id=? AND section=? AND weekday=? AND start=?', schoolId, l.section, l.weekday, start);
      if (dup) run('UPDATE lessons SET teacher_id=?,subject=?,room=?,end=?,color=?,period_number=? WHERE id=?', tid, l.subject, l.room, end, l.color || 'blue', l.periodNumber || 1, dup.id);
      else run('INSERT INTO lessons(id,school_id,section,teacher_id,subject,room,weekday,start,end,color,period_number) VALUES(?,?,?,?,?,?,?,?,?,?,?)', id(), schoolId, l.section, tid, l.subject, l.room, l.weekday, start, end, l.color || 'blue', l.periodNumber || 1);
      lessonCount++;
    }
    for (const hw of v.homework) {
      const tid = (hw.teacherEmail && one("SELECT id FROM users WHERE school_id=? AND email=? AND role='teacher'", schoolId, hw.teacherEmail.toLowerCase())?.id) || fallbackTeacher;
      run('INSERT INTO homework(id,school_id,section,teacher_id,subject,title,description,due,color) VALUES(?,?,?,?,?,?,?,?,?)', id(), schoolId, hw.section, tid, hw.subject, hw.title, hw.description, hw.due, hw.color || 'peach');
    }
    for (const ann of v.announcements) run('INSERT INTO announcements(id,school_id,author_id,title,content) VALUES(?,?,?,?,?)', id(), schoolId, actorUser.id, ann.title, ann.content);
    audit(actorUser, `Imported school database (${v.mode})`);
    return {
      mode: v.mode,
      counts: {
        classes: v.classes.length,
        subjects: v.subjects.length,
        teachers: v.teachers.length,
        parents: v.parents.length,
        students: v.students.length,
        lessons: lessonCount,
        homework: v.homework.length,
        announcements: v.announcements.length,
      },
    };
  })();
}

module.exports = { importSchoolSnapshot };
