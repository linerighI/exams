import { z } from 'zod';
import { geminiGenerate } from './gemini';
import type { RosterSheet } from './studentRoster';
import { studentRosterPrompt } from '../src/studentRosterExchange';

const schema = z.object({
  students: z
    .array(
      z.object({
        name: z.string(),
        id: z.string(),
        national: z.string(),
        grade: z.string(),
        section: z.string(),
      }),
    )
    .max(3000),
});
const fail = (message: string) => Object.assign(Error(message), { statusCode: 400 });

export async function readRosterWithGemini(
  sheets: RosterSheet[],
  model: string,
  key: string,
  generate = geminiGenerate,
) {
  if (!key) throw fail('أدخل مفتاح Gemini في الإعدادات أولًا، أو استخدم خيار الطلب وJSON.');
  const batches = sheets.flatMap((sheet) => {
    const parts = [];
    for (let start = 0; start < sheet.rows.length; start += 40) {
      const rows = sheet.rows.slice(start, start + 40);
      if (rows.some((row) => row.some(Boolean)))
        parts.push({
          sheet: sheet.name,
          firstRow: start + 1,
          context: sheet.rows.slice(0, 20),
          rows,
        });
    }
    return parts;
  });
  const students: z.infer<typeof schema>['students'] = [];
  // Bound each response so large workbooks cannot silently lose the last students.
  for (let offset = 0; offset < batches.length; offset += 3) {
    const results = await Promise.all(
      batches.slice(offset, offset + 3).map(async (batch) => {
        const result = await generate(
          model,
          key,
          studentRosterPrompt +
            '\nتستقبل جزءًا من الورقة. استخرج الطلاب من rows فقط. context عناوين وسياق للمساعدة فقط، لا تستخرج منه طلابًا. أعد students فارغة إذا لم توجد أسماء في rows.',
          JSON.stringify(batch),
          z.toJSONSchema(schema),
          AbortSignal.timeout(120000),
        );
        if (result.done_reason === 'length')
          throw fail('لم تكتمل قراءة Gemini. أعد المحاولة أو استخدم JSON.');
        try {
          return schema.parse(
            JSON.parse(
              result.message.content
                .trim()
                .replace(/^```(?:json)?\s*/i, '')
                .replace(/\s*```$/, ''),
            ),
          ).students;
        } catch {
          throw fail('أعاد Gemini بيانات غير مكتملة. أعد المحاولة أو استخدم JSON.');
        }
      }),
    );
    students.push(...results.flat());
    if (students.length > 3000) throw fail('الحد الأقصى 3000 طالب؛ قسّم الملف.');
  }
  return { students };
}
