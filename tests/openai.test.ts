import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { openaiGenerate } from '../server/openai';
import { createApp } from '../server/app';
import { generate } from '../server/ai';
const response = (content: any) =>
  new Response(
    JSON.stringify({
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(content) }] },
      ],
      usage: { input_tokens: 20, output_tokens: 10 },
    }),
  );
test('OpenAI uses structured Responses requests, image inputs, optional fields and safe failures', async () => {
  const original = globalThis.fetch;
  try {
    const schema = z.toJSONSchema(
      z.object({
        reply: z.string(),
        page: z.string().optional(),
        box: z.array(z.number()).nullable(),
      }),
    );
    globalThis.fetch = (async (url: any, init: any) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.headers.Authorization, 'Bearer secret-test');
      const body = JSON.parse(init.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.deepEqual(body.text.format.schema.required, ['reply', 'page', 'box']);
      assert.equal(body.input[0].content[1].type, 'input_image');
      assert.equal(body.input[0].content[1].image_url, 'data:image/png;base64,aGVsbG8=');
      return response({ reply: 'رد', page: null, box: null });
    }) as any;
    const result = await openaiGenerate(
      'gpt-4.1-mini',
      'secret-test',
      'system',
      'prompt',
      schema,
      new AbortController().signal,
      [{ mimeType: 'image/png', data: 'aGVsbG8=' }],
    );
    assert.deepEqual(JSON.parse(result.message.content), { reply: 'رد', box: null });
    for (const status of [401, 403, 404, 429, 500]) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: { message: 'secret-test' } }), { status })) as any;
      await assert.rejects(
        () =>
          openaiGenerate(
            'gpt-4.1-mini',
            'secret-test',
            's',
            'p',
            schema,
            new AbortController().signal,
          ),
        (e) => e instanceof Error && !e.message.includes('secret-test'),
      );
    }
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: 'incomplete', output: [] }))) as any;
    await assert.rejects(
      () =>
        openaiGenerate(
          'gpt-4.1-mini',
          'secret-test',
          's',
          'p',
          schema,
          new AbortController().signal,
        ),
      /غير مكتمل/,
    );
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] }),
      )) as any;
    await assert.rejects(
      () =>
        openaiGenerate(
          'gpt-4.1-mini',
          'secret-test',
          's',
          'p',
          schema,
          new AbortController().signal,
        ),
      /تعذر/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test('provider selection routes chat, graph generation and prompt rewriting to OpenAI and never exports keys', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'openai-school-'));
  const server = await createApp({ directory });
  const original = globalThis.fetch;
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Openai-test123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Openai-test123' })
    ).json().token;
    const config = (await call('/api/settings', 'GET', undefined, token)).json();
    const saved = (
      await call(
        '/api/settings',
        'PUT',
        { ...config, aiProvider: 'openai', openaiKey: 'secret-openai-key' },
        token,
      )
    ).json();
    assert.equal(saved.hasOpenaiKey, true);
    assert.equal(saved.openaiKey, undefined);
    const status = (await call('/api/assistant/status', 'GET', undefined, token)).json();
    assert.equal(status.provider, 'openai');
    assert.equal(status.ready, true);
    let requests = 0;
    globalThis.fetch = (async (url: any, init: any) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.headers.Authorization, 'Bearer secret-openai-key');
      requests++;
      const body = JSON.parse(init.body);
      if (body.instructions.includes('وصفًا هندسيًا'))
        return response({ objects: [{ type: 'function', name: 'f', coefficients: [0, 0, 1] }] });
      if (body.instructions.includes('محرر طلبات'))
        return response({
          prompt: 'طلب تعليمي منظم يطلب بنك الأسئلة كاملًا مع الإجابات ومصادرها للمراجعة.',
        });
      return response({ action: 'reply', reply: 'يمكن مراجعة المفاهيم ثم حل أمثلة متدرجة.' });
    }) as any;
    assert.equal(
      (
        await call(
          '/api/assistant/messages',
          'POST',
          { message: 'اشرح كيف أساعد الطالب في فهم الكسور' },
          token,
        )
      ).statusCode,
      200,
    );
    const geometry = await call(
      '/api/geometry/generate',
      'POST',
      { prompt: 'ارسم منحنى x^2' },
      token,
    );
    assert.equal(geometry.statusCode, 200);
    assert.equal(geometry.json().objects[0].type, 'function');
    assert.equal(
      (
        await call(
          '/api/bank/prompt/rewrite',
          'POST',
          {
            prompt: 'هذا طلب تعليمي لبنك الأسئلة مع الإجابات الصحيحة ومصادر كل سؤال.',
            instructions: 'اجعل الشرح أوضح',
          },
          token,
        )
      ).statusCode,
      200,
    );
    assert.equal(requests, 3);
    assert.ok(
      !JSON.stringify((await call('/api/backup', 'GET', undefined, token)).json()).includes(
        'secret-openai-key',
      ),
    );
    assert.ok(
      !readFileSync(join(directory, 'school.sqlite')).includes(Buffer.from('secret-openai-key')),
    );
    const backup = (await call('/api/backup', 'GET', undefined, token)).json();
    assert.equal((await call('/api/restore', 'POST', backup, token)).statusCode, 200);
    const again = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Openai-test123' })
    ).json().token;
    assert.equal((await call('/api/settings', 'GET', undefined, again)).json().hasOpenaiKey, true);
    await call('/api/settings', 'PUT', { ...saved, clearOpenaiKey: true }, again);
    assert.equal(
      (await call('/api/assistant/status', 'GET', undefined, again)).json().ready,
      false,
    );
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('question generation uses the selected OpenAI provider and validates the question source', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async (url: any) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      return response({
        questions: [
          {
            text: 'ما ناتج ثلاثة زائد اثنين؟',
            options: ['5', '6', '7', '8'],
            correct: 0,
            explanation: 'مجموع ثلاثة واثنين خمسة',
            page: 8,
          },
        ],
      });
    }) as any;
    const questions = await generate(
      {
        id: 'source',
        name: 'درس',
        pages: [{ page: 8, text: 'الجمع: ثلاثة زائد اثنين يساوي خمسة.', images: [] }],
      },
      [8],
      1,
      'سهل',
      'gpt-4.1-mini',
      new AbortController().signal,
      () => {},
      { provider: 'openai', key: 'secret-test' },
    );
    assert.equal(questions.length, 1);
    assert.equal(questions[0].page, 8);
    assert.equal(questions[0].correct, 0);
  } finally {
    globalThis.fetch = original;
  }
});
