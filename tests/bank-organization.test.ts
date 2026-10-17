import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';

test('bank folders and bulk actions persist, enforce ownership, validate approval atomically and preserve other banks', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bank-organization-'));
  let server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const login = async (username = 'admin', password = 'Organization123') =>
    (await call('/api/login', 'POST', { role: 'teacher', username, password })).json().token;
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة الاختبار', password: 'Organization123' });
    let token = await login();
    await call(
      '/api/teachers',
      'POST',
      { username: 'second', name: 'المعلم الثاني', password: 'Second-test123' },
      token,
    );
    const other = await login('second', 'Second-test123');
    const data = {
      version: 1,
      batchId: 'organization',
      book: {
        title: 'بنك الرياضيات',
        subject: 'الرياضيات',
        grade: '10',
        term: 'الأول',
        pageCount: 10,
      },
      questions: [1, 2, 3].map((n) => ({
        text: `ما ناتج ${n}+2؟`,
        options: ['3', '4', '5', '6'],
        correct: n - 1,
        explanation: 'الجمع',
        page: 1,
        difficulty: 'سهل',
        chapter: 'الجبر',
        evidence: 'مثال',
      })),
    };
    const b = (await call('/api/bank/import/commit', 'POST', { data }, token)).json().bookId;
    const base = `/api/books/${b}`;
    const qs = () => call(`${base}/questions`, 'GET', undefined, token).then((r) => r.json());
    const ids = (await qs()).map((q: any) => q.id);
    assert.equal((await call(`${base}/organization`)).statusCode, 403);
    assert.equal((await call(`${base}/organization`, 'GET', undefined, other)).statusCode, 404);
    const f = (
      await call(`${base}/folders`, 'POST', { name: 'المعادلات', color: 'mint' }, token)
    ).json();
    assert.ok(f.id);
    assert.equal(
      (await call(`${base}/folders`, 'POST', { name: ' المعادلات ', color: 'blue' }, token))
        .statusCode,
      409,
    );
    assert.equal(
      (await call(`${base}/folders`, 'POST', { name: 'اسم', color: 'red-script' }, token))
        .statusCode,
      400,
    );
    const bulk = (body: any, auth = token) => call(`${base}/questions/bulk`, 'POST', body, auth);
    assert.equal(
      (await bulk({ ids: [ids[0], 'missing'], action: 'move', folderId: f.id })).statusCode,
      404,
    );
    assert.deepEqual(
      (await call(`${base}/organization`, 'GET', undefined, token)).json().questionFolders,
      {},
    );
    assert.equal((await bulk({ ids, action: 'move', folderId: f.id })).statusCode, 200);
    assert.equal((await bulk({ ids, action: 'approve' }, other)).statusCode, 404);
    // A missing required image must reject the entire batch without approving its valid peers.
    server.store.put('bank_questions', {
      ...(await qs()).find((q: any) => q.id === ids[1]),
      requiresImage: true,
    });
    assert.equal((await bulk({ ids, action: 'approve' })).statusCode, 400);
    assert.ok((await qs()).every((q: any) => q.status === 'draft'));
    server.store.put('bank_questions', {
      ...(await qs()).find((q: any) => q.id === ids[1]),
      requiresImage: false,
    });
    const approved = await bulk({ ids, action: 'approve' });
    assert.equal(approved.statusCode, 200, approved.body);
    assert.ok((await qs()).every((q: any) => q.status === 'approved'));
    assert.equal((await bulk({ ids: [ids[0]], action: 'draft' })).statusCode, 200);
    assert.equal((await qs()).find((q: any) => q.id === ids[0]).status, 'draft');
    server.store.put('bank_questions', {
      ...(await qs()).find((q: any) => q.id === ids[0]),
      chapter: 'الم\uFFFDعادلات',
    });
    assert.equal((await bulk({ ids, action: 'approve' })).statusCode, 400);
    assert.equal(
      (
        await call(
          `${base}/chapter`,
          'PUT',
          { previous: 'الم\uFFFDعادلات', name: 'المعادلات' },
          token,
        )
      ).statusCode,
      200,
    );
    assert.equal((await qs()).find((q: any) => q.id === ids[0]).chapter, 'المعادلات');
    const corrupted = structuredClone(data);
    corrupted.book.title = 'بنك تالف';
    corrupted.questions[0].chapter = 'الم\uFFFDعادلات';
    const preview = (
      await call('/api/bank/import/preview', 'POST', { data: corrupted }, token)
    ).json();
    assert.equal(preview.rejected.length, 1);
    await call(`${base}/folders/${f.id}`, 'PUT', { name: 'تدريب', color: 'rose' }, token);
    await server.app.close();
    server = await createApp({ directory });
    token = await login();
    const persisted = (await call(`${base}/organization`, 'GET', undefined, token)).json();
    assert.equal(persisted.folders[0].name, 'تدريب');
    assert.equal(persisted.questionFolders[ids[0]], f.id);
    const backup = (await call('/api/backup', 'GET', undefined, token)).json();
    assert.ok(backup.tables.settings.some((row: any) => row.key === `bank-organization:${b}`));
    assert.equal(
      (await call(`${base}/folders/${f.id}`, 'DELETE', undefined, token)).statusCode,
      200,
    );
    assert.equal((await qs()).length, 3);
    assert.deepEqual(
      (await call(`${base}/organization`, 'GET', undefined, token)).json().questionFolders,
      {},
    );
    assert.equal((await bulk({ ids: [ids[0], 'absent'], action: 'delete' })).statusCode, 404);
    assert.equal((await qs()).length, 3);
    assert.equal((await bulk({ ids: [ids[0]], action: 'delete' })).statusCode, 200);
    assert.equal((await qs()).length, 2);
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: '1', name: 'طالب', grade: '10', section: 'أ' },
        token,
      )
    ).json();
    const st = (await call('/api/login', 'POST', { role: 'student', code: student.code })).json()
      .token;
    assert.equal((await bulk({ ids: [ids[1]], action: 'approve' }, st)).statusCode, 403);
    assert.equal((await call('/api/restore', 'POST', backup, token)).statusCode, 200);
    token = await login();
    assert.equal((await qs()).length, 3);
    assert.deepEqual(
      (await call(`${base}/organization`, 'GET', undefined, token)).json(),
      persisted,
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
