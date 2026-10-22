import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app';

test('teacher distributes verified update bytes to students; active exams defer installation and a lease blocks new starts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'school-updates-'));
  const bytes = Buffer.from('official verified installer fixture'),
    hash = createHash('sha256').update(bytes).digest('hex');
  const file = join(directory, 'update.exe');
  writeFileSync(file, bytes);
  const server = await createApp({
    directory,
    updatePackage: async () => ({
      version: '1.5.5',
      size: bytes.length,
      hash,
      notes: 'تحديث',
      file,
    }),
  });
  const call = (url: string, method = 'GET', payload?: any, token?: string, headers = {}) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Update-test123' });
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Update-test123' })
    ).json().token;
    server.store.put('students', {
      id: 's',
      name: 'طالب التحديث',
      grade: 'العاشر',
      section: 'أ',
      code: 'STUDENTUPDATE',
    });
    const studentLogin = await call('/api/login', 'POST', {
      role: 'student',
      code: 'STUDENTUPDATE',
    });
    assert.equal(studentLogin.statusCode, 200, studentLogin.body);
    const student = studentLogin.json().token;
    assert.equal((await call('/api/school-updates/student')).statusCode, 403);
    assert.equal((await call('/api/school-updates/publish', 'POST', {}, student)).statusCode, 403);
    const publish = await call('/api/school-updates/publish', 'POST', {}, teacher);
    assert.equal(publish.statusCode, 200, publish.body);
    const campaign = publish.json();
    assert.ok(!publish.body.includes(file));
    assert.equal(
      (await call('/api/school-updates/student', 'GET', undefined, student)).json().campaign.id,
      campaign.id,
    );
    const download = await call(
      `/api/school-updates/${campaign.id}/file`,
      'GET',
      undefined,
      student,
    );
    assert.deepEqual(download.rawPayload, bytes);
    const partial = await call(
      `/api/school-updates/${campaign.id}/file`,
      'GET',
      undefined,
      student,
      { range: 'bytes=5-' },
    );
    assert.equal(partial.statusCode, 206);
    assert.deepEqual(partial.rawPayload, bytes.subarray(5));
    assert.equal(
      (
        await call(`/api/school-updates/${campaign.id}/file`, 'GET', undefined, student, {
          range: 'bytes=999-',
        })
      ).statusCode,
      416,
    );
    const report = {
      campaignId: campaign.id,
      clientId: 'device-123456',
      current: '1.5.4',
      status: 'installing',
      progress: 100,
    };
    server.store.put('exams', { id: 'ex', grade: 'العاشر', section: 'أ', questions: [] });
    server.store.put('attempts', {
      id: 'attempt',
      examId: 'ex',
      studentId: 's',
      deadline: Date.now() + 60000,
    });
    assert.equal(
      (await call('/api/school-updates/student', 'GET', undefined, student)).json().active,
      true,
    );
    assert.equal(
      (await call('/api/school-updates/student/status', 'POST', report, student)).statusCode,
      409,
    );
    server.store.put('attempts', {
      id: 'attempt',
      examId: 'ex',
      studentId: 's',
      deadline: Date.now() + 60000,
      submittedAt: Date.now(),
    });
    assert.equal(
      (await call('/api/school-updates/student/status', 'POST', report, student)).statusCode,
      200,
    );
    const start = await call('/api/attempts/start', 'POST', {}, student);
    assert.equal(start.statusCode, 409, start.body);
    const dashboard = (await call('/api/school-updates', 'GET', undefined, teacher)).json();
    assert.equal(dashboard.devices[0].status, 'installing');
    assert.equal(dashboard.devices[0].name, 'طالب التحديث');
    await call('/api/teachers','POST',{username:'other',name:'معلم آخر',password:'Update-other123'},teacher);
    const otherLogin=await call('/api/login','POST',{role:'teacher',username:'other',password:'Update-other123'});
    assert.equal(otherLogin.statusCode,200,otherLogin.body);
    const otherDashboard=(await call('/api/school-updates','GET',undefined,otherLogin.json().token)).json();
    assert.equal(otherDashboard.campaign,null);assert.deepEqual(otherDashboard.devices,[]);
    await call('/api/school-updates', 'DELETE', undefined, teacher);
    assert.equal(
      (await call('/api/school-updates/student', 'GET', undefined, student)).json().campaign,
      null,
    );
    assert.equal(
      (await call(`/api/school-updates/${campaign.id}/file`, 'GET', undefined, student)).statusCode,
      404,
    );
  } finally {
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
