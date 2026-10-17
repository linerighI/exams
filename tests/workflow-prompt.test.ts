import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { bankPrompt } from '../src/bankExchange';
import { cachedStudentHash, credentialSalt } from '../src/studentCredential';
test('Gemini orb editing uses its own encrypted key even when Ollama is selected and preserves the saved original', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gemini-orb-')),
    server = await createApp({ directory }),
    original = globalThis.fetch;
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Password123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Password123' })
    ).json().token;
    const config = (await call('/api/settings', 'GET', undefined, token)).json();
    await call(
      '/api/settings',
      'PUT',
      { ...config, aiProvider: 'ollama', geminiKey: 'test-gemini-secret' },
      token,
    );
    const prompt = bankPrompt(
      { title: 'رياضيات', subject: 'رياضيات', grade: 'العاشر', term: 'الأول' },
      200,
      '',
      'مختلط',
    );
    await call('/api/bank/prompt', 'PUT', { prompt }, token);
    let finish = 'STOP';
    const edited = prompt + '\nركز على التطبيق.';
    globalThis.fetch = async (url: any, init: any) => {
      assert.match(String(url), /^https:\/\/generativelanguage.googleapis.com\//);
      assert.equal(init.headers['x-goog-api-key'], 'test-gemini-secret');
      assert.match(init.body, /التطبيق/);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: finish,
              content: {
                parts: [{ text: '```json\n' + JSON.stringify({ prompt: edited }) + '\n```' }],
              },
            },
          ],
        }),
      );
    };
    const result = await call(
      '/api/bank/prompt/rewrite',
      'POST',
      { prompt, instructions: 'ركز على التطبيق', provider: 'gemini' },
      token,
    );
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().prompt, edited);
    assert.equal((await call('/api/bank/prompt', 'GET', undefined, token)).json().prompt, prompt);
    assert.equal(
      (await call('/api/settings', 'GET', undefined, token)).json().aiProvider,
      'ollama',
    );
    finish = 'MAX_TOKENS';
    assert.equal(
      (
        await call(
          '/api/bank/prompt/rewrite',
          'POST',
          { prompt, instructions: 'ركز على التطبيق', provider: 'gemini' },
          token,
        )
      ).statusCode,
      400,
    );
    assert.equal((await call('/api/bank/prompt', 'GET', undefined, token)).json().prompt, prompt);
    const status = (await call('/api/security/status')).json();
    assert.equal(status.brand, 'Zunis');
    assert.equal(status.transport, 'development-http');
    assert.ok(!('fullySecure' in status));
    assert.ok(
      !(await call('/api/settings', 'GET', undefined, token)).body.includes('test-gemini-secret'),
    );
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('offline student credential uses per-cache salt and canonical Arabic digits', async () => {
  const a = credentialSalt(),
    b = credentialSalt();
  assert.notEqual(a, b);
  assert.equal(await cachedStudentHash('٠١٢٣٤٥٦٧٨٩', a), await cachedStudentHash('0123456789', a));
  assert.notEqual(
    await cachedStudentHash('0123456789', a),
    await cachedStudentHash('0123456789', b),
  );
  await assert.rejects(cachedStudentHash('test', 'bad salt'));
});
