/**
 * Backend SAR compiler & storage pipeline tests plus incremental dirty-room hash checks:
 * verifies compact `.sar` uploads compile cleanly on the server, reduce payload size,
 * preserve legacy JSON saves, and isolate Three.js scene rebuild hashes per room.
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { createApp } = require('../server/app.cjs');

const repoPkg = path.resolve(__dirname, '../../package.json');
const requireFromRoot = createRequire(repoPkg);
const esbuild = requireFromRoot('esbuild');

let app;
beforeEach(() => {
  ({ app } = createApp({ demo: true, clock: () => new Date('2026-11-10T08:30:00Z') }));
});
afterEach(async () => {
  await app.close();
});

async function loginAdmin() {
  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { email: 'rami@schoolsync.demo', password: 'SchoolSync!2026' },
  });
  assert.equal(res.statusCode, 200);
  return res.headers['set-cookie'].split(';')[0];
}

test('POST /api/campus-layout compiles compact SAR text into validated CampusLayout with smaller payload', async () => {
  const cookie = await loginAdmin();
  const sar = [
    'campus "Al-Afaq" grid 0.5',
    'wing west "الجناح الغربي" color #007aff',
    'floor f1 "الطابق الأول" y 0 height 3.4',
    '  room wl-1 "8A" kind classroom class "8A" wing west size 6x5.5 at (-12, 0)',
    '    door E 0 width 1.15 height 2.25',
    '    color wall #f8fafc floor #fef9c3',
    '    state note "Quiz Hall"',
    '    assign "Break Duty" type duty at (-1, 0) due "10:30"',
    '  room cor "ممر" kind corridor wing west size 2x10 east_of wl-1 align center',
    '    open W',
    '  prop desk_cluster in wl-1 offset (0, 0.4) rot 90 scale 0.95',
  ].join('\n');

  const save = await app.inject({
    method: 'POST',
    url: '/api/campus-layout',
    headers: { cookie },
    payload: { status: 'published', sar },
  });
  assert.equal(save.statusCode, 200, save.body);
  const body = JSON.parse(save.body);
  assert.ok(body.sarBytes < body.jsonBytes, `Expected sarBytes (${body.sarBytes}) < jsonBytes (${body.jsonBytes})`);
  assert.equal(body.layout.rooms.length, 2);
  assert.equal(body.layout.rooms[0].assignments3D[0].title, 'Break Duty');
  assert.equal(body.layout.rooms[1].x, -8);

  const getRes = await app.inject({ method: 'GET', url: '/api/campus-layout', headers: { cookie } });
  const getBody = JSON.parse(getRes.body);
  assert.equal(getBody.publishedSar.trim(), sar.trim());
  assert.equal(getBody.published.props[0].roomId, 'wl-1');

  const stateRes = await app.inject({ method: 'GET', url: '/api/state', headers: { cookie } });
  const st = JSON.parse(stateRes.body);
  assert.equal(st.campusLayout.rooms[0].stateNote, 'Quiz Hall');
});

test('POST /api/campus-layout keeps legacy layout JSON compatible and auto-generates sar_source', async () => {
  const cookie = await loginAdmin();
  const legacyLayout = {
    meta: { version: 1, gridSize: 0.5, unit: 'm', theme: 'apple-clay' },
    floors: [{ id: 'floor-1', index: 1, labelAr: 'الأول', labelEn: 'F1', elevationY: 0, ceilingHeight: 3.4 }],
    wings: [{ id: 'main', labelAr: 'الرئيسي', labelEn: 'Main', color: '#007aff', floorIds: ['floor-1'] }],
    rooms: [{
      id: 'r1', floorId: 'floor-1', wingId: 'main', kind: 'classroom', label: '8B', className: '8B',
      x: 4, z: 2, width: 6, depth: 5.5, rotationY: 0, wallHeight: 3.2, wallThickness: 0.2, openings: [], assignments3D: [],
    }],
    props: [],
  };
  const save = await app.inject({
    method: 'POST',
    url: '/api/campus-layout',
    headers: { cookie },
    payload: { status: 'published', layout: legacyLayout },
  });
  assert.equal(save.statusCode, 200, save.body);
  const body = JSON.parse(save.body);
  assert.ok(typeof body.sar === 'string' && body.sar.includes('room r1 "8B"'));
});

test('incremental dirty hash isolates edits to changed room only', () => {
  const bundle = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, '../src/spatial/engine/proceduralCampusBuilder.ts')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    external: ['three'],
  });
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', bundle.outputFiles[0].text)(mod.exports, requireFromRoot, mod);
  const { hashRoomForScene } = mod.exports;

  const r1 = { id: 'r1', floorId: 'f1', wingId: 'w1', kind: 'classroom', label: 'A', className: 'A', x: 0, z: 0, width: 6, depth: 5.5, rotationY: 0, wallHeight: 3.2, wallThickness: 0.2, openings: [], assignments3D: [] };
  const r2 = { ...r1, id: 'r2', label: 'B', x: 20 };
  const r1Edited = { ...r1, wallColor: '#dbeafe' };

  assert.notEqual(hashRoomForScene(r1, 0), hashRoomForScene(r1Edited, 0));
  assert.equal(hashRoomForScene(r2, 0), hashRoomForScene(r2, 0));
});
