/**
 * Authorization helpers, Jordanian bell schedule calculations, notification broadcaster,
 * and `/api/state` response builder.
 */
const { day, id, fail } = require('./db.cjs');
const { createNotificationsHub } = require('./notifications-hub.cjs');
const { getPublishedLayoutPayload } = require('./routes-campus-layout.cjs');
const { buildTeacherPresenceList, getOwnPresence } = require('./routes-presence.cjs');

const STAFF_ROLES = ['teacher', 'assistant', 'admin'];
const MANAGER_ROLES = ['assistant', 'admin'];

/** Compute start and end HH:MM for Jordanian period N (1..10). */
function periodWindow(school, periodNumber) {
  const [h, m] = (school.start_time || '08:00').split(':').map(Number);
  const pMin = Number(school.period_minutes || 45);
  const bMin = Number(school.break_minutes || 5);
  const offset = (periodNumber - 1) * (pMin + bMin);
  const startTotal = h * 60 + m + offset;
  const endTotal = startTotal + pMin;
  const fmt = (t) =>
    `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  return { start: fmt(startTotal), end: fmt(endTotal) };
}

function createContext(db, clock) {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);

  const audit = (u, action) =>
    run(
      'INSERT INTO audit_log(id,school_id,actor_id,action) VALUES(?,?,?,?)',
      id(),
      u.school_id,
      u.id,
      action,
    );

  const { insertNotification, notify, subscribeUserNotifications, pushUserNotification } =
    createNotificationsHub(one, all, run);

  function teacherClasses(u) {
    const rows = all('SELECT class_name FROM teacher_classes WHERE teacher_id=?', u.id).map(
      (r) => r.class_name,
    );
    if (u.section && !rows.includes(u.section)) rows.push(u.section);
    return rows;
  }

  function teacherSubjects(u) {
    return all('SELECT subject FROM teacher_subjects WHERE teacher_id=?', u.id).map((r) => r.subject);
  }

  function teacherWings(u) {
    return all('SELECT wing FROM teacher_wings WHERE teacher_id=?', u.id).map((r) => r.wing);
  }

  function students(u) {
    if (u.role === 'parent')
      return all(
        'SELECT s.* FROM students s JOIN guardian_links g ON g.student_id=s.id WHERE g.guardian_id=? AND s.school_id=?',
        u.id,
        u.school_id,
      );
    if (u.role === 'student')
      return all('SELECT * FROM students WHERE user_id=? AND school_id=?', u.id, u.school_id);
    if (u.role === 'teacher') {
      const cls = teacherClasses(u);
      if (!cls.length) return [];
      const placeholders = cls.map(() => '?').join(',');
      return all(
        `SELECT * FROM students WHERE school_id=? AND section IN (${placeholders}) ORDER BY section, name`,
        u.school_id,
        ...cls,
      );
    }
    return all('SELECT * FROM students WHERE school_id=? ORDER BY section, name', u.school_id);
  }

  const student = (u, sid) =>
    students(u).find((s) => s.id === sid) || fail('Student access denied');

  const staff = (u) => {
    if (!STAFF_ROLES.includes(u.role)) fail('Staff access required');
  };

  const schoolManager = (u) => {
    if (!MANAGER_ROLES.includes(u.role)) fail('Administrator access required');
  };

  const lesson = (u, lid) => {
    const l = one('SELECT * FROM lessons WHERE id=? AND school_id=?', lid, u.school_id);
    if (!l || (u.role === 'teacher' && l.teacher_id !== u.id)) fail('Lesson access denied');
    return l;
  };

  function teacherCanManageSubject(u, section, subject) {
    if (MANAGER_ROLES.includes(u.role)) return true;
    const assigned = teacherClasses(u).includes(section);
    if (!assigned) return false;
    if (
      one(
        'SELECT 1 FROM lessons WHERE teacher_id=? AND school_id=? AND section=? AND subject=?',
        u.id,
        u.school_id,
        section,
        subject,
      )
    )
      return true;
    const subs = teacherSubjects(u);
    return subs.length > 0 && subs.includes(subject);
  }

  return {
    one,
    all,
    run,
    audit,
    notify,
    insertNotification,
    subscribeUserNotifications,
    pushUserNotification,
    students,
    student,
    staff,
    schoolManager,
    lesson,
    teacherClasses,
    teacherSubjects,
    teacherWings,
    teacherCanManageSubject,
    clock,
  };
}

function buildState(ctx, u, requestedStudentId, demo) {
  const { one, all, students, student, clock } = ctx;
  const rawStudents = students(u);
  const sid = requestedStudentId || rawStudents[0]?.id;
  const s = sid ? student(u, sid) : null;
  const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
  const date = day(school.timezone, clock());
  const isStaff = STAFF_ROLES.includes(u.role);
  const isManager = MANAGER_ROLES.includes(u.role);

  const enrichedStudents = rawStudents.map((st) => {
    const lastAbsent = one(
      "SELECT MAX(d) d FROM (SELECT date d FROM attendance WHERE student_id=? AND status='absent' UNION SELECT date d FROM daily_attendance WHERE student_id=? AND status='absent')",
      st.id,
      st.id,
    )?.d;
    const todayRec =
      one('SELECT status FROM daily_attendance WHERE student_id=? AND date=?', st.id, date) ||
      one(
        'SELECT status FROM attendance WHERE student_id=? AND date=? ORDER BY rowid DESC LIMIT 1',
        st.id,
        date,
      );
    const { national_id_hash: _hiddenHash, ...safeStudent } = st;
    const exposeId = isManager || st.user_id === u.id;
    return {
      ...safeStudent,
      national_id: exposeId ? st.national_id || '' : undefined,
      has_account: Boolean(st.user_id && st.national_id),
      last_absence: lastAbsent || null,
      today_status: todayRec?.status || null,
    };
  });

  const selectedStudent = s ? enrichedStudents.find((x) => x.id === s.id) || s : null;
  const hw = s
    ? all(
        'SELECT h.*,u.name teacher,sub.content submission FROM homework h JOIN users u ON u.id=h.teacher_id LEFT JOIN submissions sub ON sub.homework_id=h.id AND sub.student_id=? WHERE h.school_id=? AND h.section=? ORDER BY h.due',
        s.id,
        u.school_id,
        s.section,
      )
    : [];

  const mergedAttendance = s
    ? all(
        `SELECT id,school_id,student_id,lesson_id,date,status,subject,start FROM (
           SELECT a.id,a.school_id,a.student_id,a.lesson_id,a.date,a.status,l.subject,l.start
             FROM attendance a JOIN lessons l ON l.id=a.lesson_id
             WHERE a.student_id=? AND a.school_id=?
           UNION ALL
           SELECT d.id,d.school_id,d.student_id,COALESCE(d.lesson_id,'daily') lesson_id,d.date,d.status,d.label subject,'08:00' start
             FROM daily_attendance d
             WHERE d.student_id=? AND d.school_id=? AND d.lesson_id IS NULL
         ) ORDER BY date DESC, start`,
        s.id,
        u.school_id,
        s.id,
        u.school_id,
      )
    : [];

  const teachers = isStaff
    ? all("SELECT id,name,email,section FROM users WHERE school_id=? AND role='teacher' ORDER BY name", u.school_id).map(
        (t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          classes: ctx.teacherClasses(t),
          subjects: ctx.teacherSubjects(t),
          wings: ctx.teacherWings(t),
        }),
      )
    : [];

  return {
    user: u,
    school,
    date,
    students: enrichedStudents,
    student: selectedStudent,
    classes: all('SELECT * FROM classes WHERE school_id=? ORDER BY sort_order ASC, name ASC', u.school_id),
    subjects: all('SELECT * FROM subjects WHERE school_id=? ORDER BY name', u.school_id),
    teachers,
    teacherWings: u.role === 'teacher' ? ctx.teacherWings(u) : [],
    spatialRooms: all('SELECT slot_id,label,kind,class_name,wing FROM spatial_rooms WHERE school_id=?', u.school_id),
    campusLayout: isStaff ? getPublishedLayoutPayload(one, u.school_id) : null,
    teacherPresence: isManager
      ? buildTeacherPresenceList(ctx, school, clock())
      : u.role === 'teacher'
        ? [getOwnPresence(ctx, u)].filter(Boolean)
        : [],
    lessons: s
      ? all(
          'SELECT l.*,u.name teacher FROM lessons l JOIN users u ON u.id=l.teacher_id WHERE l.school_id=? AND l.section=? ORDER BY l.weekday,l.start',
          u.school_id,
          s.section,
        )
      : [],
    homework: hw,
    grades: s
      ? all(
          "SELECT * FROM grades WHERE student_id=? AND school_id=? AND (published=1 OR ? IN ('teacher','assistant','admin')) ORDER BY date DESC",
          s.id,
          u.school_id,
          u.role,
        )
      : [],
    attendance: mergedAttendance,
    incidents: all(
      'SELECT i.*,s.name student_name FROM incidents i JOIN students s ON s.id=i.student_id WHERE i.school_id=?',
      u.school_id,
    ).filter((i) => rawStudents.some((st) => st.id === i.student_id)),
    notes: s
      ? all(
          'SELECT n.*,u.name author FROM notes n JOIN users u ON u.id=n.author_id WHERE student_id=? AND n.school_id=? ORDER BY created DESC',
          s.id,
          u.school_id,
        )
      : [],
    announcements: all('SELECT * FROM announcements WHERE school_id=? ORDER BY created DESC', u.school_id),
    notifications: all('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 100', u.id),
    messages: [],
    contacts: [],
    accounts: isManager
      ? all('SELECT id,name,email,role,section FROM users WHERE school_id=? ORDER BY name', u.school_id)
      : [],
    rosterAttendance: isStaff
      ? all('SELECT * FROM daily_attendance WHERE school_id=? AND date=?', u.school_id, date)
          .filter((a) => rawStudents.some((st) => st.id === a.student_id))
          .concat(
            all('SELECT * FROM attendance WHERE school_id=? AND date=?', u.school_id, date).filter((a) =>
              rawStudents.some((st) => st.id === a.student_id),
            ),
          )
      : [],
    familyAccess: isManager
      ? all(
          'SELECT c.student_id,c.guardian_id,u.name guardian_name FROM family_credentials c JOIN users u ON u.id=c.guardian_id WHERE c.school_id=?',
          u.school_id,
        )
      : [],
    schoolWorkspace: isStaff
      ? {
          lessons: all(
            'SELECT l.*,u.name teacher FROM lessons l JOIN users u ON u.id=l.teacher_id WHERE l.school_id=? AND (? IN (\'admin\',\'assistant\') OR l.teacher_id=? OR l.section IN (SELECT class_name FROM teacher_classes WHERE teacher_id=?)) ORDER BY l.weekday,l.start',
            u.school_id,
            u.role,
            u.id,
            u.id,
          ),
          homework: all(
            'SELECT id,section,subject,title,due FROM homework WHERE school_id=? ORDER BY due',
            u.school_id,
          ),
        }
      : null,
    demo,
  };
}

module.exports = { periodWindow, createContext, buildState, STAFF_ROLES, MANAGER_ROLES };
