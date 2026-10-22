import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { geminiGenerate, geminiSchema } from '../server/gemini';
import { questionFields } from '../server/questionSchema';

test('Gemini simplifies large question constraints while keeping output structure and local validation', () => {
  const original: any = z.toJSONSchema(z.object({ questions: z.array(questionFields).max(3000) }));
  const snapshot = JSON.stringify(original);
  const result = geminiSchema(original);
  const encoded = JSON.stringify(result);
  for (const keyword of [
    'maxLength',
    'maxItems',
    'minimum',
    'maximum',
    'pattern',
    '$schema',
    'default',
  ])
    assert.ok(!encoded.includes(`"${keyword}":`), keyword);
  assert.deepEqual(
    result.properties.questions.items.properties.kind.enum,
    questionFields.shape.kind.unwrap().options,
  );
  const audio = result.properties.questions.items.properties.audio;
  assert.equal(audio.anyOf.length, 2);
  assert.equal(audio.anyOf[0].properties.data.type, 'string');
  assert.deepEqual(audio.anyOf[1].required, ['name', 'id']);
  assert.deepEqual(
    result.properties.questions.items.required,
    original.properties!.questions.items.required,
  );
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(questionFields.shape.text.safeParse('x'.repeat(2001)).success, false);
});

test('schema property names survive cleaning and literal values become enums', () => {
  assert.deepEqual(
    geminiSchema({
      type: 'object',
      properties: { maximum: { type: 'string', maxLength: 12 }, default: { const: 'review' } },
      required: ['maximum', 'default'],
    }),
    {
      type: 'object',
      properties: { maximum: { type: 'string' }, default: { enum: ['review'] } },
      required: ['maximum', 'default'],
    },
  );
});

test('Gemini sends simplified schemas for old and new models and shows redacted rejection reasons', async () => {
  const original = globalThis.fetch;
  try {
    for (const model of ['gemini-2.5-flash', 'gemini-3.8-flash']) {
      globalThis.fetch = (async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        const config = body.generationConfig;
        const schema = model.startsWith('gemini-2')
          ? config.responseJsonSchema
          : config.responseFormat.text.schema;
        assert.equal(schema.properties.students.maxItems, undefined);
        if (!model.startsWith('gemini-2'))
          assert.equal(config.responseFormat.text.mimeType, 'APPLICATION_JSON');
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"students":[]}' }] }, finishReason: 'STOP' },
            ],
          }),
        );
      }) as typeof fetch;
      await geminiGenerate(
        model,
        'secret-key',
        'system',
        'prompt',
        {
          type: 'object',
          properties: { students: { type: 'array', maxItems: 3000, items: { type: 'string' } } },
        },
        AbortSignal.timeout(1000),
      );
    }
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { message: 'Invalid generationConfig for secret-key' } }),
        { status: 400 },
      )) as typeof fetch;
    await assert.rejects(
      geminiGenerate(
        'gemini-2.5-flash',
        'secret-key',
        'system',
        'prompt',
        {},
        AbortSignal.timeout(1000),
      ),
      (error) => {
        assert.match((error as Error).message, /Invalid generationConfig/);
        assert.ok(!(error as Error).message.includes('secret-key'));
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});
