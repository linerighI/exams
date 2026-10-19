import type { Question, Attempt } from './types';

export const questionKinds = [
  ['single', 'ضع دائرة'],
  ['multiple', 'اختيارات متعددة'],
  ['boolean', 'صح أو خطأ'],
  ['short', 'إجابة قصيرة'],
  ['essay', 'إجابة كتابية'],
  ['blank', 'أكمل الفراغ'],
  ['match', 'توصيل'],
  ['order', 'ترتيب بالسحب'],
  ['draw', 'رسم وكتابة بالقلم'],
] as const;
export type QuestionKind = (typeof questionKinds)[number][0];
export type Answer =
  | number
  | string
  | (number | string)[]
  | { pairs: number[] }
  | { strokes: number[][][]; text: string };
export const kindOf = (q: Pick<Question, 'kind'>): QuestionKind => q.kind || 'single';
export const kindLabel = (q: Pick<Question, 'kind'>) =>
  questionKinds.find(([kind]) => kind === kindOf(q))![1];
export const manualQuestion = (q: Pick<Question, 'kind' | 'keywordGrading'>) =>
  ['essay', 'draw'].includes(kindOf(q)) || !!q.keywordGrading;
export function createQuestion(kind: QuestionKind): Question {
  return {
    id: crypto.randomUUID(),
    kind,
    text: '',
    options:
      kind === 'single' || kind === 'multiple'
        ? ['', '', '', '']
        : kind === 'boolean'
          ? ['صح', 'خطأ']
          : kind === 'order'
            ? ['', '', '']
            : [],
    correct: 0,
    explanation: '',
    page: 1,
    points: 1,
    ...(kind === 'multiple' ? { correctChoices: [0] } : {}),
    ...(kind === 'short' ? { acceptedAnswers: [''] } : {}),
    ...(kind === 'blank' ? { blankAnswers: [''] } : {}),
    ...(kind === 'match'
      ? {
          pairs: [
            { left: '', right: '' },
            { left: '', right: '' },
          ],
        }
      : {}),
    ...(kind === 'order' ? { orderCorrect: [0, 1, 2] } : {}),
    ...(manualQuestion({ kind }) ? { rubric: '' } : {}),
  };
}
const normalize = (s: string) =>
  s
    .normalize('NFKC')
    .trim()
    .replace(/[\u064B-\u065F\u0640]/gu, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
export function hasAnswer(q: Question, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  const k = kindOf(q);
  if (k === 'single' || k === 'boolean') return typeof a === 'number';
  if (k === 'short' || k === 'essay') return typeof a === 'string' && !!a.trim();
  if (k === 'multiple') return Array.isArray(a) && a.length > 0;
  if (k === 'blank')
    return (
      Array.isArray(a) &&
      a.length === (q.blankCount || q.blankAnswers?.length || 1) &&
      a.every((v) => typeof v === 'string' && !!v.trim())
    );
  if (k === 'order') return Array.isArray(a) && a.length === q.options.length;
  if (k === 'match')
    return (
      !Array.isArray(a) &&
      typeof a === 'object' &&
      'pairs' in a &&
      a.pairs.length === (q.matchLeft?.length || q.pairs?.length) &&
      a.pairs.every((v) => v >= 0)
    );
  return (
    typeof a === 'object' &&
    !Array.isArray(a) &&
    'strokes' in a &&
    (a.strokes.some((s) => s.length > 1) || !!a.text.trim())
  );
}
export function answerValid(q: Question, a: Answer): boolean {
  const k = kindOf(q),
    indices = (v: unknown, n: number) =>
      Array.isArray(v) &&
      v.every((i) => Number.isInteger(i) && i >= 0 && i < n) &&
      new Set(v).size === v.length;
  if (k === 'single' || k === 'boolean')
    return Number.isInteger(a) && Number(a) >= 0 && Number(a) < q.options.length;
  if (k === 'short' || k === 'essay') return typeof a === 'string' && a.length <= 10000;
  if (k === 'multiple') return indices(a, q.options.length);
  if (k === 'order')
    return indices(a, q.options.length) && Array.isArray(a) && a.length === q.options.length;
  if (k === 'blank')
    return (
      Array.isArray(a) &&
      a.length === (q.blankAnswers?.length || 1) &&
      a.every((v) => typeof v === 'string' && v.length <= 1000)
    );
  if (k === 'match')
    return (
      typeof a === 'object' &&
      !Array.isArray(a) &&
      'pairs' in a &&
      a.pairs.length === q.pairs?.length &&
      a.pairs.every((v) => Number.isInteger(v) && v >= -1 && v < q.pairs!.length) &&
      new Set(a.pairs.filter((v) => v >= 0)).size === a.pairs.filter((v) => v >= 0).length
    );
  if (
    typeof a !== 'object' ||
    Array.isArray(a) ||
    !('strokes' in a) ||
    typeof a.text !== 'string' ||
    a.text.length > 10000 ||
    a.strokes.length > 300
  )
    return false;
  return (
    a.strokes.reduce((n, s) => n + s.length, 0) <= 15000 &&
    a.strokes.every((s) =>
      s.every((p) => p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)),
    )
  );
}
export function correctAnswer(q: Question, a: Answer | undefined): boolean {
  if (a === undefined || manualQuestion(q)) return false;
  switch (kindOf(q)) {
    case 'single':
    case 'boolean':
      return a === q.correct;
    case 'multiple':
      return (
        Array.isArray(a) &&
        JSON.stringify([...a].sort()) === JSON.stringify([...(q.correctChoices || [])].sort())
      );
    case 'short':
      return (
        typeof a === 'string' &&
        (q.acceptedAnswers || []).some((v) => normalize(v) === normalize(a))
      );
    case 'blank':
      return (
        Array.isArray(a) &&
        a.length === q.blankAnswers?.length &&
        a.every((v, i) => typeof v === 'string' && normalize(v) === normalize(q.blankAnswers![i]))
      );
    case 'order':
      return (
        Array.isArray(a) &&
        JSON.stringify(a.map((i) => orderingOptions(q)[Number(i)])) ===
          JSON.stringify(q.orderCorrect?.map((i) => q.options[i]))
      );
    case 'match':
      return (
        typeof a === 'object' &&
        !Array.isArray(a) &&
        'pairs' in a &&
        a.pairs.every((v, i) => matchingColumns(q).right[v] === q.pairs?.[i].right)
      );
    default:
      return false;
  }
}
export function matchingColumns(q: Question) {
  return {
    left: q.pairs?.map((p) => p.left) || q.matchLeft || [],
    right:
      q.pairs?.map((p) => p.right).sort((a, b) => a.localeCompare(b, 'ar')) || q.matchRight || [],
  };
}
export const orderingOptions = (q: Question) =>
  [...q.options].sort((a, b) => a.localeCompare(b, 'ar'));
