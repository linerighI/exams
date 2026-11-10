/**
 * SchoolSync First-Run Setup & Configuration Test Suite
 *
 * Verifies that a fresh database requires initial administrative setup,
 * that GET /api/config reflects the operational (non-demo) environment,
 * and that POST /api/setup validates inputs, prevents remote execution,
 * and provisions the first school and admin atomically in memory.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');

test('fresh operational database returns demo: false and setupRequired: true', async () => {
  const { app } = createApp({ allowSetup: true, demo: false });
  try {
    const res = await app.inject('/api/config');
    assert.equal(res.statusCode, 200);
    const config = res.json();
    assert.equal(config.demo, false);
    assert.equal(config.setupRequired, true);
  } finally {
    await app.close();
  }
});

test('config returns setupRequired: false when allowSetup is disabled', async () => {
  const { app } = createApp({ allowSetup: false, demo: false });
  try {
    const res = await app.inject('/api/config');
    assert.equal(res.statusCode, 200);
    const config = res.json();
    assert.equal(config.demo, false);
    assert.equal(config.setupRequired, false);
  } finally {
    await app.close();
  }
});

test('first-run setup provisions school, administrator, and session cookie in memory', async () => {
  const { app, db } = createApp({ allowSetup: true, demo: false });
  try {
    const payload = {
      schoolName: 'مدرسة النهضة الحديثة',
      adminName: 'أحمد الإبراهيمي',
      email: 'principal@nahda.edu',
      password: 'AdminPassword!2026',
      timezone: 'Asia/Amman',
      start: '07:45',
      end: '13:45',
    };

    const res = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload,
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.name, payload.adminName);
    assert.equal(body.role, 'admin');
    assert.ok(body.id);

    // Verify session cookie was set
    const cookie = res.headers['set-cookie'];
    assert.ok(cookie);
    assert.match(cookie, /schoolsync=/);

    // Verify database records in memory
    const userCount = db.prepare('SELECT COUNT(*) n FROM users').get().n;
    const schoolCount = db.prepare('SELECT COUNT(*) n FROM schools').get().n;
    assert.equal(userCount, 1);
    assert.equal(schoolCount, 1);

    const school = db.prepare('SELECT * FROM schools LIMIT 1').get();
    assert.equal(school.name, payload.schoolName);
    assert.equal(school.start_time, '07:45');
    assert.equal(school.end_time, '13:45');

    // Verify subsequent GET /api/config returns setupRequired: false
    const configRes = await app.inject('/api/config');
    assert.equal(configRes.json().setupRequired, false);

    // Verify admin can fetch initial state with 0 students and empty operational tables
    const stateRes = await app.inject({
      method: 'GET',
      url: '/api/state',
      headers: { cookie: cookie.split(';')[0] },
    });
    assert.equal(stateRes.statusCode, 200);
    const state = stateRes.json();
    assert.equal(state.user.role, 'admin');
    assert.equal(state.students.length, 0);
    assert.equal(state.grades.length, 0);
    assert.equal(state.attendance.length, 0);
    assert.equal(state.homework.length, 0);
    assert.equal(state.demo, false);
  } finally {
    await app.close();
  }
});

test('duplicate setup requests are rejected with 409 conflict', async () => {
  const { app } = createApp({ allowSetup: true, demo: false });
  try {
    const payload = {
      schoolName: 'المدرسة الأولى',
      adminName: 'المدير الأول',
      email: 'admin1@school.edu',
      password: 'StrongSecretPassword!2026',
      timezone: 'Asia/Amman',
      start: '08:00',
      end: '14:00',
    };

    const first = await app.inject({ method: 'POST', url: '/api/setup', payload });
    assert.equal(first.statusCode, 200);

    const second = await app.inject({ method: 'POST', url: '/api/setup', payload });
    assert.equal(second.statusCode, 409);
    assert.match(second.json().error, /تم إعداد المدرسة بالفعل/);
  } finally {
    await app.close();
  }
});

test('setup rejects unauthorized or non-local requests', async () => {
  const disabledApp = createApp({ allowSetup: false, demo: false }).app;
  try {
    const payload = {
      schoolName: 'مدرسة تجريبية',
      adminName: 'مدير تجريبي',
      email: 'admin@test.edu',
      password: 'StrongSecretPassword!2026',
      timezone: 'Asia/Amman',
      start: '08:00',
      end: '14:00',
    };

    const resDisabled = await disabledApp.inject({ method: 'POST', url: '/api/setup', payload });
    assert.equal(resDisabled.statusCode, 403);
  } finally {
    await disabledApp.close();
  }

  const enabledApp = createApp({ allowSetup: true, demo: false }).app;
  try {
    const payload = {
      schoolName: 'مدرسة تجريبية',
      adminName: 'مدير تجريبي',
      email: 'admin@test.edu',
      password: 'StrongSecretPassword!2026',
      timezone: 'Asia/Amman',
      start: '08:00',
      end: '14:00',
    };

    const resRemote = await enabledApp.inject({
      method: 'POST',
      url: '/api/setup',
      remoteAddress: '198.51.100.1',
      payload,
    });
    assert.equal(resRemote.statusCode, 403);
  } finally {
    await enabledApp.close();
  }
});

test('setup validates password length, operating hours, and timezone', async () => {
  const { app } = createApp({ allowSetup: true, demo: false });
  try {
    const base = {
      schoolName: 'مدرسة التحقق',
      adminName: 'مدير التحقق',
      email: 'verify@school.edu',
      password: 'ValidPassword!2026',
      timezone: 'Asia/Amman',
      start: '08:00',
      end: '14:00',
    };

    // Password too short (< 12 characters)
    const shortPass = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { ...base, password: 'short' },
    });
    assert.equal(shortPass.statusCode, 400);
    assert.match(shortPass.json().error, /١٢/);

    // End time before start time
    const invalidHours = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { ...base, start: '14:00', end: '08:00' },
    });
    assert.equal(invalidHours.statusCode, 400);
    assert.match(invalidHours.json().error, /نهاية الدوام/);

    // Invalid IANA timezone
    const invalidTz = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { ...base, timezone: 'Mars/Phobos' },
    });
    assert.equal(invalidTz.statusCode, 400);
    assert.match(invalidTz.json().error, /المنطقة الزمنية/);

    // Malformed email
    const invalidEmail = await app.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { ...base, email: 'not-an-email' },
    });
    assert.equal(invalidEmail.statusCode, 400);
  } finally {
    await app.close();
  }
});
