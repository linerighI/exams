import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankPrompt } from '../src/bankExchange';
import { atlasCrop, diagramSheet } from '../src/diagramAtlas';
import sharp from 'sharp';
const meta = { title: 'رياضيات عاشر', subject: 'رياضيات', grade: '10', term: 'الأول' };
test('math prompt specifies book-value variants, recalculated keys, constraints, provenance and exact diagram links', () => {
  const prompt = bankPrompt(meta, 30, '10-20', 'متوسط', true, ['single']);
  for (const word of [
    'تغيير القيم فقط',
    'القيم الأصلية',
    'المجال',
    'المثلث',
    'diagramAtlas',
    'atlasBox',
    'لا تكشف الحل',
    'المعلم',
  ])
    assert.ok(prompt.includes(word), word);
  assert.match(bankPrompt(meta, 30, '', 'سهل', false), /لا تولّد رسومًا/);
  assert.doesNotMatch(bankPrompt(meta, 30, '', 'سهل', false), /diagrams.png/);
  assert.match(
    bankPrompt(meta, 30, '', 'سهل', true, ['single'], 'concepts'),
    /أسئلة جديدة على مفاهيم الكتاب/,
  );
});
test('atlas crop coordinates are normalized, bounded, pixel accurate and cannot silently point outside the picture', () => {
  assert.deepEqual(atlasCrop([0.25, 0.1, 0.75, 0.9], 1000, 800), {
    x: 250,
    y: 80,
    width: 500,
    height: 640,
  });
  for (const bad of [
    [-0.1, 0, 1, 1],
    [0, 0, 1.1, 1],
    [0, 0, 0, 1],
    [1, 1, 0, 0],
    [0, 0, NaN, 1],
    ['0', 0, 1, 1],
    [0, 0, 1],
  ])
    assert.throws(() => atlasCrop(bad, 1000, 800));
  assert.throws(() => atlasCrop([0, 0, 1, 1], 10000, 10000));
  assert.throws(() => atlasCrop([0, 0, 0.001, 0.001], 1000, 800));
});
test('combined SVG sheet preserves vector diagrams, includes only question IDs, escapes metadata and rejects executable/remote images', async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 90 L50 10 L90 90 Z" fill="none" stroke="blue"/></svg>';
  const result = diagramSheet(
    [
      { id: 'q-001', svg, text: 'answer must not appear', explanation: 'secret key' },
      { id: 'q-002', svg },
    ],
    '<script>title</script>',
  );
  assert.equal(result.count, 2);
  assert.match(result.svg, /q-001/);
  assert.doesNotMatch(result.svg, /secret key|answer must not appear|<script>/);
  assert.match(result.svg, /&lt;script&gt;/);
  assert.equal(result.boxes['q-001'].length, 4);
  const bitmap = await sharp(Buffer.from(result.svg)).png().toBuffer();
  assert.ok(bitmap.length > 1000);
  assert.throws(() => diagramSheet([{ id: 'x', image: 'https://example.com/image.png' }]));
  assert.throws(() => diagramSheet([{ id: 'x', svg: '<svg><script>alert(1)</script></svg>' }]));
  assert.throws(() =>
    diagramSheet([
      { id: 'x', svg },
      { id: 'x', svg },
    ]),
  );
});
