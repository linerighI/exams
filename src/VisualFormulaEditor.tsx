import { useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import 'mathlive/fonts.css';
import MathText from './MathText';
import { mathSegments } from './mathNotation';
import { textDirection } from './textDirection';
import './visualMath.css';
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.computeEngine = null;
MathfieldElement.locale = 'ar';
type Part = { id: string; text: string; math?: boolean; display?: boolean };
const split = (text: string): Part[] =>
  mathSegments(text).map((p) => ({
    ...p,
    math: p.math && !/^[+-]?\d+(?:\.\d+)?$/.test(text.trim()),
    id: crypto.randomUUID(),
  }));
function MathInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    field = useRef<MathfieldElement>(null),
    change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const el = new MathfieldElement();
    field.current = el;
    el.mathVirtualKeyboardPolicy = 'manual';
    el.value = value;
    el.setAttribute('aria-label', label);
    const input = () => change.current(el.value);
    const focus = () => {
      window.mathVirtualKeyboard.container = el.closest('dialog') || document.body;
    };
    el.addEventListener('input', input);
    el.addEventListener('focusin', focus);
    host.current!.append(el);
    return () => {
      el.removeEventListener('input', input);
      el.removeEventListener('focusin', focus);
      el.remove();
    };
  }, []);
  useEffect(() => {
    if (field.current && field.current.value !== value)
      field.current.setValue(value, { silenceNotifications: true });
  }, [value]);
  return <div className="visual-math-input" ref={host} />;
}
export default function VisualFormulaEditor({
  value,
  onChange,
  tools,
  showPreview,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  tools: boolean;
  showPreview: boolean;
  ariaLabel: string;
}) {
  const [parts, setParts] = useState(() => split(value)),
    last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setParts(split(value));
      last.current = value;
    }
  }, [value]);
  const commit = (next: Part[]) => {
    setParts(next);
    const text = next
      .map((p) =>
        p.math ? `${p.display ? '\\[' : '\\('}${p.text}${p.display ? '\\]' : '\\)'}` : p.text,
      )
      .join('');
    last.current = text;
    onChange(text);
  };
  const update = (id: string, text: string) =>
    commit(parts.map((p) => (p.id === id ? { ...p, text } : p)));
  const add = (text: string, math = true) =>
    commit([
      ...parts,
      { id: crypto.randomUUID(), text, math },
      { id: crypto.randomUUID(), text: ' ' },
    ]);
  return (
    <div
      className="formula-editor visual-formula-editor"
      role="group"
      aria-label={`${ariaLabel} · محرر مرئي`}
    >
      {tools && (
        <div className="formula-tools">
          <button type="button" onClick={() => add('')}>
            + معادلة
          </button>
          <button type="button" onClick={() => add('', false)}>
            + نص
          </button>
          {['\\frac{a}{b}', 'x^{2}', '\\sqrt{x}', '\\theta', '\\leq', '\\pi'].map((v) => (
            <button type="button" key={v} onClick={() => add(v)}>
              <MathText text={`\\(${v}\\)`} />
            </button>
          ))}
        </div>
      )}
      <div className="visual-formula-parts" dir={textDirection(value)}>
        {parts.map((p, i) =>
          p.math ? (
            <div className="visual-equation" key={p.id}>
              <MathInput
                value={p.text}
                label={`${ariaLabel} · معادلة ${i + 1}`}
                onChange={(v) => update(p.id, v)}
              />
              <button
                type="button"
                aria-label={`حذف المعادلة ${i + 1}`}
                onClick={() => commit(parts.filter((q) => q.id !== p.id))}
              >
                ×
              </button>
            </div>
          ) : (
            <textarea
              key={p.id}
              className="question-text"
              dir={textDirection(p.text || value)}
              aria-label={i === 0 ? ariaLabel : `${ariaLabel} · النص ${i + 1}`}
              rows={Math.max(1, p.text.split('\n').length)}
              value={p.text}
              placeholder={parts.length === 1 ? 'اكتب النص هنا…' : ''}
              onChange={(e) => update(p.id, e.target.value)}
              onBlur={() => {
                if (
                  !/^[+-]?\d+(?:\.\d+)?$/.test(p.text.trim()) &&
                  mathSegments(p.text).some((s) => s.math)
                )
                  commit(parts.flatMap((q) => (q.id === p.id ? split(p.text) : [q])));
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text/plain');
                if (!mathSegments(pasted).some((p) => p.math)) return;
                e.preventDefault();
                const el = e.currentTarget,
                  combined =
                    p.text.slice(0, el.selectionStart) + pasted + p.text.slice(el.selectionEnd);
                commit(parts.flatMap((q) => (q.id === p.id ? split(combined) : [q])));
              }}
            />
          ),
        )}
      </div>
      {showPreview && parts.some((p) => p.math) && (
        <details className="visual-math-preview">
          <summary>معاينة السؤال كاملًا</summary>
          <div className="formula-preview">
            <MathText text={value} />
          </div>
        </details>
      )}
    </div>
  );
}
