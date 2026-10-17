import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, X } from 'lucide-react';
const ScientificCalculator = lazy(() => import('./ScientificCalculator'));
export type StudentToolsHandle = { open: (tool: 'calculator' | 'geometry') => void };
export default function StudentTools({
  calculatorAllowed,
  geogebraAllowed,
  controller,
  onOpenChange,
}: {
  calculatorAllowed?: boolean;
  geogebraAllowed?: boolean;
  controller?: RefObject<StudentToolsHandle | null>;
  onOpenChange?: (open: boolean) => void;
}) {
  const [tool, setTool] = useState<'calculator' | 'geometry' | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [calculatorLoaded, setCalculatorLoaded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!controller) return;
    controller.current = {
      open: (next) => {
        if (next === 'calculator' && calculatorAllowed) {
          setCalculatorLoaded(true);
          setTool(next);
        }
        if (next === 'geometry' && geogebraAllowed) {
          setLoaded(true);
          setTool(next);
        }
      },
    };
    return () => {
      controller.current = null;
    };
  }, [controller, calculatorAllowed, geogebraAllowed]);
  useEffect(() => {
    onOpenChange?.(!!tool);
  }, [tool, onOpenChange]);
  useEffect(() => () => onOpenChange?.(false), [onOpenChange]);
  useEffect(() => {
    if (!tool) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [tool]);
  if (!calculatorAllowed && !geogebraAllowed) return null;
  return (
    <div className="student-tools">
      <span>الأدوات المسموح بها</span>
      {calculatorAllowed && (
        <button
          className="secondary small"
          onClick={() => {
            setCalculatorLoaded(true);
            setTool('calculator');
          }}
        >
          <Calculator size={16} />
          الآلة الحاسبة
        </button>
      )}
      {geogebraAllowed && (
        <button
          className="secondary small"
          onClick={() => {
            setLoaded(true);
            setTool('geometry');
          }}
        >
          GeoGebra
        </button>
      )}
      {createPortal(
        <div className="student-tool-overlay" hidden={!tool}>
          <section
            ref={panel}
            className={`card student-tool-panel ${tool === 'geometry' ? 'is-geometry' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={tool === 'geometry' ? 'GeoGebra' : 'الآلة الحاسبة'}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setTool(undefined);
              }
              if (e.key === 'Tab') {
                const items = [
                  ...panel.current!.querySelectorAll<HTMLElement>('button,input,iframe'),
                ].filter((n) => n.getClientRects().length > 0);
                if (e.shiftKey && document.activeElement === items[0]) {
                  e.preventDefault();
                  items.at(-1)?.focus();
                } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
                  e.preventDefault();
                  items[0]?.focus();
                }
              }
            }}
          >
            <header>
              <h2>{tool === 'geometry' ? 'مساحة الرسم · GeoGebra' : 'الآلة الحاسبة'}</h2>
              <button aria-label="إغلاق أداة الرياضيات" onClick={() => setTool(undefined)}>
                <X size={20} />
              </button>
            </header>
            <div hidden={tool !== 'calculator'}>
              {calculatorLoaded && (
                <Suspense fallback={<p>جارٍ تجهيز الآلة العلمية…</p>}>
                  <ScientificCalculator />
                </Suspense>
              )}
            </div>
            <div hidden={tool !== 'geometry'}>
              {loaded && geogebraAllowed && (
                <iframe
                  title="GeoGebra للطالب"
                  src="geometry.html?student=1"
                  sandbox="allow-scripts allow-same-origin"
                />
              )}
              <p className="tiny muted">
                مساحة مساعدة للحل؛ إجابتك المعتمدة هي الخيار الذي تحدده في السؤال. GeoGebra
                للاستخدام التعليمي.
              </p>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
