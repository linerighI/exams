import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { assertCanHost, assertHostElection } from '../desktop/hostPolicy';
import { bankPrompt } from '../src/bankExchange';

test('paired clients and other discovered main PCs cannot be promoted to a second host', () => {
  const base = { hosting: false, role: '', discovered: [], localAddresses: ['192.168.1.20'] };
  assert.doesNotThrow(() => assertCanHost(base));
  assert.throws(() => assertCanHost({ ...base, role: 'student' }), /الجهاز الرئيسي/);
  assert.throws(() => assertCanHost({ ...base, target: { host: '192.168.1.10' } }), /مرتبط/);
  assert.throws(
    () => assertCanHost({ ...base, discovered: [{ host: '192.168.1.10', school: 'مدرستي' }] }),
    /مدرستي/,
  );
  assert.doesNotThrow(() => assertCanHost({ ...base, hosting: true, role: 'teacher' }));
  assert.doesNotThrow(() =>
    assertHostElection('A', base.localAddresses, [
      { host: '192.168.1.10', deviceId: 'B', hostState: 'starting' },
    ]),
  );
  assert.throws(() =>
    assertHostElection('B', base.localAddresses, [
      { host: '192.168.1.10', deviceId: 'A', hostState: 'starting' },
    ]),
  );
  assert.throws(() =>
    assertHostElection('A', base.localAddresses, [
      { host: '192.168.1.10', deviceId: 'Z', hostState: 'active' },
    ]),
  );
});

test('picture preference creates figure-dependent instructions or self-contained text questions', () => {
  const meta = { title: 'فيزياء', subject: 'فيزياء', grade: '10', term: 'الأول' };
  assert.match(bankPrompt(meta, 50, '', 'مختلط', true), /تتطلب قراءة الرسم نفسه/);
  assert.match(bankPrompt(meta, 50, '', 'مختلط', true), /دائرة كهربائية/);
  assert.match(bankPrompt(meta, 50, '', 'مختلط', false), /أسئلة دون صور/);
  assert.match(bankPrompt(meta, 50, '', 'مختلط', false), /لا تعتمد على صورة مفقودة/);
});

test('blank banks, manual questions and blank exam drafts work without PDF or AI; approval and tenant boundaries remain enforced', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'manual-bank-'));
  const server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Manual-test123' });
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Manual-test123' })
    ).json().token;
    const bankResponse = await call(
      '/api/books/manual',
      'POST',
      { title: 'بنك يدوي', subject: 'رياضيات', grade: '10', term: 'الأول' },
      teacher,
    );
    assert.equal(bankResponse.statusCode, 200, bankResponse.body);
    const bank = bankResponse.json();
    assert.equal(bank.questions, 0);
    assert.equal(bank.hasPdf, false);
    const input = {
      text: 'ما ناتج جمع 2 و3؟',
      options: ['1', '3', '5', '7'],
      correct: 2,
      explanation: 'نجمع العددين.',
      page: 1,
      difficulty: 'سهل',
      chapter: 'جمع',
      evidence: 'أعده المعلم',
      status: 'draft',
      requiresImage: false,
    };
    const question = (await call(`/api/books/${bank.id}/questions`, 'POST', input, teacher)).json();
    assert.ok(question.id);
    assert.equal(question.status, 'draft');
    const missingImage = await call(
      `/api/books/${bank.id}/questions`,
      'POST',
      { ...input, status: 'approved', requiresImage: true },
      teacher,
    );
    assert.notEqual(missingImage.statusCode, 200);
    const duplicateOptions = await call(
      `/api/books/${bank.id}/questions`,
      'POST',
      { ...input, options: ['1', '1', '2', '3'] },
      teacher,
    );
    assert.notEqual(duplicateOptions.statusCode, 200);
    const image =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK9sAAAAASUVORK5CYII=';
    assert.equal(
      (
        await call(
          `/api/books/${bank.id}/questions`,
          'POST',
          { ...input, status: 'approved', requiresImage: true, image },
          teacher,
        )
      ).statusCode,
      200,
    );
    const examInput = {
      title: 'امتحان يدوي',
      subject: 'رياضيات',
      grade: '10',
      section: '',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 20,
      difficulty: 'مختلط',
      cameraRequired: false,
      opensAt: new Date().toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions: [],
    };
    const empty = await call('/api/exams', 'POST', examInput, teacher);
    assert.equal(empty.statusCode, 200, empty.body);
    assert.notEqual(
      (await call(`/api/exams/${empty.json().id}/publish`, 'POST', undefined, teacher)).statusCode,
      200,
    );
    const draft = await call(
      `/api/exams/${empty.json().id}`,
      'PUT',
      { ...examInput, questions: [{ ...input, id: 'manual-1', image }] },
      teacher,
    );
    assert.equal(draft.statusCode, 200, draft.body);
    assert.equal(
      (await call(`/api/exams/${draft.json().id}/publish`, 'POST', undefined, teacher)).statusCode,
      200,
    );
    await call(
      '/api/teachers',
      'POST',
      { username: 'teacher2', name: 'معلم ثان', password: 'Manual-other123', classes: [] },
      teacher,
    );
    assert.equal(server.hasActiveAttempts(), false);
    assert.equal(server.beginUpdateMaintenance(), true);
    const student = (await call('/api/students', 'POST', { id: 'manual-student', name: 'طالب', grade: '10', section: 'أ' }, teacher)).json();
    const studentToken = (await call('/api/login', 'POST', { role: 'student', code: student.code })).json().token;
    assert.equal((await call('/api/attempts/start', 'POST', { examId: draft.json().id, cameraAvailable: false }, studentToken)).statusCode, 503);
    server.cancelUpdateMaintenance();
    assert.equal((await call('/api/attempts/start', 'POST', { examId: draft.json().id, cameraAvailable: false }, studentToken)).statusCode, 200);
    assert.equal(server.hasActiveAttempts(), true);
    assert.equal(server.beginUpdateMaintenance(), false);
    const other = (
      await call('/api/login', 'POST', {
        role: 'teacher',
        username: 'teacher2',
        password: 'Manual-other123',
      })
    ).json().token;
    assert.ok(other);
    assert.equal((await call('/api/books', 'GET', undefined, other)).json().length, 0);
    assert.notEqual(
      (await call(`/api/books/${bank.id}/questions`, 'POST', input, other)).statusCode,
      200,
    );
    assert.notEqual(
      (await call('/api/books/manual', 'POST', { title: 'غير مصرح' })).statusCode,
      200,
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
