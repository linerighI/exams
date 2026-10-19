import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { readJsonResponse } from '../desktop/readJsonResponse';

const response = (body: string, statusCode = 200) => {
  const bytes = Buffer.from(body);
  // Deterministically split every Arabic/emoji UTF-8 sequence across buffers.
  return Object.assign(Readable.from(Array.from(bytes, b => Buffer.from([b]))), {statusCode}) as unknown as IncomingMessage;
};
test('desktop JSON preserves Arabic bank choices and emoji across byte-sized response chunks', async () => {
  const question = { text: 'اختر الإجابة الصحيحة 😀', options: ['فرحي', 'أملي', 'حزني', 'هدوئي'], correct: 2 };
  const body = JSON.stringify({ questions: [question], padding: 'سؤال عربي '.repeat(8000) });
  const decoded = await readJsonResponse(response(body));
  assert.deepEqual(decoded, JSON.parse(body));
  assert.equal(decoded.questions[0].options[2], 'حزني');
  assert.ok(!JSON.stringify(decoded).includes('\uFFFD'));
});
test('desktop response decoder retains errors and size limits', async () => {
  await assert.rejects(readJsonResponse(response(JSON.stringify({error:'اختر أسئلة معتمدة'}),400)), /اختر أسئلة معتمدة/);
  await assert.rejects(readJsonResponse(response('{broken')), /استجابة الخادم غير صالحة/);
  await assert.rejects(readJsonResponse(response(JSON.stringify({text:'أ'.repeat(20)})),20), /الاستجابة كبيرة/);
});
