import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { checkRosterZip } from '../server/studentRoster';

test('Excel roster import previews, masks identities, commits atomically and authenticates without leaking credentials', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'roster-')),
    server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Password123' });
    const token = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Password123' })
    ).json().token;
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet('العاشر');
    sheet.addRow(['قائمة المدرسة']);
    sheet.addRow(['اسم الطالب', 'الرقم الوطني', 'الصف', 'الشعبة']);
    sheet.addRow(['أحمد علي', '0123456789', 'العاشر', 'أ']);
    sheet.addRow(['خالد عمر', '٩٨٧٦٥٤٣٢١٠', 'العاشر', 'ب']);
    const data = {
      filename: 'school.xlsx',
      file: Buffer.from(await book.xlsx.writeBuffer()).toString('base64'),
    };
    assert.equal((await call('/api/students/roster/preview', 'POST', data)).statusCode, 403);
    const result = await call('/api/students/roster/preview', 'POST', data, token);
    assert.equal(result.statusCode, 200, result.body);
    const preview = result.json();
    assert.equal(preview.headerRow, 2);
    assert.equal(preview.added, 2);
    assert.equal(preview.issues.length, 0);
    assert.ok(!result.body.includes('0123456789'));
    assert.ok(!result.body.includes('9876543210'));
    assert.equal((await call('/api/students', 'GET', undefined, token)).json().length, 0);
    const commit = await call(
      '/api/students/roster/commit',
      'POST',
      { token: preview.token },
      token,
    );
    assert.equal(commit.statusCode, 200, commit.body);
    assert.equal(
      (await call('/api/students/roster/commit', 'POST', { token: preview.token }, token))
        .statusCode,
      400,
    );
    const students = (await call('/api/students', 'GET', undefined, token)).json();
    assert.equal(students.length, 2);
    const serialized = JSON.stringify(students);
    assert.ok(!serialized.includes('0123456789'));
    assert.ok(!serialized.includes('hash'));
    assert.equal(students[0].loginMethod, 'national');
    const login = await call('/api/login', 'POST', { role: 'student', code: '٠١٢٣٤٥٦٧٨٩' });
    assert.equal(login.statusCode, 200, login.body);
    assert.equal(login.json().student.name, 'أحمد علي');
    assert.equal(
      (await call('/api/students/roster/preview', 'POST', data, login.json().token)).statusCode,
      403,
    );
    assert.equal(
      (await call('/api/login', 'POST', { role: 'student', code: '0123456788' })).statusCode,
      401,
    );
    const again = (await call('/api/students/roster/preview', 'POST', data, token)).json();
    assert.equal(again.existing, 2);
    assert.equal(
      (await call('/api/students/roster/commit', 'POST', { token: again.token }, token)).json()
        .skipped,
      2,
    );
    const backup = (await call('/api/backup', 'GET', undefined, token)).body;
    assert.ok(!backup.includes('0123456789'));
    assert.ok(backup.includes('student-national-credentials'));
    await call(
      '/api/teachers',
      'POST',
      { username: 'other', name: 'آخر', password: 'Password456' },
      token,
    );
    const other = (
      await call('/api/login', 'POST', {
        role: 'teacher',
        username: 'other',
        password: 'Password456',
      })
    ).json().token;
    const conflict = (await call('/api/students/roster/preview', 'POST', data, other)).json();
    assert.equal(conflict.token, '');
    assert.equal(conflict.issues.length, 2);
    const duplicate = {
      filename: 'students.csv',
      file: Buffer.from(
        'اسم الطالب,الرقم الوطني,الصف\nطالب أول,1111111111,العاشر\nطالب ثان,1111111111,العاشر',
      ).toString('base64'),
    };
    const invalid = (await call('/api/students/roster/preview', 'POST', duplicate, token)).json();
    assert.equal(invalid.token, '');
    assert.equal(invalid.issues.length, 1);
    assert.equal((await call('/api/students', 'GET', undefined, token)).json().length, 2);
    const mapping = {
      filename: 'custom.csv',
      file: Buffer.from('Student,Identity\nطالب جديد,2222222222').toString('base64'),
      grade: 'التاسع',
    };
    assert.equal(
      (await call('/api/students/roster/preview', 'POST', mapping, token)).json().token,
      '',
    );
    const mapped = (
      await call(
        '/api/students/roster/preview',
        'POST',
        { ...mapping, columns: { name: 0, national: 1 } },
        token,
      )
    ).json();
    assert.equal(mapped.added, 1);
    assert.ok(mapped.token);
    assert.equal(
      (await call('/api/students/roster/commit', 'POST', { token: mapped.token }, other))
        .statusCode,
      400,
    );
    assert.equal(
      (await call('/api/students/roster/commit', 'POST', { token: mapped.token }, token)).json()
        .count,
      1,
    );
    const layout = { order: ['writer', 'calculator'], workflow: ['blueprint', 'writer'] };
    assert.equal((await call('/api/workspace', 'PUT', layout, token)).statusCode, 200);
    assert.deepEqual((await call('/api/workspace', 'GET', undefined, token)).json(), layout);
    assert.notDeepEqual((await call('/api/workspace', 'GET', undefined, other)).json(), layout);
    assert.equal(
      (await call('/api/workspace', 'PUT', { ...layout, workflow: ['writer', 'writer'] }, token))
        .statusCode,
      400,
    );
    assert.equal(
      (await call('/api/workspace/summary', 'GET', undefined, token)).json().students,
      3,
    );
    assert.equal(
      (await call('/api/workspace/summary', 'GET', undefined, login.json().token)).statusCode,
      403,
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('roster ZIP rejects malformed and inflated archives before parsing Excel', () => {
  assert.throws(() => checkRosterZip(Buffer.from('bad')));
  const bytes = Buffer.alloc(70);
  bytes.writeUInt32LE(0x02014b50, 0);
  bytes.writeUInt32LE(17 * 1024 * 1024, 24);
  bytes.writeUInt32LE(0x06054b50, 48);
  bytes.writeUInt16LE(1, 58);
  bytes.writeUInt32LE(0, 64);
  assert.throws(() => checkRosterZip(bytes));
});
