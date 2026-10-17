import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
const directory = mkdtempSync(join(tmpdir(), 'assistant-upgrade-live-'));
const server = await createApp({ directory });
try {
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  await call('/api/setup', 'POST', { school: 'اختبار المساعد المحلي', password: 'Local-test123' });
  const token = (
    await call('/api/login', 'POST', { role: 'teacher', password: 'Local-test123' })
  ).json().token;
  const bookId = (
    await call(
      '/api/bank/import/commit',
      'POST',
      {
        data: {
          version: 1,
          batchId: 'local',
          book: {
            title: 'بنك الرياضيات',
            subject: 'الرياضيات',
            grade: '10',
            term: 'الأول',
            pageCount: 10,
          },
          questions: [1, 2].map((n) => ({
            text: `احسب ${n}+1`,
            options: ['1', '2', '3', '4'],
            correct: 1,
            explanation: 'جمع',
            page: 1,
            difficulty: 'سهل',
            chapter: 'الجبر',
            evidence: 'مثال',
          })),
        },
      },
      token,
    )
  ).json().bookId;
  for (const message of [
    'أريد فحص جاهزية بنك الرياضيات.',
    'أنشئ مجلدًا باسم مراجعة داخل بنك الرياضيات، ولونه أخضر.',
    'اعتمد جميع الأسئلة في بنك الرياضيات.',
    'اشرح لي كيف يراقب المعلم الطلاب بالكاميرات داخل التطبيق.',
    'اقترح خطوات لمراجعة جودة سؤال اختيار من متعدد دون أن تولد سؤالًا.',
  ]) {
    const began = Date.now();
    const result = await call('/api/assistant/messages', 'POST', { message, bookId }, token);
    if (result.statusCode !== 200) throw Error(result.body);
    const r = result.json();
    const reply = r.conversation.messages.at(-1);
    if (
      message.startsWith('اعتمد') &&
      !reply.cards.some((c: any) => c.kind === 'proposal' && c.title.includes('اعتماد'))
    )
      throw Error('Bulk approval did not produce a proposal');
    if (
      message.includes('جاهزية') &&
      !reply.cards.some((c: any) => c.kind === 'status' && c.value === '0 / 2')
    )
      throw Error('Readiness did not use backend counts');
    if (
      message.includes('أنشئ مجلد') &&
      !reply.cards.some((c: any) => c.kind === 'proposal' && c.title.includes('مراجعة'))
    )
      throw Error('Folder request did not produce a reviewable proposal');
    if (
      message.includes('الكاميرات') &&
      !reply.cards.some((c: any) => c.subtitle.includes('دون صوت أو تسجيل'))
    )
      throw Error('Camera guidance was not grounded');
    console.log(
      JSON.stringify({
        message,
        seconds: (Date.now() - began) / 1000,
        reply: r.conversation.messages.at(-1),
        performance: r.performance,
      }),
    );
  }
  if (server.store.getSetting(`bank-organization:${bookId}`))
    throw Error('Proposal applied without review');
} finally {
  await server.app.close();
  rmSync(directory, { recursive: true, force: true });
}
