import type { Question } from './types';
export type KeywordGrading = {
  mode: 'review';
  required: number;
  groups: { label: string; terms: string[] }[];
};
export const keywordNormalize = (s: string) =>
  s
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
export function keywordSuggestion(q: Question, answer: unknown) {
  if (!q.keywordGrading || typeof answer !== 'string') return undefined;
  const words = keywordNormalize(answer).split(' '),
    used = new Set<number>();
  const matched = q.keywordGrading.groups.flatMap((group, index) => {
    const alternatives = group.terms
      .map((term) => ({ term, parts: keywordNormalize(term).split(' ') }))
      .filter((v) => v.parts[0])
      .sort((a, b) => b.parts.length - a.parts.length);
    for (const { term, parts } of alternatives)
      for (let i = 0; i <= words.length - parts.length; i++)
        if (parts.every((word, j) => word === words[i + j] && !used.has(i + j))) {
          parts.forEach((_, j) => used.add(i + j));
          return [{ index, label: group.label, term }];
        }
    return [];
  });
  const flags: string[] = [];
  if (
    words.some((word) =>
      ['لا', 'ليس', 'ليست', 'لم', 'لن', 'غير', 'دون', 'not', 'never', 'no'].includes(word),
    )
  )
    flags.push('تحتوي الإجابة على نفي؛ راجع ما إذا كان المعنى صحيحًا.');
  if (matched.length < q.keywordGrading.required)
    flags.push('لم تطابق جميع الأفكار المطلوبة؛ قد توجد صياغة صحيحة أو مرادفات غير مسجلة.');
  return {
    matched,
    count: matched.length,
    target: q.keywordGrading.required,
    ratio: Math.min(1, matched.length / q.keywordGrading.required),
    flags,
  };
}