export function studentQuestion(q: Question): Question {
  const {
    correct,
    explanation,
    correctChoices,
    acceptedAnswers,
    blankAnswers,
    pairs,
    orderCorrect,
    rubric,
    keywordGrading,
    ...safe
  } = q;
  return {
    ...safe,
    ...(keywordGrading ? { keywordTarget: keywordGrading.required } : {}),
    ...(kindOf(q) === 'order' ? { options: orderingOptions(q) } : {}),
    ...(kindOf(q) === 'blank' ? { blankCount: blankAnswers?.length || 1 } : {}),
    ...(kindOf(q) === 'match'
      ? { matchLeft: matchingColumns(q).left, matchRight: matchingColumns(q).right }
      : {}),
  } as Question;
}
export function changeQuestionKind(q: Question, kind: QuestionKind): Question {
  const {
    kind: oldKind,
    options,
    correct,
    correctChoices,
    acceptedAnswers,
    blankAnswers,
    pairs,
    orderCorrect,
    rubric,
    keywordGrading,
    keywordTarget,
    blankCount,
    matchLeft,
    matchRight,
    ...meta
  } = q;
  return { ...createQuestion(kind), ...meta, kind };
}
export const bankQuestionSignature = (q: Question) =>
  JSON.stringify([
    kindOf(q),
    q.text,
    q.options,
    q.correct,
    q.correctChoices,
    q.acceptedAnswers,
    q.blankAnswers,
    q.pairs,
    q.orderCorrect,
    q.rubric,
    q.keywordGrading,
    q.image,
    q.points || 1,
  ]);
export const questionOptionsDistinct = (
  q: Pick<Question, 'kind' | 'options'>,
  normalize: (s: string) => string = (s) => s.trim(),
) =>
  !['single', 'multiple', 'boolean', 'order'].includes(kindOf(q)) ||
  new Set(q.options.map(normalize)).size === q.options.length;
