import { api } from './api';
import type { Question } from './types';

export async function refreshBankQuestions(questions: Question[]): Promise<Question[]> {
  const ids = [...new Set(questions.flatMap(q => q.bankId ? [q.bankId] : []))];
  if (!ids.length) return questions;
  const { questions: fresh } = await api('/api/bank/selection', 'POST', { ids });
  const byId = new Map<string, Question>(fresh.map((q: Question) => [q.bankId, q]));
  return questions.map(q => {
    if (!q.bankId) return q;
    const bank = byId.get(q.bankId);
    if (!bank) throw Error('تعذر تحديث أحد الأسئلة؛ أعد اختياره من البنك.');
    return { ...q, ...bank, id: q.id, image: bank.image, geometryId: bank.geometryId, audio: q.audio };
  });
}
