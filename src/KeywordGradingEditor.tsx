import type { Question } from './types';
export default function KeywordGradingEditor({
  q,
  patch,
}: {
  q: Question;
  patch: (p: Partial<Question>) => void;
}) {
  if (!['short', 'essay'].includes(q.kind || 'single')) return null;
  const config = q.keywordGrading;
  return (
    <details data-question-field="keywordGrading" className="keyword-editor" open={!!config}>
      <summary>مساعدة التصحيح بالكلمات والمفاهيم</summary>
      <label className="check-label">
        <input
          type="checkbox"
          checked={!!config}
          onChange={(e) =>
            patch({
              keywordGrading: e.target.checked
                ? { mode: 'review', required: 1, groups: [{ label: 'الفكرة الأولى', terms: [''] }] }
                : undefined,
              acceptedAnswers: q.acceptedAnswers?.filter((v) => v.trim()),
            })
          }
        />
        اقتراح درجة بالكلمات المفتاحية، ثم اعتماد المعلم
      </label>
      <p className="muted">
        الكلمات وحدها لا تثبت صحة المعنى. يراجع المعلم النفي والتناقض والمرادفات قبل اعتماد الدرجة.
      </p>
      {config && (
        <>
          <label className="field">
            عدد الأفكار اللازمة للدرجة الكاملة
            <input
              type="number"
              min={1}
              max={config.groups.length}
              value={config.required}
              onChange={(e) =>
                patch({
                  keywordGrading: {
                    ...config,
                    required: Math.max(
                      1,
                      Math.min(config.groups.length, Number(e.target.value) || 1),
                    ),
                  },
                })
              }
            />
          </label>
          {config.groups.map((group, i) => (
            <div className="keyword-group" key={i}>
              <label className="field">
                اسم الفكرة {i + 1}
                <input
                  maxLength={150}
                  value={group.label}
                  onChange={(e) =>
                    patch({
                      keywordGrading: {
                        ...config,
                        groups: config.groups.map((g, j) =>
                          i === j ? { ...g, label: e.target.value } : g,
                        ),
                      },
                    })
                  }
                />
              </label>
              <label className="field">
                كلمات أو عبارات مقبولة · افصل البدائل بعلامة |
                <input
                  aria-label={`مرادفات الفكرة ${i + 1}`}
                  value={group.terms.join('|')}
                  onChange={(e) =>
                    patch({
                      keywordGrading: {
                        ...config,
                        groups: config.groups.map((g, j) =>
                          i === j ? { ...g, terms: e.target.value.split('|').slice(0, 15) } : g,
                        ),
                      },
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="text-button"
                disabled={config.groups.length <= 1}
                onClick={() =>
                  patch({
                    keywordGrading: {
                      ...config,
                      required: Math.min(config.required, config.groups.length - 1),
                      groups: config.groups.filter((_, j) => j !== i),
                    },
                  })
                }
              >
                حذف الفكرة
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary small"
            disabled={config.groups.length >= 20}
            onClick={() =>
              patch({
                keywordGrading: {
                  ...config,
                  groups: [
                    ...config.groups,
                    { label: `الفكرة ${config.groups.length + 1}`, terms: [''] },
                  ],
                },
              })
            }
          >
            إضافة فكرة
          </button>
          <p className="muted">
            يُحسب كل مفهوم مرة واحدة فقط. يرى الطالب العدد المطلوب دون كلمات الإجابة، ولا يُعتمد أي
            اقتراح تلقائيًا.
          </p>
        </>
      )}
    </details>
  );
}
