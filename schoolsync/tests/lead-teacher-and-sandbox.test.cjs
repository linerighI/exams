/**
 * Tests for explicit Class Lead Teacher (`مربي الصف`) lock and Isolated Sandbox
 * role-switching (`/api/demo/switch-role` + `seedSandboxCampus`).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');

async function login(app, email) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email, password: 'SchoolSync!2026' },
  });
  assert.equal(res.statusCode, 200);
  return res.headers['set-cookie'].split(';')[0];
}

test('Class Lead Teacher stays locked when an alphabetically earlier teacher teaches a lesson', async () => {
  const { app, db } = createApp({ demo: true, clock: () => new Date('2026-11-10T08:30:00Z') });
  try {
    const cookie = await login(app, 'rami@schoolsync.demo');

    // Create an alphabetically earlier subject teacher ("Aaron Alpha" < "Emma Wilson")
    const createTeacher = await app.inject({
      method: 'POST',
      url: '/api/accounts',
      headers: { cookie },
      payload: {
        name: 'Aaron Alpha',
        email: 'aaron.alpha@schoolsync.demo',
        password: 'SchoolSync!2026',
        role: 'teacher',
        sections: ['6B'],
      },
    });
    assert.equal(createTeacher.statusCode, 200);
    const aaron = db.prepare("SELECT id FROM users WHERE email='aaron.alpha@schoolsync.demo'").get();

    // Assign Aaron to teach a period inside 8A (where Emma Wilson is locked homeroom lead)
    const upsertRes = await app.inject({
      method: 'POST',
      url: '/api/schedule/cell',
      headers: { cookie },
      payload: {
        section: '8A',
        weekday: 4,
        periodNumber: 7,
        action: 'upsert',
        subject: 'التاريخ',
        teacherId: aaron.id,
        color: 'blue',
      },
    });
    assert.equal(upsertRes.statusCode, 200);

    const ov = (await app.inject({ method: 'GET', url: '/api/schedule/overview?weekday=4', headers: { cookie } })).json();
    assert.equal(ov.leadTeachers['8A']?.id, 'teacher-demo');

    // Manager explicitly reassigns lead teacher of 8A to Aaron, verifying explicit endpoint + RBAC
    const cls8A = ov.classes.find((c) => c.name === '8A');
    const teacherCookie = await login(app, 'emma@schoolsync.demo');
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/classes/${cls8A.id}/lead-teacher`,
      headers: { cookie: teacherCookie },
      payload: { teacherId: aaron.id },
    });
    assert.equal(forbidden.statusCode, 403);

    const reassign = await app.inject({
      method: 'POST',
      url: `/api/classes/${cls8A.id}/lead-teacher`,
      headers: { cookie },
      payload: { teacherId: aaron.id },
    });
    assert.equal(reassign.statusCode, 200);

    const stateAfter = (await app.inject({ method: 'GET', url: '/api/state', headers: { cookie } })).json();
    const updated8A = stateAfter.classes.find((c) => c.name === '8A');
    assert.equal(updated8A.lead_teacher_id, aaron.id);
  } finally {
    await app.close();
  }
});

test('Sandbox mode seeds 3D campus + wing isolation and supports 1-click role switching', async () => {
  const { app } = createApp({ demo: true, sandbox: true, clock: () => new Date('2026-11-10T08:30:00Z') });
  try {
    const adminRes = await app.inject({ method: 'POST', url: '/api/demo/switch-role', payload: { role: 'admin' } });
    assert.equal(adminRes.statusCode, 200);
    assert.equal(adminRes.json().role, 'admin');
    const adminCookie = adminRes.headers['set-cookie'].split(';')[0];

    const adminState = (await app.inject({ method: 'GET', url: '/api/state', headers: { cookie: adminCookie } })).json();
    assert.ok(adminState.campusLayout && adminState.campusLayout.rooms.length >= 6);

    const teacherRes = await app.inject({
      method: 'POST',
      url: '/api/demo/switch-role',
      headers: { cookie: adminCookie },
      payload: { role: 'teacher' },
    });
    assert.equal(teacherRes.statusCode, 200);
    assert.equal(teacherRes.json().role, 'teacher');
    const teacherCookie = teacherRes.headers['set-cookie'].split(';')[0];

    const teacherState = (await app.inject({ method: 'GET', url: '/api/state', headers: { cookie: teacherCookie } })).json();
    assert.deepEqual(teacherState.teacherWings, ['west-main']);

    const parentRes = await app.inject({
      method: 'POST',
      url: '/api/demo/switch-role',
      headers: { cookie: teacherCookie },
      payload: { role: 'parent' },
    });
    assert.equal(parentRes.statusCode, 200);
    assert.equal(parentRes.json().role, 'parent');
    assert.equal(parentRes.json().entryStudentId, 'alex');
  } finally {
    await app.close();
  }
});

test('Live (non-demo) server does NOT expose /api/demo/switch-role', async () => {
  const { app } = createApp({ demo: false, allowSetup: true });
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/api/demo/switch-role',
      payload: { role: 'admin' },
    });
    assert.notEqual(res.statusCode, 200);
  } finally {
    await app.close();
  }
});
