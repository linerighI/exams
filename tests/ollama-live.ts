// Opt-in integration check against the teacher's running local Ollama.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
const directory = mkdtempSync(join(tmpdir(), 'school-ollama-live-'));
const server = await createApp({ directory });
try {
  const call = async (url: string, method = 'GET', body?: any, token?: string) => {
    const result = await server.app.inject({
      url,
      method: method as any,
      payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    assert.equal(result.statusCode, 200, result.body);
    return result.json();
  };
  await call('/api/setup', 'POST', { school: 'اختبار الإصلاح', password: 'test-password123' });
  const { token } = await call('/api/login', 'POST', {
    role: 'teacher',
    password: 'test-password123',
  });
  const status = await call('/api/model', 'GET', undefined, token);
  assert.equal(status.ready, true);
  assert.equal(status.model, status.models.includes('qwen3:1.7b') ? 'qwen3:1.7b' : 'qwen3.5:4b');
  assert.equal(server.store.getSetting('config').model, status.model);
  console.log('Detected and persisted installed model:', status.model);
  const benchmark = await call('/api/model/benchmark', 'POST', {}, token);
  assert.ok(benchmark.text.trim());
  console.log('Benchmark passed in', benchmark.seconds, 'seconds');
  server.store.put('sources', {
    id: 'live-source',
    name: 'اختبار العلوم',
    pages: [
      { page: 1, text: 'هذه الصفحة مستبعدة: مدينة باريس عاصمة فرنسا.', images: [] },
      {
        page: 8,
        text: 'تتكون دورة الماء من التبخر والتكاثف والهطول. التبخر هو تحول الماء السائل إلى بخار بسبب حرارة الشمس. التكاثف هو تحول بخار الماء إلى قطرات ماء صغيرة عند تبريده وتتكون السحب. الهطول هو سقوط الماء من السحب على الأرض على شكل مطر أو ثلج أو برد. تتجمع المياه في الأنهار والبحيرات والبحار ثم تتكرر الدورة. الشمس مصدر الطاقة التي تحرك دورة الماء.',
        images: [],
      },
    ],
  });
  const job = await call(
    '/api/generate',
    'POST',
    { sourceId: 'live-source', pages: [8], count: 2, difficulty: 'سهل' },
    token,
  );
  const deadline = Date.now() + 300000;
  for (;;) {
    const result = await call('/api/jobs/' + job.jobId, 'GET', undefined, token);
    if (result.status === 'done') {
      assert.equal(result.questions.length, 2);
      assert.ok(
        result.questions.every(
          (q: any) => q.page === 8 && q.options.length === 4 && q.correct >= 0 && q.correct <= 3,
        ),
      );
      console.log('Real Arabic generation passed:', JSON.stringify(result.questions));
      break;
    }
    if (result.status === 'failed') throw Error(result.error);
    if (Date.now() > deadline) throw Error('Live generation timeout');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} finally {
  await server.app.close();
  rmSync(directory, { recursive: true, force: true });
}
