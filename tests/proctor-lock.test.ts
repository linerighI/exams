import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
test('proctor lock is teacher scoped, persists on restart, blocks answer/submit APIs, preserves work and keeps the original deadline', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'proctor-lock-'));
  let server = await createApp({ directory });
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const ok = async (url: string, method = 'GET', payload?: any, token?: string) => {
    const r = await call(url, method, payload, token);
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  try {
    await ok('/api/setup', 'POST', { school: 'Proctor test', password: 'Proctor-Test123' });
    let teacher = (await ok('/api/login', 'POST', { role: 'teacher', password: 'Proctor-Test123' }))
      .token;
    await ok(
      '/api/teachers',
      'POST',
      { username: 'other', name: 'Other teacher', password: 'Other-Test123' },
      teacher,
    );
    const other = (
      await ok('/api/login', 'POST', {
        role: 'teacher',
        username: 'other',
        password: 'Other-Test123',
      })
    ).token;
    const student = await ok(
      '/api/students',
      'POST',
      { id: 's1', name: 'طالب اختبار', grade: '10', section: 'أ' },
      teacher,
    );
    let token = (await ok('/api/login', 'POST', { role: 'student', code: student.code })).token;
    const exam = await ok(
      '/api/exams',
      'POST',
      {
        title: 'Proctor exam',
        subject: 'عربي',
        grade: '10',
        section: 'أ',
        term: 'الأول',
        kind: 'نصفي',
        duration: 30,
        total: 20,
        difficulty: 'سهل',
        cameraRequired: false,
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 3600000).toISOString(),
        questions: [
          {
            id: 'q1',
            text: 'اختر الإجابة',
            options: ['أ', 'ب', 'ج', 'د'],
            correct: 1,
            explanation: 'شرح',
            page: 1,
          },
        ],
      },
      teacher,
    );
    await ok('/api/exams/' + exam.id + '/publish', 'POST', {}, teacher);
    const started = await ok(
        '/api/attempts/start',
        'POST',
        { examId: exam.id, cameraAvailable: true },
        token,
      ),
      id = started.attempt.id,
      deadline = started.attempt.deadline;
    await ok(
      '/api/attempts/' + id + '/answers',
      'PUT',
      { answers: [{ questionId: 'q1', choice: 1, revision: 1 }] },
      token,
    );
    assert.equal(
      (await call('/api/attempts/' + id + '/proctor-lock', 'PUT', { active: true }, token))
        .statusCode,
      403,
    );
    assert.equal(
      (await call('/api/attempts/' + id + '/proctor-lock', 'PUT', { active: true }, other))
        .statusCode,
      404,
    );
    const locked = await ok(
      '/api/attempts/' + id + '/proctor-lock',
      'PUT',
      { active: true },
      teacher,
    );
    assert.ok(locked.proctorLock.active);
    assert.equal(locked.deadline, deadline);
    const duplicate = await ok(
      '/api/attempts/' + id + '/proctor-lock',
      'PUT',
      { active: true },
      teacher,
    );
    assert.equal(duplicate.proctorLock.lockedAt, locked.proctorLock.lockedAt);
    assert.equal(
      (
        await call(
          '/api/attempts/' + id + '/answers',
          'PUT',
          { answers: [{ questionId: 'q1', choice: 0, revision: 2 }] },
          token,
        )
      ).statusCode,
      423,
    );
    assert.equal(
      (await call('/api/attempts/' + id + '/submit', 'POST', {}, token)).statusCode,
      423,
    );
    const state = await ok('/api/attempts/' + id + '/status', 'GET', undefined, token);
    assert.equal(state.attempt.proctorLock.active, true);
    assert.equal(state.attempt.deadline, deadline);
    // Camera requests and camera responses remain available during a lock.
    const request = await ok('/api/attempts/' + id + '/camera', 'POST', {}, teacher);
    const pending = await ok('/api/attempts/' + id + '/camera', 'GET', undefined, token);
    const cameraRequest = pending.requests?.[0] || pending[0] || pending.request || request;
    assert.ok(cameraRequest);
    await ok(
      '/api/attempts/' + id + '/camera/' + cameraRequest.id,
      'POST',
      { error: 'camera unavailable in fixture' },
      token,
    );
    // Fetch and retry cannot clear a lock.
    assert.equal(
      (await ok('/api/attempts/start', 'POST', { examId: exam.id, cameraAvailable: true }, token))
        .attempt.proctorLock.active,
      true,
    );
    await server.app.close();
    server = await createApp({ directory });
    teacher = (await ok('/api/login', 'POST', { role: 'teacher', password: 'Proctor-Test123' }))
      .token;
    token = (await ok('/api/login', 'POST', { role: 'student', code: student.code })).token;
    const restored = await ok('/api/attempts/' + id, 'GET', undefined, token);
    assert.equal(restored.attempt.proctorLock.active, true);
    assert.equal(restored.attempt.answers.q1, 1);
    assert.equal(restored.attempt.deadline, deadline);
    const unlocked = await ok(
      '/api/attempts/' + id + '/proctor-lock',
      'PUT',
      { active: false },
      teacher,
    );
    assert.equal(unlocked.proctorLock.active, false);
    assert.equal(unlocked.deadline, deadline);
    await ok('/api/attempts/' + id + '/proctor-lock', 'PUT', { active: true }, teacher);
    await ok('/api/attempts/' + id + '/proctor-lock', 'PUT', { active: false }, teacher);
    await ok('/api/attempts/' + id + '/submit', 'POST', {}, token);
    assert.equal((await ok('/api/attempts/' + id, 'GET', undefined, teacher)).attempt.score, 20);
    // A locked attempt still expires normally; the proctor can remove its warning afterwards.
    const saved = server.store.get('attempts', id);
    saved.submittedAt = null;
    saved.status = 'active';
    saved.deadline = Date.now() + 20000;
    server.store.put('attempts', saved);
    await ok('/api/attempts/' + id + '/proctor-lock', 'PUT', { active: true }, teacher);
    const expired = server.store.get('attempts', id);
    expired.deadline = Date.now() - 100;
    server.store.put('attempts', expired);
    await ok('/api/attempts', 'GET', undefined, teacher);
    const after = await ok('/api/attempts/' + id + '/status', 'GET', undefined, token);
    assert.ok(after.attempt.submittedAt);
    assert.ok(after.attempt.proctorLock.active);
    await ok('/api/attempts/' + id + '/proctor-lock', 'PUT', { active: false }, teacher);
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
