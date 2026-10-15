import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app';
import { extractPDF } from '../server/pdf';
const pdf = process.argv[2];
if (!pdf) throw Error('Provide a PDF path');
mkdirSync('.data', { recursive: true });
mkdirSync('test-results', { recursive: true });
const directory = mkdtempSync(join(tmpdir(), 'school-math-live-'));
const controller = new AbortController();
let server: Awaited<ReturnType<typeof createApp>> | undefined;
try {
  const cached = '.data/math-full-source-v2.json';
  const started = Date.now();
  const source = existsSync(cached)
    ? JSON.parse(readFileSync(cached, 'utf8'))
    : {
        id: 'math-book',
        name: 'كتاب الرياضيات الصف العاشر',
        pages: await extractPDF(
          readFileSync(pdf).toString('base64'),
          directory,
          '',
          resolve('worker'),
          controller.signal,
        ),
      };
  if (!existsSync(cached)) writeFileSync(cached, JSON.stringify(source));
  console.log(
    'Full application PDF extraction:',
    source.pages.length,
    'pages;',
    Math.round((Date.now() - started) / 1000),
    'seconds;',
    Math.round(Buffer.byteLength(JSON.stringify(source)) / 1024),
    'KB',
  );
  assert.equal(source.pages.length, 132);
  server = await createApp({ directory });
  const call = async (url: string, method = 'GET', body?: any, token?: string) => {
    const result = await server!.app.inject({
      url,
      method: method as any,
      payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    assert.equal(result.statusCode, 200, result.body);
    return result.json();
  };
  await call('/api/setup', 'POST', {
    school: 'اختبار كتاب الرياضيات',
    password: 'test-password123',
  });
  const { token } = await call('/api/login', 'POST', {
    role: 'teacher',
    password: 'test-password123',
  });
  server.store.put('sources', source);
  let job = await call(
    '/api/generate',
    'POST',
    {
      sourceId: source.id,
      pages: Array.from({ length: 57 }, (_, i) => i + 8),
      count: 10,
      difficulty: 'مختلط',
    },
    token,
  );
  let previous = '',
    lastLog = 0;
  const generationStart = Date.now();
  let completions = 0;
  for (;;) {
    const result = await call('/api/jobs/' + job.jobId, 'GET', undefined, token);
    if (result.message !== previous && Date.now() - lastLog > 15000) {
      console.log(Math.round((Date.now() - generationStart) / 1000), 'seconds:', result.message);
      previous = result.message;
      lastLog = Date.now();
    }
    if (result.status === 'done') {
      if (result.questions.length < 10 && completions++ < 2) {
        console.log('Completing missing questions while keeping',result.questions.length,'valid questions');
        job=await call('/api/generate','POST',{sourceId:source.id,pages:Array.from({length:57},(_,i)=>i+8),count:10,difficulty:'مختلط',existing:result.questions},token);
        continue;
      }
      assert.equal(result.questions.length, 10);
      assert.ok(
        result.questions.every(
          (q: any) =>
            q.page >= 8 &&
            q.page <= 64 &&
            q.options.length === 4 &&
            q.correct >= 0 &&
            q.correct <= 3,
        ),
      );
      const report = {
        pdf,
        pages: [8, 64],
        count: 10,
        seconds: Math.round((Date.now() - generationStart) / 1000),
        model: server.store.getSetting('config').model,
        questions: result.questions,
        completions,
      };
      writeFileSync('test-results/math-generation.json', JSON.stringify(report, null, 2));
      console.log('PASS:', JSON.stringify(report));
      break;
    }
    if (result.status === 'failed' || result.status === 'cancelled') throw Error(result.error);
    if (Date.now() - generationStart > 30 * 60000) throw Error('Math test timeout');
    await new Promise((r) => setTimeout(r, 1200));
  }
} finally {
  controller.abort();
  await server?.app.close();
  rmSync(directory, { recursive: true, force: true });
}
