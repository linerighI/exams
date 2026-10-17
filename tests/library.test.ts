import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { geometryCommands } from '../src/geometry';
test('geometry rejects executable input and undefined references', () => {
  assert.deepEqual(
    geometryCommands({
      objects: [
        { type: 'point', name: 'O', x: 0, y: 0 },
        { type: 'circle', name: 'c', center: 'O', radius: 3 },
      ],
    }),
    ['O=(0,0)', 'c=Circle(O,3)'],
  );
  assert.throws(() =>
    geometryCommands({ objects: [{ type: 'point', name: 'x);RunScript(', x: 0, y: 0 }] }),
  );
  assert.throws(() =>
    geometryCommands({ objects: [{ type: 'circle', name: 'c', center: 'O', radius: 3 }] }),
  );
});

test('visual processing checkpoints survive quota errors and server restarts', async () => {
  const path = 'C:/Users/User/Downloads/كتاب الطالب لمادة الرياضيات الصف العاشر الفصل الأول.pdf';
  if (!existsSync(path)) return;
  const directory = mkdtempSync(join(tmpdir(), 'book-resume-'));
  let server = await createApp({ directory });
  const original = globalThis.fetch;
  const call = async (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const login = async () =>
    (await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })).json().token;
  const wait = async (status: string) => {
    for (let i = 0; i < 600; i++) {
      const job = server.store.get('book_jobs', 'visual-job');
      if (job.status === status) return job;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw Error('processing test timed out');
  };
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'password123' });
    let token = await login();
    const config = (await call('/api/settings', 'GET', undefined, token)).json();
    await call('/api/settings', 'PUT', { ...config, aiProvider: 'gemini', geminiKey: 'test-key' }, token);
    server.store.put('books', {
      id: 'visual',
      title: 'رياضيات',
      subject: 'رياضيات',
      grade: 'العاشر',
      term: 'الأول',
      pdf: readFileSync(path).toString('base64'),
      pageCount: 11,
      pages: Array.from({ length: 11 }, (_, i) => ({
        page: i + 1,
        included: true,
        chapter: '',
        lesson: '',
      })),
    });
    server.store.put('book_jobs', {
      id: 'visual-job',
      bookId: 'visual',
      nextPage: 8,
      target: 50,
      completed: 0,
      tokens: 0,
      status: 'paused',
    });
    let requests = 0;
    const item = (page: number) => ({
      text: page === 8 ? 'احسب \\(2^2\\)' : 'احسب \\(3^2\\)',
      options: page === 8 ? ['1', '2', '3', '4'] : ['1', '3', '6', '9'],
      correct: 3,
      explanation: 'ارفع العدد إلى القوة الثانية',
      page,
      difficulty: 'سهل',
      chapter: 'الفصل الأول',
      evidence: 'مثال',
      requiresImage: page === 11,
      ...(page === 8 ? { box: [0.8, 0.7, 0.1, 0.2] } : { box: [0, 0, 0, 0] }),
    });
    globalThis.fetch = async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      assert.ok(body.contents[0].parts.some((p: any) => p.inlineData?.mimeType === 'image/png'));
      requests++;
      if (requests === 2)
        return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 });
      const pages = requests === 1 ? [8, 9, 10] : [11];
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      pages: pages.map((page) => ({
                        page,
                        included: true,
                        reason: 'درس',
                        chapter: 'الفصل الأول',
                        lesson: 'الجبر',
                      })),
                      questions: requests === 1 ? [item(8), item(8)] : [item(11)],
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 100 },
        }),
      );
    };
    await call('/api/books/visual/process', 'POST', { target: 50 }, token);
    const paused = await wait('paused');
    assert.equal(paused.nextPage, 11);
    assert.equal(server.store.all('bank_questions').length, 1);
    assert.ok(server.store.all('bank_questions')[0].image.startsWith('data:image/png;base64,'));
    await server.app.close();
    server = await createApp({ directory });
    token = await login();
    await call('/api/books/visual/process', 'POST', { target: 50 }, token);
    const done = await wait('done');
    assert.equal(done.completed, 2);
    assert.equal(done.tokens, 200);
    assert.equal(requests, 3);
    assert.equal(server.store.all('bank_questions').length, 2);
    assert.equal(server.store.all('bank_questions').find((q) => q.page === 11).image, undefined);
    const missingImage = server.store.all('bank_questions').find((q) => q.page === 11);
    assert.ok(missingImage.cropWarning);
    const approval = await call(
      `/api/bank/${missingImage.id}`,
      'PUT',
      { ...missingImage, status: 'approved' },
      token,
    );
    assert.ok(approval.statusCode >= 400);
    const fixed = await call(
      `/api/bank/${missingImage.id}/crop`,
      'POST',
      { box: [0.1, 0.2, 0.8, 0.7] },
      token,
    );
    assert.equal(fixed.statusCode, 200, fixed.body);
    assert.equal(
      (
        await call(
          `/api/bank/${missingImage.id}`,
          'PUT',
          { ...fixed.json(), status: 'approved' },
          token,
        )
      ).statusCode,
      200,
    );
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('assistant creates draft through validated tools and anonymizes student statistics', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'assistant-test-'));
  const server = await createApp({ directory });
  const original = globalThis.fetch;
  const call = async (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'password123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })
    ).json().token;
    const config = (await call('/api/settings', 'GET', undefined, token)).json();
    await call('/api/settings', 'PUT', { ...config, geminiKey: 'test-key' }, token);
    server.store.put('books', {
      id: 'b',
      title: 'الرياضيات',
      subject: 'رياضيات',
      grade: 'العاشر',
      term: 'الأول',
      pages: [],
    });
    server.store.put('bank_questions', {
      id: 'q',
      bookId: 'b',
      status: 'approved',
      text: 'احسب 2+2',
      options: ['1', '2', '3', '4'],
      correct: 3,
      page: 8,
      explanation: 'أربعة',
      chapter: 'الجبر',
    });
    server.store.put('students', { id: 'S1001', name: 'أحمد خالد', grade: 'العاشر' });
    globalThis.fetch = async (_url: any, init: any) => {
      assert.ok(String(_url).startsWith('http://127.0.0.1:11434/api/'));
      if (String(_url).endsWith('/tags'))
        return new Response(JSON.stringify({ models: [{ name: config.model }] }));
      const body = JSON.parse(init.body);
      assert.equal(JSON.stringify(body).includes('أحمد خالد'), false);
      assert.equal(JSON.stringify(body).includes('S1001'), false);
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              reply: 'جاهز',
              action: 'create_exam',
              bookId: 'b',
              count: 1,
            }),
          },
        }),
      );
    };
    const result = await call(
      '/api/assistant/messages',
      'POST',
      { message: 'أنشئ امتحانًا لأحمد خالد من سؤال واحد', bookId: 'b' },
      token,
    );
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().exam.status, 'draft');
    assert.ok(result.json().conversation.messages[1].examId);
    assert.equal(server.store.all('conversations').length, 1);
    assert.equal((await call('/api/assistant/conversations')).statusCode, 403);
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('bank drafts are offline snapshots, teacher-only; backup contains library but not key', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'library-test-'));
  const server = await createApp({ directory });
  const call = async (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const original = globalThis.fetch;
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'password123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })
    ).json().token;
    server.store.put('books', {
      id: 'book',
      title: 'رياضيات',
      subject: 'رياضيات',
      grade: 'العاشر',
      term: 'الأول',
      pages: [],
      pdf: 'private-pdf',
    });
    server.store.put('bank_questions', {
      id: 'q',
      bookId: 'book',
      status: 'approved',
      text: 'احسب \\(2^2\\)',
      options: ['1', '2', '3', '4'],
      correct: 3,
      explanation: '4',
      page: 8,
      difficulty: 'سهل',
      chapter: 'الفصل الأول',
      evidence: '2^2',
    });
    globalThis.fetch = async () => {
      throw Error('network must not be used');
    };
    assert.equal((await call('/api/books')).statusCode, 403);
    const result = await call('/api/bank/exam', 'POST', { bookId: 'book', count: 1 }, token);
    assert.equal(result.statusCode, 200, result.body);
    const exam = result.json();
    assert.equal(exam.status, 'draft');
    assert.equal(exam.questions.length, 1);
    server.store.put('bank_questions', {
      ...server.store.get('bank_questions', 'q'),
      text: 'changed',
    });
    assert.equal(server.store.get('exams', exam.id).questions[0].text, 'احسب \\(2^2\\)');
    const config = (await call('/api/settings', 'GET', undefined, token)).json();
    await call('/api/settings', 'PUT', { ...config, geminiKey: 'secret-key' }, token);
    const backup = (await call('/api/backup', 'GET', undefined, token)).json();
    assert.equal(backup.tables.books.length, 1);
    assert.equal(JSON.stringify(backup).includes('secret-key'), false);
    assert.equal(JSON.stringify(backup).includes('gemini-key'), false);
    assert.equal(
      (await call('/api/bank/exam', 'POST', { bookId: 'book', count: 2 }, token)).statusCode >= 400,
      true,
    );
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
