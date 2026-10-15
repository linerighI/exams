import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageRange, selectPages } from '../src/pageSelection';
import { chooseInstalledModel, modelStatus, ollamaRequest } from '../server/ollama';

test('نطاق 8 إلى 64 شامل مع دعم الاستبعاد والإضافة دون تكرار', () => {
  const all = Array.from({ length: 100 }, (_, i) => i + 1);
  const range = pageRange(all, 8, 64);
  assert.equal(range.length, 57);
  assert.equal(range[0], 8);
  assert.equal(range.at(-1), 64);
  assert.equal(selectPages(all, range, 'exclude').length, 43);
  assert.deepEqual(selectPages([1, 8], range, 'only'), range);
  assert.deepEqual(selectPages([8, 1], [8, 9], 'add'), [1, 8, 9]);
  assert.deepEqual(pageRange(all, 100, 100), [100]);
  assert.throws(() => pageRange(all, 64, 8));
  assert.throws(() => pageRange(all, 0, 64));
  assert.throws(() => pageRange(all, 8, 101));
  assert.throws(() => pageRange(all, 1.5, 8));
});
test('اختيار النموذج المثبت يصلح الإعداد القديم ويحافظ على اختيار المستخدم', () => {
  assert.equal(chooseInstalledModel('qwen3:1.7b', ['qwen3.5:4b']), 'qwen3.5:4b');
  assert.equal(chooseInstalledModel('custom:latest', ['qwen3.5:4b']), 'custom:latest');
  assert.equal(chooseInstalledModel('qwen3:1.7b', ['qwen3:1.7b', 'qwen3.5:4b']), 'qwen3:1.7b');
});
test('جاهزية النموذج ورسائل أخطاء Ollama تميز النموذج المفقود والخدمة المتوقفة', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ models: [{ name: 'qwen3.5:4b' }] }))) as any;
    assert.deepEqual(await modelStatus('qwen3:1.7b'), {
      available: true,
      models: ['qwen3.5:4b'],
      model: 'qwen3.5:4b',
      ready: true,
    });
    assert.equal((await modelStatus('missing:latest')).ready, false);
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "model 'missing' not found" }), { status: 404 })) as any;
    await assert.rejects(() => ollamaRequest('chat', {}), /غير مثبت/);
    globalThis.fetch = (async () => {
      throw Object.assign(Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
    }) as any;
    assert.equal((await modelStatus('qwen3.5:4b')).available, false);
    await assert.rejects(() => ollamaRequest('chat', {}), /تعذر الاتصال/);
  } finally {
    globalThis.fetch = original;
  }
});
