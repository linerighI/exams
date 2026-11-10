const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, hash } = require('../server/app.cjs');
let app, db;
beforeEach(() => {
  ({ app, db } = createApp({ demo: true, clock: () => new Date('2026-11-10T08:30:00Z') }));
});
afterEach(async () => {
  await app.close();
});
async function login(email = 'alex', password = 'SchoolSync!2026') {
  const r = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email: `${email}@schoolsync.demo`, password },
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.headers['set-cookie'].split(';')[0];
}
async function request(cookie, url, payload) {
  return app.inject({
    method: payload === undefined ? 'GET' : 'POST',
    url,
    headers: { cookie },
    payload,
  });
}
test('authentication is required and passwords are hashed', async () => {
  assert.equal((await app.inject('/api/state')).statusCode, 401);
  assert.notEqual(
    db.prepare('SELECT password FROM users LIMIT 1').get().password,
    'SchoolSync!2026',
  );
  const bad = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email: 'alex@schoolsync.demo', password: 'incorrect' },
  });
  assert.equal(bad.statusCode, 401);
});
test('session cookie is private and revoked on logout', async () => {
  const cookie = await login();
  assert.equal((await request(cookie, '/api/state')).statusCode, 200);
  assert.equal((await request(cookie, '/api/logout', {})).statusCode, 200);
  assert.equal((await request(cookie, '/api/state')).statusCode, 401);
});
test('student and guardian access only linked profiles', async () => {
  const student = await login();
  assert.equal((await request(student, '/api/state?student=jamie')).statusCode, 403);
  const parent = await login('sarah');
  const a = (await request(parent, '/api/state')).json();
  assert.equal(a.students.length, 2);
  assert.equal((await request(parent, '/api/state?student=jamie')).json().student.id, 'jamie');
  db.prepare('DELETE FROM guardian_links WHERE student_id=?').run('jamie');
  assert.equal((await request(parent, '/api/state?student=jamie')).statusCode, 403);
});
test('cross-school reads and administrative writes are denied', async () => {
  const teacher = await login('emma');
  assert.equal((await request(teacher, '/api/state?student=jamie')).statusCode, 403);
  assert.equal(
    (await request(teacher, '/api/students', { name: 'No access', section: '6B' })).statusCode,
    403,
  );
  db.prepare('INSERT INTO schools(id,name) VALUES(?,?)').run('other', 'Other school');
  db.prepare(
    'INSERT INTO students(id,school_id,name,section,initials,color) VALUES(?,?,?,?,?,?)',
  ).run('other-child', 'other', 'Private Child', '8A', 'PC', 'mint');
  const admin = await login('rami');
  assert.equal((await request(admin, '/api/state?student=other-child')).statusCode, 403);
});
test('homework saves a real submission, supports correction, and isolates siblings', async () => {
  const cookie = await login();
  const s = (await request(cookie, '/api/state')).json();
  const homework = s.homework[0];
  assert.equal(
    (await request(cookie, `/api/homework/${homework.id}/submit`, { content: 'My actual answer' }))
      .statusCode,
    200,
  );
  assert.equal(
    (await request(cookie, '/api/state')).json().homework.find((h) => h.id === homework.id)
      .submission,
    'My actual answer',
  );
  await request(cookie, `/api/homework/${homework.id}/submit`, { content: 'Corrected answer' });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM submissions').get().n, 1);
  const sibling = await login('jamie');
  assert.equal(
    (await request(sibling, `/api/homework/${homework.id}/submit`, { content: 'Unauthorized' }))
      .statusCode,
    404,
  );
  const parent = await login('sarah');
  assert.equal(
    (await request(parent, `/api/homework/${homework.id}/submit`, { content: 'Unauthorized' }))
      .statusCode,
    403,
  );
});
test('teacher publishing reaches families, unrelated sections are denied', async () => {
  const c = await login('emma');
  const payload = {
    section: '8A',
    subject: 'الرياضيات',
    title: 'Practice fractions',
    description: 'Complete the exercises',
    due: '2026-11-12',
  };
  assert.equal((await request(c, '/api/homework', payload)).statusCode, 200);
  assert.ok(db.prepare('SELECT * FROM notifications WHERE title=?').all('واجب جديد').length >= 2);
  assert.equal((await request(c, '/api/homework', { ...payload, section: '6B' })).statusCode, 403);
});
test('grades validate score and keep drafts private', async () => {
  const c = await login('emma');
  const grade = {
    studentId: 'alex',
    subject: 'الرياضيات',
    title: 'Draft learning milestone',
    score: 88,
    max: 100,
    published: false,
  };
  assert.equal((await request(c, '/api/grades', { ...grade, score: 101 })).statusCode, 400);
  assert.equal((await request(c, '/api/grades', grade)).statusCode, 200);
  const s = await login();
  assert.ok(!(await request(s, '/api/state')).json().grades.some((g) => g.title === grade.title));
  assert.equal(
    (await request(c, '/api/grades', { ...grade, published: true, title: 'Published milestone' }))
      .statusCode,
    200,
  );
  assert.ok(
    (await request(s, '/api/state')).json().grades.some((g) => g.title === 'Published milestone'),
  );
});
test('attendance discrepancy creates one incident with private persisted notifications', async () => {
  const c = await login('emma');
  const present = {
    lessonId: '8A-2-Mathematics',
    date: '2026-11-10',
    records: [{ studentId: 'alex', status: 'present' }],
  };
  assert.equal((await request(c, '/api/attendance', present)).statusCode, 200);
  const absent = {
    ...present,
    lessonId: '8A-2-English',
    records: [{ studentId: 'alex', status: 'absent' }],
  };
  assert.equal((await request(c, '/api/attendance', absent)).statusCode, 200);
  assert.equal((await request(c, '/api/attendance', absent)).statusCode, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM incidents').get().n, 1);
  const n = db
    .prepare('SELECT * FROM notifications WHERE title=? AND user_id=?')
    .all('الحضور يحتاج إلى تحقق', 'parent-demo');
  assert.equal(n.length, 1);
  assert.match(n[0].content, /لا يؤكد مغادرة/);
  const a = await login('rami');
  const incident = db.prepare('SELECT * FROM incidents').get();
  assert.equal(
    (
      await request(a, `/api/incidents/${incident.id}`, {
        status: 'resolved',
        resolution: 'Verified in the school office with staff.',
      })
    ).statusCode,
    200,
  );
  assert.equal(db.prepare('SELECT status FROM incidents').get().status, 'resolved');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM incident_events').get().n, 2);
});
test('unrecorded presence and isolated absence never imply verified attendance or departure', async () => {
  const c = await login('emma');
  assert.equal((await request(c, '/api/state')).json().attendance.length, 0);
  await request(c, '/api/attendance', {
    lessonId: '8A-2-English',
    date: '2026-11-10',
    records: [{ studentId: 'alex', status: 'absent' }],
  });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM incidents').get().n, 0);
});
test('attendance rejects unrelated teachers, historical dates, future periods, and atomic mixed rosters', async () => {
  const c = await login('emma');
  const p = {
    lessonId: '8A-2-English',
    date: '2026-11-10',
    records: [{ studentId: 'alex', status: 'present' }],
  };
  assert.equal(
    (await request(c, '/api/attendance', { ...p, lessonId: '6B-2-English' })).statusCode,
    403,
  );
  assert.equal((await request(c, '/api/attendance', { ...p, date: '2026-11-09' })).statusCode, 400);
  assert.equal(
    (await request(c, '/api/attendance', { ...p, lessonId: '8A-2-History' })).statusCode,
    400,
  );
  assert.equal(
    (
      await request(c, '/api/attendance', {
        ...p,
        records: [...p.records, { studentId: 'jamie', status: 'absent' }],
      })
    ).statusCode,
    403,
  );
  assert.equal(db.prepare('SELECT COUNT(*) n FROM attendance').get().n, 0);
});
test('timetable changes persist and reject teacher, room, or class overlaps', async () => {
  const c = await login('rami');
  const conflicting = await request(c, '/api/lessons/8A-2-Mathematics', {
    start: '09:00',
    end: '09:45',
    room: 'Room 204',
  });
  assert.equal(conflicting.statusCode, 409);
  assert.equal(
    (
      await request(c, '/api/lessons/8A-2-Mathematics', {
        start: '08:00',
        end: '08:45',
        room: 'New room',
      })
    ).statusCode,
    200,
  );
  const s = await login('sarah');
  assert.equal(
    (await request(s, '/api/state')).json().lessons.find((l) => l.id === '8A-2-Mathematics').room,
    'New room',
  );
});
test('notes, messaging, and notification read state persist across authorized accounts', async () => {
  const teacher = await login('emma');
  assert.equal(
    (await request(teacher, '/api/notes', { studentId: 'alex', content: 'Great progress today' }))
      .statusCode,
    200,
  );
  const parent = await login('sarah');
  assert.ok(
    (await request(parent, '/api/state'))
      .json()
      .notes.some((n) => n.content === 'Great progress today'),
  );
  assert.equal(
    (
      await request(parent, '/api/messages', {
        recipientId: 'teacher-demo',
        content: 'Thank you for sharing!',
      })
    ).statusCode,
    200,
  );
  assert.ok(
    (await request(teacher, '/api/state'))
      .json()
      .messages.some((m) => m.content === 'Thank you for sharing!'),
  );
  assert.equal(
    (
      await request(parent, '/api/messages', {
        recipientId: 'student-sibling',
        content: 'Not an authorized channel',
      })
    ).statusCode,
    403,
  );
  await request(parent, '/api/notifications/read', {});
  assert.ok((await request(parent, '/api/state')).json().notifications.every((n) => n.read === 1));
});
test('malformed input and cross-origin mutations are rejected', async () => {
  const c = await login();
  assert.equal(
    (await request(c, '/api/messages', { recipientId: 'teacher-demo', content: ' ' })).statusCode,
    400,
  );
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/messages',
        headers: { cookie: c, origin: 'https://unrelated.example' },
        payload: { recipientId: 'teacher-demo', content: 'Injected' },
      })
    ).statusCode,
    403,
  );
});
test('production starts without seed accounts', async () => {
  const p = createApp();
  assert.equal(p.db.prepare('SELECT COUNT(*) n FROM users').get().n, 0);
  assert.equal((await p.app.inject('/api/config')).json().demo, false);
  await p.app.close();
});
test('administrators create real accounts and verified guardian links without exposing password hashes', async () => {
  const c = await login('rami');
  const payload = {
    name: 'ولي أمر تجريبي',
    email: 'newguardian@schoolsync.demo',
    password: 'UniqueTestPassword!2026',
    role: 'parent',
  };
  assert.equal((await request(c, '/api/accounts', payload)).statusCode, 200);
  assert.equal((await request(c, '/api/accounts', payload)).statusCode, 409);
  const parent = (
    await app.inject({
      method: 'POST',
      url: '/api/login',
      payload: { email: payload.email, password: payload.password },
    })
  ).headers['set-cookie'].split(';')[0];
  assert.equal((await request(parent, '/api/state')).json().students.length, 0);
  assert.equal(
    (await request(c, '/api/guardians', { studentId: 'alex', guardianEmail: payload.email }))
      .statusCode,
    200,
  );
  assert.equal((await request(parent, '/api/state')).json().students[0].id, 'alex');
  const state = (await request(c, '/api/state')).json();
  assert.ok(state.accounts.some((a) => a.email === payload.email));
  assert.ok(state.accounts.every((a) => !('password' in a)));
  assert.equal(
    (
      await request(parent, '/api/accounts', {
        ...payload,
        email: 'abuse@schoolsync.demo',
        role: 'admin',
      })
    ).statusCode,
    403,
  );
});
test('an enrolled student can be linked to a new independent login', async () => {
  const c = await login('rami');
  await request(c, '/api/students', { name: 'طالب جديد', section: '8A' });
  const s = db.prepare('SELECT * FROM students WHERE name=?').get('طالب جديد');
  assert.equal(
    (
      await request(c, '/api/accounts', {
        name: s.name,
        email: 'newstudent@schoolsync.demo',
        password: 'UniqueTestPassword!2026',
        role: 'student',
        studentId: s.id,
      })
    ).statusCode,
    200,
  );
  const cookie = await login('newstudent', 'UniqueTestPassword!2026');
  const state = (await request(cookie, '/api/state')).json();
  assert.equal(state.students.length, 1);
  assert.equal(state.student.id, s.id);
  assert.equal((await request(cookie, '/api/state?student=alex')).statusCode, 403);
});
test('new weekly lessons are authorized, conflict-checked, and restricted to school hours', async () => {
  const c = await login('rami');
  const l = {
    section: '8A',
    teacherId: 'teacher-demo',
    subject: 'نشاط القراءة',
    room: 'المكتبة',
    weekday: 5,
    start: '09:00',
    end: '09:45',
  };
  assert.equal((await request(c, '/api/lessons', l)).statusCode, 200);
  assert.equal((await request(c, '/api/lessons', l)).statusCode, 409);
  assert.equal(
    (await request(c, '/api/lessons', { ...l, weekday: 6, start: '07:00', end: '07:45' }))
      .statusCode,
    400,
  );
  assert.equal(
    (await request(c, '/api/lessons', { ...l, weekday: 6, teacherId: 'teacher-sibling' }))
      .statusCode,
    400,
  );
  const parent = await login('sarah');
  assert.ok(
    (await request(parent, '/api/state')).json().lessons.some((x) => x.subject === l.subject),
  );
  assert.equal((await request(parent, '/api/lessons', { ...l, weekday: 6 })).statusCode, 403);
});
test('school settings validate timezone and protect existing timetable hours', async () => {
  const c = await login('rami');
  const s = { name: 'مدرسة جديدة', timezone: 'Asia/Amman', start: '08:00', end: '14:00' };
  assert.equal(
    (await request(c, '/api/school', { ...s, timezone: 'Imaginary/Zone' })).statusCode,
    400,
  );
  assert.equal((await request(c, '/api/school', { ...s, end: '12:00' })).statusCode, 409);
  assert.equal((await request(c, '/api/school', s)).statusCode, 200);
  assert.equal((await request(c, '/api/state')).json().school.name, s.name);
});
test('draft publication is authorized and idempotent', async () => {
  const teacher = await login('emma');
  await request(teacher, '/api/grades', {
    studentId: 'alex',
    subject: 'الرياضيات',
    title: 'علامة غير منشورة',
    score: 9,
    max: 10,
    published: false,
  });
  const draft = db.prepare('SELECT * FROM grades WHERE title=?').get('علامة غير منشورة');
  const student = await login();
  assert.equal((await request(student, `/api/grades/${draft.id}/publish`, {})).statusCode, 403);
  assert.equal((await request(teacher, `/api/grades/${draft.id}/publish`, {})).statusCode, 200);
  await request(teacher, `/api/grades/${draft.id}/publish`, {});
  assert.equal(
    db
      .prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND title=?')
      .get('parent-demo', 'تحديث دراسي جديد').n,
    1,
  );
  assert.ok((await request(student, '/api/state')).json().grades.some((g) => g.id === draft.id));
});
test('password changes verify the old password and revoke other sessions', async () => {
  const a = await login(),
    b = await login();
  const p = { currentPassword: 'SchoolSync!2026', newPassword: 'DifferentPassword!2026' };
  assert.equal(
    (await request(a, '/api/password', { ...p, currentPassword: 'wrong' })).statusCode,
    400,
  );
  assert.equal((await request(a, '/api/password', p)).statusCode, 200);
  assert.equal((await request(a, '/api/state')).statusCode, 200);
  assert.equal((await request(b, '/api/state')).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/login',
        payload: { email: 'alex@schoolsync.demo', password: p.newPassword },
      })
    ).statusCode,
    200,
  );
});
test('live changes reach authenticated school connections without publishing student records', async () => {
  const cookie = await login('sarah');
  const teacher = await login('emma');
  await app.ready();
  const socket = await app.injectWS('/api/live', { headers: { cookie } });
  const received = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('No live update received')), 2000);
    socket.once('message', (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString()));
    });
  });
  await request(teacher, '/api/notes', { studentId: 'alex', content: 'ملاحظة متزامنة' });
  assert.deepEqual(await received, { changed: true });
  socket.terminate();
});
async function familyLogin(nationalId = '0000000001', password = 'YousefDemo2026') {
  const r = await app.inject({
    method: 'POST',
    url: '/api/family-login',
    payload: { nationalId, password },
  });
  return r;
}
test('either sibling national ID and independent code opens the same verified family account', async () => {
  const a = await familyLogin();
  const b = await familyLogin('0000000002', 'OmarDemo2026');
  assert.equal(a.statusCode, 200, a.body);
  assert.equal(b.statusCode, 200, b.body);
  assert.equal(a.json().id, 'parent-demo');
  assert.equal(b.json().id, a.json().id);
  assert.equal(a.json().role, 'parent');
  assert.equal(b.json().entryStudentId, 'jamie');
  const cookie = b.headers['set-cookie'].split(';')[0];
  const s = (await request(cookie, '/api/state')).json();
  assert.deepEqual(s.students.map((s) => s.id).sort(), ['alex', 'jamie']);
  assert.equal(s.familyAccess.length, 0);
  assert.ok(!JSON.stringify(s).includes('national_id_hash'));
  assert.ok(!JSON.stringify(s).includes('0000000002'));
  assert.equal((await familyLogin('٠٠٠٠٠٠٠٠٠١', 'YousefDemo2026')).statusCode, 200);
  assert.equal((await familyLogin('0000000001', 'OmarDemo2026')).statusCode, 401);
  assert.equal((await familyLogin('0000009999', 'YousefDemo2026')).statusCode, 401);
});
test('family login fails after verification is revoked, and staff portal rejects family accounts', async () => {
  db.prepare('DELETE FROM guardian_links WHERE guardian_id=? AND student_id=?').run(
    'parent-demo',
    'alex',
  );
  assert.equal((await familyLogin()).statusCode, 401);
  const r = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email: 'sarah@schoolsync.demo', password: 'SchoolSync!2026', portal: 'staff' },
  });
  assert.equal(r.statusCode, 403);
  assert.ok(!r.headers['set-cookie']);
});
test('only school administrators can configure student family access and guardian verification is required', async () => {
  const admin = await login('rami');
  const teacher = await login('emma');
  const p = {
    studentId: 'demo-student-1',
    guardianEmail: 'sarah@schoolsync.demo',
    nationalId: '0000000099',
    code: 'AdamDemo2026',
  };
  assert.equal((await request(teacher, '/api/family-access', p)).statusCode, 403);
  assert.equal((await request(admin, '/api/family-access', p)).statusCode, 400);
  await request(admin, '/api/guardians', {
    studentId: p.studentId,
    guardianEmail: p.guardianEmail,
  });
  assert.equal((await request(admin, '/api/family-access', p)).statusCode, 200);
  assert.equal(
    (await request(admin, '/api/family-access', { ...p, nationalId: '0000000001' })).statusCode,
    409,
  );
  const record = db.prepare('SELECT * FROM family_credentials WHERE student_id=?').get(p.studentId);
  assert.notEqual(record.national_id_hash, p.nationalId);
  assert.notEqual(record.code_hash, p.code);
  const r = await familyLogin(p.nationalId, p.code);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().id, 'parent-demo');
  const state = (await request(r.headers['set-cookie'].split(';')[0], '/api/state')).json();
  assert.equal(state.students.length, 3);
});
test('a family can rotate one child code without changing the sibling code or account', async () => {
  const r = await familyLogin();
  const cookie = r.headers['set-cookie'].split(';')[0];
  const payload = {
    studentId: 'alex',
    currentPassword: 'YousefDemo2026',
    newPassword: 'NewYousef2026',
  };
  assert.equal(
    (await request(cookie, '/api/family-code', { ...payload, currentPassword: 'WrongCode2026' }))
      .statusCode,
    400,
  );
  assert.equal((await request(cookie, '/api/family-code', payload)).statusCode, 200);
  assert.equal((await familyLogin()).statusCode, 401);
  assert.equal((await familyLogin('0000000001', 'NewYousef2026')).statusCode, 200);
  assert.equal((await familyLogin('0000000002', 'OmarDemo2026')).json().id, 'parent-demo');
});
test('school workspace is staff-only and uses teacher assignments instead of the selected family profile', async () => {
  const teacher = await login('emma');
  const teacherState = (await request(teacher, '/api/state')).json();
  assert.ok(teacherState.schoolWorkspace.lessons.length > 0);
  assert.ok(
    teacherState.schoolWorkspace.lessons.every(
      (l) => l.teacher_id === 'teacher-demo' && l.section === '8A',
    ),
  );
  const admin = await login('rami');
  const adminState = (await request(admin, '/api/state')).json();
  assert.ok(adminState.schoolWorkspace.lessons.some((l) => l.section === '6B'));
  assert.ok(adminState.schoolWorkspace.lessons.some((l) => l.section === '8A'));
  const family = await familyLogin();
  const parentState = (
    await request(family.headers['set-cookie'].split(';')[0], '/api/state')
  ).json();
  assert.equal(parentState.schoolWorkspace, null);
  assert.equal(parentState.accounts.length, 0);
  assert.equal(parentState.rosterAttendance.length, 0);
});
