import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { createApp } from '../server/app';
import { allowedRequestPath } from '../desktop/requestPolicy';
import { cameraError } from '../src/cameraAccess';
import { normalizeStudentCode } from '../src/studentCode';

test('desktop preview query options are accepted without opening arbitrary query routes', () => {
  const id = 'a'.repeat(32);
  assert.equal(
    allowedRequestPath(
      `/api/books/${id}/document?audience=student&title=${encodeURIComponent('بنك رياضيات')}&approvedOnly=true&chapter=`,
      'GET',
    ),
    true,
  );
  assert.equal(allowedRequestPath(`/api/books/${id}/document?audience=teacher`, 'POST'), false);
  for (const path of [
    '/api/setup?anything=yes',
    'https://evil.invalid/api/books/',
    '/api/login?role=teacher',
    `/api/books/${id}/document?url=https://evil.invalid`,
    `/api/books/${id}/document?title=x#fragment`,
  ])
    assert.equal(allowedRequestPath(path, 'GET'), false);
  assert.equal(
    allowedRequestPath(`/api/students/${encodeURIComponent('طالب ١')}/code`, 'POST'),
    true,
  );
});
test('camera errors distinguish permission, missing device and busy camera; passcodes accept Arabic digits', () => {
  assert.match(cameraError({ name: 'NotAllowedError' }), /Windows/);
  assert.match(cameraError({ name: 'NotFoundError' }), /لم نعثر/);
  assert.match(cameraError({ name: 'NotReadableError' }), /مشغولة/);
  assert.equal(normalizeStudentCode('١٢٣-٤٥٦'), '123456');
});
test('short student codes preserve legacy logins, block live resets, scope onboarding and export real safe Excel workbooks', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'comfort-'));
  const server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'المدرسة', password: 'Comfort-test123' });
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Comfort-test123' })
    ).json().token;
    const students = [];
    for (let i = 0; i < 25; i++) {
      const r = await call(
        '/api/students',
        'POST',
        {
          id: `00${i}`,
          name: i === 0 ? '=HYPERLINK("bad")' : 'طالب ' + i,
          grade: '10',
          section: 'أ',
        },
        teacher,
      );
      assert.equal(r.statusCode, 200, r.body);
      students.push(r.json());
    }
    assert.ok(students.every((s) => /^[1-9][0-9]{5}$/.test(s.code)));
    assert.equal(new Set(students.map((s) => s.code)).size, 25);
    const changed = await call(`/api/students/${students[0].id}/code`, 'POST', {}, teacher);
    assert.equal(changed.statusCode, 200);
    assert.notEqual(changed.json().code, students[0].code);
    const login = await call('/api/login', 'POST', {
      role: 'student',
      code: changed
        .json()
        .code.replace(/[0-9]/g, (c: string) => String.fromCharCode(Number(c) + 1632)),
    });
    assert.equal(login.statusCode, 200, login.body);
    const student = login.json().token;
    assert.equal(
      (await call(`/api/students/${students[0].id}/code`, 'POST', {}, teacher)).statusCode,
      409,
    );
    server.store.put('students', {
      id: 'legacy',
      name: 'طالب قديم',
      grade: '10',
      section: 'أ',
      code: 'AB12CD34EF56',
    });
    assert.equal(
      (await call('/api/login', 'POST', { role: 'student', code: 'ab12cd34ef56' })).statusCode,
      200,
    );
    assert.equal(
      (await call('/api/preferences/onboarding', 'GET', undefined, teacher)).json().seen,
      false,
    );
    await call('/api/preferences/onboarding', 'PUT', { seen: true }, teacher);
    assert.equal(
      (await call('/api/preferences/onboarding', 'GET', undefined, teacher)).json().seen,
      true,
    );
    assert.equal(
      (await call('/api/preferences/onboarding', 'PUT', { seen: true }, student)).statusCode,
      403,
    );
    const exported = await call('/api/exports/students', 'GET', undefined, teacher);
    assert.equal(exported.statusCode, 200);
    assert.equal(exported.headers['cache-control'], 'no-store');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(exported.json().data, 'base64') as any);
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.rowCount, 27);
    assert.equal(sheet.views[0].rightToLeft, true);
    assert.equal(sheet.getCell('A2').value, '000');
    assert.equal(sheet.getCell('B2').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('E2').value, changed.json().code);
    const template = (await call('/api/exports/template', 'GET', undefined, teacher)).json();
    const templateBook = new ExcelJS.Workbook();
    await templateBook.xlsx.load(Buffer.from(template.data, 'base64') as any);
    assert.equal(templateBook.worksheets[0].getCell('C2').value, '0123456789');
    assert.equal((await call('/api/exports/students', 'GET', undefined, student)).statusCode, 403);
    await call(
      '/api/teachers',
      'POST',
      { username: 'comfort-other', name: 'آخر', password: 'Comfort-other123' },
      teacher,
    );
    const other = (
      await call('/api/login', 'POST', {
        role: 'teacher',
        username: 'comfort-other',
        password: 'Comfort-other123',
      })
    ).json().token;
    assert.equal(
      (await call('/api/preferences/onboarding', 'GET', undefined, other)).json().seen,
      false,
    );
    const otherBook = new ExcelJS.Workbook();
    await otherBook.xlsx.load(
      Buffer.from(
        (await call('/api/exports/students', 'GET', undefined, other)).json().data,
        'base64',
      ) as any,
    );
    assert.equal(otherBook.worksheets[0].rowCount, 1);
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
