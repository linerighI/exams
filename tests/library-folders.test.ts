import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app';

test('library folders persist, isolate teachers, move books atomically, survive backup and never delete questions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'library-folders-'));
  let server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const login = async (username = 'admin', password = 'Folder-test123') =>
    (await call('/api/login', 'POST', { role: 'teacher', username, password })).json().token;
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة المجلدات', password: 'Folder-test123' });
    let owner = await login();
    await call(
      '/api/teachers',
      'POST',
      { username: 'teacher2', name: 'المعلم الثاني', password: 'Second-test123' },
      owner,
    );
    const other = await login('teacher2', 'Second-test123');
    const data = {
      version: 1,
      batchId: 'folders',
      book: { title: 'الرياضيات', subject: 'الرياضيات', grade: '10', term: 'الأول', pageCount: 10 },
      questions: [
        {
          text: 'ما ناتج 2+3؟',
          options: ['5', '6', '7', '8'],
          correct: 0,
          explanation: 'الجمع',
          page: 1,
          difficulty: 'سهل',
          chapter: 'الجبر',
          evidence: 'مثال',
        },
      ],
    };
    const book = (await call('/api/bank/import/commit', 'POST', { data }, owner)).json();
    const otherBook = (await call('/api/bank/import/commit', 'POST', { data }, other)).json();
    assert.ok(book.bookId);
    assert.ok(otherBook.bookId);
    const folder = (
      await call('/api/library/folders', 'POST', { name: 'الصف العاشر', color: 'mint' }, owner)
    ).json();
    assert.ok(folder.id);
    assert.equal(
      (await call('/api/library/folders', 'POST', { name: ' الصف العاشر ', color: 'rose' }, owner))
        .statusCode,
      409,
    );
    assert.equal(
      (await call('/api/library/folders', 'POST', { name: '', color: 'blue' }, owner)).statusCode,
      400,
    );
    assert.equal(
      (await call('/api/library/folders', 'POST', { name: 'اسم', color: 'javascript:red' }, owner))
        .statusCode,
      400,
    );
    assert.equal((await call('/api/library/folders')).statusCode, 403);
    assert.deepEqual(
      (await call('/api/library/folders', 'GET', undefined, other)).json().folders,
      [],
    );
    assert.equal(
      (
        await call(
          `/api/library/folders/${folder.id}`,
          'PUT',
          { name: 'تعديل', color: 'blue' },
          other,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await call(
          '/api/library/move',
          'PUT',
          { bookIds: [otherBook.bookId], folderId: folder.id },
          other,
        )
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await call(
          '/api/library/move',
          'PUT',
          { bookIds: [book.bookId, otherBook.bookId], folderId: folder.id },
          owner,
        )
      ).statusCode,
      404,
    );
    assert.deepEqual(
      (await call('/api/library/folders', 'GET', undefined, owner)).json().bookFolders,
      {},
    );
    assert.equal(
      (
        await call(
          '/api/library/move',
          'PUT',
          { bookIds: [book.bookId], folderId: folder.id },
          owner,
        )
      ).statusCode,
      200,
    );
    await call(
      `/api/library/folders/${folder.id}`,
      'PUT',
      { name: 'مراجعة الفصل الأول', color: 'violet' },
      owner,
    );
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: '1', name: 'طالب', grade: '10', section: 'أ' },
        owner,
      )
    ).json();
    const studentToken = (
      await call('/api/login', 'POST', { role: 'student', code: student.code })
    ).json().token;
    assert.equal(
      (await call('/api/library/folders', 'GET', undefined, studentToken)).statusCode,
      403,
    );
    assert.equal(
      (
        await call(
          '/api/library/move',
          'PUT',
          { bookIds: [book.bookId], folderId: null },
          studentToken,
        )
      ).statusCode,
      403,
    );
    await server.app.close();
    server = await createApp({ directory });
    owner = await login();
    const persisted = (await call('/api/library/folders', 'GET', undefined, owner)).json();
    assert.equal(persisted.bookFolders[book.bookId], folder.id);
    assert.equal(persisted.folders[0].name, 'مراجعة الفصل الأول');
    assert.equal(persisted.folders[0].color, 'violet');
    const backup = (await call('/api/backup', 'GET', undefined, owner)).json();
    assert.ok(backup.tables.settings.some((row: any) => row.key === 'library-organization'));
    await call(`/api/library/folders/${folder.id}`, 'DELETE', undefined, owner);
    assert.deepEqual((await call('/api/library/folders', 'GET', undefined, owner)).json(), {
      folders: [],
      bookFolders: {},
    });
    assert.equal((await call('/api/books', 'GET', undefined, owner)).json().length, 1);
    assert.equal(
      (await call(`/api/books/${book.bookId}/questions`, 'GET', undefined, owner)).json().length,
      1,
    );
    assert.equal((await call('/api/restore', 'POST', backup, owner)).statusCode, 200);
    owner = await login();
    assert.deepEqual(
      (await call('/api/library/folders', 'GET', undefined, owner)).json(),
      persisted,
    );
    await call('/api/library/move', 'PUT', { bookIds: [book.bookId], folderId: null }, owner);
    assert.deepEqual(
      (await call('/api/library/folders', 'GET', undefined, owner)).json().bookFolders,
      {},
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

