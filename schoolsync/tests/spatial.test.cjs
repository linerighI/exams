/**
 * Automated tests for 3D spatial room labeling (`/api/spatial-rooms`)
 * and teacher wing isolation persistence (`teacher_wings`).
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');

let app;

beforeEach(() => {
  ({ app } = createApp({ demo: true, clock: () => new Date('2026-11-10T08:30:00Z') }));
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

test('principal can label spatial rooms and teachers cannot mutate them', async () => {
  const teacher = await login('emma');
  const denied = await app.inject({
    method: 'POST',
    url: '/api/spatial-rooms',
    headers: { cookie: teacher },
    payload: {
      slot_id: 'wm-1',
      label: 'التاسع أ',
      kind: 'classroom',
      class_name: '8A',
      wing: 'west-main',
    },
  });
  assert.equal(denied.statusCode, 403);

  const admin = await login('rami');
  const saved = await app.inject({
    method: 'POST',
    url: '/api/spatial-rooms',
    headers: { cookie: admin },
    payload: {
      slot_id: 'wm-1',
      label: 'التاسع أ — الجناح الغربي',
      kind: 'classroom',
      class_name: '8A',
      wing: 'west-main',
    },
  });
  assert.equal(saved.statusCode, 200, saved.body);

  const state = (await app.inject({ url: '/api/state', headers: { cookie: admin } })).json();
  const slot = state.spatialRooms.find((r) => r.slot_id === 'wm-1');
  assert.equal(slot.label, 'التاسع أ — الجناح الغربي');
  assert.equal(slot.class_name, '8A');
  assert.equal(slot.wing, 'west-main');
});

test('teacher wing assignments persist and expose teacherWings on /api/state', async () => {
  const admin = await login('rami');
  const upd = await app.inject({
    method: 'POST',
    url: '/api/teachers/teacher-demo/assignments',
    headers: { cookie: admin },
    payload: {
      classes: ['8A'],
      subjects: ['Mathematics'],
      wings: ['west-main'],
    },
  });
  assert.equal(upd.statusCode, 200, upd.body);

  const teacher = await login('emma');
  const teacherState = (await app.inject({ url: '/api/state', headers: { cookie: teacher } })).json();
  assert.deepEqual(teacherState.teacherWings, ['west-main']);
});
