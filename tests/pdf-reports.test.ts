import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { bankDocument } from '../server/bankTransfer';
import { openTenantStores } from '../server/tenants';

test('request read reuse does not keep stale records in async continuations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'request-reads-'));
  const tenancy = openTenantStores(directory);
  try {
    tenancy.create('admin', 'مدير', 'Read-test123', true);
    tenancy.store.put('students', { id: '1', name: 'قبل', grade: '10', section: 'أ' });
    await tenancy.run('master', async () => {
      assert.equal(tenancy.store.get('students', '1').name, 'قبل');
      await Promise.resolve();
      tenancy
        .forTeacher('master')
        .put('students', { id: '1', name: 'بعد', grade: '10', section: 'أ' });
      assert.equal(tenancy.store.get('students', '1').name, 'بعد');
    });
  } finally {
    tenancy.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('bank PDFs omit answers and drafts for students; titles, diagrams and math are safe and offline', () => {
  const questions = [
    {
      id: 'q1',
      text: 'احسب \\(x^2+4\\)',
      options: ['1', '2', '3', '4'],
      correct: 2,
      explanation: 'SECRET_EXPLANATION',
      status: 'approved',
      chapter: 'جبر',
      page: 1,
    },
    {
      id: 'q2',
      text: 'DRAFT_QUESTION',
      options: ['1', '2', '3', '4'],
      correct: 0,
      explanation: 'draft',
      status: 'draft',
      chapter: 'هندسة',
      page: 2,
    },
  ];
  const bank = { title: '<script>BAD</script>', subject: 'رياضيات', grade: '10', term: 'الأول' };
  const student = bankDocument(
    bank,
    questions,
    { audience: 'student', approvedOnly: false },
    'مدرسة الاختبار',
  );
  assert.ok(!student.includes('SECRET_EXPLANATION'));
  assert.ok(!student.includes('DRAFT_QUESTION'));
  assert.ok(!student.includes('<script>BAD'));
  assert.match(student, /&lt;script&gt;/);
  assert.match(student, /class="katex/);
  assert.match(student, /font\/woff2;base64/);
  assert.ok(!student.includes('url(fonts/'));
  assert.match(student, /مدرسة الاختبار/);
  const teacher = bankDocument(bank, questions, { audience: 'teacher', approvedOnly: false });
  assert.match(teacher, /SECRET_EXPLANATION/);
  assert.match(teacher, /DRAFT_QUESTION/);
  const chapter = bankDocument(bank, questions, { audience: 'teacher', chapter: 'جبر' });
  assert.ok(!chapter.includes('DRAFT_QUESTION'));
});

test('school PDF routes enforce roles, tenant/grade scope, credential opt-in and archive answers', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'school-report-'));
  const server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة التقارير', password: 'Reports-test123' });
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Reports-test123' })
    ).json().token;
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: 'reports-student', name: 'سارة <img src=x>', grade: '10', section: 'أ' },
        teacher,
      )
    ).json();
    const token = (await call('/api/login', 'POST', { role: 'student', code: student.code })).json()
      .token;
    const options = {
      sections: ['students', 'results', 'exams', 'banks', 'activity', 'accounts'],
      includeLoginCodes: false,
      includeAnswerDetails: true,
      includeArchived: true,
    };
    assert.equal((await call('/api/reports/document', 'POST', options)).statusCode, 403);
    assert.equal((await call('/api/reports/document', 'POST', options, token)).statusCode, 403);
    assert.equal(
      (await call('/api/reports/document', 'POST', { sections: [] }, teacher)).statusCode,
      400,
    );
    server.store.setSetting('openai-key', 'SECRET_API_KEY');
    const exam = {
      id: 'report-exam',
      title: 'امتحان جبر',
      subject: 'رياضيات',
      grade: '10',
      section: 'أ',
      term: 'الأول',
      kind: 'نصفي',
      duration: 30,
      total: 20,
      status: 'closed',
      questions: [
        {
          id: 'q1',
          text: 'السؤال الأصلي',
          options: ['1', '2', '3', '4'],
          correct: 0,
          explanation: 'تفسير',
        },
      ],
      code: 'EXAMCODE',
      opensAt: new Date().toISOString(),
      closesAt: new Date().toISOString(),
    };
    server.store.put('exams', exam);
    const attempt = {
      id: 'attempt1',
      studentId: student.id,
      examId: exam.id,
      score: 20,
      status: 'submitted',
      answers: { assigned: 1 },
      lateAnswers: { assigned: 0 },
      revisions: { assigned: 2 },
      startedAt: Date.now(),
      deadline: Date.now(),
      submittedAt: Date.now(),
      assignedQuestions: [
        {
          id: 'assigned',
          text: 'سؤال النموذج الخاص',
          options: ['1', '2', '3', '4'],
          correct: 1,
          explanation: 'تفسير النموذج',
        },
      ],
    };
    server.store.put('attempts', attempt);
    const response = await call('/api/reports/document', 'POST', options, teacher);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers['cache-control'], 'no-store');
    let html = response.json().html;
    assert.ok(!html.includes(student.code));
    assert.ok(!html.includes('EXAMCODE'));
    assert.ok(!html.includes('SECRET_API_KEY'));
    assert.ok(!html.includes(server.store.getSetting('password')));
    assert.match(html, /20 \/ 20/);
    assert.match(html, /سؤال النموذج الخاص/);
    assert.ok(!html.includes('السؤال الأصلي'));
    assert.match(html, /&lt;img src=x&gt;/);
    html = (
      await call('/api/reports/document', 'POST', { ...options, includeLoginCodes: true }, teacher)
    ).json().html;
    assert.ok(html.includes(student.code));
    assert.ok(html.includes('EXAMCODE'));
    await call(
      '/api/teachers',
      'POST',
      { username: 'report-other', name: 'معلم آخر', password: 'Other-report123', classes: [] },
      teacher,
    );
    const other = (
      await call('/api/login', 'POST', {
        role: 'teacher',
        username: 'report-other',
        password: 'Other-report123',
      })
    ).json().token;
    html = (
      await call('/api/reports/document', 'POST', { ...options, includeLoginCodes: true }, other)
    ).json().html;
    assert.ok(!html.includes(student.id));
    assert.ok(!html.includes(student.code));
    assert.ok(!html.includes('admin'));
    assert.equal(
      (await call(`/api/attempts/${attempt.id}/reopen`, 'POST', {}, teacher)).statusCode,
      200,
    );
    html = (await call('/api/reports/document', 'POST', options, teacher)).json().html;
    assert.match(html, /سؤال النموذج الخاص/);
    assert.match(html, /مؤرشفة/);
    html = (
      await call('/api/reports/document', 'POST', { ...options, includeArchived: false }, teacher)
    ).json().html;
    assert.ok(!html.includes('سؤال النموذج الخاص'));
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
