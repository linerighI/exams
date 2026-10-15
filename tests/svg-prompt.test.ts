import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeSvg } from '../src/svgDiagram';
import { bankPrompt } from '../src/bankExchange';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
const diagram =
  '<svg viewBox="0 0 300 200"><circle cx="100" cy="100" r="60" fill="none" stroke="#456789"/><text x="170" y="100" font-size="20">θ</text></svg>';
test('SVG imports permit geometric primitives and reject active or external content', () => {
  assert.match(safeSvg(diagram), /xmlns="http/);
  for (const svg of [
    diagram.replace('<circle', '<script'),
    diagram.replace('cx="100"', 'onload="alert(1)"'),
    diagram.replace('fill="none"', 'fill="url(https://evil.example)"'),
    diagram.replace('<circle', '<image href="https://evil.example"'),
    diagram.replace('<circle', '<foreignObject'),
    `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]>${diagram}`,
    diagram.replace('</svg>', '</g>'),
    diagram.replace('r="60"', 'r="60" r="50"'),
  ])
    assert.throws(() => safeSvg(svg));
  const prompt = bankPrompt(
    { title: 'كتاب', subject: 'رياضيات', grade: 'العاشر', term: 'الأول' },
    200,
    '8–64',
    'مختلط',
  );
  assert.match(prompt, /ملف JSON واحد/);
  assert.match(prompt, /SVG/);
  assert.ok(!prompt.includes('25 سؤال'));
});
test('prompt rewrite proposes changes without overwriting the saved prompt', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'prompt-edit-'));
  const server = await createApp({ directory });
  const original = globalThis.fetch;
  try {
    const call = (url: string, method = 'GET', payload?: any, token?: string) =>
      server.app.inject({
        url,
        method: method as any,
        payload,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'password123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })
    ).json().token;
    const originalPrompt = bankPrompt(
      { title: 'كتاب', subject: 'رياضيات', grade: 'العاشر', term: 'الأول' },
      200,
      '',
      'مختلط',
    );
    await call('/api/bank/prompt', 'PUT', { prompt: originalPrompt }, token);
    const edited = originalPrompt + '\nركز على المسائل التطبيقية.';
    globalThis.fetch = async (url: any, init: any) => {
      assert.ok(String(url).startsWith('http://127.0.0.1:11434/'));
      if (String(url).endsWith('/tags'))
        return new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }));
      const body = JSON.parse(init.body);
      assert.match(JSON.stringify(body), /المسائل التطبيقية/);
      return new Response(
        JSON.stringify({ message: { content: JSON.stringify({ prompt: edited }) } }),
      );
    };
    const result = await call(
      '/api/bank/prompt/rewrite',
      'POST',
      { prompt: originalPrompt, instructions: 'ركز على المسائل التطبيقية' },
      token,
    );
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().prompt, edited);
    assert.equal(
      (await call('/api/bank/prompt', 'GET', undefined, token)).json().prompt,
      originalPrompt,
    );
    const main = await call(
      '/api/assistant/messages',
      'POST',
      { message: '/طلب ركز على المسائل التطبيقية' },
      token,
    );
    assert.equal(main.statusCode, 200, main.body);
    assert.equal(main.json().conversation.messages.at(-1).cards[0].kind, 'prompt');
    assert.equal(
      (await call('/api/bank/prompt', 'GET', undefined, token)).json().prompt,
      originalPrompt,
    );
    const data = {
      version: 1,
      book: { title: 'كتاب', subject: 'رياضيات', grade: 'العاشر', term: 'الأول', pageCount: 10 },
      questions: [
        {
          id: 'q1',
          text: 'حدد الزاوية θ',
          options: ['1', '2', '3', '4'],
          correct: 0,
          explanation: 'حسب الرسم',
          chapter: 'هندسة',
          page: 1,
          evidence: 'مثال',
          difficulty: 'سهل',
          requiresImage: true,
          svg: diagram,
        },
      ],
    };
    const preview = (await call('/api/bank/import/preview', 'POST', { data }, token)).json();
    assert.equal(preview.accepted.length, 1);
    assert.match(preview.accepted[0].svg, /xmlns/);
    assert.equal(preview.repairNeeded, 1);
    const rejected = (
      await call(
        '/api/bank/import/preview',
        'POST',
        {
          data: {
            ...data,
            questions: [
              { ...data.questions[0], svg: diagram.replace('cx="100"', 'onload="alert(1)"') },
            ],
          },
        },
        token,
      )
    ).json();
    assert.equal(rejected.accepted[0].svg, undefined);
    assert.ok(rejected.accepted[0].reviewWarnings.length);
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
