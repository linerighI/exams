import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCropBox } from '../server/cropBox';
test('Gemini empty and reversed boxes do not fail question validation', () => {
  for (const value of [undefined, null, [0, 0, 0, 0]])
    assert.deepEqual(normalizeCropBox(value), {});
  const reversed = normalizeCropBox([0.8, 0.7, 0.1, 0.2]);
  assert.deepEqual(reversed.box, [0.1, 0.2, 0.8, 0.7]);
  assert.ok(reversed.warning);
  for (const value of [[0.1, 0.2, 0.1, 0.7], [0, 0, 500, 500], [NaN, 0, 1, 1], {}, [0, 1]]) {
    assert.equal(normalizeCropBox(value).box, undefined);
    assert.ok(normalizeCropBox(value).warning);
  }
});
