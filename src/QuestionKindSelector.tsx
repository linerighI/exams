import type { Question } from './types';
import { questionKinds, kindOf, changeQuestionKind, type QuestionKind } from './questionFormats';
export default function QuestionKindSelector({
  question,
  onChange,
}: {
  question: Question;
  onChange: (q: Question) => void;
}) {
  return (
    <label className="field">
      نوع السؤال
      <select
        aria-label="نوع السؤال"
        value={kindOf(question)}
        onChange={(e) => onChange(changeQuestionKind(question, e.target.value as QuestionKind))}
      >
        {questionKinds.map(([id, label]) => (
          <option value={id} key={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
