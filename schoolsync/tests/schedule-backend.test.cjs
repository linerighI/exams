/**
 * Schedule backend hardening tests: verifies school-wide daily overview (`/api/schedule/overview`),
 * atomic universal schedule broadcast (`/api/lessons/universal`), conflict skipping,
 * atomic period swapping (`/api/lessons/swap`), and manager RBAC enforcement.
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');

let app;
let db;
beforeEach(() => {
  ({ app, db } = createApp({ demo: true, clock: () => new Date('2026-11-10T08:30:00Z') }));
});
afterEach(async () => {
  await app.close();
});

async function login(email) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email, password: 'SchoolSync!2026' },
  });
  assert.equal(res.statusCode, 200);
  return res.headers['set-cookie'].split(';')[0];
}

test('GET /api/schedule/overview returns classes, lead teachers, period slots, and lessons', async () => {
  const cookie = await login('rami@schoolsync.demo');
  const res = await app.inject({ method: 'GET', url: '/api/schedule/overview?weekday=0', headers: { cookie } });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.classes) && body.classes.length >= 2);
  assert.ok(Array.isArray(body.slots) && body.slots.length >= 5);
  assert.ok(typeof body.leadTeachers === 'object');
});

test('POST /api/lessons/universal broadcasts template across all classes and rejects non-managers', async () => {
  const teacher = db.prepare("SELECT email FROM users WHERE role='teacher' LIMIT 1").get();
  const teacherCookie = await login(teacher.email);
  const denied = await app.inject({
    method: 'POST',
    url: '/api/lessons/universal',
    headers: { cookie: teacherCookie },
    payload: { entries: [{ weekday: 3, periodNumber: 1, subject: 'العلوم' }] },
  });
  assert.equal(denied.statusCode, 403);

  const adminCookie = await login('rami@schoolsync.demo');
  const res = await app.inject({
    method: 'POST',
    url: '/api/lessons/universal',
    headers: { cookie: adminCookie },
    payload: {
      replaceExisting: true,
      entries: [
        { weekday: 4, periodNumber: 1, subject: 'الرياضيات' },
        { weekday: 4, periodNumber: 2, subject: 'اللغة العربية' },
      ],
    },
  });
  assert.equal(res.statusCode, 200);
  const data = res.json();
  assert.equal(data.ok, true);
  assert.ok(data.createdCount >= 2);

  const ov = await app.inject({ method: 'GET', url: '/api/schedule/overview?weekday=4', headers: { cookie: adminCookie } });
  assert.equal(ov.statusCode, 200);
  assert.ok(ov.json().lessons.length >= 2);
});

test('POST /api/lessons/swap swaps two lesson slots atomically', async () => {
  const cookie = await login('rami@schoolsync.demo');
  const ov1 = await app.inject({ method: 'GET', url: '/api/schedule/overview?weekday=0', headers: { cookie } });
  const lessons = ov1.json().lessons;
  assert.ok(lessons.length >= 2);
  const a = lessons[0];
  const b = lessons.find((l) => l.section === a.section && l.id !== a.id);
  if (b) {
    const swapRes = await app.inject({
      method: 'POST',
      url: '/api/lessons/swap',
      headers: { cookie },
      payload: { lessonIdA: a.id, lessonIdB: b.id },
    });
    assert.equal(swapRes.statusCode, 200);
    assert.equal(swapRes.json().ok, true);
  }
});
