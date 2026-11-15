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
    payload: { email: `${email}@schoolsync.demo`, password },
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

test('enrolling a student with or without National ID auto-creates unified <first5>@Alshereqi.Edu login', async () => {
  const admin = await login('rami');
  const teacher = await login('emma');

  // 1. Enroll with National ID immediately -> auto-creates account
  const created = await req(admin, '/api/students', {
    name: 'زيد سامي العلي',
    section: '8A',
    guardianPhone: '0791112233',
    nationalId: '2004567890',
  });
  assert.equal(created.statusCode, 200, created.body);
  assert.equal(created.json().accountCreated, true);
  assert.equal(created.json().defaultPassword, '20045@Alshereqi.Edu');

  const firstLogin = await app.inject({
    method: 'POST',
    url: '/api/family-login',
    payload: { nationalId: '2004567890', password: '20045@Alshereqi.Edu' },
  });
  assert.equal(firstLogin.statusCode, 200, firstLogin.body);
  const studentCookie = firstLogin.headers['set-cookie'].split(';')[0];

  // Absence and announcement reach unified student account & pending notifications API
  const sid = created.json().studentId;
  assert.equal((await req(teacher, '/api/attendance/quick', { studentId: sid, status: 'absent' })).statusCode, 200);
  const pending = (await req(studentCookie, '/api/notifications/pending')).json();
  assert.ok(pending.notifications.some((n) => n.title.includes('تنبيه غياب فوري')));
  assert.equal((await req(studentCookie, '/api/notifications/test', {})).statusCode, 200);

  // 2. Enroll WITHOUT National ID now, assign National ID later -> auto-creates account then
  const pendingStudent = await req(admin, '/api/students', {
    name: 'خالد وليد الحسن',
    section: '8A',
  });
  assert.equal(pendingStudent.statusCode, 200);
  assert.equal(pendingStudent.json().accountCreated, false);

  const laterSid = pendingStudent.json().studentId;
  const assignRes = await req(admin, `/api/students/${laterSid}/national-id`, {
    nationalId: '٢٠٠٩٨١٢٣٤٥',
  });
  assert.equal(assignRes.statusCode, 200, assignRes.body);
  assert.equal(assignRes.json().nationalId, '2009812345');
  assert.equal(assignRes.json().defaultPassword, '20098@Alshereqi.Edu');

  const secondLogin = await app.inject({
    method: 'POST',
    url: '/api/family-login',
    payload: { nationalId: '2009812345', password: '20098@Alshereqi.Edu' },
  });
  assert.equal(secondLogin.statusCode, 200, secondLogin.body);
});

test('admin can auto-sort Jordanian grades (8th before 9th) and manually reorder schedule classes', async () => {
  const admin = await login('rami');
  for (const name of ['التاسع أ', 'العاشر أ', 'الثامن أ', 'السابع أ']) {
    assert.equal((await req(admin, '/api/classes', { name })).statusCode, 200);
  }
  assert.equal((await req(admin, '/api/classes/reorder', { mode: 'auto' })).statusCode, 200);
  const autoOrdered = (await req(admin, '/api/state')).json().classes;
  const names = autoOrdered.map((c) => c.name);
  assert.ok(names.indexOf('السابع أ') < names.indexOf('الثامن أ'));
  assert.ok(names.indexOf('الثامن أ') < names.indexOf('التاسع أ'));
  assert.ok(names.indexOf('التاسع أ') < names.indexOf('العاشر أ'));

  // Manual reverse override persists cleanly
  const reversedIds = [...autoOrdered].reverse().map((c) => c.id);
  assert.equal(
    (await req(admin, '/api/classes/reorder', { mode: 'manual', classIds: reversedIds })).statusCode,
    200,
  );
  const manualOrdered = (await req(admin, '/api/state')).json().classes;
  assert.deepEqual(manualOrdered.map((c) => c.id), reversedIds);
});
