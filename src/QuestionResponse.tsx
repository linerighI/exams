import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUp, ArrowDown, GripVertical, Check, Eraser } from 'lucide-react';
import type { Question } from './types';
import { kindOf, matchingColumns, type Answer } from './questionFormats';
import MathText from './MathText';
import { textDirection } from './textDirection';
import './questionStudio.css';

export default function QuestionResponse({
  question: q,
  value,
  onChange,
  disabled = false,
}: {
  question: Question;
  value?: Answer;
  onChange: (a: Answer) => void;
  disabled?: boolean;
}) {
  const kind = kindOf(q),
    reduced = useReducedMotion();
  if (kind === 'short' || kind === 'essay')
    return (
      <label className="field question-written">
        إجابتك
        {q.keywordTarget && (
          <span className="keyword-student-hint">
            للدرجة الكاملة: اذكر {q.keywordTarget} أفكار صحيحة ومختلفة. يراجع المعلم المعنى؛ تكرار
            الكلمات لا يزيد الدرجة.
          </span>
        )}
        {kind === 'short' ? (
          <input
            dir={textDirection(typeof value === 'string' && value.trim() ? value : q.text)}
            maxLength={10000}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="اكتب إجابتك هنا"
          />
        ) : (
          <textarea
            dir={textDirection(typeof value === 'string' && value.trim() ? value : q.text)}
            rows={6}
            maxLength={10000}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="اكتب إجابتك وراجعها قبل التسليم"
          />
        )}
      </label>
    );
  if (kind === 'blank') {
    const values = Array.isArray(value) ? value : [];
    return (
      <div className="response-blanks">
        {Array.from({ length: q.blankCount || q.blankAnswers?.length || 1 }, (_, i) => (
          <label className="field" key={i}>
            الفراغ {i + 1}
            <input
              dir={textDirection(String(values[i] || q.text))}
              disabled={disabled}
              maxLength={1000}
              value={String(values[i] || '')}
              onChange={(e) =>
                onChange(
                  Array.from({ length: q.blankCount || q.blankAnswers?.length || 1 }, (_, j) =>
                    j === i ? e.target.value : String(values[j] || ''),
                  ),
                )
              }
            />
          </label>
        ))}
      </div>
    );
  }
  if (kind === 'match')
    return <Matching key={q.id} q={q} value={value} onChange={onChange} disabled={disabled} />;
  if (kind === 'order')
    return <Ordering key={q.id} q={q} value={value} onChange={onChange} disabled={disabled} />;
  if (kind === 'draw')
    return <Drawing key={q.id} value={value} onChange={onChange} disabled={disabled} />;
  return (
    <div
      className={`student-options response-choices ${kind === 'multiple' ? 'is-multiple' : ''}`}
      aria-label="خيارات الإجابة"
    >
      {kind === 'multiple' && <p className="muted">يمكن اختيار أكثر من إجابة.</p>}
      {q.options.map((option, i) => {
        const selected =
          kind === 'multiple' ? Array.isArray(value) && value.includes(i) : value === i;
        return (
          <motion.button
            type="button"
            disabled={disabled}
            key={i}
            aria-pressed={selected}
            className={selected ? 'selected' : ''}
            whileTap={reduced ? undefined : { scale: 0.99 }}
            onClick={() =>
              onChange(
                kind === 'multiple'
                  ? Array.isArray(value)
                    ? value.includes(i)
                      ? value.filter((v) => v !== i)
                      : [...value, i]
                    : [i]
                  : i,
              )
            }
          >
            <motion.span
              className="radio-circle"
              animate={reduced ? undefined : { scale: selected ? [0.85, 1.12, 1] : 1 }}
            >
              {selected && <Check size={15} />}
            </motion.span>
            <span className="option-letter">
              {['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'][i]}
            </span>
            <MathText text={option} />
          </motion.button>
        );
      })}
    </div>
  );
}
function Ordering({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question;
  value?: Answer;
  onChange: (a: Answer) => void;
  disabled: boolean;
}) {
  // The initial display is deliberately different from the teacher's sequence. It is not an answer until confirmed.
  const order = Array.isArray(value) ? (value as number[]) : q.options.map((_, i) => i).reverse();
  const dragged = useRef<number | null>(null),
    reduced = useReducedMotion();
  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  return (
    <div className="response-order">
      <p className="muted">اسحب العناصر لترتيبها، أو استخدم السهمين، ثم اعتمد الترتيب.</p>
      {order.map((index, i) => (
        <motion.div
          layout={!reduced}
          className="response-rank"
          key={index}
          draggable={!disabled}
          onDragStart={() => {
            dragged.current = i;
          }}
          onDragEnd={() => (dragged.current = null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragged.current !== null) move(dragged.current, i);
            dragged.current = null;
          }}
        >
          <GripVertical size={16} />
          <span>{i + 1}</span>
          <MathText text={q.options[index]} />
          <button
            type="button"
            className="secondary small"
            aria-label={`رفع العنصر ${i + 1}`}
            disabled={disabled || i === 0}
            onClick={() => move(i, i - 1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="secondary small"
            aria-label={`خفض العنصر ${i + 1}`}
            disabled={disabled || i === order.length - 1}
            onClick={() => move(i, i + 1)}
          >
            <ArrowDown size={15} />
          </button>
        </motion.div>
      ))}
      <button
        type="button"
        className="secondary small"
        disabled={disabled}
        onClick={() => onChange([...order])}
      >
        <Check size={16} />
        اعتماد هذا الترتيب
      </button>
    </div>
  );
}
function Matching({
  q,
  value,
  onChange,
  disabled,
}: {
  q: Question;
  value?: Answer;
  onChange: (a: Answer) => void;
  disabled: boolean;
}) {
  const cols = matchingColumns(q),
    pairs =
      value && typeof value === 'object' && !Array.isArray(value) && 'pairs' in value
        ? value.pairs
        : cols.left.map(() => -1);
  const [active, setActive] = useState<number | null>(null),
    [paths, setPaths] = useState<string[]>([]),
    box = useRef<HTMLDivElement>(null),
    dragged = useRef<number | null>(null);
  const connect = (left: number, right: number) => {
    if (disabled) return;
    onChange({ pairs: pairs.map((v, i) => (i === left ? right : v === right ? -1 : v)) });
    setActive(null);
  };
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const redraw = () => {
      const root = el.getBoundingClientRect();
      setPaths(
        pairs.flatMap((to, from) => {
          const l = el.querySelector(`[data-match-left="${from}"]`)?.getBoundingClientRect(),
            r = el.querySelector(`[data-match-right="${to}"]`)?.getBoundingClientRect();
          if (!l || !r) return [];
          const x1 = l.left - root.left,
            y1 = l.top + l.height / 2 - root.top,
            x2 = r.right - root.left,
            y2 = r.top + r.height / 2 - root.top;
          return [`M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`];
        }),
      );
    };
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [q, JSON.stringify(pairs)]);
  return (
    <div className="response-matching">
      <p className="muted">اختر عنصرًا من اليمين ثم نظيره من اليسار، أو اسحب بينهما.</p>
      <div className="response-match-grid" ref={box}>
        <div>
          {cols.left.map((v, i) => (
            <button
              type="button"
              key={i}
              disabled={disabled}
              data-match-left={i}
              draggable={!disabled}
              aria-pressed={active === i}
              className={pairs[i] >= 0 ? 'matched' : ''}
              onDragStart={() => (dragged.current = i)}
              onDragEnd={() => (dragged.current = null)}
              onClick={() => setActive(active === i ? null : i)}
            >
              <MathText text={v} />
              {pairs[i] >= 0 && <Check size={14} />}
            </button>
          ))}
        </div>
        <svg aria-label="خطوط التوصيل المختارة" role="img">
          {paths.map((d, i) => (
            <motion.path key={i} d={d} initial={false} animate={{ d }} />
          ))}
        </svg>
        <div>
          {cols.right.map((v, i) => (
            <button
              type="button"
              key={i}
              disabled={disabled}
              data-match-right={i}
              className={pairs.includes(i) ? 'matched' : ''}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragged.current !== null) connect(dragged.current, i);
                dragged.current = null;
              }}
              onClick={() => {
                if (active !== null) connect(active, i);
              }}
            >
              <MathText text={v} />
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="text-button"
        disabled={disabled}
        onClick={() => onChange({ pairs: cols.left.map(() => -1) })}
      >
        مسح التوصيلات
      </button>
      <span className="muted" role="status">
        {pairs.filter((i) => i >= 0).length} من {cols.left.length} أزواج
      </span>
    </div>
  );
}
function Drawing({
  value,
  onChange,
  disabled,
}: {
  value?: Answer;
  onChange: (a: Answer) => void;
  disabled: boolean;
}) {
  const answer =
    value && typeof value === 'object' && !Array.isArray(value) && 'strokes' in value
      ? value
      : { strokes: [], text: '' };
  const [ink, setInk] = useState(answer.strokes),
    stroke = useRef<number[][] | null>(null),
    svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!stroke.current) setInk(answer.strokes);
  }, [value]);
  const point = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    ];
  };
  const finish = () => {
    if (!stroke.current) return;
    const next = [...answer.strokes, stroke.current];
    stroke.current = null;
    setInk(next);
    onChange({ ...answer, strokes: next });
  };
  return (
    <div className="response-drawing">
      <p className="muted">اكتب بالقلم أو الفأرة. يمكنك أيضًا كتابة وصف للإجابة أسفل المساحة.</p>
      <svg
        ref={svg}
        className="response-ink"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
        aria-label="مساحة الإجابة بالقلم"
        role="img"
        onPointerDown={(e) => {
          if (disabled || answer.strokes.length >= 300) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          stroke.current = [point(e)];
          setInk([...answer.strokes, stroke.current]);
        }}
        onPointerMove={(e) => {
          if (!stroke.current || ink.reduce((n, s) => n + s.length, 0) >= 15000) return;
          const next = point(e),
            prev = stroke.current.at(-1)!;
          if (Math.hypot(next[0] - prev[0], next[1] - prev[1]) < 0.003) return;
          stroke.current = [...stroke.current, next];
          setInk([...answer.strokes, stroke.current]);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {ink.map((s, i) => (
          <polyline key={i} points={s.map(([x, y]) => `${x * 1000},${y * 400}`).join(' ')} />
        ))}
      </svg>
      <button
        type="button"
        className="secondary small"
        disabled={disabled}
        onClick={() => {
          setInk([]);
          onChange({ ...answer, strokes: [] });
        }}
      >
        <Eraser size={15} />
        مسح الرسم
      </button>
      <label className="field">
        وصف الإجابة
        <textarea
          disabled={disabled}
          maxLength={10000}
          value={answer.text}
          onChange={(e) => onChange({ ...answer, text: e.target.value })}
        />
      </label>
    </div>
  );
}
