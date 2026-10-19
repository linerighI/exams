import type { Question } from './types';
import { questionProblem, kindOf } from './questionFormats';
export type ExamIssue = { path: (string | number)[]; message: string };
export const examFieldNames: Record<string, string> = {
  title: 'اسم الامتحان',
  subject: 'المادة',
  grade: 'الصف',
  section: 'الشعبة',
  duration: 'المدة',
  total: 'الدرجة الكلية',
  opensAt: 'بداية الإتاحة',
  closesAt: 'نهاية الإتاحة',
  questions: 'الأسئلة',
  delivery: 'التوزيع العشوائي',
  approved: 'اعتماد المراجعة',
  text: 'نص السؤال',
  options: 'الخيارات',
  correct: 'الإجابة الصحيحة',
  correctChoices: 'الإجابات الصحيحة',
  acceptedAnswers: 'الإجابات المقبولة',
  blankAnswers: 'إجابات الفراغات',
  pairs: 'أزواج التوصيل',
  orderCorrect: 'الترتيب الصحيح',
  rubric: 'معيار التصحيح',
  keywordGrading: 'الأفكار والكلمات المفتاحية',
  image: 'الصورة',
  audio: 'الصوت',
  points: 'وزن الدرجة',
  appearance: 'مظهر الامتحان',
  difficulty: 'الصعوبة',
  cameraRequired: 'اشتراط الكاميرا',
  term: 'الفصل',
  kind: 'نوع الامتحان',
  id: 'معرّف السؤال',
  explanation: 'تفسير الإجابة',
};
// The native host may retain only the error message, so keep navigation usable
// even when structured HTTP validation issues are unavailable.
export function issuesFromError(error: unknown): ExamIssue[] {
  const structured = (error as { issues?: ExamIssue[] })?.issues;
  if (Array.isArray(structured) && structured.length) return structured;
  const message = (error as Error)?.message || 'تعذر حفظ الامتحان. أعد المحاولة.';
  const question = message.match(/السؤال\s+(\d+)/);
  const field = Object.entries(examFieldNames)
    .sort((a, b) => b[1].length - a[1].length)
    .find(([, label]) => message.includes(label))?.[0];
  if (question) return [{ path: ['questions', Number(question[1]) - 1, field || 'text'], message }];
  return [{ path: [field || (/توزيع|نماذج|مجموعة|عدد أسئلة/.test(message) ? 'delivery' : /موعد|إتاحة|فترة|إغلاق/.test(message) ? 'closesAt' : /بنك|سؤال|أسئلة/.test(message) ? 'questions' : 'title')], message }];
}
export function validationMessage(
  path: (string | number)[],
  issue: { code?: string; minimum?: number | bigint; maximum?: number | bigint; message?: string },
) {
  const field = String(path[0] === 'questions' ? path[2] || 'questions' : path[0]);
  const label = `${path[0] === 'questions' && typeof path[1] === 'number' ? `السؤال ${path[1] + 1} · ` : ''}${examFieldNames[field] || 'الحقل'}`;
  const detail =
    issue.code === 'too_small'
      ? `أكمل القيمة المطلوبة${issue.minimum !== undefined ? ` (الحد الأدنى ${issue.minimum})` : ''}`
      : issue.code === 'too_big'
        ? `تجاوزت الحد المسموح${issue.maximum !== undefined ? ` (${issue.maximum})` : ''}`
        : issue.message && /[\u0600-\u06ff]/.test(issue.message)
          ? issue.message
          : 'راجع القيمة أو الاختيارات المسموحة';
  return `${label}: ${detail}.`;
}
export function examIssues(
  form: {
    title: string;
    subject: string;
    grade: string;
    duration: number;
    total: number;
    opensAt: string;
    closesAt: string;
    questions: Question[];
    delivery?: any;
  },
  publish = false,
  approved = false,
): ExamIssue[] {
  const issues: ExamIssue[] = [];
  const add = (field: string, message: string) => issues.push({ path: [field], message });
  for (const field of ['title', 'subject', 'grade'] as const) {
    if (!form[field].trim()) add(field, `أدخل ${examFieldNames[field]}.`);
    else if (form[field].trim().length > 300)
      add(field, `${examFieldNames[field]}: الحد الأقصى 300 حرف.`);
  }
  if (!Number.isInteger(form.duration) || form.duration < 1 || form.duration > 240)
    add('duration', 'المدة: أدخل عددًا صحيحًا من 1 إلى 240 دقيقة.');
  if (!Number.isFinite(form.total) || form.total < 1 || form.total > 1000)
    add('total', 'الدرجة الكلية: أدخل رقمًا من 1 إلى 1000.');
  for (const field of ['opensAt', 'closesAt'] as const)
    if (!Number.isFinite(Date.parse(form[field])))
      add(field, `حدد ${examFieldNames[field]} بتاريخ ووقت صحيحين.`);
  if (Date.parse(form.closesAt) <= Date.parse(form.opensAt))
    add('closesAt', 'نهاية الإتاحة يجب أن تكون بعد بداية الإتاحة.');
  if (publish && !form.questions.length) add('questions', 'أضف سؤالًا واحدًا على الأقل قبل النشر.');
  form.questions.forEach((q, i) => {
    const problem = questionProblem(q);
    if (problem) {
      const kind = kindOf(q);
      const field = !q.text.trim()
        ? 'text'
        : q.keywordGrading && /الأفكار|مرادفات/.test(problem)
          ? 'keywordGrading'
          : ['essay', 'draw'].includes(kind)
            ? 'rubric'
            : kind === 'short'
              ? 'acceptedAnswers'
              : kind === 'blank'
                ? 'blankAnswers'
                : kind === 'match'
                  ? 'pairs'
                  : 'options';
      issues.push({ path: ['questions', i, field], message: `السؤال ${i + 1}: ${problem}` });
    }
    if (q.points !== undefined && (!Number.isFinite(q.points) || q.points <= 0 || q.points > 100))
      issues.push({
        path: ['questions', i, 'points'],
        message: `السؤال ${i + 1}: وزن الدرجة يجب أن يكون أكبر من صفر وحتى 100.`,
      });
  });
  if (publish && !approved) add('approved', 'أكد مراجعة الأسئلة والإجابات قبل النشر.');
  return issues;
}
