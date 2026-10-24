import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { createApp } from '../server/app';

test('live lab scopes devices and ephemeral camera frames, expires leases, enforces exemptions and stops on submission', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'live-lab-'));
  const server = await createApp({ directory });
  const realNow = Date.now;
  let advance = 0;
  Date.now = () => realNow() + advance;
  const call = (url: string, method = 'GET', payload?: any, token?: string) =>
    server.app.inject({
      url,
      method: method as any,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  try {
    await call('/api/setup', 'POST', { school: 'مدرسة', password: 'Live-test123' });
    const teacher = (
      await call('/api/login', 'POST', { role: 'teacher', password: 'Live-test123' })
    ).json().token;
    await call(
      '/api/teachers',
      'POST',
      { username: 'teacher2', name: 'معلم ثان', password: 'Other-test123' },
      teacher,
    );
    const other = (
      await call('/api/login', 'POST', {
        role: 'teacher',
        username: 'teacher2',
        password: 'Other-test123',
      })
    ).json().token;
    const student = (
      await call(
        '/api/students',
        'POST',
        { id: '1', name: 'سارة', grade: '10', section: 'أ' },
        teacher,
      )
    ).json();
    const token = (await call('/api/login', 'POST', { role: 'student', code: student.code })).json()
      .token;
    const exam = (
      await call(
        '/api/exams',
        'POST',
        {
          title: 'الرياضيات',
          subject: 'الرياضيات',
          grade: '10',
          section: 'أ',
          term: 'الأول',
          kind: 'نصفي',
          duration: 45,
          total: 20,
          difficulty: 'سهل',
          cameraRequired: false,
          opensAt: new Date(Date.now() - 60000).toISOString(),
          closesAt: new Date(Date.now() + 86400000).toISOString(),
          questions: [
            {
              id: 'q1',
              text: 'ما ناتج 2+3؟',
              options: ['5', '6', '7', '8'],
              correct: 0,
              explanation: 'جمع',
              page: 1,
            },
          ],
        },
        teacher,
      )
    ).json();
    await call(`/api/exams/${exam.id}/publish`, 'POST', {}, teacher);
    const attempt = (
      await call('/api/attempts/start', 'POST', { examId: exam.id, cameraAvailable: true }, token)
    ).json().attempt;
    const heartbeat = {
      clientId: 'client-test-123',
      platform: 'Windows',
      page: 'exam',
      attemptId: attempt.id,
      camera: 'idle',
    };
    assert.equal(
      (await call('/api/lab/heartbeat', 'POST', heartbeat, token)).json().cameraRequested,
      false,
    );
    assert.equal((await call('/api/lab', 'GET', undefined, token)).statusCode, 403);
    assert.equal((await call('/api/lab/frames', 'GET', undefined, token)).statusCode, 403);
    assert.deepEqual((await call('/api/lab', 'GET', undefined, other)).json().devices, []);
    assert.equal((await call('/api/lab/watch', 'POST', { active: true }, token)).statusCode, 403);
    const image =
      'data:image/jpeg;base64,' +
      (
        await sharp({ create: { width: 32, height: 32, channels: 3, background: '#336699' } })
          .jpeg()
          .toBuffer()
      ).toString('base64');
    assert.equal(
      (await call(`/api/lab/devices/${heartbeat.clientId}/frame`, 'POST', { image }, token))
        .statusCode,
      403,
    );
    await call('/api/lab/watch', 'POST', { active: true }, teacher);
    await call('/api/lab/cameras', 'POST', { start: true }, teacher);
    const request = (await call('/api/lab/heartbeat', 'POST', heartbeat, token)).json();
    assert.equal(request.cameraRequested, true);
    assert.ok(request.requestVersion > 0);
    assert.equal(
      (await call(`/api/lab/devices/${heartbeat.clientId}/frame`, 'POST', { image }, token))
        .statusCode,
      200,
    );
    const frames = (await call('/api/lab/frames', 'GET', undefined, teacher)).json().frames;
    assert.equal(frames.length, 1);
    assert.equal(frames[0].image, image);
    assert.deepEqual((await call('/api/lab/frames', 'GET', undefined, other)).json().frames, []);
    const backup = (await call('/api/backup', 'GET', undefined, teacher)).json();
    assert.equal(JSON.stringify(backup).includes(image), false);
    assert.equal(
      (await call(`/api/lab/devices/${heartbeat.clientId}/frame`, 'POST', { image }, token))
        .statusCode,
      429,
    );
    assert.equal((await call('/api/attempts/'+attempt.id+'/proctor-lock','PUT',{active:true},teacher)).statusCode,200);
    assert.equal((await call('/api/lab/heartbeat','POST',heartbeat,token)).json().cameraRequested,true);
    advance += 1100;
    assert.equal((await call('/api/lab/devices/'+heartbeat.clientId+'/frame','POST',{image},token)).statusCode,200);
    assert.equal((await call('/api/lab','GET',undefined,teacher)).json().devices[0].proctorLock.active,true);
    await call('/api/attempts/'+attempt.id+'/proctor-lock','PUT',{active:false},teacher);
    advance += 7000;
    assert.deepEqual((await call('/api/lab/frames', 'GET', undefined, teacher)).json().frames, []);
    await call('/api/lab/heartbeat', 'POST', heartbeat, token);
    await call(`/api/lab/devices/${heartbeat.clientId}/pause`, 'POST', {}, token);
    await call('/api/lab/cameras', 'POST', { start: true }, teacher);
    assert.ok(
      (await call('/api/lab/heartbeat', 'POST', heartbeat, token)).json().requestVersion >
        request.requestVersion,
    );
    await call('/api/camera/exempt', 'POST', { examId: exam.id, studentId: student.id }, teacher);
    assert.equal(
      (await call('/api/lab/heartbeat', 'POST', heartbeat, token)).json().cameraAllowed,
      false,
    );
    assert.equal(
      (await call(`/api/lab/devices/${heartbeat.clientId}/frame`, 'POST', { image }, token))
        .statusCode,
      403,
    );
    advance += 21000;
    assert.equal(
      (await call('/api/lab', 'GET', undefined, teacher)).json().devices[0].online,
      false,
    );
    await call('/api/lab/heartbeat', 'POST', heartbeat, token);
    assert.equal(
      (await call('/api/lab/heartbeat', 'POST', heartbeat, token)).json().cameraRequested,
      false,
    );
    await call(`/api/attempts/${attempt.id}/submit`, 'POST', {}, token);
    assert.equal(
      (await call('/api/lab/heartbeat', 'POST', heartbeat, token)).json().cameraAllowed,
      false,
    );
    await call('/api/lab/watch', 'POST', { active: false }, teacher);
    assert.deepEqual((await call('/api/lab/frames', 'GET', undefined, teacher)).json().frames, []);
  } finally {
    Date.now = realNow;
    await server.app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
