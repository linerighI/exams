import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store';
import { registerStudentRoster, parseRosterJson } from '../server/studentRoster';

test('JSON imports name-only students and partial updates preserve grade and national login', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'roster-json-'));
  const store = openStore(directory),
    app = Fastify();
  registerStudentRoster(
    app,
    store,
    () => {},
    () => [],
  );
  const preview = (students: unknown, extra = {}) =>
    app.inject({
      method: 'POST',
      url: '/api/students/roster/preview',
      payload: { source: 'json', json: JSON.stringify({ students }), ...extra },
    });
  const commit = (token: string) =>
    app.inject({ method: 'POST', url: '/api/students/roster/commit', payload: { token } });
  try {
    const first = (
      await preview([{ name: 'طالب أول' }, { name: 'طالبة ثانية', grade: 'العاشر' }])
    ).json();
    assert.equal(first.count, 2);
    assert.ok(first.token);
    assert.equal(first.issues.length, 0);
    assert.equal(store.all('students').length, 0);
    assert.equal((await commit(first.token)).json().count, 2);
    const onlyName = store.all('students').find((s) => s.name === 'طالب أول');
    assert.equal(onlyName.grade, '');
    assert.equal(onlyName.section, '');
    assert.ok(onlyName.code);
    const national = (
      await preview([
        {
          id: 'school-1',
          name: 'طالب ثالث',
          national: '0123456789',
          grade: 'التاسع',
          section: 'ب',
        },
      ])
    ).json();
    assert.ok(!JSON.stringify(national).includes('0123456789'));
    await commit(national.token);
    const credential = store.getSetting('student-national-credentials')['school-1'];
    const partial = (
      await preview([{ id: 'school-1', name: 'طالب ثالث محدث' }], { mode: 'update' })
    ).json();
    assert.equal(partial.existing, 1);
    assert.ok(partial.token);
    assert.equal(partial.rows[0].grade, 'التاسع');
    await commit(partial.token);
    assert.equal(store.get('students', 'school-1').grade, 'التاسع');
    assert.equal(store.get('students', 'school-1').loginMethod, 'national');
    assert.deepEqual(store.getSetting('student-national-credentials')['school-1'], credential);
    const incomplete = (await preview([{ name: 'طالب برقم ناقص', national: '123' }])).json();
    assert.ok(incomplete.token);
    assert.equal(incomplete.warnings.length, 1);
    assert.equal((await commit(incomplete.token)).json().count, 1);
    assert.ok(store.all('students').find((s) => s.name === 'طالب برقم ناقص').code);
    assert.equal((await preview([{ grade: 'العاشر' }])).statusCode, 400);
    assert.equal(
      parseRosterJson('```json\n[{"name":"طالب","national":null}]\n```')[0].national,
      '',
    );
  } finally {
    await app.close();
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Gemini workbook path receives every sheet and previews incomplete records without saving', async () => {
  const { default: ExcelJS } = await import('exceljs');
  const directory = mkdtempSync(join(tmpdir(), 'roster-gemini-'));
  const store = openStore(directory),
    app = Fastify();
  let calls = 0;
  registerStudentRoster(
    app,
    store,
    () => {},
    () => [],
    () => {},
    undefined,
    async (sheets) => {
      calls++;
      assert.deepEqual(
        sheets.map((s) => s.name),
        ['غلاف', 'طلاب أ', 'طلاب ب'],
      );
      assert.equal(sheets[2].rows[1][0], 'طالبة ثانية');
      return { students: [{ name: 'طالب أول' }, { name: 'طالبة ثانية', section: 'ب' }] };
    },
  );
  try {
    const book = new ExcelJS.Workbook();
    book.addWorksheet('غلاف').addRow(['مدرسة']);
    book.addWorksheet('طلاب أ').addRows([['اسم الطالب'], ['طالب أول']]);
    book.addWorksheet('طلاب ب').addRows([['اسم الطالب'], ['طالبة ثانية']]);
    const result = await app.inject({
      method: 'POST',
      url: '/api/students/roster/preview',
      payload: {
        source: 'gemini',
        filename: 'school.xlsx',
        file: Buffer.from(await book.xlsx.writeBuffer()).toString('base64'),
      },
    });
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(calls, 1);
    assert.equal(result.json().count, 2);
    assert.ok(result.json().token);
    assert.equal(result.json().rows[1].section, 'ب');
    assert.equal(store.all('students').length, 0);
  } finally {
    await app.close();
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('partial JSON does not bypass class assignment checks', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'roster-class-'));
  const store = openStore(directory),
    app = Fastify();
  registerStudentRoster(
    app,
    store,
    () => {},
    () => [],
    (grade) => {
      if (grade !== 'العاشر') throw Error('forbidden');
    },
  );
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/students/roster/preview',
      payload: { source: 'json', json: '{"students":[{"name":"طالب"}]}' },
    });
    assert.equal(response.json().token, '');
    assert.equal(response.json().issues.length, 1);
    assert.equal(store.all('students').length, 0);
  } finally {
    await app.close();
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
