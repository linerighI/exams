const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');

let app, db;

beforeEach(() => {
  ({ app, db } = createApp({ demo: true, clock: () => new Date('2026-11-10T08:30:00Z') }));
});

afterEach(async () => {
  await app.close();
});

async function login(email, password = 'SchoolSync!2026') {
  const r = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email: email.includes('@') ? email : `${email}@schoolsync.demo`, password },
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.headers['set-cookie'].split(';')[0];
}

function req(cookie, url, payload) {
  return app.inject({
    method: payload === undefined ? 'GET' : 'POST',
    url,
    headers: { cookie },
    payload,
  });
}

test('assistant principal has full school administration permissions while teachers cannot administer', async () => {
  const assistant = await login('tareq');
  const teacher = await login('emma');

  assert.equal(
    (await req(teacher, '/api/classes', { name: '9C', location: 'Floor 2' })).statusCode,
    403,
  );
  assert.equal(
    (await req(assistant, '/api/classes', { name: 'الصف التاسع - ج', location: 'الطابق الثاني' })).statusCode,
    200,
  );
  assert.equal(
    (await req(assistant, '/api/subjects', { name: 'علوم الأرض', description: 'التاسع والعاشر', color: 'mint' })).statusCode,
    200,
  );
  assert.equal(
    (
      await req(assistant, '/api/teachers/teacher-demo/assignments', {
        classes: ['8A', 'الصف التاسع - ج'],
        subjects: ['الرياضيات', 'علوم الأرض'],
      })
    ).statusCode,
    200,
  );

  // Teacher can now see newly assigned class in state and schedule lessons for both classes
  const tState = (await req(teacher, '/api/state')).json();
  assert.ok(tState.teachers.some((t) => t.id === 'teacher-demo' && t.classes.includes('الصف التاسع - ج')));
  assert.equal(
    (
      await req(assistant, '/api/school', {
        name: 'مدرسة تجريبية',
        timezone: 'Asia/Amman',
        start: '08:00',
        end: '15:00',
        periodMinutes: 45,
        breakMinutes: 5,
        periodCount: 8,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await req(assistant, '/api/lessons', {
        section: 'الصف التاسع - ج',
        teacherId: 'teacher-demo',
        subject: 'علوم الأرض',
        room: 'مختبر ١',
        weekday: 5,
        periodNumber: 2,
      })
    ).statusCode,
    200,
  );
});

test('1-tap quick attendance and behavior notes notify parents immediately over live state and WebSocket', async () => {
  const teacher = await login('emma');
  const parent = await login('sarah');
  await app.ready();
  const socket = await app.injectWS('/api/live', { headers: { cookie: parent } });

  const wsPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Expected live WS notification')), 2000);
    socket.once('message', (msg) => {
      clearTimeout(t);
      resolve(JSON.parse(msg.toString()));
    });
  });

  const absRes = await req(teacher, '/api/attendance/quick', {
    studentId: 'alex',
    status: 'absent',
  });
  assert.equal(absRes.statusCode, 200, absRes.body);
  assert.equal((await wsPromise).changed, true);

  // Repeating the same absent mark does not duplicate parent absence notification
  await req(teacher, '/api/attendance/quick', { studentId: 'alex', status: 'absent' });

  await req(teacher, '/api/notes', {
    studentId: 'alex',
    category: 'behavior',
    content: 'تعاون رائع مع زملائه في حصة الرياضيات',
  });

  const parentState = (await req(parent, '/api/state')).json();
  const absenceNotifs = parentState.notifications.filter((n) => n.title === 'تنبيه غياب فوري');
  const noteNotifs = parentState.notifications.filter((n) => n.title.startsWith('ملاحظة سلوكية'));
  assert.equal(absenceNotifs.length, 1);
  assert.equal(noteNotifs.length, 1);
  assert.equal(parentState.student.last_absence, '2026-11-10');

  socket.close();
});

test('multi-class teacher authorization isolates unassigned sections', async () => {
  const teacher = await login('emma');
  assert.equal(
    (await req(teacher, '/api/attendance/quick', { studentId: 'jamie', status: 'absent' })).statusCode,
    403,
  );
  assert.equal(
    (await req(teacher, '/api/notes', { studentId: 'jamie', content: 'Unauthorized note' })).statusCode,
    403,
  );
});
