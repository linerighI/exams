// Real HTTP + WebSocket traffic on loopback. This does not measure school Wi-Fi.
import { createRequestQueue } from '../desktop/requestQueue';
import { createApp } from '../server/app';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import WebSocket from 'ws';
import selfsigned from 'selfsigned';
import { request as httpsRequest } from 'node:https';

const directory = mkdtempSync(join(tmpdir(), 'school-network-load-'));
const tls = process.env.LOAD_TLS === '1';
const certificate = tls
  ? await selfsigned.generate([{ name: 'commonName', value: 'Load test' }], { keySize: 2048 })
  : undefined;
let server = await createApp({
  directory,
  ...(certificate ? { https: { key: certificate.private, cert: certificate.cert } } : {}),
});
const count = Number(process.env.LOAD_STUDENTS || 30),
  rounds = Number(process.env.LOAD_ROUNDS || 12);
const loopDelay = monitorEventLoopDelay({ resolution: 20 });
loopDelay.enable();
const background = new Set<Promise<unknown>>();
const backgroundErrors: unknown[] = [];
let heartbeatTimer: ReturnType<typeof setInterval> | undefined,
  watchTimer: ReturnType<typeof setInterval> | undefined;
const samples: Record<string, number[]> = {};
let received = 0,
  events = 0,
  ws: WebSocket | undefined;
