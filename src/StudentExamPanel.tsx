import type { CSSProperties, RefObject } from 'react';
import {
  Calculator,
  ChartNoAxesCombined,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  LayoutGrid,
  Save,
  X,
} from 'lucide-react';
import { allowedGuideAction, type GuideAction, type GuideContext } from './studentGuide';

export default function StudentExamPanel({
  context,
  busy,
  onAction,
  onClose,
  panelRef,
  style,
}: {
  context: GuideContext;
  busy: boolean;
  onAction: (action: GuideAction) => void;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  style: CSSProperties;
}) {
  const exam = context.exam!;
  const disabled = (action: GuideAction) => busy || !allowedGuideAction(action, context);
  const marked = exam.flagged.includes(exam.current);
  const saveError = exam.saveState === 'error';
  const saveText = exam.finished
    ? 'تم تأكيد تسليم إجاباتك'
    : saveError
      ? 'تعذّر الحفظ على الجهاز. أبلغ المعلم.'
      : exam.saveState === 'saving'
        ? 'جارٍ حفظ إجاباتك على الجهاز…'
        : !exam.online
          ? 'الاتصال منقطع · ستُرسل الإجابات المحفوظة عند عودته'
          : exam.pending
            ? 'محفوظة على الجهاز · جارٍ المزامنة مع المعلم'
            : 'محفوظة ومتزامنة مع جهاز المعلم';
  return (
    <section
      ref={panelRef}
      id="student-guide-panel"
      className="student-guide-panel student-exam-panel"
      role="dialog"
      aria-label="أدوات المحاولة"
      dir="rtl"
      tabIndex={-1}
      style={style}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header>
        <div className="guide-header-mark">
          <LayoutGrid size={21} />
        </div>
        <div>
          <h2>أدوات المحاولة</h2>
          <p>كل ما تحتاجه، بخطوة واحدة</p>
        </div>
        <button aria-label="إغلاق أدوات المحاولة" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="exam-panel-body">
        <div className="exam-panel-progress">
          <span>
            إنجازك{' '}
            <strong>
              {exam.answered} / {exam.total}
            </strong>
          </span>
          {!exam.finished && (
            <span>
              <Clock3 size={14} />
              <b dir="ltr">
                {Math.floor(exam.remaining / 60)}:{String(exam.remaining % 60).padStart(2, '0')}
              </b>
            </span>
          )}
        </div>
        <progress
          aria-label="الأسئلة المجابة"
          value={exam.answered}
          max={Math.max(1, exam.total)}
        />
        <div className={`exam-panel-save ${saveError ? 'has-error' : ''}`} role="status">
          <Save size={16} />
          <span>{saveText}</span>
        </div>
        {!exam.finished ? (
          <>
            <div className="exam-panel-current">
              <button
                aria-label="السؤال السابق من الأدوات"
                disabled={disabled('previous')}
                onClick={() => onAction('previous')}
              >
                <ChevronRight size={18} />
              </button>
              <strong>
                السؤال {exam.current} <small>من {exam.total}</small>
              </strong>
              <button
                aria-label="السؤال التالي من الأدوات"
                disabled={disabled('next')}
                onClick={() => onAction('next')}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
            <button
              className="exam-panel-mark"
              aria-pressed={marked}
              disabled={disabled('mark')}
              onClick={() => onAction('mark')}
            >
              <Flag size={15} />
              {marked ? 'إلغاء تعليم هذا السؤال' : 'علّم هذا السؤال للمراجعة'}
            </button>
            <div className="exam-panel-shortcuts">
              <button disabled={disabled('missing')} onClick={() => onAction('missing')}>
                <strong>{exam.missing.length}</strong>
                <span>أول سؤال غير مجاب</span>
              </button>
              <button disabled={disabled('review')} onClick={() => onAction('review')}>
                <strong>{exam.flagged.length}</strong>
                <span>أسئلة للمراجعة</span>
              </button>
            </div>
            {(exam.calculator || exam.geometry) && (
              <div className="exam-panel-tools" aria-label="أدوات سمح بها المعلم">
                {exam.calculator && (
                  <button disabled={disabled('calculator')} onClick={() => onAction('calculator')}>
                    <Calculator size={17} />
                    الآلة الحاسبة
                  </button>
                )}
                {exam.geometry && (
                  <button disabled={disabled('geometry')} onClick={() => onAction('geometry')}>
                    <ChartNoAxesCombined size={17} />
                    GeoGebra
                  </button>
                )}
              </div>
            )}
            <button
              className="exam-panel-primary"
              disabled={disabled(exam.missing.length ? 'missing' : 'submit')}
              onClick={() => onAction(exam.missing.length ? 'missing' : 'submit')}
            >
              <CheckCheck size={17} />
              {exam.frozen
                ? 'جارٍ التسليم…'
                : exam.missing.length
                  ? 'راجع الأسئلة المتبقية'
                  : 'مراجعة التسليم النهائي'}
            </button>
          </>
        ) : (
          <button
            className="exam-panel-primary"
            disabled={disabled('results')}
            onClick={() => onAction('results')}
          >
            <CheckCheck size={17} />
            عرض نتائجي
          </button>
        )}
      </div>
    </section>
  );
}
