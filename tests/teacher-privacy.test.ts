import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app';
import { openStore, hashPassword } from '../server/store';
test('teachers have isolated databases, students, banks, conversations, jobs, credentials and backups', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'teacher-privacy-'));
  let server = await createApp({ directory });
  const originalFetch = globalThis.fetch;
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'password123' });
    const login = async (username: string, password: string) =>
      (await call('/api/login', 'POST', { role: 'teacher', username, password })).json();
    let a = (await login('admin', 'password123')).token;
    const bob = (
      await call(
        '/api/teachers',
        'POST',
        { username: 'teacher2', name: 'معلم ثان', password: 'teacher222' },
        a,
      )
    ).json();
    assert.ok(bob.id);
    assert.equal(bob.password, undefined);
    let b = (await login('teacher2', 'teacher222')).token;
    assert.ok(b);
    const data = {
      version: 1,
      batchId: 'bank-1',
      book: {
        title: 'كتاب خاص',
        subject: 'رياضيات',
        grade: 'العاشر',
        term: 'الأول',
        pageCount: 10,
      },
      questions: [
        {
          text: 'احسب 2+2',
          options: ['1', '2', '3', '4'],
          correct: 3,
          explanation: 'أربعة',
          page: 1,
          difficulty: 'سهل',
          chapter: 'الجبر',
          evidence: 'مثال',
        },
      ],
    };
    const bankA = (await call('/api/bank/import/commit', 'POST', { data }, a)).json();
    const bankB = (await call('/api/bank/import/commit', 'POST', { data }, b)).json();
    assert.ok(bankA.bookId);
    assert.ok(bankB.bookId);
    assert.notEqual(bankA.bookId, bankB.bookId);
    assert.equal((await call('/api/books', 'GET', undefined, a)).json().length, 1);
    assert.equal((await call('/api/books', 'GET', undefined, b)).json().length, 1);
    for (const [url, method, payload] of [
      [`/api/books/${bankA.bookId}`, 'GET', undefined],
      [`/api/books/${bankA.bookId}/questions`, 'GET', undefined],
      [`/api/books/${bankA.bookId}/document`, 'GET', undefined],
    ]) {
      const response = await call(url as string, method as string, payload, b);
      assert.ok(response.statusCode >= 400, response.body);
    }
    const qa = (await call(`/api/books/${bankA.bookId}/questions`, 'GET', undefined, a)).json()[0];
    assert.equal((await call('/api/bank/selection', 'POST', { ids: [qa.id] }, b)).statusCode, 400);
    const studentA = (
      await call(
        '/api/students',
        'POST',
        { id: '100', name: 'طالب أ', grade: 'العاشر', section: 'D' },
        a,
      )
    ).json();
    const studentB = (
      await call(
        '/api/students',
        'POST',
        { id: '100', name: 'طالب ب', grade: 'العاشر', section: 'D' },
        b,
      )
    ).json();
    assert.notEqual(studentA.code, studentB.code);
    assert.equal((await call('/api/students', 'GET', undefined, a)).json()[0].name, 'طالب أ');
    assert.equal((await call('/api/students', 'GET', undefined, b)).json()[0].name, 'طالب ب');
    const sa = (await call('/api/login', 'POST', { role: 'student', code: studentA.code })).json();
    const sb = (await call('/api/login', 'POST', { role: 'student', code: studentB.code })).json();
    assert.notEqual(sa.teacherId, sb.teacherId);
    const ca = (await call('/api/assistant/messages', 'POST', { message: '/كتاب' }, a)).json()
      .conversation;
    assert.equal(
      (await call('/api/assistant/conversations', 'GET', undefined, b)).json().length,
      0,
    );
    assert.equal(
      (
        await call(
          '/api/assistant/messages',
          'POST',
          { conversationId: ca.id, message: '/كتاب' },
          b,
        )
      ).statusCode,
      400,
    );
    assert.equal((await call('/api/teachers', 'GET', undefined, b)).statusCode, 403);
    assert.equal(
      (
        await call(
          '/api/teachers',
          'POST',
          { username: 'intruder', name: 'x', password: 'password123' },
          b,
        )
      ).statusCode,
      403,
    );
    await call(
      '/api/bank/prompt',
      'PUT',
      { prompt: 'طلب خاص للمعلم الأول: أنشئ بنك أسئلة كامل مع الرسوم.' },
      a,
    );
    await call(
      '/api/bank/prompt',
      'PUT',
      { prompt: 'طلب خاص للمعلم الثاني: أنشئ بنك أسئلة كامل مع المعادلات.' },
      b,
    );
    globalThis.fetch = async (url: any, init: any) => {
      await new Promise((r) => setTimeout(r, 10));
      if (String(url).endsWith('/tags'))
        return new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }] }));
      const body = JSON.parse(init.body);
      const content = JSON.parse(body.messages.at(-1).content);
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({ prompt: content.prompt + ' تم تعديل الصياغة حسب الطلب.' }),
          },
        }),
      );
    };
    const [promptA, promptB] = await Promise.all([
      call('/api/assistant/messages', 'POST', { message: '/طلب عدّل الصياغة' }, a),
      call('/api/assistant/messages', 'POST', { message: '/طلب عدّل الصياغة' }, b),
    ]);
    assert.match(promptA.json().conversation.messages.at(-1).cards[0].prompt, /الأول/);
    assert.ok(!JSON.stringify(promptA.json()).includes('الثاني'));
    assert.match(promptB.json().conversation.messages.at(-1).cards[0].prompt, /الثاني/);
    assert.ok(!JSON.stringify(promptB.json()).includes('الأول'));
    globalThis.fetch = originalFetch;
    const examInput = {
      title: 'امتحان خاص',
      subject: 'رياضيات',
      grade: 'العاشر',
      section: 'D',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 20,
      difficulty: 'سهل',
      cameraRequired: false,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions: [
        {
          id: 'q1',
          text: 'احسب 2+2',
          options: ['1', '2', '3', '4'],
          correct: 3,
          explanation: 'أربعة',
          page: 1,
        },
      ],
    };
    const examA = (await call('/api/exams', 'POST', examInput, a)).json(),
      examB = (await call('/api/exams', 'POST', examInput, b)).json();
    await call(`/api/exams/${examA.id}/publish`, 'POST', {}, a);
    await call(`/api/exams/${examB.id}/publish`, 'POST', {}, b);
    assert.equal((await call('/api/exams', 'GET', undefined, sa.token)).json()[0].id, examA.id);
    assert.equal(
      (
        await call(
          '/api/attempts/start',
          'POST',
          { code: examB.code, cameraAvailable: false },
          sa.token,
        )
      ).statusCode,
      404,
    );
    assert.equal((await call('/api/exams', 'GET', undefined, sb.token)).json()[0].id, examB.id);
    const attempt = (
      await call(
        '/api/attempts/start',
        'POST',
        { code: examA.code, cameraAvailable: false },
        sa.token,
      )
    ).json();
    assert.equal((await call('/api/attempts', 'GET', undefined, b)).json().length, 0);
    assert.equal(
      (await call('/api/attempts/' + attempt.attempt.id, 'GET', undefined, b)).statusCode,
      404,
    );
    const job = (
      await call(
        '/api/sources',
        'POST',
        { name: 'bad.pdf', data: Buffer.from('%PDF-1.4').toString('base64') },
        a,
      )
    ).json();
    assert.equal((await call('/api/jobs/' + job.jobId, 'GET', undefined, b)).statusCode, 404);
    assert.equal((await call('/api/jobs/' + job.jobId, 'DELETE', undefined, b)).statusCode, 404);
    const backup = (await call('/api/backup', 'GET', undefined, b)).json();
    assert.ok(!JSON.stringify(backup).includes(bankA.bookId));
    assert.ok(!JSON.stringify(backup).includes('طالب أ'));
    assert.ok(!('teachers' in backup.tables));
    assert.equal((await call('/api/restore', 'POST', backup, b)).statusCode, 200);
    assert.equal((await call('/api/books', 'GET', undefined, a)).statusCode, 200);
    b = (await login('teacher2', 'teacher222')).token;
    assert.equal(
      (
        await call(
          '/api/account',
          'PUT',
          { name: 'جديد', currentPassword: 'wrong', password: 'changed222' },
          b,
        )
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await call(
          '/api/account',
          'PUT',
          { name: 'جديد', currentPassword: 'teacher222', password: 'changed222' },
          b,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call('/api/login', 'POST', {
          role: 'teacher',
          username: 'teacher2',
          password: 'teacher222',
        })
      ).statusCode,
      401,
    );
    await server.app.close();
    server = await createApp({ directory });
    a = (await login('admin', 'password123')).token;
    b = (await login('teacher2', 'changed222')).token;
    assert.equal((await call('/api/books', 'GET', undefined, b)).json()[0].id, bankB.bookId);
    assert.equal((await call('/api/books', 'GET', undefined, a)).json()[0].id, bankA.bookId);
    assert.equal(
      (await call('/api/teachers/' + bob.id, 'PATCH', { disabled: true }, a)).statusCode,
      200,
    );
    assert.equal((await call('/api/books', 'GET', undefined, b)).statusCode, 403);
    assert.equal(
      (await call('/api/login', 'POST', { role: 'student', code: studentB.code })).statusCode,
      401,
    );
  } finally {
    globalThis.fetch = originalFetch;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('existing single-teacher work migrates to the original administrator', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'teacher-migration-'));
  const old = openStore(directory);
  old.setSetting('password', hashPassword('original123'));
  old.put('books', {
    id: 'old-book',
    title: 'كتاب قديم',
    subject: 'علوم',
    grade: 'السابع',
    term: 'الأول',
    pages: [],
  });
  old.db.close();
  const server = await createApp({ directory });
  try {
    const login = await server.app.inject({
      url: '/api/login',
      method: 'POST',
      payload: { role: 'teacher', password: 'original123' },
    });
    assert.equal(login.statusCode, 200);
    assert.equal(login.json().teacher.username, 'admin');
    const token = login.json().token;
    assert.equal(
      (
        await server.app.inject({
          url: '/api/books',
          headers: { authorization: `Bearer ${token}` },
        })
      ).json()[0].id,
      'old-book',
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
