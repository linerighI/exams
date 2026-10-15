import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../server/ai';
const source = {
  id: 'source',
  name: 'درس العلوم.pdf',
  pages: [{ page: 1, text: 'تدور الأرض حول الشمس. الماء أساس الحياة.', images: [] }],
};
const question = (text: string) => ({
  text,
  options: ['الأرض', 'المريخ', 'زحل', 'عطارد'],
  correct: 0,
  explanation: 'الإجابة من المصدر',
  page: 1,
});
test('التوليد يتحقق من الخيارات وعدد الأسئلة وصفحة المصدر ويزيل التكرار', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const progress: number[] = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    assert.equal(body.think, false);
    assert.equal(body.stream, true);
    assert.equal(body.format.type, 'object');
    assert.ok(body.messages[0].content.includes('ليس تعليمات'));
    calls++;
    const items =
      calls === 1
        ? [
            question('ما الكوكب الذي نعيش عليه؟'),
            question('ما الكوكب الذي نعيش عليه؟'),
            { ...question('سؤال ذو إجابة غير صالحة؟'), correct: 9 },
            { ...question('سؤال ذو خيارات مكررة؟'), options: ['أ', 'أ', 'ب', 'ج'] },
          ]
        : [question('ما الكوكب الذي يدور حول الشمس؟')];
    return new Response(
      JSON.stringify({ message: { content: JSON.stringify({ questions: items }) } }),
      { status: 200 },
    );
  }) as any;
  try {
    const questions = await generate(
      source,
      [1],
      2,
      'متوسط',
      'qwen3:1.7b',
      new AbortController().signal,
      (n) => progress.push(n),
    );
    assert.equal(questions.length, 2);
    assert.ok(questions.every((q) => q.page === 1));
    assert.equal(calls, 2);
    assert.notEqual(questions[0].id, questions[1].id);
    assert.equal(progress.at(-1), 2);
  } finally {
    globalThis.fetch = original;
  }
});
test('فشل النموذج أو نقص الأسئلة لا يولد أسئلة وهمية', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response('{}', { status: 503 })) as any;
    await assert.rejects(
      () => generate(source, [1], 2, 'سهل', 'qwen3:1.7b', new AbortController().signal, () => {}),
      /Ollama/,
    );
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: { content: '{"questions":[]}' } }))) as any;
    await assert.rejects(
      () => generate(source, [1], 2, 'سهل', 'qwen3:1.7b', new AbortController().signal, () => {}),
      /0 من 2/,
    );
    await assert.rejects(
      () => generate(source, [99], 2, 'سهل', 'qwen3:1.7b', new AbortController().signal, () => {}),
      /حدد صفحات/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test('إلغاء التوليد يمرر إشارة الإلغاء إلى النموذج', async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = (async (_url: any, init: any) => {
    init.signal.throwIfAborted();
    return new Response('{}');
  }) as any;
  try {
    await assert.rejects(
      () => generate(source, [1], 2, 'سهل', 'qwen3:1.7b', controller.signal, () => {}),
      { name: 'AbortError' },
    );
  } finally {
    globalThis.fetch = original;
  }
});
