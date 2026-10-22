import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRosterWithGemini } from '../server/studentRosterGemini';
import { parseRosterJson } from '../server/studentRoster';

test('student JSON accepts missing optional fields, nulls, numeric values and fenced arrays', () => {
  assert.deepEqual(parseRosterJson('{"students":[{"name":"طالب"}]}')[0], {
    name: 'طالب',
    national: '',
    id: '',
    grade: '',
    section: '',
  });
  assert.equal(
    parseRosterJson('```json\n[{"name":"طالب","national":null,"id":12}]\n```')[0].id,
    '12',
  );
  assert.throws(() => parseRosterJson('{"students":[{"grade":"العاشر"}]}'), /الاسم مطلوب/);
  assert.throws(() => parseRosterJson('broken'), /JSON غير صالح/);
});

test('Gemini reads later batches and sheets, and rejects truncated responses', async () => {
  const rows = Array.from({ length: 85 }, (_, i) => [`طالب ${i}`]);
  const visited: string[] = [];
  const sheets = [
    { name: 'أ', rows },
    { name: 'ب', rows: [['طالبة أخيرة']] },
  ];
  const result = await readRosterWithGemini(
    sheets,
    'configured-model',
    'test-key',
    async (model, key, system, prompt) => {
      assert.equal(model, 'configured-model');
      assert.equal(key, 'test-key');
      assert.ok(system.includes('rows فقط'));
      const batch = JSON.parse(prompt);
      assert.ok(batch.rows.length <= 40);
      visited.push(`${batch.sheet}:${batch.firstRow}`);
      return {
        message: {
          content: JSON.stringify({
            students: batch.rows.map(([name]: string[]) => ({
              name,
              id: '',
              national: '',
              grade: '',
              section: '',
            })),
          }),
        },
        done_reason: 'stop',
        usage: {},
      };
    },
  );
  assert.equal(result.students.length, 86);
  assert.equal(result.students[84].name, 'طالب 84');
  assert.equal(result.students[85].name, 'طالبة أخيرة');
  assert.deepEqual(visited, ['أ:1', 'أ:41', 'أ:81', 'ب:1']);
  await assert.rejects(
    readRosterWithGemini(sheets, 'model', 'key', async () => ({
      message: { content: '{}' },
      done_reason: 'length',
      usage: {},
    })),
    /لم تكتمل/,
  );
  await assert.rejects(readRosterWithGemini(sheets, 'model', ''), /مفتاح Gemini/);
});
