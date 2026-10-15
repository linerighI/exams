import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quickAssistantIntent, requestsAssistantTools } from '../server/assistantIntent';
import { assistantModelStatus } from '../server/ollama';
import { createApp } from '../server/app';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('ordinary conversation excludes bank context and cannot execute model-selected tools', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'assistant-chat-'));
  const server = await createApp({ directory });
  const original = globalThis.fetch;
  try {
    await server.app.inject({
      url: '/api/setup',
      method: 'POST',
      payload: { school: 'مدرسة', password: 'password123' },
    });
    const token = (
      await server.app.inject({
        url: '/api/login',
        method: 'POST',
        payload: { role: 'teacher', password: 'password123' },
      })
    ).json().token;
    server.store.put('books', {
      id: 'private-bank',
      title: 'عنوان خاص',
      subject: 'رياضيات',
      grade: 'العاشر',
      term: 'الأول',
      pages: [],
    });
    let invalid = false;
    globalThis.fetch = async (url: any, init: any) => {
      if (String(url).endsWith('/tags'))
        return new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }));
      const body = JSON.parse(init.body);
      assert.equal(body.format.properties.action.const, 'reply');
      assert.ok(!init.body.includes('private-bank'));
      assert.ok(!body.messages[0].content.includes('45'));
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              action: invalid ? 'search_books' : 'reply',
              reply: 'أنا بخير، كيف أساعدك؟',
            }),
          },
        }),
      );
    };
    const send = () =>
      server.app.inject({
        url: '/api/assistant/messages',
        method: 'POST',
        payload: { message: 'كيف حالك؟' },
        headers: { authorization: `Bearer ${token}` },
      });
    const response = await send();
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().conversation.messages.at(-1).cards.length, 0);
    invalid = true;
    assert.equal((await send()).statusCode, 400);
    assert.equal(server.store.all('exams').length, 0);
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fast assistant shortcuts only recognize greetings and unambiguous reads', () => {
  assert.equal(quickAssistantIntent('hello!')?.greeting, true);
  assert.equal(quickAssistantIntent('انت تسمعني؟')?.communication, true);
  assert.equal(requestsAssistantTools('انت تسمعني'), false);
  assert.equal(requestsAssistantTools('كيف حالك؟'), false);
  assert.equal(requestsAssistantTools('أنشئ امتحان رياضيات'), true);
  assert.equal(requestsAssistantTools('show my students'), true);
  assert.equal(quickAssistantIntent('انت تسمعني افتح البنوك'), undefined);
  assert.equal(quickAssistantIntent('اعرض البنوك الموجودة في التطبيق')?.command, 'books');
  assert.equal(quickAssistantIntent('show my students')?.command, 'students');
  for (const text of [
    'احذف الطلاب',
    'اعرض الطلاب ثم احذفهم',
    'create exam',
    'اعرض النتائج للصف العاشر',
  ])
    assert.equal(quickAssistantIntent(text), undefined);
});

test('assistant fast mode chooses installed small model while manual mode respects selection', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }, { name: 'qwen3.5:4b' }] }));
  try {
    assert.equal(
      (await assistantModelStatus({ model: 'qwen3.5:4b', localSpeed: 'fast' })).model,
      'qwen3:1.7b',
    );
    assert.equal(
      (await assistantModelStatus({ model: 'qwen3.5:4b', localSpeed: 'manual' })).model,
      'qwen3.5:4b',
    );
  } finally {
    globalThis.fetch = original;
  }
});
