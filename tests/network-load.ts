// Real HTTP + WebSocket traffic on loopback. This does not measure school Wi-Fi.
import { createApp } from '../server/app';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
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
const server = await createApp({
  directory,
  ...(certificate ? { https: { key: certificate.private, cert: certificate.cert } } : {}),
});
const count = Number(process.env.LOAD_STUDENTS || 30),
  rounds = 12;
const samples: Record<string, number[]> = {};
let received = 0,
  events = 0,
  ws: WebSocket | undefined;
await server.app.listen({ host: '127.0.0.1', port: 0 });
const address = server.app.server.address() as any;
const base = `http${tls ? 's' : ''}://127.0.0.1:${address.port}`;
async function call(path: string, method = 'GET', body?: any, token?: string, measured = false) {
  const start = performance.now();
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
        req.on('error', reject);
        req.end(options.body);
      })
    : await fetch(base + path, options);
  const bytes = await response.text();
  received += Buffer.byteLength(bytes);
  assert.equal(response.status, 200, `${method} ${path}: ${bytes.slice(0, 300)}`);
  if (measured)
    (samples[
      path.endsWith('/submit')
        ? 'submit'
        : path.includes('/answers')
          ? 'answer-save'
          : path.includes('/frame') && !path.endsWith('/frames')
            ? 'camera-upload'
            : path
    ] ||= []).push(performance.now() - start);
  return JSON.parse(bytes);
}
try {
  await call('/api/setup', 'POST', { school: 'اختبار شبكة 30 طالب', password: 'Network-test123' });
  const teacher = (
    await call('/api/login', 'POST', { role: 'teacher', password: 'Network-test123' })
  ).token;
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
      teacher,
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
  await Promise.all(
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
  await Promise.all(students.map(heartbeat));
  await call('/api/lab/watch', 'POST', { active: true }, teacher);
  await call('/api/lab/cameras', 'POST', { start: true }, teacher);
  const started = performance.now();
  console.log(`Connected ${count} students; starting answer/camera traffic.`);
  for (let r = 1; r <= rounds; r++) {
    await Promise.all([
      ...students.flatMap((s) => [
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
              heartbeat(s),
              call('/api/exams', 'GET', undefined, s.token, true),
              call('/api/attempts', 'GET', undefined, s.token, true),
            ]
          : []),
      ]),
      call('/api/attempts', 'GET', undefined, teacher, true),
      call('/api/lab', 'GET', undefined, teacher, true),
      call('/api/lab/frames', 'GET', undefined, teacher, true),
      ...(r % 5 === 0 ? [call('/api/lab/watch', 'POST', { active: true }, teacher)] : []),
    ]);
    // Like StudentLiveSession, wait after the previous upload completes.
    await new Promise((resolve) => setTimeout(resolve, 1050));
    if (r % 4 === 0) console.log(`Completed ${r}/${rounds} synchronized rounds.`);
  }
  const liveFrames = await call('/api/lab/frames', 'GET', undefined, teacher);
  assert.equal(liveFrames.frames.length, count, 'all students have recent camera frames');
  const liveDevices = await call('/api/lab', 'GET', undefined, teacher);
  assert.equal(liveDevices.devices.filter((d: any) => d.online).length, count);
  await Promise.all(
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
  const percentile = (values: number[], p: number) =>
    Math.round(
      [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))],
    );
  const result = {
    students: count,
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
    allScoresCorrect: true,
  };
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    `test-results/network-load-${process.env.LOAD_LABEL || 'latest'}.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  ws?.terminate();
  await server.app.close();
  rmSync(directory, { recursive: true, force: true });
}