await server.app.listen({ host: '127.0.0.1', port: 0 });
const address = server.app.server.address() as any;
const base = `http${tls ? 's' : ''}://127.0.0.1:${address.port}`;
async function allRequests<T>(requests: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(requests);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length)
    throw new AggregateError(
      failures.map((result) => (result as PromiseRejectedResult).reason),
      'Concurrent load requests failed',
    );
  return results.map((result) => (result as PromiseFulfilledResult<T>).value);
}
const clientQueues = new Map<string, ReturnType<typeof createRequestQueue>>();
async function call(path: string, method = 'GET', body?: any, token?: string, measured = false) {
  const start = performance.now();
  const client = token || 'setup';
  if (!clientQueues.has(client)) clientQueues.set(client, createRequestQueue());
  return clientQueues.get(client)!(async () => {
    const options = {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    };
    const response = tls
      ? await new Promise<{ status: number; text: () => Promise<string> }>((resolve, reject) => {
          // Fresh TLS socket per call, matching the desktop client's current transport.
          const req = httpsRequest(
            base + path,
            {
              method,
              headers: options.headers,
              rejectUnauthorized: false,
              agent: false,
              signal: options.signal,
            },
            (res) => {
              let text = '';
              res.setEncoding('utf8');
              res.on('data', (chunk) => (text += chunk));
              res.on('end', () => resolve({ status: res.statusCode!, text: async () => text }));
              res.on('error', reject);
            },
          );
          req.on('error', (error) =>
            reject(new Error(`${method} ${path}: ${error.message}`, { cause: error })),
          );
          req.end(options.body);
        })
      : await fetch(base + path, options);
    const bytes = await response.text();
    received += Buffer.byteLength(bytes);
    assert.equal(response.status, 200, `${method} ${path}: ${bytes.slice(0, 300)}`);
    if (measured)
      (samples[
        path.endsWith('/status')
          ? 'attempt-status'
          : path.endsWith('/submit')
            ? 'submit'
            : path.includes('/answers')
              ? 'answer-save'
              : path.includes('/frame') && !path.endsWith('/frames')
                ? 'camera-upload'
                : path
      ] ||= []).push(performance.now() - start);
    return JSON.parse(bytes);
  });
}
try {
  await call('/api/setup', 'POST', { school: 'اختبار شبكة 30 طالب', password: 'Network-test123' });
  let teacher = (await call('/api/login', 'POST', { role: 'teacher', password: 'Network-test123' }))
    .token;
  const rosterOwner = teacher;
  const sharedRoster = process.env.LOAD_SHARED === '1';
  if (sharedRoster) {
    await call(
      '/api/students',
      'POST',
      { id: 'class-fixture', name: 'طالب الصف', grade: '10', section: 'أ' },
      rosterOwner,
    );
    await call(
      '/api/teachers',
      'POST',
      {
        username: 'examteacher',
        name: 'معلم الامتحان',
        password: 'Network-test123',
        classes: ['["10","ا"]'],
      },
      rosterOwner,
    );
    teacher = (
      await call('/api/login', 'POST', {
        role: 'teacher',
        username: 'examteacher',
        password: 'Network-test123',
      })
    ).token;
  }
  // A diagram-heavy random exam: 30 questions, each containing a ~26 KB diagram.
  const image =
    'data:image/jpeg;base64,' +
    (
      await sharp({
        create: {
          width: 240,
          height: 160,
          channels: 3,
          background: '#29839b',
          noise: { type: 'gaussian', mean: 128, sigma: 35 },
        },
      })
        .jpeg({ quality: 85 })
        .toBuffer()
    ).toString('base64');
  const questions = Array.from({ length: 30 }, (_, i) => ({
    id: `q${i}`,
    text: `السؤال ${i + 1}: اقرأ الشكل واحسب الناتج`,
    options: ['1', '2', '3', '4'],
    correct: 0,
    explanation: 'الإجابة الأولى',
    page: 1,
    chapter: 'حساب',
    difficulty: 'سهل',
    image,
  }));
  const exam = await call(
    '/api/exams',
    'POST',
    {
      title: 'امتحان ضغط الشبكة',
      subject: 'رياضيات',
      grade: '10',
      section: 'أ',
      term: 'الأول',
      kind: 'نصفي',
      duration: 45,
      total: 20,
      difficulty: 'سهل',
      cameraRequired: false,
      opensAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      questions,
      delivery: {
        mode: 'random',
        count: 10,
        quotas: [{ chapter: 'حساب', difficulty: 'سهل', count: 10 }],
      },
    },
    teacher,
  );
  await call(`/api/exams/${exam.id}/publish`, 'POST', {}, teacher);
  const students: {
    token: string;
    id: string;
    clientId: string;
    attempt: any;
    questions: any[];
  }[] = [];
  for (let i = 0; i < count; i++) {
    const student = await call(
      '/api/students',
      'POST',
      { id: `load-${i}`, name: `طالب ${i + 1}`, grade: '10', section: 'أ' },
      rosterOwner,
    );
    const token = (await call('/api/login', 'POST', { role: 'student', code: student.code })).token;
    students.push({
      token,
      id: student.id,
      clientId: `load-client-${i.toString().padStart(4, '0')}`,
      attempt: undefined as any,
      questions: [] as any[],
    });
  }
  ws = new WebSocket(`${base.replace('http', 'ws')}/api/events?token=${teacher}`, {
    rejectUnauthorized: !tls,
  });
  await new Promise<void>((resolve, reject) => {
    ws!.once('open', resolve);
    ws!.once('error', reject);
  });
  ws.on('message', () => events++);
  await allRequests(
    students.map(async (s) => {
      const data = await call(
        '/api/attempts/start',
        'POST',
        { examId: exam.id, cameraAvailable: true },
        s.token,
        true,
      );
      s.attempt = data.attempt;
      s.questions = data.questions;
    }),
  );
  const heartbeat = (s: (typeof students)[number]) =>
    call(
      '/api/lab/heartbeat',
      'POST',
      {
        clientId: s.clientId,
        platform: 'Windows',
        page: 'exam',
        attemptId: s.attempt.id,
        camera: 'live',
      },
      s.token,
      true,
    );
  await allRequests(students.map(heartbeat));
  await call('/api/lab/watch', 'POST', { active: true }, teacher);
  await call('/api/lab/cameras', 'POST', { start: true }, teacher);
  // Real clients renew camera interest every 1.5 s and heartbeat every 4 s,
  // independently of how long answer/camera batches take. Do not tie leases to rounds.
  const beating = new Set<string>();
  let watching = false;
  const runBackground = (job: Promise<unknown>) => {
    background.add(job);
    void job.catch((error) => backgroundErrors.push(error)).finally(() => background.delete(job));
  };
  heartbeatTimer = setInterval(
    () =>
      students.forEach((s) => {
        if (beating.has(s.id)) return;
        beating.add(s.id);
        runBackground(heartbeat(s).finally(() => beating.delete(s.id)));
      }),
    4000,
  );
  watchTimer = setInterval(() => {
    if (watching) return;
    watching = true;
    runBackground(
      call('/api/lab/watch', 'POST', { active: true }, teacher, true).finally(() => {
        watching = false;
      }),
    );
  }, 1500);
  const started = performance.now();
  console.log(`Connected ${count} students; starting answer/camera traffic.`);
  for (let r = 1; r <= rounds; r++) {
    await allRequests([
      ...students.flatMap((s) => [
        call(`/api/attempts/${s.attempt.id}/status`, 'GET', undefined, s.token, true),
        call(
          `/api/attempts/${s.attempt.id}/answers`,
          'PUT',
          { answers: s.questions.map((q) => ({ questionId: q.id, choice: 0, revision: r })) },
          s.token,
          true,
        ),
        call(`/api/lab/devices/${s.clientId}/frame`, 'POST', { image }, s.token, true),
        ...(r % 3 === 0
          ? [
              call('/api/exams', 'GET', undefined, s.token, true),
              call('/api/attempts', 'GET', undefined, s.token, true),
            ]
          : []),
      ]),
      call('/api/attempts', 'GET', undefined, teacher, true),
      call('/api/lab', 'GET', undefined, teacher, true),
      call('/api/lab/frames', 'GET', undefined, teacher, true),
    ]);
    // Like StudentLiveSession, wait after the previous upload completes.
    await new Promise((resolve) => setTimeout(resolve, 1050));
    if (r % 4 === 0) console.log(`Completed ${r}/${rounds} synchronized rounds.`);
  }
  clearInterval(heartbeatTimer);
  clearInterval(watchTimer);
  await Promise.allSettled([...background]);
  assert.deepEqual(backgroundErrors, [], 'independent heartbeat/watch requests must succeed');
  const liveFrames = await call('/api/lab/frames', 'GET', undefined, teacher);
  assert.equal(liveFrames.frames.length, count, 'all students have recent camera frames');
  const liveDevices = await call('/api/lab', 'GET', undefined, teacher);
  assert.equal(liveDevices.devices.filter((d: any) => d.online).length, count);
  await allRequests(
    students.map((s) => call(`/api/attempts/${s.attempt.id}/submit`, 'POST', {}, s.token, true)),
  );
  const attempts = await call('/api/attempts', 'GET', undefined, teacher);
  assert.equal(attempts.length, count);
  for (const a of attempts) {
    assert.equal(a.score, 20);
    assert.equal(a.status, 'submitted');
    assert.equal(Object.keys(a.answers).length, 10);
    assert.ok(Object.values(a.revisions).every((v) => v === rounds));
  }
  assert.ok(events > 0, 'teacher WebSocket received updates');
  // Close and reopen the same disposable database: verify disk persistence,
  // not just the in-memory/HTTP response from the original process.
  ws.terminate();
  await server.app.close();
  server = await createApp({ directory });
  const reauth = await server.app.inject({
    url: '/api/login',
    method: 'POST',
    payload: {
      role: 'teacher',
      username: sharedRoster ? 'examteacher' : 'admin',
      password: 'Network-test123',
    },
  });
  assert.equal(reauth.statusCode, 200, reauth.body);
  const restored = await server.app.inject({
    url: '/api/attempts',
    headers: { authorization: `Bearer ${reauth.json().token}` },
  });
  assert.equal(restored.statusCode, 200, restored.body);
  const recovered = restored.json();
  assert.equal(recovered.length, count);
  for (const saved of recovered) {
    const original = attempts.find((a: any) => a.id === saved.id);
    assert.deepEqual(saved.answers, original.answers);
    assert.deepEqual(saved.revisions, original.revisions);
    assert.equal(saved.score, original.score);
    assert.equal(saved.status, 'submitted');
  }

  const percentile = (values: number[], p: number) =>
    Math.round(
      [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))],
    );
  const result = {
    students: count,
    sharedRoster,
    maxRequestsPerClient: 4,
    rounds,
    seconds: Math.round((performance.now() - started) / 1000),
    transport: `loopback ${tls ? 'HTTPS (fresh socket per request)' : 'HTTP'} + teacher WebSocket; ${count} simultaneous camera senders`,
    cpu: cpus()[0]?.model,
    diagramBytes: Buffer.byteLength(image),
    receivedMB: Math.round(received / 1024 / 1024),
    websocketEvents: events,
    latency: Object.fromEntries(
      Object.entries(samples).map(([key, v]) => [
        key,
        {
          requests: v.length,
          p50Ms: percentile(v, 0.5),
          p95Ms: percentile(v, 0.95),
          maxMs: Math.round(Math.max(...v)),
        },
      ]),
    ),
    eventLoopP95Ms: Math.round(loopDelay.percentile(95) / 1e6),
    eventLoopMaxMs: Math.round(loopDelay.max / 1e6),
    memoryRssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    verifiedAfterServerRestart: true,
    allScoresCorrect: true,
  };
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    `test-results/network-load-${process.env.LOAD_LABEL || 'latest'}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Load test failure:', error);
  throw error;
} finally {
  clearInterval(heartbeatTimer);
  clearInterval(watchTimer);
  loopDelay.disable();
  await Promise.allSettled([...background]);
  ws?.terminate();
  await server.app.close();
  rmSync(directory, { recursive: true, force: true });
}
