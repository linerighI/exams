import katex from 'katex';
import 'katex/dist/katex.min.css';
import { mathSegments } from './mathNotation';

export default function MathText({ text }: { text: string }) {
  const pieces = mathSegments(text);
  return (
    <span className="math-text">
      {pieces.map((part, i) => {
        const display = !!part.display;
        if (!part.math) return <span key={i}>{part.text}</span>;
        const expression = part.text;
        try {
          return (
            <span
              key={i}
              dir="ltr"
              className="formula"
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(expression, {
                  displayMode: display,
                  throwOnError: true,
                  trust: false,
                  maxExpand: 200,
                  strict: 'error',
                }),
              }}
            />
          );
        } catch {
          return (
            <span key={i} dir="ltr" className="formula-error" title="صيغة رياضية غير صالحة؛ راجعها">
              {part.text}
            </span>
          );
        }
      })}
    </span>
  );
}

export function FormulaEditor({
  value,
  onChange,
  showPreview = true,
  tools = true,
  ariaLabel = 'نص ومعادلات',
}: {
  value: string;
  onChange: (v: string) => void;
  showPreview?: boolean;
  tools?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className="formula-editor">
      {tools && (
        <div className="formula-tools">
          {['\\frac{a}{b}', 'x^{2}', '\\sqrt{x}', '\\theta', '\\leq', '\\pi'].map((valueMath) => (
            <button
              type="button"
              key={valueMath}
              onClick={() => onChange(value + ` \\(${valueMath}\\) `)}
            >
              <MathText text={`\\(${valueMath}\\)`} />
            </button>
          ))}
        </div>
      )}
      <textarea
        className="question-text"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {showPreview && (
        <div className="formula-preview">
          <MathText text={value} />
        </div>
      )}
    </div>
  );
}
