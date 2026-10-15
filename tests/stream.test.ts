import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ollamaRequest } from '../server/ollama';
import { generate } from '../server/ai';

const streamResponse = (lines: any[]) => {
  const bytes = new TextEncoder().encode(lines.map((line) => JSON.stringify(line)).join('\n'));
  return new Response(
    new ReadableStream({
      start(controller) {
        // Deliberately split Arabic UTF-8 characters and NDJSON lines across chunks.
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } },
  );
};
test('بث Ollama يجمع أجزاء العربية ويفحص اكتمال الرد ويبلغ عن تقدم الكتابة', async () => {
  const original = globalThis.fetch;
  const updates: number[] = [];
  try {
    globalThis.fetch = (async (_url: any, init: any) => {
      assert.ok(init.dispatcher);
      return streamResponse([
        { message: { content: 'سؤال ' }, done: false },
        { message: { content: 'عربي' }, done: true },
      ]);
    }) as any;
    const result = await ollamaRequest(
      'chat',
      { stream: true },
      new AbortController().signal,
      (n) => updates.push(n),
    );
    assert.equal(result.message.content, 'سؤال عربي');
    assert.equal(updates.at(-1), 9);
    globalThis.fetch = (async () =>
      streamResponse([{ message: { content: 'ناقص' }, done: false }])) as any;
    await assert.rejects(() => ollamaRequest('chat', {}), /قبل اكتماله/);
    globalThis.fetch = (async () =>
      streamResponse([{ error: 'requires more system memory' }])) as any;
    await assert.rejects(() => ollamaRequest('chat', {}), /ذاكرة الجهاز/);
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_HEADERS_TIMEOUT' } });
    }) as any;
    await assert.rejects(() => ollamaRequest('chat', {}), /مهلة انتظار النموذج/);
  } finally {
    globalThis.fetch = original;
  }
});
test('الأسئلة المكتملة تبقى متاحة عند فشل طلب لاحق والمختلط يوزع الصعوبة', async () => {
  const original = globalThis.fetch;
  const levels: string[] = [];
  const partial: any[] = [];
  let calls = 0;
  try {
    globalThis.fetch = (async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      assert.equal(body.options.num_thread, 4);
      levels.push(body.messages[1].content);
      if (++calls === 3) throw Object.assign(Error('reset'), { code: 'ECONNRESET' });
      return streamResponse([
        {
          message: {
            content: JSON.stringify({
              questions: [
                {
                  text: `ما إجابة السؤال التجريبي رقم ${calls}؟`,
                  options: ['أ', 'ب', 'ج', 'د'],
                  correct: 0,
                  explanation: 'من النص',
                  page: calls,
                },
              ],
            }),
          },
          done: true,
        },
      ]);
    }) as any;
    await assert.rejects(
      () =>
        generate(
          {
            id: 's',
            name: 's',
            pages: [1, 2, 3].map((page) => ({ page, text: 'نص دراسي عربي', images: [] })),
          },
          [1, 2, 3],
          3,
          'مختلط',
          'qwen3.5:4b',
          new AbortController().signal,
          (_n, _message, questions) => {
            if (questions) partial.push(questions);
          },
        ),
      /انقطع الاتصال/,
    );
    assert.equal(partial.at(-1).length, 2);
    assert.deepEqual(
      partial.at(-1).map((q: any) => q.difficulty),
      ['سهل', 'متوسط'],
    );
    assert.ok(levels[2].includes('بصعوبة صعب'));
  } finally {
    globalThis.fetch = original;
  }
});
