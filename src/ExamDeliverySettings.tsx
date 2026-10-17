import type { Exam, Question } from './types';
import { defaultDelivery, groupKey, poolGroups } from './examDelivery';
export default function ExamDeliverySettings({
  questions,
  delivery,
  onChange,
}: {
  questions: Question[];
  delivery?: Exam['delivery'];
  onChange: (value: Exam['delivery']) => void;
}) {
  const groups = poolGroups(questions);
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
      <div className="section-heading">
        <div>
          <h2>نموذج مختلف لكل طالب</h2>
          <p>مجموعة معتمدة واحدة، وتوزيع ثابت للموضوعات والصعوبات.</p>
        </div>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={!!delivery}
          onChange={(e) => {
            if (!e.target.checked) return onChange(undefined);
            onChange(
              defaultDelivery(questions) || {
                mode: 'random',
                count: 1,
                quotas: groups.map((g) => ({
                  chapter: g.chapter,
                  difficulty: g.difficulty,
                  count: 1,
                })),
              },
            );
          }}
        />
        سحب عشوائي عند بدء المحاولة
      </label>
      {delivery ? (
        <>
          <div className="delivery-summary">
            <strong>{questions.length} سؤالًا في المجموعة</strong>
            <span>←</span>
            <strong>{delivery.count} سؤالًا لكل طالب</strong>
          </div>
          <p className="muted">
            حدّد نصيب كل موضوع ومستوى. يحصل الجميع على العدد والتوزيع نفسيهما؛ قد يشتركون في بعض
            الأسئلة، لكن لا يتكرر النموذج كاملًا. تُحفظ الأسئلة والتصحيح مع المحاولة.
          </p>
          <div className="delivery-table">
            <div>
              <strong>الموضوع / الصعوبة</strong>
              <strong>المتاح</strong>
              <strong>لكل طالب</strong>
            </div>
            {groups.map((g) => {
              const key = groupKey(g.chapter, g.difficulty),
                count =
                  delivery.quotas.find((q) => groupKey(q.chapter, q.difficulty) === key)?.count ||
                  0;
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
                    onChange={(e) => change(key, Math.max(0, Math.trunc(Number(e.target.value))))}
                  />
                </div>
              );
            })}
          </div>
          <p className="info-note">
            يتحقق النظام قبل النشر من كفاية النماذج لطلاب الصف. لن يُكرر نموذجًا قديمًا عند نفاد
            الاحتمالات.
          </p>
        </>
      ) : (
        <p className="muted">
          الوضع الثابت: الأسئلة المختارة نفسها لجميع الطلاب. فعّل السحب بعد إضافة مجموعة أكبر من عدد
          أسئلة الطالب.
        </p>
      )}
    </section>
  );
}
