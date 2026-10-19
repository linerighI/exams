import { questionKinds, type QuestionKind } from './questionFormats';
export default function QuestionTypeSelection({
  value,
  onChange,
}: {
  value: QuestionKind[];
  onChange: (k: QuestionKind[]) => void;
}) {
  return (
    <fieldset className="bank-type-selection">
      <legend>أنواع أسئلة البنك</legend>
      <p>اختر الأنواع المناسبة للمادة؛ يمكنك جمع أكثر من نوع في البنك نفسه.</p>
      <div>
        {questionKinds.map(([kind, label]) => (
          <label className="check-label" key={kind}>
            <input
              type="checkbox"
              checked={value.includes(kind)}
              disabled={value.length === 1 && value.includes(kind)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, kind] : value.filter((v) => v !== kind))
              }
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
