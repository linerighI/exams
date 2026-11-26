/**
 * Unit and round-trip tests for the SAR (Spatial Architectural Representation)
 * parser, relative-anchor solver, adjacency merge resolver, and bidirectional serializer.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');

const repoPkg = path.resolve(__dirname, '../../package.json');
const requireFromRoot = createRequire(repoPkg);
const esbuild = requireFromRoot('esbuild');

function loadSarModules() {
  const entrySrc = `
    export { parseSar } from './sarParser.ts';
    export { compileSarToLayout } from './sarCompiler.ts';
    export { serializeLayoutToSar } from './sarSerializer.ts';
    export { SAR_TEMPLATES } from './sarTemplates.ts';
  `;
  const out = esbuild.buildSync({
    stdin: {
      contents: entrySrc,
      resolveDir: path.resolve(__dirname, '../src/spatial/sar'),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
  });
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', out.outputFiles[0].text);
  fn(mod.exports, requireFromRoot, mod);
  return mod.exports;
}

const { compileSarToLayout, serializeLayoutToSar, SAR_TEMPLATES } = loadSarModules();

test('all built-in SAR templates compile cleanly with zero errors or warnings', () => {
  assert.ok(SAR_TEMPLATES.length >= 4);
  for (const tpl of SAR_TEMPLATES) {
    const res = compileSarToLayout(tpl.source, 'ar');
    assert.deepEqual(res.diagnostics, [], `Diagnostics in ${tpl.id}: ${JSON.stringify(res.diagnostics)}`);
    assert.ok(res.layout.rooms.length >= 2, `Expected rooms in ${tpl.id}`);
  }
});

test('relative flush placement (east_of/south_of/align) computes exact 0.00m adjacency', () => {
  const src = `
    campus "Flush Test"
    floor f1 "F1" y 0 height 3.4
      room base "Base" kind classroom size 6x5.5 at (0, 0)
      room rightRoom "Right" kind corridor size 2x11 east_of base align start
        merge base
      room southRoom "South" kind reception size 6x4 south_of base align center gap 0.5
  `;
  const res = compileSarToLayout(src, 'en');
  assert.equal(res.diagnostics.length, 0);
  const byId = new Map(res.layout.rooms.map((r) => [r.id, r]));
  assert.equal(byId.get('rightRoom').x, 4);
  assert.equal(byId.get('rightRoom').z, 2.75);
  assert.equal(byId.get('southRoom').x, 0);
  assert.equal(byId.get('southRoom').z, 5.25);
  assert.ok(byId.get('rightRoom').openEdges.includes(3), 'Expected west wall edge (3) merged against base');
});

test('row generator, opening clamping, custom polygon shapes, and props in rooms work together', () => {
  const src = `
    campus "Wing Builder"
    wing west "West" color #007aff
    floor f1 "F1" y 0 height 3.4
      row 3 classroom "Room" prefix r_ wing west start (-10, -6) step (0, 6) size 6x5.5 door E window W
      room poly "Hex Hall" kind auditorium at (5, 2)
        shape [(-4, -3), (4, -3), (5, 0), (3, 3.5), (-4, 3.5)]
        door 0 99 width 1.2
        color wall #eef2ff floor #dbeafe
        state note "Exam Wing"
      prop desk_cluster in r_1 offset (0, 0.4) rot 90 scale 0.9
  `;
  const res = compileSarToLayout(src, 'en');
  assert.equal(res.diagnostics.length, 0);
  assert.equal(res.layout.rooms.length, 4);
  const poly = res.layout.rooms.find((r) => r.id === 'poly');
  assert.ok(poly && poly.points.length === 5);
  assert.ok(Math.abs(poly.openings[0].offset) < 4, `Opening offset should clamp safely, got ${poly.openings[0].offset}`);
  assert.equal(poly.roomState, 'note');
  assert.equal(poly.stateNote, 'Exam Wing');
  const desk = res.layout.props[0];
  assert.equal(desk.roomId, 'r_1');
  assert.equal(desk.x, -10);
  assert.equal(desk.z, -5.6);
});

test('invalid SAR statements produce line-numbered diagnostics without throwing', () => {
  const src = `
    campus "Broken"
    unknown_keyword foo bar
    room lonely "Test" south_of missing_target
  `;
  const res = compileSarToLayout(src, 'en');
  assert.ok(res.diagnostics.some((d) => d.line === 3 && d.severity === 'error'));
  assert.ok(res.diagnostics.some((d) => d.line === 4 && d.severity === 'error'));
  assert.equal(res.layout.rooms.length, 1);
});

test('bidirectional serialize -> compile round-trip preserves architecture stats', () => {
  const first = compileSarToLayout(SAR_TEMPLATES[0].source, 'ar');
  const sarText = serializeLayoutToSar(first.layout);
  const second = compileSarToLayout(sarText, 'ar');
  assert.equal(second.diagnostics.length, 0, JSON.stringify(second.diagnostics));
  assert.equal(second.stats.floors, first.stats.floors);
  assert.equal(second.stats.rooms, first.stats.rooms);
  assert.equal(second.stats.props, first.stats.props);
  assert.equal(second.stats.openings, first.stats.openings);
});
