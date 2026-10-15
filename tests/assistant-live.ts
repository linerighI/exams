import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
const directory = mkdtempSync(join(tmpdir(), 'assistant-live-'));
const server = await createApp({ directory });
try {
  await server.app.inject({
    url: '/api/setup',
    method: 'POST',
    payload: { password: 'password123', school: 'اختبار محلي' },
  });
  const token = (
    await server.app.inject({
      url: '/api/login',
      method: 'POST',
      payload: { role: 'teacher', password: 'password123' },
    })
  ).json().token;
  server.store.put('books', {
    id: 'live-bank',
    title: 'كتاب الرياضيات',
    subject: 'رياضيات',
    grade: 'العاشر',
    term: 'الأول',
    pages: [],
  });
  const started = Date.now();
  const result = await server.app.inject({
    url: '/api/assistant/messages',
    method: 'POST',
    payload: { message: 'اعرض البنوك الموجودة في التطبيق' },
    headers: { authorization: `Bearer ${token}` },
  });
  if (result.statusCode !== 200) throw Error(result.body);
  const reply = result.json().conversation.messages.at(-1);
  if (!reply.cards?.some((c: any) => c.kind === 'book' && c.id === 'live-bank'))
    throw Error('Local model did not choose the bank search tool: ' + JSON.stringify(reply));
  console.log(
    JSON.stringify({
      provider: 'Ollama',
      seconds: (Date.now() - started) / 1000,
      reply: reply.text,
      cards: reply.cards.length,
    }),
  );
  for (let n = 0; n < 2; n++) {
    const time = Date.now();
    const response = await server.app.inject({
      url: '/api/assistant/messages',
      method: 'POST',
      payload: {
        message: n === 0 ? 'كيف حالك؟' : 'ما الفرق بين الامتحان النصفي والنهائي؟ أجب باختصار.',
      },
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.statusCode !== 200) throw Error(response.body);
    const answer = response.json().conversation.messages.at(-1);
    if (answer.cards.length) throw Error('Ordinary chat unexpectedly opened app tools');
    console.log(
      JSON.stringify({
        run: n + 1,
        seconds: (Date.now() - time) / 1000,
        reply: answer.text,
        ...response.json().performance,
      }),
    );
  }
} finally {
  await server.app.close();
  rmSync(directory, { recursive: true, force: true });
}
