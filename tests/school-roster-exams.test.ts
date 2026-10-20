import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';

test('school JSON roster reaches assigned teachers and students can complete exams across teachers after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'school-roster-'));
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
      await call('/api/login', 'POST', { role: 'teacher', username, password: 'School-test123' })
    ).json().token;
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'School-test123' });
    let admin = await login();
    const file = (students: any[]) => ({
      filename: 'students.json',
      file: Buffer.from(JSON.stringify({ version: 1, students })).toString('base64'),
    });
    const preview = await call(
      '/api/students/roster/preview',
      'POST',
      file([
        {
          name: 'طالب المدرسة',
          grade: 'العاشر الأساسي',
          section: 'الشعبة أ',
          id: '001',
          national: '0123456789',
        },
        { name: 'طالب آخر', grade: 'التاسع', section: 'ب', id: '002' },
      ]),
      admin,
    );
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(preview.json().issues.length, 0);
    assert.ok(!preview.body.includes('0123456789'));
    assert.equal(
      (
        await call('/api/students/roster/commit', 'POST', { token: preview.json().token }, admin)
      ).json().count,
      2,
    );
    assert.equal(
      (
        await call(
          '/api/students/roster/preview',
          'POST',
          file([{ name: 'طالب', national: 123456789 }]),
          admin,
        )
      ).statusCode,
      400,
    );
    const accounts = [];
    for (const username of ['math', 'science', 'other']) {
      const account = await call(
        '/api/teachers',
        'POST',
        {
          username,
          name: username,
          password: 'School-test123',
          classes: [username === 'other' ? '["9","ب"]' : '["10","ا"]'],
        },
        admin,
      );
      assert.equal(account.statusCode, 200, account.body);
      accounts.push(account.json());
    }
    const tokens = await Promise.all(['math', 'science', 'other'].map(login));
    for (let i = 0; i < 2; i++) {
      const roster = (await call('/api/students', 'GET', undefined, tokens[i])).json();
      assert.equal(roster.length, 1);
      assert.equal(roster[0].id, '001');
    }
    assert.equal((await call('/api/students', 'GET', undefined, tokens[2])).json()[0].id, '002');
    const examInput = {
      title: 'امتحان المدرسة',
      subject: 'رياضيات',
      grade: '10',
      section: 'A',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 20,
      difficulty: 'سهل',
      cameraRequired: false,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions: [
        {
          id: 'q1',
          text: 'كم يساوي 2+2؟',
          options: ['4', '3', '2', '1'],
          correct: 0,
          explanation: 'جمع',
          page: 1,
        },
      ],
    };
    const exams = [];
    for (let i = 0; i < 2; i++) {
      const response = await call('/api/exams', 'POST', examInput, tokens[i]);
      assert.equal(response.statusCode, 200, response.body);
      exams.push(response.json());
      assert.equal(
        (await call(`/api/exams/${exams[i].id}/publish`, 'POST', {}, tokens[i])).statusCode,
        200,
      );
    }
    let student = (await call('/api/login', 'POST', { role: 'student', code: '0123456789' })).json()
      .token;
    assert.ok(student);
    const listing = await call('/api/exams', 'GET', undefined, student);
    assert.equal(listing.json().length, 2, listing.body);
    assert.ok(listing.json().every((e: any) => e.questions.length === 0));
    const attempts = [];
    for (const [examIndex, exam] of exams.entries()) {
      const started = await call(
        '/api/attempts/start',
        'POST',
        { examId: exam.id, cameraAvailable: false },
        student,
      );
      assert.equal(started.statusCode, 200, started.body);
      const attempt = started.json().attempt;
      attempts.push(attempt);
      const heartbeat = await call(
        '/api/lab/heartbeat',
        'POST',
        {
          clientId: 'shared-client-001',
          platform: 'Windows',
          page: 'exam',
          attemptId: attempt.id,
          camera: 'idle',
        },
        student,
      );
      assert.equal(heartbeat.statusCode, 200, heartbeat.body);
      const devices = (await call('/api/lab', 'GET', undefined, tokens[examIndex])).json().devices;
      assert.equal(devices[0].attemptId, attempt.id);
      assert.equal(devices[0].studentId, '001');
      const saved = await call(
        `/api/attempts/${attempt.id}/answers`,
        'PUT',
        { answers: [{ questionId: 'q1', choice: 0, revision: 1 }] },
        student,
      );
      assert.equal(saved.statusCode, 200, saved.body);
      assert.equal(
        (await call(`/api/attempts/${attempt.id}/submit`, 'POST', {}, student)).statusCode,
        200,
      );
    }
    assert.equal((await call('/api/attempts', 'GET', undefined, student)).json().length, 2);
    for (let i = 0; i < 2; i++) {
      const own = (await call('/api/attempts', 'GET', undefined, tokens[i])).json();
      assert.equal(own.length, 1);
      assert.equal(own[0].score, 20);
      assert.equal(own[0].studentName, 'طالب المدرسة');
      assert.equal(
        (await call(`/api/attempts/${attempts[1 - i].id}`, 'GET', undefined, tokens[i])).statusCode,
        404,
      );
    }
    assert.equal((await call('/api/attempts', 'GET', undefined, tokens[2])).json().length, 0);
    await server.app.close();
    server = await createApp({ directory });
    admin = await login();
    student = (await call('/api/login', 'POST', { role: 'student', code: '0123456789' })).json()
      .token;
    assert.equal((await call('/api/exams', 'GET', undefined, student)).json().length, 2);
    assert.equal((await call('/api/attempts', 'GET', undefined, student)).json().length, 2);
    const revoked = await call(`/api/teachers/${accounts[0].id}`, 'PATCH', { classes: [] }, admin);
    assert.equal(revoked.statusCode, 200, revoked.body);
    assert.equal((await call('/api/exams', 'GET', undefined, student)).json().length, 1);
    assert.equal(
      (await call(`/api/attempts/${attempts[0].id}`, 'GET', undefined, student)).statusCode,
      404,
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
