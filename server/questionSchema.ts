import { z } from 'zod';
import { audioSchema } from './examMedia';
import { questionKinds, kindOf } from '../src/questionFormats';
import { keywordNormalize } from '../src/keywordGrading';
const keywordSchema = z
  .object({
    mode: z.literal('review'),
    required: z.number().int().min(1).max(20),
    groups: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(150),
          terms: z.array(z.string().trim().min(1).max(150)).min(1).max(15),
        }),
      )
      .min(1)
      .max(20),
  })
  .superRefine((value, ctx) => {
    const terms = value.groups.flatMap((g) => g.terms.map(keywordNormalize));
    if (
      value.required > value.groups.length ||
      terms.some((v) => !v) ||
      new Set(terms).size !== terms.length
    )
      ctx.addIssue({ code: 'custom', message: 'حدد عددًا صالحًا من الأفكار ومرادفات غير مكررة.' });
  });
export const questionFields = z.object({
  id: z.string().trim().min(1).max(300),
  text: z.string().trim().min(3).max(2000),
  kind: z
    .enum(
      questionKinds.map((k) => k[0]) as [
        (typeof questionKinds)[number][0],
        ...(typeof questionKinds)[number][0][],
      ],
    )
    .optional(),
  options: z.array(z.string().trim().min(1).max(800)).max(10),
  correct: z.number().int().min(0).max(9),
  points: z.number().positive().max(100).optional(),
  explanation: z.string().max(3000).default(''),
  page: z.number().int().positive().default(1),
  requiresImage: z.boolean().optional(),
  image: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  difficulty: z.string().optional(),
  bankId: z.string().max(100).optional(),
  geometryId: z.string().max(100).optional(),
  chapter: z.string().max(300).optional(),
  audio: audioSchema.optional(),
  correctChoices: z.array(z.number().int().min(0).max(9)).max(10).optional(),
  acceptedAnswers: z.array(z.string().trim().min(1).max(1000)).max(30).optional(),
  blankAnswers: z.array(z.string().trim().min(1).max(1000)).max(10).optional(),
  pairs: z
    .array(
      z.object({
        left: z.string().trim().min(1).max(500),
        right: z.string().trim().min(1).max(500),
      }),
    )
    .max(10)
    .optional(),
  orderCorrect: z.array(z.number().int().min(0).max(9)).max(10).optional(),
  rubric: z.string().max(3000).optional(),
  keywordGrading: keywordSchema.optional(),
});
export function refineQuestion(q: z.infer<typeof questionFields>, ctx: z.RefinementCtx) {
  const k = kindOf(q),
    fail = () => ctx.addIssue({ code: 'custom', message: 'راجع السؤال وخياراته ومفتاح الإجابة' });
  if (
    ['single', 'multiple', 'boolean', 'order'].includes(k) &&
    new Set(q.options).size !== q.options.length
  )
    fail();
  if (k === 'single' && (q.options.length !== 4 || q.correct >= 4)) fail();
  if (k === 'boolean' && (q.options.length !== 2 || q.correct >= 2)) fail();
  if (
    k === 'multiple' &&
    (q.options.length < 2 ||
      !q.correctChoices?.length ||
      q.correctChoices.some((n) => n >= q.options.length) ||
      new Set(q.correctChoices).size !== q.correctChoices.length)
  )
    fail();
  if (k === 'short' && !q.acceptedAnswers?.length && !q.keywordGrading) fail();
  if (q.keywordGrading && !['short', 'essay'].includes(k)) fail();
  if (k === 'blank' && !q.blankAnswers?.length) fail();
  if (
    k === 'match' &&
    (!q.pairs ||
      q.pairs.length < 2 ||
      new Set(q.pairs.map((p) => p.left)).size !== q.pairs.length ||
      new Set(q.pairs.map((p) => p.right)).size !== q.pairs.length)
  )
    fail();
  if (
    k === 'order' &&
    (q.options.length < 2 ||
      q.orderCorrect?.length !== q.options.length ||
      new Set(q.orderCorrect).size !== q.options.length ||
      q.orderCorrect.some((n) => n >= q.options.length))
  )
    fail();
}
export const questionSchema = questionFields.superRefine(refineQuestion);
export const answerSchema = z.union([
  z.number().int().min(0).max(9),
  z.string().max(10000),
  z.array(z.union([z.number().int().min(0).max(9), z.string().max(1000)])).max(10),
  z.object({ pairs: z.array(z.number().int().min(-1).max(9)).max(10) }),
  z.object({
    strokes: z.array(z.array(z.array(z.number().min(0).max(1)).length(2)).max(15000)).max(300),
    text: z.string().max(10000),
  }),
]);