export function questionProblem(q: Question): string | undefined {
  const kind = kindOf(q);
  if (q.text.trim().length < 3) return 'اكتب نص سؤال واضحًا من ثلاثة أحرف على الأقل.';
  if (
    ['single', 'multiple', 'boolean', 'order'].includes(kind) &&
    (q.options.some((v) => !v.trim()) || !questionOptionsDistinct(q))
  )
    return 'أكمل العناصر أو الخيارات دون تكرار.';
  if (kind === 'single' && q.options.length !== 4) return 'الاختيار المفرد يحتاج أربعة خيارات.';
  if (kind === 'multiple' && !q.correctChoices?.length) return 'حدد الإجابات الصحيحة.';
  if (kind === 'short' && !q.keywordGrading && !q.acceptedAnswers?.some((v) => v.trim()))
    return 'أضف إجابة قصيرة مقبولة.';
  if (kind === 'blank' && (!q.blankAnswers?.length || q.blankAnswers.some((v) => !v.trim())))
    return 'أكمل إجابات الفراغات بالترتيب.';
  if (
    kind === 'match' &&
    (!q.pairs ||
      q.pairs.length < 2 ||
      q.pairs.some((p) => !p.left.trim() || !p.right.trim()) ||
      new Set(q.pairs.map((p) => p.left.trim())).size !== q.pairs.length ||
      new Set(q.pairs.map((p) => p.right.trim())).size !== q.pairs.length)
  )
    return 'أكمل أزواج التوصيل دون تكرار أي طرف.';
  if (['essay', 'draw'].includes(kind) && !q.rubric?.trim())
    return 'أضف معيارًا واضحًا لتقييم الإجابة الكتابية أو الرسم.';
  if (
    q.keywordGrading &&
    (q.keywordGrading.required < 1 ||
      q.keywordGrading.required > q.keywordGrading.groups.length ||
      q.keywordGrading.groups.some(
        (g) => !g.label.trim() || !g.terms.length || g.terms.some((t) => !t.trim()),
      ))
  )
    return 'أكمل الأفكار ومرادفاتها وحدد العدد المطلوب.';
}
export function questionWeight(q: Question, questions: Question[], total: number) {
  return (total * (q.points || 1)) / questions.reduce((n, x) => n + (x.points || 1), 0);
}
export function gradeAnswers(attempt: Attempt, questions: Question[], total: number) {
  const waiting = questions.filter(
    (q) =>
      manualQuestion(q) &&
      hasAnswer(q, attempt.answers[q.id]) &&
      attempt.manualGrades?.[q.id] === undefined,
  );
  attempt.gradingPending = waiting.length > 0;
  attempt.score = waiting.length
    ? null
    : Math.round(
        questions.reduce(
          (sum, q) =>
            sum +
            questionWeight(q, questions, total) *
              (manualQuestion(q)
                ? attempt.manualGrades?.[q.id] || 0
                : correctAnswer(q, attempt.answers[q.id])
                  ? 1
                  : 0),
          0,
        ) * 100,
      ) / 100;
}
export function answerText(q: Question, a: Answer | undefined): string {
  if (a === undefined) return 'دون إجابة';
  if (typeof a === 'number') return q.options[a] || String(a);
  if (typeof a === 'string') return a;
  if (Array.isArray(a))
    return a
      .map((v) =>
        typeof v === 'number' ? (kindOf(q) === 'order' ? orderingOptions(q) : q.options)[v] : v,
      )
      .join(' · ');
  if ('pairs' in a) {
    const cols = matchingColumns(q);
    return cols.left.map((v, i) => `${v} ← ${cols.right[a.pairs[i]] || '—'}`).join(' · ');
  }
  return `${a.strokes.length ? 'إجابة بالقلم. ' : ''}${a.text}`;
}
export function answerKeyText(q: Question): string {
  if (q.keywordGrading)
    return `مراجعة المعلم؛ ${q.keywordGrading.required} أفكار للدرجة الكاملة. ${q.keywordGrading.groups.map((g) => `${g.label}: ${g.terms.join(' / ')}`).join('؛ ')}${q.rubric ? `؛ ${q.rubric}` : ''}`;
  switch (kindOf(q)) {
    case 'multiple':
      return (q.correctChoices || []).map((i) => q.options[i]).join(' · ');
    case 'short':
      return (q.acceptedAnswers || []).join(' / ');
    case 'blank':
      return (q.blankAnswers || []).join(' · ');
    case 'match':
      return (q.pairs || []).map((p) => `${p.left} ← ${p.right}`).join(' · ');
    case 'order':
      return (q.orderCorrect || []).map((i) => q.options[i]).join(' ← ');
    case 'essay':
    case 'draw':
      return q.rubric || 'مراجعة المعلم';
    default:
      return q.options[q.correct] || '';
  }
}
