import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { bankPrompt } from '../src/bankExchange';
test('external bank batches import, crop, assemble, export, and restore with zero AI requests', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bank-import-'));
  const server = await createApp({ directory });
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    throw Error('AI requests forbidden');
  };
  const call = async (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة اختبار', password: 'password123' });
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })
    ).json().token;
    const q = {
      id: 'q1',
      text: 'احسب \\(x^2\\) عندما \\(x=2\\)',
      options: ['1', '2', '3', '4'],
      correct: 3,
      explanation: 'نربع العدد',
      page: 8,
      difficulty: 'سهل',
      chapter: 'الجبر',
      lesson: 'القوى',
      evidence: 'مثال القوى',
      requiresImage: false,
      box: null,
    };
    const signed = {
      version: 1,
      batchId: 'sign-check',
      book: {
        title: 'خيارات سالبة',
        subject: 'رياضيات',
        grade: 'العاشر',
        term: 'الأول',
        pageCount: 132,
      },
      questions: [{ ...q, options: ['-1', '1', '-0.5', '0.5'] }],
    };
    assert.equal(
      (await call('/api/bank/import/preview', 'POST', { data: signed }, teacher)).json().accepted
        .length,
      1,
    );
    const data = {
      version: 1,
      batchId: 'batch-01',
      book: {
        title: 'كتاب الرياضيات',
        subject: 'رياضيات',
        grade: 'العاشر',
        term: 'الأول',
        pageCount: 132,
      },
      questions: [
        q,
        q,
        { ...q, text: 'سؤال بلا خيارات', options: ['1'] },
        { ...q, text: 'سؤال بصفحة خاطئة', page: 999 },
        { ...q, text: 'احسب مساحة الدائرة', requiresImage: true, box: [0.8, 0.7, 0.1, 0.2] },
        { ...q, text: 'راجع \\(\\notacommand{x}\\)', box: [0, 0, 0, 0] },
      ],
    };
    assert.equal((await call('/api/bank/import/preview', 'POST', { data })).statusCode, 403);
    const preview = (await call('/api/bank/import/preview', 'POST', { data }, teacher)).json();
    assert.equal(preview.accepted.length, 3);
    assert.equal(preview.duplicates.length, 1);
    assert.equal(preview.rejected.length, 2);
    assert.equal(preview.repairNeeded, 2);
    assert.equal(server.store.all('books').length, 0);
    const saved = (await call('/api/bank/import/commit', 'POST', { data }, teacher)).json();
    assert.equal(saved.imported, 3);
    const bookId = saved.bookId;
    assert.ok(bookId);
    const again = (await call('/api/bank/import/preview', 'POST', { data }, teacher)).json();
    assert.equal(again.accepted.length, 0);
    assert.equal(server.store.all('books').length, 1);
    const large = await call('/api/bank/import/preview','POST',{data:{...data,batchId:'large-550',questions:Array.from({length:550},(_,i)=>({...q,id:'large-'+i,text:'سؤال كبير '+i}))}},teacher);
    assert.equal(large.statusCode,200,large.body);
    const next = {
      ...data,
      batchId: 'batch-02',
      questions: [
        { ...q, id: 'q2', text: 'احسب \\(3^2\\)', options: ['3', '6', '9', '12'], correct: 2 },
      ],
    };
    assert.equal(
      (await call('/api/bank/import/commit', 'POST', { data: next, bookId }, teacher)).json()
        .imported,
      1,
    );
    assert.equal(
      (await call('/api/bank/import/preview', 'POST', { data: { ...data, version: 2 } }, teacher))
        .statusCode,
      400,
    );
    assert.equal(
      (
        await call(
          '/api/bank/import/preview',
          'POST',
          { data: { ...data, questions: Array(1001).fill(q) } },
          teacher,
        )
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(
          '/api/bank/import/preview',
          'POST',
          { data: { ...data, book: { ...data.book, grade: 'السابع' } }, bookId },
          teacher,
        )
      ).statusCode,
      400,
    );
    let rows = (await call(`/api/books/${bookId}/questions`, 'GET', undefined, teacher)).json();
    assert.ok(rows.every((q: any) => q.status === 'draft'));
    const noImage = rows.find((q: any) => q.requiresImage);
    assert.equal(
      (await call(`/api/bank/${noImage.id}`, 'PUT', { ...noImage, status: 'approved' }, teacher))
        .statusCode,
      400,
    );
    const path = 'C:/Users/User/Downloads/كتاب الطالب لمادة الرياضيات الصف العاشر الفصل الأول.pdf';
    if (existsSync(path)) {
      assert.equal(
        (
          await call(
            `/api/books/${bookId}/source`,
            'POST',
            { pdf: readFileSync(path).toString('base64') },
            teacher,
          )
        ).statusCode,
        200,
      );
      rows = (await call(`/api/books/${bookId}/questions`, 'GET', undefined, teacher)).json();
      assert.match(rows.find((q: any) => q.requiresImage).image, /^data:image\/png/);
      assert.equal(
        (await call(`/api/bank/${noImage.id}/crop`, 'POST', { box: [0.1, 0.1, 0.7, 0.5] }, teacher))
          .statusCode,
        200,
      );
    }
    const approved = rows.find((r: any) => r.text === q.text);
    assert.equal(
      (await call(`/api/bank/${approved.id}`, 'PUT', { ...approved, status: 'approved' }, teacher))
        .statusCode,
      200,
    );
    const exam = (await call('/api/bank/exam', 'POST', { bookId, count: 1 }, teacher)).json();
    assert.equal(exam.questions.length, 1);
    assert.equal(exam.status, 'draft');
    const html = (await call(`/api/books/${bookId}/document`, 'GET', undefined, teacher)).json()
      .html;
    assert.match(html, /class="katex/);
    assert.match(html, /font\/woff2;base64/);
    assert.match(html, /مفتاح الإجابة/);
    assert.ok(!html.includes('url(fonts/'));
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: '100', name: 'طالب', grade: 'العاشر', section: 'D' },
        teacher,
      )
    ).json();
    const token = (await call('/api/login', 'POST', { role: 'student', code: student.code })).json()
      .token;
    for (const url of [
      `/api/books/${bookId}/document`,
      `/api/books/${bookId}/questions`,
      `/api/books/${bookId}/companion`,
    ])
      assert.equal((await call(url, 'GET', undefined, token)).statusCode, 403);
    const pdf = Buffer.from('%PDF-1.4\n% companion').toString('base64');
    assert.equal(
      (await call(`/api/books/${bookId}/companion`, 'POST', { pdf }, teacher)).statusCode,
      200,
    );
    const backup = (await call('/api/backup', 'GET', undefined, teacher)).json();
    assert.equal((await call('/api/restore', 'POST', backup, teacher)).statusCode, 200);
    const login = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'password123' })
    ).json().token;
    assert.equal(
      (await call(`/api/books/${bookId}/questions`, 'GET', undefined, login)).json().length,
      4,
    );
    assert.equal(
      (await call(`/api/books/${bookId}/companion`, 'GET', undefined, login)).json().pdf,
      pdf,
    );
    assert.equal(requests, 0);
    assert.match(bankPrompt(data.book, 200, '8–64', 'مختلط'), /البنك كاملًا/);
  } finally {
    globalThis.fetch = original;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
