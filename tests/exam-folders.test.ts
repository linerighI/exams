import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
test('exam folders isolate teachers, persist, reject partial moves and preserve exams on deletion', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'exam-folders-'));
  let server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const login = async (username = 'admin') =>
    (
      await call('/api/login', 'POST', { role: 'teacher', username, password: 'Folder-test123' })
    ).json().token;
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Folder-test123' });
    let owner = await login();
    await call(
      '/api/teachers',
      'POST',
      { username: 'other', name: 'معلم آخر', password: 'Folder-test123' },
      owner,
    );
    const other = await login('other');
    server.store.put('exams', {
      id: 'e1',
      title: 'الرياضيات',
      status: 'closed',
      questions: [{ id: 'q1' }],
    });
    assert.equal((await call('/api/exam-folders')).statusCode, 403);
    const folder = (
      await call('/api/exam-folders', 'POST', { name: 'العاشر', color: 'mint' }, owner)
    ).json();
    assert.ok(folder.id);
    assert.equal(
      (await call('/api/exam-folders', 'POST', { name: ' العاشر ', color: 'blue' }, owner))
        .statusCode,
      409,
    );
    assert.equal(
      (
        await call(
          '/api/exams/move',
          'PUT',
          { examIds: ['e1', 'missing'], folderId: folder.id },
          owner,
        )
      ).statusCode,
      404,
    );
    assert.deepEqual(
      (await call('/api/exam-folders', 'GET', undefined, owner)).json().examFolders,
      {},
    );
    assert.equal(
      (await call('/api/exams/move', 'PUT', { examIds: ['e1'], folderId: folder.id }, owner))
        .statusCode,
      200,
    );
    assert.equal(
      (await call('/api/exam-folders', 'GET', undefined, owner)).json().examFolders.e1,
      folder.id,
    );
    assert.equal(
      (
        await call(
          `/api/exam-folders/${folder.id}`,
          'PUT',
          { name: 'رياضيات', color: 'violet' },
          other,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (await call('/api/exams/move', 'PUT', { examIds: ['e1'], folderId: folder.id }, other))
        .statusCode,
      404,
    );
    assert.equal(
      (await call('/api/exam-folders', 'GET', undefined, other)).json().folders.length,
      0,
    );
    await call(
      `/api/exam-folders/${folder.id}`,
      'PUT',
      { name: 'رياضيات', color: 'violet' },
      owner,
    );
    const backup = (await call('/api/backup', 'GET', undefined, owner)).json();
    assert.ok(backup.tables.settings.some((row: any) => row.key === 'exam-organization'));
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: 's1', name: 'طالب', grade: '10', section: 'أ' },
        owner,
      )
    ).json();
    const studentToken = (
      await call('/api/login', 'POST', { role: 'student', code: student.code })
    ).json().token;
    assert.equal((await call('/api/exam-folders', 'GET', undefined, studentToken)).statusCode, 403);
    assert.equal(
      (await call('/api/exams/move', 'PUT', { examIds: ['e1'], folderId: null }, studentToken))
        .statusCode,
      403,
    );
    await server.app.close();
    server = await createApp({ directory });
    owner = await login();
    const saved = (await call('/api/exam-folders', 'GET', undefined, owner)).json();
    assert.equal(saved.folders[0].name, 'رياضيات');
    assert.equal(saved.examFolders.e1, folder.id);
    assert.equal(
      (await call(`/api/exam-folders/${folder.id}`, 'DELETE', undefined, owner)).statusCode,
      200,
    );
    assert.deepEqual((await call('/api/exam-folders', 'GET', undefined, owner)).json(), {
      folders: [],
      examFolders: {},
    });
    assert.equal(server.store.get('exams', 'e1').questions[0].id, 'q1');
    assert.equal(server.store.get('exams', 'e1').status, 'closed');
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
