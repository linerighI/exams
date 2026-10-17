import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pcm16FromChunks, speechChunks } from '../src/speechAudio';

test('speech PCM conversion clips, sanitizes and preserves chunk order', () => {
  const bytes = pcm16FromChunks([new Float32Array([-2, 0]), new Float32Array([2, NaN])], 16000);
  const view = new DataView(bytes.buffer);
  assert.deepEqual(
    [0, 2, 4, 6].map((i) => view.getInt16(i, true)),
    [-32768, 0, 32767, 0],
  );
  assert.throws(() => pcm16FromChunks([], 0));
});
test('speech resampling uses source sample rate and enforces 30 second limit', () => {
  assert.equal(pcm16FromChunks([new Float32Array(48000)], 48000).length, 32000);
  assert.equal(pcm16FromChunks([new Float32Array(16000 * 31)], 16000).length, 960000);
});
test('readback removes markup and bounds every native synthesis request', () => {
  assert.equal(
    speechChunks('**مرحبا** ```secret code``` <b>أستاذي</b>').join(' ').replace(/\s+/g, ' '),
    'مرحبا أستاذي',
  );
  const chunks = speechChunks('كلمة '.repeat(400));
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((part) => part.length > 0 && part.length <= 600));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), 'كلمة '.repeat(400).trim());
});
