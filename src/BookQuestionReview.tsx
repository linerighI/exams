import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowUpLeft,
  BookOpen,
  CheckCircle2,
  Check,
  ChevronLeft,
  ImagePlus,
  Loader2,
  Pencil,
  Scan,
  ShieldCheck,
  X,
} from 'lucide-react';
import MathText, { FormulaEditor } from './MathText';
import GeometryEditor from './GeometryEditor';
import { api } from './api';
import { fileBase64 } from './api';
import { svgToPng } from './svgDiagram';
import './review.css';
type Props = {
  question: any;
  bookId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  notify: (message: string) => void;
};
export default function BookQuestionReview({
  question: initial,
  bookId,
  onClose,
  onSaved,
  notify,
}: Props) {
  const [question, setQuestion] = useState({ ...initial }),
    [editing, setEditing] = useState(false),
    [source, setSource] = useState(''),
    [sourceOpen, setSourceOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [geometry, setGeometry] = useState(false),
    [error, setError] = useState(''),
    [crop, setCrop] = useState<number[] | undefined>(
      initial.box?.length === 4 ? initial.box : undefined,
    ),
    [dragging, setDragging] = useState(false);
  const origin = useRef<number[] | undefined>(undefined),
    close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !geometry && !saving) onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [geometry, saving]);
  useEffect(() => {
    close.current?.focus();
    if (initial.svg && !initial.image)
      void svgToPng(initial.svg)
        .then((diagram) => setQuestion((q: any) => ({ ...q, ...diagram })))
        .catch((e) => setError((e as Error).message));
  }, []);
  async function showSource() {
    setSourceOpen(true);
    if (source) return;
    setLoading(true);
    setError('');
    try {
      setSource((await api(`/api/books/${bookId}/page/${question.page}`)).image);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function save(status: 'draft' | 'approved') {
    setSaving(true);
    setError('');
    try {
      await api(`/api/bank/${question.id}`, 'PUT', { ...question, status });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function applyCrop() {
    if (!crop) return;
    setSaving(true);
    setError('');
    try {
      const result = await api(`/api/bank/${question.id}/crop`, 'POST', { box: crop });
      setQuestion({
        ...question,
        image: result.image,
        box: result.box,
        cropWarning: undefined,
        status: 'draft',
      });
      setSourceOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function point(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    ];
  }
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !origin.current) return;
    const p = point(e);
    setCrop([
      Math.min(p[0], origin.current[0]),
      Math.min(p[1], origin.current[1]),
      Math.max(p[0], origin.current[0]),
      Math.max(p[1], origin.current[1]),
    ]);
  };
  return (
    <motion.div
      className="workspace-modal bank-review-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className={`bank-review-dialog ${sourceOpen ? 'with-source' : ''}`}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 310, damping: 30 }}
      >
        <header className="bank-review-header">
          <div>
            <span className="review-heading-icon">
              <BookOpen size={22} />
            </span>
            <div>
              <span>بنك الأسئلة · {question.chapter}</span>
              <h2 id="review-title">مراجعة السؤال</h2>
            </div>
          </div>
          <button
            className="review-close"
            ref={close}
            aria-label="إغلاق مراجعة السؤال"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </header>
        <div className="bank-review-toolbar">
          <div className="review-mode-tabs" role="tablist" aria-label="طريقة مراجعة السؤال">
            <button
              role="tab"
              aria-selected={!editing}
              className={!editing ? 'selected' : ''}
              onClick={() => setEditing(false)}
            >
              <ShieldCheck size={15} />
              معاينة
            </button>
            <button
              role="tab"
              aria-selected={editing}
              className={editing ? 'selected' : ''}
              onClick={() => setEditing(true)}
            >
              <Pencil size={15} />
              تعديل
            </button>
          </div>
          <div className="review-tags">
            <span>صفحة {question.page}</span>
            <span>{question.difficulty}</span>
            <span className={question.status === 'approved' ? 'approved' : ''}>
              {question.status === 'approved' ? 'معتمد' : 'مسودة للمراجعة'}
            </span>
          </div>
        </div>
        <div className="bank-review-body">
          <div className="bank-review-question">
            {(error || question.cropWarning) && (
              <div className="review-warning" role="alert">
                <AlertCircle size={18} />
                <span>{error || question.cropWarning}</span>
                {!error && !question.image && (
                  <button onClick={() => void showSource()}>
                    تحديد الصورة
                    <ArrowUpLeft size={14} />
                  </button>
                )}
              </div>
            )}
            {!editing ? (
              <>
                <h3 className="review-question-text">
                  <MathText text={question.text} />
                </h3>
                {question.image && (
                  <div className="review-question-image">
                    <img src={question.image} alt="الرسم المرتبط بالسؤال" />
                    <button onClick={() => void showSource()}>
                      <Scan size={14} />
                      تعديل القص
                    </button>
                  </div>
                )}
                <div className="review-option-list" role="radiogroup" aria-label="الإجابة الصحيحة">
                  {question.options.map((option: string, i: number) => (
                    <button
                      role="radio"
                      aria-checked={question.correct === i}
                      key={i}
                      className={question.correct === i ? 'correct' : ''}
                      onClick={() => setQuestion({ ...question, correct: i })}
                    >
                      <span className="review-option-circle">
                        {question.correct === i && <Check size={12} />}
                      </span>
                      <span className="review-option-letter">{['أ', 'ب', 'ج', 'د'][i]}</span>
                      <MathText text={option} />
                      {question.correct === i && (
                        <small>
                          <CheckCircle2 size={13} />
                          الإجابة الصحيحة
                        </small>
                      )}
                    </button>
                  ))}
                </div>
                <p className="review-selection-hint">اضغط خيارًا لتغيير الإجابة الصحيحة.</p>
                <details className="review-explanation" open>
                  <summary>تفسير الإجابة · للمعلم فقط</summary>
                  <MathText text={question.explanation} />
                </details>
                <details className="review-evidence">
                  <summary>الدليل من صفحة المصدر</summary>
                  <MathText text={question.evidence} />
                </details>
              </>
            ) : (
              <div className="review-edit-form">
                <label className="review-image-required">
                  <input
                    type="checkbox"
                    checked={!!question.requiresImage}
                    onChange={(e) =>
                      setQuestion({
                        ...question,
                        requiresImage: e.target.checked,
                        cropWarning: e.target.checked ? question.cropWarning : undefined,
                      })
                    }
                  />
                  هذا السؤال يحتاج رسمًا للإجابة عنه
                </label>
                <div className="review-formula-field">
                  نص السؤال
                  <FormulaEditor
                    ariaLabel="نص السؤال"
                    showPreview={false}
                    value={question.text}
                    onChange={(text) => setQuestion({ ...question, text })}
                  />
                </div>
                <div className="review-edit-options">
                  {question.options.map((option: string, i: number) => (
                    <div className="review-formula-field" key={i}>
                      <span>
                        <input
                          type="radio"
                          name="correct-bank-option"
                          aria-label={`اعتماد الخيار ${i + 1}`}
                          checked={question.correct === i}
                          onChange={() => setQuestion({ ...question, correct: i })}
                        />
                        الخيار {['أ', 'ب', 'ج', 'د'][i]}
                      </span>
                      <FormulaEditor
                        ariaLabel={`الخيار ${i + 1}`}
                        tools={false}
                        showPreview={false}
                        value={option}
                        onChange={(value) =>
                          setQuestion({
                            ...question,
                            options: question.options.map((v: string, j: number) =>
                              j === i ? value : v,
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="review-formula-field">
                  تفسير الإجابة
                  <FormulaEditor
                    ariaLabel="تفسير الإجابة"
                    showPreview={false}
                    tools={false}
                    value={question.explanation}
                    onChange={(explanation) => setQuestion({ ...question, explanation })}
                  />
                </div>
                <button className="review-preview-action" onClick={() => setEditing(false)}>
                  شاهد معاينة التعديلات
                  <ChevronLeft size={16} />
                </button>
              </div>
            )}
            <div className="review-image-tools">
              <label className="secondary file-button">
                <ImagePlus size={16} />
                إرفاق صورة أو SVG
                <input
                  aria-label="صورة السؤال أو SVG"
                  type="file"
                  accept="image/png,image/jpeg,.svg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file)
                      void (async () => {
                        try {
                          if (file.size > 2 * 1024 * 1024)
                            throw Error('اختر صورة أقل من 2 ميجابايت');
                          const diagram = /\.svg$/i.test(file.name)
                            ? await svgToPng(await file.text())
                            : { image: await fileBase64(file), svg: undefined };
                          setQuestion({ ...question, ...diagram, cropWarning: undefined });
                          setError('');
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      })();
                  }}
                />
              </label>
              <button onClick={() => void showSource()}>
                <Scan size={16} />
                {question.image ? 'صفحة المصدر والقص' : 'إرفاق رسم من الكتاب'}
              </button>
              <button onClick={() => setGeometry(true)}>
                <ImagePlus size={16} />
                رسم هندسي · GeoGebra
              </button>
            </div>
          </div>
          {sourceOpen && (
            <aside className="review-source-pane">
              <header>
                <div>
                  <strong>صفحة المصدر {question.page}</strong>
                  <small>اسحب مستطيلًا حول الرسم الذي تريده.</small>
                </div>
                <button aria-label="إغلاق صفحة المصدر" onClick={() => setSourceOpen(false)}>
                  <X size={17} />
                </button>
              </header>
              {loading ? (
                <div className="source-loading">
                  <Loader2 className="spin" />
                  <span>جارٍ عرض الصفحة…</span>
                </div>
              ) : (
                source && (
                  <>
                    <div className="crop-instructions">
                      <Scan size={15} />
                      حدد الرسم وتسمياته، ثم اضغط «إرفاق القص».
                    </div>
                    <div
                      className="visual-crop-stage"
                      dir="ltr"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        origin.current = point(e);
                        setDragging(true);
                        setCrop(undefined);
                      }}
                      onPointerMove={pick}
                      onPointerUp={(e) => {
                        pick(e);
                        setDragging(false);
                        origin.current = undefined;
                      }}
                      onPointerCancel={() => {
                        setDragging(false);
                        origin.current = undefined;
                      }}
                    >
                      <img draggable={false} src={source} alt={`صفحة المصدر ${question.page}`} />
                      {crop && (
                        <div
                          className="visual-crop-box"
                          style={{
                            left: `${crop[0] * 100}%`,
                            top: `${crop[1] * 100}%`,
                            width: `${(crop[2] - crop[0]) * 100}%`,
                            height: `${(crop[3] - crop[1]) * 100}%`,
                          }}
                        >
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                      )}
                    </div>
                    <div className="crop-action-row">
                      <button onClick={() => setCrop([0, 0, 1, 1])}>الصفحة كاملة</button>
                      <button
                        className="primary"
                        disabled={
                          saving || !crop || crop[2] - crop[0] < 0.001 || crop[3] - crop[1] < 0.001
                        }
                        onClick={() => void applyCrop()}
                      >
                        {saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />}إرفاق
                        القص
                      </button>
                    </div>
                  </>
                )
              )}
            </aside>
          )}
        </div>
        <footer className="bank-review-footer">
          <span>
            <ShieldCheck size={15} />
            راجع النص والإجابة والصورة قبل الاعتماد.
          </span>
          <div>
            <button className="secondary" disabled={saving} onClick={() => void save('draft')}>
              حفظ مسودة
            </button>
            <button
              className="primary"
              disabled={saving || (!!question.requiresImage && !question.image)}
              onClick={() => void save('approved')}
            >
              {saving ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}اعتماد
              السؤال
            </button>
          </div>
        </footer>
      </motion.section>
      {geometry && (
        <GeometryEditor
          geometryId={question.geometryId}
          initialPrompt={question.text}
          notify={notify}
          onClose={() => setGeometry(false)}
          onSave={(image, geometryId) =>
            setQuestion({ ...question, image, geometryId, cropWarning: undefined })
          }
        />
      )}
    </motion.div>
  );
}
