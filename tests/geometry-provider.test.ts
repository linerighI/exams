import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app';
test('graph generation works offline for polynomials and uses the ready local model for other geometry', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'geometry-provider-')),
    server = await createApp({ directory }),
    original = globalThis.fetch;
  try {
    await server.app.inject({
      url: '/api/setup',
      method: 'POST',
      payload: { school: 'مدرسة', password: 'Graph12345' },
    });
    const token = (
      await server.app.inject({
        url: '/api/login',
        method: 'POST',
        payload: { role: 'teacher', password: 'Graph12345' },
      })
    ).json().token;
    const generate = (prompt: string) =>
      server.app.inject({
        url: '/api/geometry/generate',
        method: 'POST',
        payload: { prompt },
        headers: { authorization: `Bearer ${token}` },
      });
    globalThis.fetch = async () => {
      throw Error('offline');
    };
    assert.equal((await generate('ارسم \\(x^{3}-64x=0\\)')).statusCode, 200);
    const unavailable = await generate('ارسم دائرة مركزها O ونصف قطرها 3');
    assert.equal(unavailable.statusCode, 503);
    assert.match(unavailable.json().error, /الإعدادات/);
    server.store.setSetting('config', {
      ...server.store.getSetting('config'),
      aiProvider: 'ollama',
      model: 'missing:4b',
      localSpeed: 'fast',
    });
    let used = '';
    globalThis.fetch = async (url: any, options: any) => {
      if (String(url).endsWith('/tags'))
        return new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }));
      used = JSON.parse(options.body).model;
      return new Response(
        JSON.stringify({
          done: true,
          message: {
            content: JSON.stringify({
              objects: [
                { type: 'point', name: 'O', x: 0, y: 0 },
                { type: 'circle', name: 'c', center: 'O', radius: 3 },
              ],
            }),
          },
        }) + '\n',
      );
    };
    const generated = await generate('ارسم دائرة مركزها O ونصف قطرها 3');
    assert.equal(generated.statusCode, 200, generated.body);
    assert.equal(used, 'qwen3:1.7b');
    globalThis.fetch = async (url: any) => {
      if (String(url).endsWith('/tags'))
        return new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }));
      throw Error('fetch failed');
    };
    const fallback = await generate('إذا كان \\(y=3x+4\\) و \\(y=x^{2}+3x+4\\)');
    assert.equal(fallback.statusCode, 200);
    assert.equal(fallback.json().origin, 'local');
    assert.equal(fallback.json().objects.length, 2);
    const config = server.store.getSetting('config');
    await server.app.inject({
      url: '/api/settings',
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...config,
        aiProvider: 'gemini',
        geminiModel: 'gemini-2.5-flash',
        geminiKey: 'fixture-key',
      },
    });
    let called = false;
    globalThis.fetch = async (url: any, options: any) => {
      called = true;
      assert.match(String(url), /gemini-2.5-flash/);
      assert.equal(options.headers['x-goog-api-key'], 'fixture-key');
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      objects: [
                        { type: 'point', name: 'O', x: 0, y: 0 },
                        { type: 'circle', name: 'c', center: 'O', radius: 3 },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    };
    const gemini = await generate('ارسم دائرة مركزها O ونصف قطرها 3');
    assert.equal(gemini.statusCode, 200, gemini.body);
    assert.ok(called);
    assert.equal(gemini.json().origin, 'ai');
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
