import { useState, useRef, useMemo } from 'react';
import FocusWindow from './FocusWindow';
import { mathDiagramSvg, type MathDiagram } from './mathDiagrams';
import { svgToPng } from './svgDiagram';
import { useAnimato } from './animato';
import './services.css';
export default function MathDiagramEditor({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (image: string) => void;
}) {
  const [type, setType] = useState<MathDiagram['type']>('function'),
    [coefficients, setCoefficients] = useState('0, 0, 1'),
    [range, setRange] = useState(10),
    [width, setWidth] = useState(4),
    [height, setHeight] = useState(3),
    [fx, setFx] = useState(8),
    [fy, setFy] = useState(5),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useAnimato(root, type);
  const result = useMemo(() => {
    try {
      const terms = coefficients.split(/[,،]/);
      if (type === 'function' && terms.some((t) => !t.trim()))
        throw Error('أدخل كل معامل، واستخدم 0 للحد الغائب');
      return {
        svg: mathDiagramSvg(
          type === 'function'
            ? { type, coefficients: terms.map(Number), range }
            : type === 'triangle'
              ? { type, width, height }
              : { type, fx, fy },
        ),
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [type, coefficients, range, width, height, fx, fy]);
  return (
    <FocusWindow title="خدمة الرياضيات · رسم من معطياتك" onClose={onClose} wide>
      <div className="math-diagram-editor" ref={root}>
        <p>
          رسم محلي من القيم التي تدخلها. راجع المقياس والتسميات قبل إرفاقه؛ لا يضيف الحل المطلوب.
        </p>
        <label className="field">
          نوع الرسم
          <select value={type} onChange={(e) => setType(e.target.value as MathDiagram['type'])}>
            <option value="function">منحنى دالة كثيرة الحدود</option>
            <option value="triangle">مثلث قائم</option>
            <option value="forces">قوتان على جسم</option>
          </select>
        </label>
        <div className="service-tool-fields" data-animato>
          {type === 'function' ? (
            <>
              <label className="field">
                المعاملات: الثابت ثم x ثم x²
                <input
                  dir="ltr"
                  value={coefficients}
                  onChange={(e) => setCoefficients(e.target.value)}
                />
                <small>مثل 0, -4, 0, 1 للدالة x³ − 4x</small>
              </label>
              <label className="field">
                حد المحورين ±
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={range}
                  onChange={(e) => setRange(+e.target.value)}
                />
              </label>
            </>
          ) : type === 'triangle' ? (
            <>
              <label className="field">
                طول AB بالسنتيمتر
                <input
                  type="number"
                  min="0.1"
                  max="1000"
                  value={width}
                  onChange={(e) => setWidth(+e.target.value)}
                />
              </label>
              <label className="field">
                طول AC بالسنتيمتر
                <input
                  type="number"
                  min="0.1"
                  max="1000"
                  value={height}
                  onChange={(e) => setHeight(+e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="field">
                Fx بالنيوتن
                <input type="number" value={fx} onChange={(e) => setFx(+e.target.value)} />
              </label>
              <label className="field">
                Fy بالنيوتن
                <input type="number" value={fy} onChange={(e) => setFy(+e.target.value)} />
              </label>
              <small>
                الموجب نحو اليمين / الأعلى، والسالب نحو اليسار / الأسفل. طول السهم نسبي لمقدار
                القوة.
              </small>
            </>
          )}
        </div>
        {result.svg && (
          <img
            className="math-service-diagram"
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`}
            alt="معاينة الرسم الرياضي"
          />
        )}
        {(result.error || error) && <p role="alert">{result.error || error}</p>}
        <button
          className="primary"
          disabled={busy || !result.svg}
          onClick={() => {
            setBusy(true);
            setError('');
            void svgToPng(result.svg!)
              .then((value) => {
                onSave(value.image);
                onClose();
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          إرفاق الرسم بالسؤال
        </button>
      </div>
    </FocusWindow>
  );
}
