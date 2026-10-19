import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import ExcelJS from 'exceljs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store';
import { registerStudentRoster } from '../server/studentRoster';
test('roster finds later worksheet and Arabic headers, imports without national ID, and maps unusual Excel headers without sharing records', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'roster-flex-'));
  const store = openStore(directory);
  const app = Fastify();
  registerStudentRoster(
    app,
    store,
    () => {},
    () => [],
    () => {},
    async (headers, profiles) => {
      assert.deepEqual(headers, ['Pupil label', 'School year']);
      assert.ok(!JSON.stringify(profiles).includes('PRIVATE STUDENT'));
      return { name: 0, national: -1, id: -1, grade: 1, section: -1 };
    },
  );
  try {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('غلاف').addRow(['قائمة المدرسة']);
    const sheet = book.addWorksheet('الطلاب');
    sheet.addRow(['مدرسة الاختبار']);
    sheet.addRow(['اسم الطالبة', 'الصف', 'الشعبة']);
    sheet.addRow(['سارة علي', 'العاشر', 'ب']);
    const result = await app.inject({
      method: 'POST',
      url: '/api/students/roster/preview',
      payload: {
        filename: 'list.xlsx',
        file: Buffer.from(await book.xlsx.writeBuffer()).toString('base64'),
      },
    });
    const p = result.json();
    assert.equal(p.count, 1, result.body);
    assert.equal(p.sheet, 'الطلاب');
    assert.equal(p.headerRow, 2);
    assert.ok(p.token);
    assert.equal(store.all('students').length, 0);
    const commit = await app.inject({
      method: 'POST',
      url: '/api/students/roster/commit',
      payload: { token: p.token },
    });
    assert.equal(commit.json().count, 1, commit.body);
    assert.ok(store.all('students')[0].code);
    assert.equal(store.all('students')[0].loginMethod, undefined);
    const csv = {
      filename: 'odd.csv',
      file: Buffer.from('Pupil label;School year\nPRIVATE STUDENT;العاشر').toString('base64'),
    };
    const unmapped = (
      await app.inject({ method: 'POST', url: '/api/students/roster/preview', payload: csv })
    ).json();
    assert.equal(unmapped.count, 0);
    assert.ok(unmapped.issues.length);
    const mapped = await app.inject({
      method: 'POST',
      url: '/api/students/roster/preview',
      payload: { ...csv, ai: true },
    });
    assert.equal(mapped.json().count, 1, mapped.body);
    assert.equal(mapped.json().aiMapped, true);
    assert.ok(mapped.json().token);
    const repeated = (
      await app.inject({
        method: 'POST',
        url: '/api/students/roster/preview',
        payload: {
          filename: 'again.xlsx',
          file: Buffer.from(await book.xlsx.writeBuffer()).toString('base64'),
        },
      })
    ).json();
    assert.equal(repeated.existing, 1);
    assert.equal(repeated.added, 0);
  } finally {
    await app.close();
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
