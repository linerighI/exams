import katex from 'katex';
import 'katex/dist/katex.min.css';
import { mathSegments } from './mathNotation';
import { lazy, Suspense } from 'react';
const VisualFormulaEditor = lazy(() => import('./VisualFormulaEditor'));

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
    <Suspense
      fallback={
        <div className="formula-preview">
          <MathText text={value} />
        </div>
      }
    >
      <VisualFormulaEditor
        value={value}
        onChange={onChange}
        tools={tools}
        showPreview={showPreview}
        ariaLabel={ariaLabel}
      />
    </Suspense>
  );
}
