/**
 * Automated tests for parametric 3D campus blueprints, geo-anchors, Wi-Fi/BLE beacons,
 * sensor fusion priority, geofence/work-hour privacy gates, and live teacher tracking RBAC.
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');
const { gpsToCampusXZ, matchBeaconRoom, resolveTeacherLocation } = require('../server/location-fusion.cjs');

let app;
let currentClock = () => new Date('2026-11-10T06:30:00Z'); // 09:30 Asia/Amman (school hours)

beforeEach(() => {
  currentClock = () => new Date('2026-11-10T06:30:00Z');
  ({ app } = createApp({ demo: true, clock: () => currentClock() }));
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

function sampleBlueprint() {
  return {
    meta: { version: 1, gridSize: 0.5, unit: 'm', theme: 'apple-clay' },
    floors: [{ id: 'f1', index: 1, labelAr: 'الأول', labelEn: 'Floor 1', elevationY: 0, ceilingHeight: 3.4 }],
    wings: [
      { id: 'w-west', labelAr: 'الغربي', labelEn: 'West', color: '#007aff', floorIds: ['f1'] },
      { id: 'w-admin', labelAr: 'الإدارة', labelEn: 'Admin', color: '#34c759', floorIds: ['f1'] },
    ],
    rooms: [
      {
        id: 'room-8a',
        floorId: 'f1',
        wingId: 'w-west',
        kind: 'classroom',
        label: '8A',
        className: '8A',
        x: -6,
        z: 4,
        width: 6,
        depth: 6,
        points: [
          { x: -3, z: -3 },
          { x: 3, z: -3 },
          { x: 3.5, z: 0 },
          { x: 3, z: 3 },
          { x: -3, z: 3 },
        ],
        rotationY: 0,
        wallHeight: 3.2,
        wallThickness: 0.2,
        wallColor: '#eff6ff',
        floorColor: '#fef9c3',
        roomState: 'note',
        stateNote: 'قاعة اختبار',
        openEdges: [1],
        openings: [{ id: 'd1', wall: 'E', wallIndex: 1, offset: 0.5, width: 2.1, height: 2.35, type: 'double_door' }],
        assignments3D: [],
      },
      {
        id: 'room-teachers',
        floorId: 'f1',
        wingId: 'w-admin',
        kind: 'teachers',
        label: 'غرفة المعلمين',
        className: '',
        x: 6,
        z: -4,
        width: 6,
        depth: 5,
        rotationY: 0,
        wallHeight: 3.2,
        wallThickness: 0.2,
        openings: [],
        assignments3D: [],
      },
    ],
    props: [],
  };
}

test('campus blueprint starts blank, supports draft & publish, and enforces manager RBAC', async () => {
  const admin = await login('rami');
  const teacher = await login('emma');

  const initialState = (await app.inject({ url: '/api/state', headers: { cookie: admin } })).json();
  assert.equal(initialState.campusLayout, null);

  const denied = await app.inject({
    method: 'POST',
    url: '/api/campus-layout',
    headers: { cookie: teacher },
    payload: { status: 'published', layout: sampleBlueprint() },
  });
  assert.equal(denied.statusCode, 403);

  const pub = await app.inject({
    method: 'POST',
    url: '/api/campus-layout',
    headers: { cookie: admin },
    payload: { status: 'published', layout: sampleBlueprint() },
  });
  assert.equal(pub.statusCode, 200, pub.body);

  const afterState = (await app.inject({ url: '/api/state', headers: { cookie: teacher } })).json();
  assert.equal(afterState.campusLayout.rooms.length, 2);
  assert.equal(afterState.campusLayout.rooms[0].id, 'room-8a');
  assert.equal(afterState.campusLayout.rooms[0].openings[0].type, 'double_door');
  assert.equal(afterState.campusLayout.rooms[0].openings[0].wallIndex, 1);
  assert.equal(afterState.campusLayout.rooms[0].points.length, 5);
  assert.deepEqual(afterState.campusLayout.rooms[0].openEdges, [1]);
  assert.equal(afterState.campusLayout.rooms[0].wallColor, '#eff6ff');
  assert.equal(afterState.campusLayout.rooms[0].floorColor, '#fef9c3');
  assert.equal(afterState.campusLayout.rooms[0].roomState, 'note');
  assert.equal(afterState.campusLayout.rooms[0].stateNote, 'قاعة اختبار');
});

test('sensor fusion resolves beacon k-NN, GPS projection, and QR priority deterministically', () => {
  const anchor = { origin_lat: 32.0, origin_lng: 36.0, bearing_deg: 0, scale: 1, geofence_radius_m: 150 };
  const inBounds = gpsToCampusXZ(32.0001, 36.0001, anchor);
  assert.ok(inBounds.x > 5 && inBounds.z < -5);
  assert.equal(inBounds.insideGeofence, true);

  const outOfBounds = gpsToCampusXZ(32.05, 36.05, anchor);
  assert.equal(outOfBounds.insideGeofence, false);

  const beacons = [
    { id: 'b1', room_id: 'room-8a', floor_id: 'f1', beacon_type: 'wifi', identifier: 'AA:BB:CC:11', rssi_ref: -55, x: -6, y: 0, z: 4 },
    { id: 'b2', room_id: 'room-teachers', floor_id: 'f1', beacon_type: 'wifi', identifier: 'AA:BB:CC:22', rssi_ref: -55, x: 6, y: 0, z: -4 },
  ];
  const matched = matchBeaconRoom(
    [{ identifier: 'aa:bb:cc:11', rssi: -56 }, { identifier: 'aa:bb:cc:22', rssi: -88 }],
    beacons,
  );
  assert.equal(matched.roomId, 'room-8a');

  const resolved = resolveTeacherLocation({
    ping: { roomId: 'room-teachers', source: 'qr', beacons: [{ identifier: 'AA:BB:CC:11', rssi: -55 }] },
    prev: null,
    layout: sampleBlueprint(),
    beacons,
    anchor,
    school: { id: 's1' },
    lessons: [{ teacher_id: 'teacher-demo', section: '8A', weekday: 2, start: '09:00', end: '10:00' }],
    teacherId: 'teacher-demo',
    weekday: 2,
    nowMin: 570,
  });
  assert.equal(resolved.roomId, 'room-teachers');
  assert.equal(resolved.source, 'qr');
  assert.equal(resolved.mismatch, true);
  assert.equal(resolved.status, 'mismatch');
});

test('teacher live tracking persists pings, detects mismatch, records trail, and blocks unauthorized reads', async () => {
  const admin = await login('rami');
  const teacher = await login('emma');

  await app.inject({
    method: 'POST',
    url: '/api/campus-layout',
    headers: { cookie: admin },
    payload: { status: 'published', layout: sampleBlueprint() },
  });
  await app.inject({
    method: 'POST',
    url: '/api/campus-geo',
    headers: { cookie: admin },
    payload: { origin_lat: 32.0, origin_lng: 36.0, bearing_deg: 0, scale: 1, geofence_radius_m: 200 },
  });
  await app.inject({
    method: 'POST',
    url: '/api/campus-beacons',
    headers: { cookie: admin },
    payload: { room_id: 'room-8a', floor_id: 'f1', beacon_type: 'wifi', identifier: 'AP-8A-FLOOR1', rssi_ref: -55, x: -6, y: 0, z: 4 },
  });

  // Off-campus GPS ping should be discarded cleanly for privacy
  const outside = (await app.inject({
    method: 'POST',
    url: '/api/presence/ping',
    headers: { cookie: teacher },
    payload: { lat: 32.1, lng: 36.1, accuracy: 10, source: 'gps' },
  })).json();
  assert.equal(outside.paused, 'outside_geofence');

  // Outside school hours passive GPS ping pauses cleanly
  currentClock = () => new Date('2026-11-10T20:00:00Z');
  const offHours = (await app.inject({
    method: 'POST',
    url: '/api/presence/ping',
    headers: { cookie: teacher },
    payload: { lat: 32.0, lng: 36.0, accuracy: 10, source: 'gps' },
  })).json();
  assert.equal(offHours.paused, 'outside_hours');

  // Back in school hours -> Wi-Fi beacon ping places teacher inside room-8a
  currentClock = () => new Date('2026-11-10T06:30:00Z');
  const wifiPing = (await app.inject({
    method: 'POST',
    url: '/api/presence/ping',
    headers: { cookie: teacher },
    payload: { beacons: [{ identifier: 'AP-8A-FLOOR1', rssi: -54 }] },
  })).json();
  assert.equal(wifiPing.presence.room_id, 'room-8a');
  assert.equal(wifiPing.presence.source, 'wifi');

  // QR check-in to teachers lounge switches room and records trail
  const checkin = (await app.inject({
    method: 'POST',
    url: '/api/presence/checkin',
    headers: { cookie: teacher },
    payload: { roomId: 'room-teachers', source: 'qr' },
  })).json();
  assert.equal(checkin.presence.room_id, 'room-teachers');
  assert.equal(checkin.presence.source, 'qr');

  // Teachers cannot read global teacher radar or trails
  const deniedRadar = await app.inject({ url: '/api/presence/teachers', headers: { cookie: teacher } });
  assert.equal(deniedRadar.statusCode, 403);

  // Admin reads live radar + movement trail
  const radar = (await app.inject({ url: '/api/presence/teachers', headers: { cookie: admin } })).json();
  const emma = radar.teachers.find((t) => t.teacher_id === 'teacher-demo');
  assert.equal(emma.room_id, 'room-teachers');

  const trail = (await app.inject({ url: '/api/presence/teachers/teacher-demo/trail', headers: { cookie: admin } })).json();
  assert.equal(trail.points.length, 2);
});
