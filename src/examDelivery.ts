import type { Question, Exam } from './types';
export const questionTopic = (q: Question) => q.chapter?.trim() || 'عام';
export const questionLevel = (q: Question) =>
  ['سهل', 'متوسط', 'صعب'].includes(q.difficulty || '') ? q.difficulty! : 'متوسط';
export const groupKey = (chapter: string, difficulty: string) =>
  JSON.stringify([chapter, difficulty]);
export function poolGroups(questions: Question[]) {
  const groups = new Map<string, { chapter: string; difficulty: string; available: number }>();
  for (const q of questions) {
    const chapter = questionTopic(q),
      difficulty = questionLevel(q),
      key = groupKey(chapter, difficulty);
    const group = groups.get(key) || { chapter, difficulty, available: 0 };
    group.available++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) =>
    groupKey(a.chapter, a.difficulty).localeCompare(groupKey(b.chapter, b.difficulty)),
  );
}
export function defaultDelivery(questions: Question[]): Exam['delivery'] {
  if (questions.length < 2) return undefined;
  return deliveryForCount(questions, Math.min(20, Math.max(1, Math.floor(questions.length / 2))));
}
export function deliveryForCount(questions: Question[], count: number): Exam['delivery'] {
  if (!Number.isInteger(count) || count < 1 || count > Math.min(100, questions.length))
    return undefined;
  const allocations = poolGroups(questions).map((g) => ({
    ...g,
    count: Math.floor((g.available * count) / questions.length),
    remainder: (g.available * count) % questions.length,
  }));
  let remaining = count - allocations.reduce((n, g) => n + g.count, 0);
  for (const group of [...allocations].sort((a, b) => b.remainder - a.remainder)) {
    if (!remaining) break;
    group.count++;
    remaining--;
  }
  return {
    mode: 'random',
    count,
    quotas: allocations
      .filter((g) => g.count > 0)
      .map(({ chapter, difficulty, count }) => ({ chapter, difficulty, count })),
  };
}
