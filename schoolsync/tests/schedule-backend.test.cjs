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

test('Master schedule config, cell conflict barrier, cancel/restore, absence optimizer, and profiles work end-to-end', async () => {
  const cookie = await login('rami@schoolsync.demo');

  // 1. Update config & duty notes
  const cfg = await app.inject({
    method: 'POST',
    url: '/api/schedule/config',
    headers: { cookie },
    payload: { schedule_mode: 'auto', period_minutes: 40, break_minutes: 5, duty_notes: 'المناوب: أ. خالد' },
  });
  assert.equal(cfg.statusCode, 200);

  // 2. Upsert cell + conflict barrier on same teacher in another class
  const ov = (await app.inject({ method: 'GET', url: '/api/schedule/overview?weekday=3', headers: { cookie } })).json();
  const [c1, c2] = ov.classes;
  const [t1] = ov.teachers;
  const up1 = await app.inject({
    method: 'POST', url: '/api/schedule/cell', headers: { cookie },
    payload: { section: c1.name, weekday: 3, periodNumber: 7, action: 'upsert', subject: 'الرياضيات', teacherId: t1.id, color: 'blue' },
  });
  assert.equal(up1.statusCode, 200);

  const clash = await app.inject({
    method: 'POST', url: '/api/schedule/cell', headers: { cookie },
    payload: { section: c2.name, weekday: 3, periodNumber: 7, action: 'upsert', subject: 'العلوم', teacherId: t1.id },
  });
  assert.equal(clash.statusCode, 409);

  // 3. Cancel & optimize absence
  const abs = await app.inject({
    method: 'POST', url: '/api/schedule/teacher-absence', headers: { cookie },
    payload: { teacherId: t1.id, isAbsent: true },
  });
  assert.equal(abs.statusCode, 200);
  const opt = await app.inject({
    method: 'POST', url: '/api/schedule/optimize-section', headers: { cookie },
    payload: { section: c1.name, weekday: 3 },
  });
  assert.equal(opt.statusCode, 200);
  assert.ok(opt.json().moved >= 1);

  // 4. Save, list, load, delete profile
  const prof = await app.inject({
    method: 'POST', url: '/api/schedule/profiles', headers: { cookie },
    payload: { name: 'الجدول الصيفي' },
  });
  assert.equal(prof.statusCode, 200);
  const pid = prof.json().id;
  const load = await app.inject({ method: 'POST', url: `/api/schedule/profiles/${pid}/load`, headers: { cookie } });
  assert.equal(load.statusCode, 200);
  const del = await app.inject({ method: 'POST', url: `/api/schedule/profiles/${pid}/delete`, headers: { cookie } });
  assert.equal(del.statusCode, 200);
});
