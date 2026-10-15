import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app';
import { assistantCommands, parseCommand } from '../src/assistantCommands';
test('slash tools, bank-only snapshots, safe draft edits, and permissions work without a model', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'assistant-tools-'));
  const server = await createApp({ directory });
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error('No model calls permitted');
  };
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { password: 'password123', school: 'مدرسة' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })
    ).json().token;
    server.store.put('books', {
      id: 'bank',
      title: 'كتاب الرياضيات',
      subject: 'رياضيات',
      grade: 'العاشر',
      term: 'الأول',
      pages: [],
    });
    server.store.put('bank_questions', {
      id: 'approved',
      bookId: 'bank',
      status: 'approved',
      text: 'احسب \\(x^2\\)',
      options: ['-1', '1', '2', '4'],
      correct: 3,
      explanation: 'تربيع',
      page: 8,
      chapter: 'القوى',
      difficulty: 'سهل',
    });
    server.store.put('bank_questions', {
      id: 'draft',
      bookId: 'bank',
      status: 'draft',
      text: 'مسودة غير معتمدة',
      options: ['1', '2', '3', '4'],
      correct: 0,
      page: 9,
      chapter: 'الجبر',
    });
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: '100', name: 'طالب اختبار', grade: 'العاشر', section: 'D' },
        token,
      )
    ).json();
    const studentToken = (
      await call('/api/login', 'POST', { role: 'student', code: student.code })
    ).json().token;
    const send = async (message: string, extra: any = {}) => {
      const r = await call('/api/assistant/messages', 'POST', { message, ...extra }, token);
      assert.equal(r.statusCode, 200, r.body);
      return r.json();
    };
    const help = await send('/help');
    assert.equal(help.conversation.messages[1].cards.length, assistantCommands.length - 1);
    assert.equal(parseCommand('/exam 10')?.command.id, 'exam');
    assert.equal(parseCommand('/امتحان ١٠')?.command.id, 'exam');
    const books = await send('/كتاب');
    assert.equal(books.conversation.messages[1].cards[0].approved, 1);
    const naturalBooks = await send('اعرض البنوك الموجودة في التطبيق');
    assert.equal(naturalBooks.conversation.messages[1].cards[0].id, 'bank');
    assert.match((await send('hello')).conversation.messages[1].text, /أهلًا/);
    const communication = (await send('انت تسمعني')).conversation.messages[1];
    assert.match(communication.text, /أقرأ رسالتك/);
    assert.equal(communication.cards.length, 0);
    const missing = await send('/امتحان');
    assert.match(missing.conversation.messages[1].text, /أي بنك/);
    assert.equal(server.store.all('exams').length, 0);
    const created = await send('/exam 1', { bookId: 'bank' });
    assert.equal(created.exam.questions.length, 1);
    assert.equal(created.exam.status, 'draft');
    assert.equal(created.conversation.messages[1].cards[0].kind, 'exam');
    const edited = await send('/تعديل 120 دقيقة 40 درجة', {
      conversationId: created.conversation.id,
    });
    assert.match(edited.conversation.messages.at(-1).text, /تحديث/);
    assert.equal(server.store.get('exams', created.exam.id).duration, 120);
    assert.equal(server.store.get('exams', created.exam.id).total, 40);
    await call(`/api/exams/${created.exam.id}/publish`, 'POST', {}, token);
    await send('/تعديل 30 دقيقة', { conversationId: created.conversation.id });
    assert.equal(server.store.get('exams', created.exam.id).duration, 120);
    const shortage = await send('/امتحان 10', { bookId: 'bank' });
    assert.match(shortage.conversation.messages.at(-1).text, /المتاح 1/);
    assert.equal(server.store.all('exams').length, 1);
    for (const command of ['/أسئلة', '/امتحانات', '/طالب', '/إحصاءات', '/متابعة', '/إعدادات'])
      assert.ok((await send(command)).conversation.messages.at(-1).cards);
    const card = (await send('/طالب')).conversation.messages.at(-1).cards[0];
    assert.equal(card.code, undefined);
    assert.equal(JSON.stringify(card).includes(student.code), false);
    assert.equal(
      (await call('/api/bank/selection', 'POST', { ids: ['draft'] }, token)).statusCode,
      400,
    );
    assert.equal(
      (await call('/api/bank/selection', 'POST', { ids: ['approved', 'approved'] }, token))
        .statusCode,
      400,
    );
    const selected = (
      await call('/api/bank/selection', 'POST', { ids: ['approved'] }, token)
    ).json();
    assert.equal(selected.questions[0].bankId, 'approved');
    assert.equal(selected.questions[0].correct, 3);
    for (const [url, method, payload] of [
      ['/api/assistant/messages', 'POST', { message: '/امتحان 1', bookId: 'bank' }],
      ['/api/assistant/conversations', 'GET', undefined],
      ['/api/assistant/status', 'GET', undefined],
      ['/api/bank/selection', 'POST', { ids: ['approved'] }],
    ] as any[])
      assert.equal((await call(url, method, payload, studentToken)).statusCode, 403);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
