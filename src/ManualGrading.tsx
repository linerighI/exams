import MorphMark from './MorphMark';
import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import FocusWindow from './FocusWindow';
import QuestionResponse from './QuestionResponse';
import MathText from './MathText';
import { api } from './api';
import { manualQuestion, hasAnswer, questionWeight } from './questionFormats';
import type { Attempt, Question } from './types';
import { keywordSuggestion } from './keywordGrading';
export default function ManualGrading({
  attempt,
  onSaved,
  notify,
}: {
  attempt: Attempt;
  onSaved: () => void;
  notify: (s: string) => void;
}) {
  const [data, setData] = useState<{
      attempt: Attempt;
      questions: Question[];
      exam: { total: number; title: string };
    }>(),
    [grades, setGrades] = useState<Record<string, number>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const open = async () => {
    setBusy(true);
    try {
      const next = await api(`/api/attempts/${attempt.id}`);
      setData(next);
      setGrades({ ...next.attempt.manualGrades });
      setError('');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/attempts/${attempt.id}/grades`, 'PUT', { grades });
      setData(undefined);
      onSaved();
      notify('حُفظ التصحيح. يمكنك نشر النتائج بعد اكتمال مراجعة جميع الطلاب.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button className="text-button" disabled={busy} onClick={() => void open()}>
        <PencilLine size={16} />
        {attempt.gradingPending ? 'تصحيح الإجابات' : 'مراجعة التصحيح'}
      </button>
      {data && (
        <FocusWindow
          wide
          title={`تصحيح ${attempt.studentName || attempt.studentId} · ${data.exam.title}`}
          onClose={() => {
            if (!busy) setData(undefined);
          }}
        >
          <div className="manual-grading-list">
            {data.questions
              .filter((q) => manualQuestion(q))
              .map((q) => {
                const max = questionWeight(q, data.questions, data.exam.total),
                  answered = hasAnswer(q, data.attempt.answers[q.id]);
                const suggestion = keywordSuggestion(q, data.attempt.answers[q.id]);
                return (
                  <section className="manual-grading-item" key={q.id}>
                    <h3>
                      <MathText text={q.text} />
                    </h3>
                    {q.rubric && <p className="manual-grading-rubric">معيار التصحيح: {q.rubric}</p>}
                    {suggestion && (
                      <div className="keyword-suggestion">
                        <strong>
                          اقتراح للمراجعة: {suggestion.count} من {suggestion.target} أفكار ·{' '}
                          {(suggestion.ratio * max).toLocaleString('ar', {
                            maximumFractionDigits: 2,
                          })}{' '}
                          درجة
                        </strong>
                        <p>
                          مطابقة:{' '}
                          {suggestion.matched.map((g) => g.label).join('، ') ||
                            'لم تُطابق مفاهيم مسجلة'}
                        </p>
                        {suggestion.flags.map((f) => (
                          <p key={f}>{f}</p>
                        ))}
                        <p>
                          قد يطابق جواب خاطئ الكلمات، وقد يصح جواب بمرادفات أخرى. القرار لك بعد
                          قراءة الإجابة.
                        </p>
                        <button
                          className="secondary small"
                          onClick={() => setGrades({ ...grades, [q.id]: suggestion.ratio })}
                        >
                          اعتماد المقترح بعد مراجعة المعنى
                        </button>
                      </div>
                    )}
                    {answered ? (
                      <QuestionResponse
                        question={q}
                        value={data.attempt.answers[q.id]}
                        disabled
                        onChange={() => {}}
                      />
                    ) : (
                      <p className="muted">لم يجب الطالب عن هذا السؤال · درجته صفر</p>
                    )}
                    <label className="field">
                      النسبة المستحقة من درجة السؤال (
                      {max.toLocaleString('ar', { maximumFractionDigits: 2 })} درجة)
                      <select
                        aria-label={`درجة السؤال ${data.questions.indexOf(q) + 1}`}
                        value={grades[q.id] ?? ''}
                        onChange={(e) => setGrades({ ...grades, [q.id]: Number(e.target.value) })}
                      >
                        <option value="" disabled>
                          لم يصحح بعد
                        </option>
                        {[
                          ...new Set([
                            0,
                            0.25,
                            0.5,
                            0.75,
                            1,
                            ...(suggestion ? [suggestion.ratio] : []),
                          ]),
                        ]
                          .sort((a, b) => a - b)
                          .map((r) => (
                            <option key={r} value={r}>
                              {(r * 100).toLocaleString('ar', { maximumFractionDigits: 1 })}% ·{' '}
                              {(r * max).toLocaleString('ar', { maximumFractionDigits: 2 })} درجة
                            </option>
                          ))}
                      </select>
                    </label>
                  </section>
                );
              })}
            {!data.questions.some((q) => manualQuestion(q)) && (
              <p>كل أسئلة هذه المحاولة تُصحح تلقائيًا.</p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy} onClick={() => void save()}>
              <MorphMark shape={busy ? 'working' : 'saved'} size={18} />
              حفظ التصحيح
            </button>
          </div>
        </FocusWindow>
      )}
    </>
  );
}
