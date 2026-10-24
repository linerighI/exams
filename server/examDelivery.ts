import { randomBytes, randomInt } from 'node:crypto';
import type { Exam, Attempt, Question } from '../src/types';
import { groupKey, questionLevel, questionTopic } from '../src/examDelivery';
const bad = (message: string) => Object.assign(Error(message), { statusCode: 400 });
export function combinations(n: number, k: number): bigint {
  let value = 1n;
  for (let i = 1; i <= Math.min(k, n - k); i++) value = (value * BigInt(n - i + 1)) / BigInt(i);
  return k < 0 || k > n ? 0n : value;
}
export function deliveryGroups(exam: Exam) {
  if (!exam.delivery) return [];
  const { count, quotas } = exam.delivery;
  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 100 ||
    quotas.reduce((sum, q) => sum + q.count, 0) !== count
  )
    throw bad('مجموع توزيع الموضوعات والصعوبات يجب أن يساوي عدد أسئلة الطالب');
  const keys = quotas.map((q) => groupKey(q.chapter, q.difficulty));
  if (!quotas.length || new Set(keys).size !== keys.length)
    throw bad('راجع توزيع الأسئلة؛ توجد مجموعة مكررة أو فارغة');
  const fingerprints = exam.questions.map((q) =>
    q.text.normalize('NFKC').replace(/[\s\u064B-\u065F\u0640]/gu, ''),
  );
  if (new Set(fingerprints).size !== fingerprints.length)
    throw bad('توجد أسئلة متكررة في مجموعة السحب؛ احذف التكرار قبل النشر');
  return quotas.map((quota) => {
    const questions = exam.questions
      .filter((q) => questionTopic(q) === quota.chapter && questionLevel(q) === quota.difficulty)
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!Number.isInteger(quota.count) || quota.count < 1 || questions.length < quota.count)
      throw bad(`الأسئلة غير كافية: ${quota.chapter} / ${quota.difficulty}`);
    return { ...quota, questions, combinations: combinations(questions.length, quota.count) };
  });
}
export const deliveryCapacity = (exam: Exam) =>
  deliveryGroups(exam).reduce((n, g) => n * g.combinations, 1n);
function randomBelow(limit: bigint) {
  const bytes = Math.ceil(limit.toString(2).length / 8);
  const mask = (1n << BigInt(limit.toString(2).length)) - 1n;
  let result: bigint;
  do {
    result = BigInt('0x' + randomBytes(bytes).toString('hex')) & mask;
  } while (result >= limit);
  return result;
}
function unrank(questions: Question[], count: number, rank: bigint) {
  const result: Question[] = [];
  let start = 0;
  for (let remaining = count; remaining > 0; remaining--) {
    for (let i = start; i <= questions.length - remaining; i++) {
      const block = combinations(questions.length - i - 1, remaining - 1);
      if (rank < block) {
        result.push(questions[i]);
        start = i + 1;
        break;
      }
      rank -= block;
    }
  }
  return result;
}
export function assignQuestions(exam: Exam, attempts: Attempt[]) {
  if (!exam.delivery) {
    if (!exam.shuffleQuestions) return {};
    const assignedQuestions = structuredClone(exam.questions);
    for (let i = assignedQuestions.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [assignedQuestions[i], assignedQuestions[j]] = [assignedQuestions[j], assignedQuestions[i]];
    }
    return { assignedQuestions };
  }
  const groups = deliveryGroups(exam),
    capacity = groups.reduce((n, g) => n * g.combinations, 1n);
  const used = new Set(
    attempts
      .filter((a) => a.examId === exam.id && a.assignmentRank !== undefined)
      .map((a) => a.assignmentRank),
  );
  let rank = randomBelow(capacity);
  // Prefer a new set while available, then allow overlap rather than blocking entry.
  if (BigInt(used.size) < capacity) while (used.has(rank.toString())) rank = (rank + 1n) % capacity;
  const assignmentRank = rank.toString();
  const assignedQuestions = groups.flatMap((group) => {
    const local = rank % group.combinations;
    rank /= group.combinations;
    return unrank(group.questions, group.count, local);
  });
  for (let i = assignedQuestions.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [assignedQuestions[i], assignedQuestions[j]] = [assignedQuestions[j], assignedQuestions[i]];
  }
  return { assignedQuestions: structuredClone(assignedQuestions), assignmentRank };
}
export const attemptQuestions = (attempt: Attempt, exam: Exam) =>
  attempt.assignedQuestions || exam.questions;
