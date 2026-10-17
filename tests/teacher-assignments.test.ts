import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';

test('only admins assign grades; server blocks unassigned students/exams, imports and privilege escalation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'assigned-grades-'));
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
      await call('/api/login', 'POST', { role: 'teacher', username, password: 'Assignments123' })
    ).json().token;
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Assignments123' });
    let admin = await login();
    for (const [id, grade, section] of [
      ['c7', 'السابع', 'أ'],
      ['c8', 'الثامن', 'أ'],
    ])
      server.store.put('students', { id, name: 'طالب', grade, section });
    const c7 = '["7","ا"]',
      c8 = '["8","ا"]';
    assert.deepEqual(
      (await call('/api/teacher-classes', 'GET', undefined, admin))
        .json()
        .map((c:any) => c.id)
        .sort(),
      [c7, c8],
    );
    const account = (
      await call(
        '/api/teachers',
        'POST',
        { username: 'teacher7', name: 'معلم', password: 'Assignments123', classes: [c7, c8] },
        admin,
      )
    ).json();
    let teacher = await login('teacher7');
    const student = { id: 's1', name: 'طالب', grade: 'الصف السابع', section: 'أ' };
    assert.equal(
      (
        await call(
          '/api/students',
          'POST',
          { ...student, id: 'wrong-section', section: 'ب' },
          teacher,
        )
      ).statusCode,
      403,
    );
    assert.equal((await call('/api/teacher-classes', 'GET', undefined, teacher)).statusCode, 403);
    assert.equal(
      (await call('/api/teachers/' + account.id, 'PATCH', { classes: ['["1","ا"]'] }, admin))
        .statusCode,
      400,
    );
    assert.equal((await call('/api/students', 'POST', student, teacher)).statusCode, 200);
    assert.equal(
      (await call('/api/students', 'POST', { ...student, id: 's10', grade: 'العاشر' }, teacher))
        .statusCode,
      403,
    );
    assert.equal(
      (await call(`/api/teachers/${account.id}`, 'PATCH', { classes: ['["10","ا"]'] }, teacher))
        .statusCode,
      403,
    );
    assert.equal(
      (
        await call(
          '/api/account',
          'PUT',
          { name: 'معلم', currentPassword: 'Assignments123', classes: ['["10","ا"]'] },
          teacher,
        )
      ).statusCode,
      200,
    );
    assert.deepEqual(
      (await call('/api/account', 'GET', undefined, teacher)).json().classes.map((c: any) => c.id),
      [c7, c8],
    );
    const exam = {
      title: 'امتحان',
      subject: 'رياضيات',
      grade: 'السابع',
      section: 'أ',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 20,
      difficulty: 'سهل',
      cameraRequired: false,
      opensAt: new Date().toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions: [
        {
          id: 'q1',
          text: 'احسب 2+3',
          options: ['5', '6', '7', '8'],
          correct: 0,
          explanation: 'جمع',
          page: 1,
        },
      ],
    };
    const created = await call('/api/exams', 'POST', exam, teacher);
    assert.equal(created.statusCode, 200, created.body);
    assert.equal(
      (await call('/api/exams', 'POST', { ...exam, grade: '١٠' }, teacher)).statusCode,
      403,
    );
    const csv = 'id,name,grade,section\ns2,طالب ثان,7,أ\ns3,طالب ثالث,10,أ';
    assert.equal((await call('/api/students/import', 'POST', { csv }, teacher)).statusCode, 403);
    assert.equal((await call('/api/students', 'GET', undefined, teacher)).json().length, 1);
    const backup = (await call('/api/backup', 'GET', undefined, teacher)).json();
    const bad = structuredClone(backup);
    bad.tables.students.push({
      id: 'bad',
      data: JSON.stringify({ ...student, id: 'bad', grade: 'العاشر' }),
    });
    assert.ok((await call('/api/restore', 'POST', bad, teacher)).statusCode >= 400);
    assert.equal((await call('/api/students', 'GET', undefined, teacher)).json().length, 1);
    assert.equal(
      (await call(`/api/teachers/${account.id}`, 'PATCH', { classes: [c8] }, admin)).statusCode,
      200,
    );
    assert.equal((await call('/api/students', 'GET', undefined, teacher)).json().length, 0);
    assert.equal((await call('/api/exams', 'GET', undefined, teacher)).json().length, 0);
    assert.equal(
      (await call(`/api/exams/${created.json().id}/publish`, 'POST', {}, teacher)).statusCode,
      403,
    );
    assert.equal((await call('/api/backup', 'GET', undefined, teacher)).statusCode, 403);
    assert.equal((await call('/api/restore', 'POST', backup, teacher)).statusCode, 403);
    // Removing access hides old records without deleting them. Assignment is rechecked on existing sessions.
    await call(`/api/teachers/${account.id}`, 'PATCH', { classes: [c7, c8] }, admin);
    assert.equal((await call('/api/students', 'GET', undefined, teacher)).json().length, 1);
    await server.app.close();
    server = await createApp({ directory });
    teacher = await login('teacher7');
    admin = await login();
    assert.equal((await call('/api/exams', 'GET', undefined, teacher)).json().length, 1);
    assert.deepEqual(
      (await call('/api/teachers', 'GET', undefined, admin))
        .json()
        .find((a: any) => a.id === account.id)
        .classes.map((c: any) => c.id),
      [c7, c8],
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
