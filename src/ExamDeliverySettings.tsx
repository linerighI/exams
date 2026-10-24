import type { Exam, Question } from './types';
import { defaultDelivery, deliveryForCount, groupKey, poolGroups } from './examDelivery';
import './examDelivery.css';
export default function ExamDeliverySettings({
  questions,
  delivery,
  shuffleQuestions = false,
  showQuotas = true,
  onShuffleChange,
  onChange,
}: {
  questions: Question[];
  delivery?: Exam['delivery'];
  shuffleQuestions?: boolean;
  showQuotas?: boolean;
  onShuffleChange?: (value: boolean) => void;
  onChange: (value: Exam['delivery']) => void;
}) {
  const groups = poolGroups(questions);
  const mode = delivery ? 'random' : shuffleQuestions ? 'shuffle' : 'fixed';
  const change = (key: string, count: number) => {
    const quotas = groups
      .map((g) => ({
        chapter: g.chapter,
        difficulty: g.difficulty,
        count:
          groupKey(g.chapter, g.difficulty) === key
            ? count
            : delivery?.quotas.find(
                (q) => groupKey(q.chapter, q.difficulty) === groupKey(g.chapter, g.difficulty),
              )?.count || 0,
      }))
      .filter((g) => g.count > 0);
    onChange({ mode: 'random', count: quotas.reduce((n, g) => n + g.count, 0), quotas });
  };
  return (
    <section className="delivery-settings">
      <h2>كيف تصل الأسئلة إلى الطلاب؟</h2>
      <div className="delivery-modes" role="group" aria-label="طريقة توزيع أسئلة الامتحان">
        {(
          [
            ['fixed', 'نفس الأسئلة', 'بنفس الترتيب'],
            ['shuffle', 'نفس الأسئلة', 'بترتيب عشوائي لكل طالب'],
            ['random', 'سحب من المجموعة', 'أسئلة عشوائية لكل طالب'],
          ] as const
        ).map(([key, title, description]) => (
          <button
            type="button"
            key={key}
            aria-pressed={mode === key}
            onClick={() => {
              onShuffleChange?.(key === 'shuffle');
              onChange(key === 'random' ? defaultDelivery(questions) : undefined);
            }}
          >
            <b>{title}</b>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <div className="delivery-summary">
        <strong>{questions.length} في مجموعة الامتحان</strong>
        <span>←</span>
        <strong>{delivery?.count ?? questions.length} لكل طالب</strong>
      </div>
      {delivery ? (
        <>
          <label className="delivery-count">
            عدد الأسئلة التي يجيب عنها كل طالب
            <input
              aria-label="عدد الأسئلة لكل طالب"
              type="number"
              min={1}
              max={Math.min(100, questions.length)}
              value={delivery.count}
              onChange={(e) => {
                const n = Number(e.target.value);
                const next = deliveryForCount(questions, n);
                onChange(next || { ...delivery, count: n });
              }}
            />
            <small>
              أنت تحدد العدد. تغيير العدد يوزعه على الموضوعات والصعوبات تلقائيًا. الحد الأقصى 100
              سؤال للطالب.
            </small>
          </label>
          <p className="info-note">
            يحصل جميع الطلاب على العدد نفسه. يمكن أن تتكرر بعض الأسئلة أو المجموعة نفسها بين الطلاب،
            دون منع أي طالب من الدخول. تُحفظ أسئلة كل محاولة وترتيبها عند إعادة الاتصال.
          </p>
          {showQuotas && (
            <details>
              <summary>تخصيص توزيع الموضوعات والصعوبات</summary>
              <div className="delivery-table">
                <div>
                  <strong>الموضوع / الصعوبة</strong>
                  <strong>المتاح</strong>
                  <strong>لكل طالب</strong>
                </div>
                {groups.map((g) => {
                  const key = groupKey(g.chapter, g.difficulty),
                    count =
                      delivery.quotas.find((q) => groupKey(q.chapter, q.difficulty) === key)
                        ?.count || 0;
                  return (
                    <div key={key}>
                      <span>
                        {g.chapter}
                        <small>{g.difficulty}</small>
                      </span>
                      <span>{g.available}</span>
                      <input
                        aria-label={`عدد أسئلة ${g.chapter} ${g.difficulty}`}
                        type="number"
                        min={0}
                        max={Math.min(100, g.available)}
                        value={count}
                        onChange={(e) =>
                          change(
                            key,
                            Math.max(
                              0,
                              Math.min(g.available, 100, Math.trunc(Number(e.target.value))),
                            ),
                          )
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </>
      ) : (
        <p className="muted">
          {shuffleQuestions
            ? 'كل طالب يجيب عن جميع الأسئلة المختارة، بترتيب مختلف محفوظ طوال محاولته.'
            : 'جميع الطلاب يجيبون عن الأسئلة المختارة نفسها وبالترتيب نفسه.'}{' '}
          لتغيير العدد، أضف أو احذف أسئلة من مجموعة الامتحان. حد هذا الوضع 100 سؤال.
        </p>
      )}
    </section>
  );
}
