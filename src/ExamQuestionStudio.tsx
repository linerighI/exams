import MorphMark from './MorphMark';
import { useSceneMotion } from './appMotion';
import { guideToField } from './appMotion';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls, useReducedMotion } from 'motion/react';
import {
  Plus,
  BookOpen,
  GripVertical,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  ImagePlus,
  Shapes,
  Check,
  Circle,
  ListChecks,
  AlignLeft,
  TextCursorInput,
  Link2,
  ListOrdered,
  PenLine,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import type { Question } from './types';
import {
  createQuestion,
  kindLabel,
  kindOf,
  questionKinds,
  manualQuestion,
  studentQuestion,
  type QuestionKind,
  type Answer,
} from './questionFormats';
import MathText, { FormulaEditor } from './MathText';
import AudioAttachment from './AudioAttachment';
import AudioPlayer from './AudioPlayer';
import GeometryEditor from './GeometryEditor';
import QuestionResponse from './QuestionResponse';
import KeywordGradingEditor from './KeywordGradingEditor';
import { fileBase64 } from './api';
import './questionStudio.css';
const icons = {
  single: Circle,
  multiple: ListChecks,
  boolean: CheckCircle2,
  short: TextCursorInput,
  essay: AlignLeft,
  blank: TextCursorInput,
  match: Link2,
  order: ListOrdered,
  draw: PenLine,
};
export default function ExamQuestionStudio({
  questions,
  onChange,
  onBank,
  notify,
  total,
  random = false,
}: {
  questions: Question[];
  onChange: (q: Question[]) => void;
  onBank: () => void;
  notify: (s: string) => void;
  total: number;
  random?: boolean;
}) {
  const [active, setActive] = useState(questions[0]?.id || ''),
    [palette, setPalette] = useState(false),
    [preview, setPreview] = useState(false),
    [geometry, setGeometry] = useState(false),
    [drop, setDrop] = useState(false),
    [deleted, setDeleted] = useState<{ q: Question; index: number }>(),
    [samples, setSamples] = useState<Record<string, Answer>>({});
  const reduced = useReducedMotion(),
    menu = useRef<HTMLDivElement>(null),
    addButton = useRef<HTMLButtonElement>(null),
    paper = useRef<HTMLElement>(null);
  const q = questions.find((q) => q.id === active) || questions[0],
    index = q ? questions.indexOf(q) : 0;
  useEffect(() => {
    if (palette) menu.current?.querySelector('button')?.focus();
  }, [palette]);
  const studio = useRef<HTMLDivElement>(null);
  useSceneMotion(
    studio,
    '.qs-question-meta, .qs-prompt-editor, [data-answer-editor]',
    `${q?.id}:${preview}`,
  );
  useSceneMotion(studio, '.qs-undo', deleted?.q.id);
  useEffect(() => {
    const element = studio.current;
    const focus = (event: Event) => {
      const { index, field } = (event as CustomEvent).detail;
      const item = questions[index];
      if (!item) return;
      setActive(item.id);
      setPreview(false);
      setPalette(false);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const target =
            field === 'text'
              ? paper.current?.querySelector<HTMLElement>('.qs-prompt-editor')
              : studio.current?.querySelector<HTMLElement>(`[data-question-field="${field}"]`);
          if (target) {
            let parent = target.parentElement;
            while (parent && parent !== paper.current) {
              if (parent instanceof HTMLDetailsElement) parent.open = true;
              parent = parent.parentElement;
            }
            guideToField(target);
          } else {
            const answers = paper.current?.querySelector<HTMLElement>('[data-answer-editor]');
            if (answers) guideToField(answers);
            else if (paper.current) guideToField(paper.current);
          }
        }),
      );
    };
    element?.addEventListener('qs-focus-question', focus);
    return () => element?.removeEventListener('qs-focus-question', focus);
  }, [questions]);
  const select = (question: Question) => {
    setActive(question.id);
    setPalette(false);
  };
  const add = (kind: QuestionKind) => {
    if (questions.length >= 500) return notify('الحد الأقصى للمجموعة ٥٠٠ سؤال');
    const next = createQuestion(kind);
    onChange([...questions, next]);
    select(next);
    requestAnimationFrame(() =>
      paper.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus(),
    );
  };
  const patch = (values: Partial<Question>) =>
    onChange(
      questions.map((item) =>
        item.id === q?.id ? { ...item, ...values, bankId: undefined } : item,
      ),
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
  };
  const closeMenu = () => {
    setPalette(false);
    addButton.current?.focus();
  };
  return (
    <div
      ref={studio}
      data-exam-field="questions"
      className={`question-studio ${preview ? 'is-student-preview' : ''}`}
    >
      <header className="qs-heading">
        <div>
          <span className="eyebrow">{random ? 'مجموعة السحب' : 'ورقة الامتحان'}</span>
          <h2>{preview ? 'كما يراه الطالب' : 'سؤالك، بطريقتك'}</h2>
          <p>
            {preview
              ? 'هذه تجربة؛ إجابات المعلم والتفسير مخفية.'
              : random
                ? 'راجع محتوى المجموعة؛ يتكون نموذج كل طالب عند بدء محاولته.'
                : 'اكتب سؤالًا، وحدد إجابته، ثم انتقل إلى التالي.'}
          </p>
        </div>
        <button
          className="secondary small qs-preview-switch"
          aria-pressed={preview}
          onClick={() => {
            setPreview(!preview);
            setPalette(false);
          }}
        >
          <MorphMark shape={preview ? 'edit' : 'eye'} size={18} />{' '}
          {preview ? 'العودة للتحرير' : 'معاينة الطالب'}
        </button>
      </header>
      {!preview && (
        <div className="qs-toolbar">
          <div className="qs-add-wrap">
            <button
              className="primary small"
              ref={addButton}
              aria-expanded={palette}
              onClick={() => setPalette(!palette)}
            >
              <Plus size={17} />
              أضف سؤالًا
            </button>
            <AnimatePresence>
              {palette && (
                <motion.div
                  ref={menu}
                  className="qs-type-menu"
                  role="dialog"
                  aria-label="اختر نوع السؤال"
                  initial={reduced ? false : { opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') closeMenu();
                  }}
                >
                  <header>
                    <strong>طريقة الإجابة</strong>
                    <button
                      className="text-button"
                      aria-label="إغلاق أنواع الأسئلة"
                      onClick={closeMenu}
                    >
                      <X size={17} />
                    </button>
                  </header>
                  <div>
                    {questionKinds.map(([kind, label]) => {
                      const Icon = icons[kind];
                      return (
                        <motion.button
                          key={kind}
                          drag
                          dragSnapToOrigin
                          dragMomentum={false}
                          style={{ touchAction: 'none', position: 'relative' }}
                          whileDrag={{ zIndex: 30, scale: 1.04 }}
                          onDrag={(_, info) => {
                            const r = paper.current?.getBoundingClientRect(),
                              x = info.point.x - window.scrollX,
                              y = info.point.y - window.scrollY;
                            setDrop(
                              !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
                            );
                          }}
                          onDragEnd={(_, info) => {
                            const r = paper.current?.getBoundingClientRect(),
                              x = info.point.x - window.scrollX,
                              y = info.point.y - window.scrollY;
                            if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
                              add(kind);
                            setDrop(false);
                          }}
                          onClick={() => add(kind)}
                        >
                          <Icon size={21} />
                          <span>{label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                  <small>انقر للإضافة أو اسحب النوع إلى الورقة.</small>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button className="text-button" onClick={onBank}>
            <BookOpen size={16} />
            إضافة من البنك المعتمد
          </button>
          <span className="qs-count" role="status">
            {questions.length} {random ? 'في المجموعة' : 'أسئلة'} · {total} درجة
          </span>
        </div>
      )}
      {deleted && !preview && (
        <div className="qs-undo" role="status">
          حُذف السؤال من المسودة.
          <button
            className="text-button"
            onClick={() => {
              const next = [...questions];
              next.splice(Math.min(deleted.index, next.length), 0, deleted.q);
              onChange(next);
              select(deleted.q);
              setDeleted(undefined);
            }}
          >
            تراجع
          </button>
          <button
            className="text-button"
            aria-label="إخفاء التراجع"
            onClick={() => setDeleted(undefined)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="qs-layout">
        {!preview && (
          <aside className="qs-outline">
            <h3>
              {random ? 'أسئلة المجموعة' : 'أسئلة الامتحان'}
              <span>{questions.length}</span>
            </h3>
            <Reorder.Group
              axis="y"
              values={questions}
              onReorder={onChange}
              as="ol"
              className="qs-question-list"
            >
              {questions.map((item, i) => (
                <OutlineItem
                  key={item.id}
                  item={item}
                  index={i}
                  selected={item.id === q?.id}
                  onSelect={() => select(item)}
                  onMove={(to) => move(i, to)}
                  count={questions.length}
                  reduced={!!reduced}
                />
              ))}
            </Reorder.Group>
            {!questions.length && <p className="muted">ابدأ بسؤال يدوي أو أضف من بنكك.</p>}
          </aside>
        )}
        <div className="qs-paper-column">
          <motion.article
            ref={paper}
            tabIndex={-1}
            className={`qs-paper ${drop ? 'is-drop-target' : ''}`}
            layout={!reduced}
            onDragOver={(e) => {
              if (Array.from(e.dataTransfer.types).includes('application/x-exam-question-kind')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setDrop(true);
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(false);
            }}
            onDrop={(e) => {
              const kind = e.dataTransfer.getData('application/x-exam-question-kind');
              if (questionKinds.some(([k]) => k === kind)) {
                e.preventDefault();
                add(kind as QuestionKind);
              }
              setDrop(false);
            }}
          >
            {drop && (
              <div className="qs-drop-label">
                <Plus size={20} />
                أفلت لإضافة السؤال إلى الامتحان
              </div>
            )}
            {q ? (
              <>
                <div className="qs-question-meta">
                  <span className="qs-question-number">{index + 1}</span>
                  <div>
                    <strong>{kindLabel(q)}</strong>
                    <small>
                      {q.bankId ? 'من البنك المعتمد' : 'سؤال يدوي'} ·{' '}
                      {random
                        ? 'وزن نسبي'
                        : (
                            ((q.points || 1) / questions.reduce((n, x) => n + (x.points || 1), 0)) *
                            total
                          ).toLocaleString('ar', { maximumFractionDigits: 2 }) + ' درجة'}
                    </small>
                  </div>
                  {!preview && (
                    <div className="qs-question-actions">
                      <button
                        className="text-button"
                        aria-label="نسخ السؤال"
                        onClick={() => {
                          if (questions.length >= 500)
                            return notify('الحد الأقصى للمجموعة ٥٠٠ سؤال');
                          const copy = { ...structuredClone(q), id: crypto.randomUUID() };
                          const next = [...questions];
                          next.splice(index + 1, 0, copy);
                          onChange(next);
                          select(copy);
                        }}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        className="text-button"
                        aria-label="حذف السؤال"
                        onClick={() => {
                          setDeleted({ q, index });
                          onChange(questions.filter((item) => item.id !== q.id));
                          setActive(questions[index + 1]?.id || questions[index - 1]?.id || '');
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {preview ? (
                  <>
                    <h2 className="qs-prompt">
                      <MathText text={q.text || 'لم يُكتب نص السؤال بعد'} />
                    </h2>
                    {q.image && <img className="qs-image" src={q.image} alt="رسم السؤال" />}
                    {q.audio && <AudioPlayer audio={q.audio} />}
                    <QuestionResponse
                      key={q.id}
                      question={studentQuestion(q)}
                      value={samples[q.id]}
                      onChange={(a) => setSamples({ ...samples, [q.id]: a })}
                    />
                  </>
                ) : (
                  <>
                    <label className="field qs-prompt-editor">
                      نص السؤال
                      <FormulaEditor value={q.text} onChange={(text) => patch({ text })} />
                    </label>
                    <div data-question-field="options" data-answer-editor="true" tabIndex={-1}>
                      <AnswerKeyEditor q={q} patch={patch} />
                    </div>
                    {q.image && (
                      <figure className="qs-attached">
                        <img src={q.image} alt="مرفق السؤال" />
                        <button
                          className="text-button"
                          onClick={() => patch({ image: undefined, geometryId: undefined })}
                        >
                          <X size={15} />
                          إزالة الصورة
                        </button>
                      </figure>
                    )}
                    <div className="qs-media-tools">
                      <label className="secondary small qs-upload">
                        <ImagePlus size={16} />
                        إرفاق صورة
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            if (file.size > 1500000)
                              return notify('الصورة يجب أن تكون أصغر من 1.5 ميجابايت');
                            try {
                              patch({ image: await fileBase64(file) });
                            } catch {
                              notify('تعذرت قراءة الصورة');
                            }
                          }}
                        />
                      </label>
                      <button className="text-button" onClick={() => setGeometry(true)}>
                        <Shapes size={16} />
                        رسم هندسي
                      </button>
                    </div>
                    <details className="qs-audio-editor">
                      <summary>
                        {q.audio ? 'صوت مرفق · تشغيل أو تعديل' : 'إضافة صوت للسؤال'}
                      </summary>
                      <AudioAttachment
                        value={q.audio}
                        onChange={(audio) => patch({ audio })}
                        label="إرفاق صوت للسؤال"
                      />
                    </details>
                    <details className="qs-explanation">
                      <summary>تفسير الإجابة · للمعلم فقط</summary>
                      <FormulaEditor
                        tools={false}
                        value={q.explanation}
                        onChange={(explanation) => patch({ explanation })}
                      />
                    </details>
                  </>
                )}
              </>
            ) : (
              <div className="qs-blank">
                <PenLine size={34} />
                <h2>هنا يبدأ امتحانك</h2>
                <p>أضف سؤالًا واكتب ما تريد أن يتعلمه طلابك.</p>
                <button className="primary" onClick={() => add('single')}>
                  <Plus size={17} />
                  اكتب السؤال الأول
                </button>
              </div>
            )}
          </motion.article>
          {q && (
            <nav className="qs-paper-nav" aria-label="التنقل بين أسئلة الورقة">
              <button
                className="text-button"
                aria-label="السؤال السابق"
                disabled={index === 0}
                onClick={() => select(questions[index - 1])}
              >
                <ChevronRight size={18} />
              </button>
              <span>
                السؤال {index + 1} من {questions.length}
              </span>
              <button
                className="text-button"
                aria-label="السؤال التالي"
                disabled={index === questions.length - 1}
                onClick={() => select(questions[index + 1])}
              >
                <ChevronLeft size={18} />
              </button>
            </nav>
          )}
        </div>
        {!preview && q && (
          <aside className="qs-inspector">
            <h3>إعداد السؤال</h3>
            <label className="field">
              وزن الدرجة
              <input
                type="number"
                min={0.25}
                max={100}
                step={0.25}
                data-question-field="points"
                value={q.points || 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n > 0 && n <= 100) patch({ points: n });
                }}
              />
              <small>
                تُوزّع الدرجة الكلية حسب أوزان الأسئلة؛ الوزن ١ لكل سؤال يعني درجات متساوية.
              </small>
            </label>
            <p className="qs-grading">
              <CheckCircle2 size={16} />
              {manualQuestion(q) ? 'يصححه المعلم بعد التسليم' : 'تصحيح تلقائي'}
            </p>
            <label className="field">
              الموضوع / الفصل
              <input
                value={q.chapter || ''}
                placeholder="عام"
                onChange={(e) => patch({ chapter: e.target.value })}
              />
            </label>
            <label className="field">
              الصعوبة
              <select
                value={q.difficulty || 'متوسط'}
                onChange={(e) => patch({ difficulty: e.target.value })}
              >
                {['سهل', 'متوسط', 'صعب'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <details>
              <summary>مرجع المصدر</summary>
              <label className="field">
                الصفحة
                <input
                  type="number"
                  min={1}
                  value={q.page}
                  onChange={(e) => patch({ page: Math.max(1, Number(e.target.value)) })}
                />
              </label>
            </details>
            <p className="muted">تُحفظ أسئلة المحاولات كما رآها كل طالب.</p>
          </aside>
        )}
      </div>
      {geometry && q && (
        <GeometryEditor
          notify={notify}
          geometryId={q.geometryId}
          initialPrompt={q.text}
          onClose={() => setGeometry(false)}
          onSave={(image, geometryId) => patch({ image, geometryId })}
        />
      )}
    </div>
  );
}
function OutlineItem({
  item,
  index,
  selected,
  onSelect,
  onMove,
  count,
  reduced,
}: {
  item: Question;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (i: number) => void;
  count: number;
  reduced: boolean;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      layout={reduced ? undefined : 'position'}
      as="li"
      className={`qs-outline-item ${selected ? 'is-current' : ''}`}
    >
      <button
        type="button"
        className="qs-drag-handle"
        aria-label={`اسحب السؤال ${index + 1} لترتيبه`}
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={16} />
      </button>
      <button
        type="button"
        className="qs-select-question"
        aria-current={selected ? 'true' : undefined}
        onClick={onSelect}
      >
        <span>{index + 1}</span>
        <span>
          <strong>{item.text || 'سؤال جديد'}</strong>
          <small>{kindLabel(item)}</small>
        </span>
      </button>
      <div className="qs-move-buttons">
        <button
          type="button"
          aria-label={`رفع السؤال ${index + 1}`}
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp size={12} />
        </button>
        <button
          type="button"
          aria-label={`خفض السؤال ${index + 1}`}
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown size={12} />
        </button>
      </div>
    </Reorder.Item>
  );
}
export function AnswerKeyEditor({
  q,
  patch,
}: {
  q: Question;
  patch: (p: Partial<Question>) => void;
}) {
  return (
    <>
      <div
        data-question-field={
          manualQuestion(q)
            ? 'rubric'
            : {
                single: 'correct',
                boolean: 'correct',
                essay: 'rubric',
                draw: 'rubric',
                short: 'acceptedAnswers',
                blank: 'blankAnswers',
                match: 'pairs',
                order: 'orderCorrect',
                multiple: 'correctChoices',
              }[kindOf(q)]
        }
      >
        <AnswerFields q={q} patch={patch} />
      </div>
      <KeywordGradingEditor q={q} patch={patch} />
    </>
  );
}
function AnswerFields({ q, patch }: { q: Question; patch: (p: Partial<Question>) => void }) {
  const kind = kindOf(q);
  if (manualQuestion(q))
    return (
      <label className="field qs-rubric">
        معيار التصحيح للمعلم
        <textarea
          value={q.rubric || ''}
          maxLength={3000}
          placeholder="النقاط المطلوبة في الإجابة وكيفية توزيع الدرجة"
          onChange={(e) => patch({ rubric: e.target.value })}
        />
        <small>لن تظهر درجة نهائية حتى تراجع الإجابات الكتابية والرسم.</small>
      </label>
    );
  if (kind === 'short' || kind === 'blank') {
    const values = kind === 'short' ? q.acceptedAnswers : q.blankAnswers;
    return (
      <label className="field">
        {kind === 'short'
          ? 'الإجابات المقبولة · كل إجابة في سطر'
          : 'إجابات الفراغات بالترتيب · كل فراغ في سطر'}
        <textarea
          value={(values || ['']).join('\n')}
          maxLength={10000}
          onChange={(e) =>
            patch({
              [kind === 'short' ? 'acceptedAnswers' : 'blankAnswers']: e.target.value
                .split('\n')
                .slice(0, kind === 'short' ? 30 : 10),
            })
          }
        />
        <small>
          {kind === 'short'
            ? 'تُتجاهل الحركات والمسافات الزائدة؛ أضف المرادفات المقبولة.'
            : 'رقّم الفراغات في نص السؤال بنفس ترتيب الإجابات هنا.'}
        </small>
      </label>
    );
  }
  if (kind === 'match')
    return (
      <div className="qs-key-fields">
        <p>اكتب كل عنصر مع نظيره الصحيح؛ تُخلط قائمة الإجابات للطالب.</p>
        {(q.pairs || []).map((pair, i) => (
          <div className="qs-pair" key={i}>
            <label className="field">
              العنصر {i + 1}
              <input
                value={pair.left}
                maxLength={500}
                onChange={(e) =>
                  patch({
                    pairs: q.pairs!.map((p, j) => (i === j ? { ...p, left: e.target.value } : p)),
                  })
                }
              />
            </label>
            <Link2 size={15} />
            <label className="field">
              نظيره الصحيح
              <input
                value={pair.right}
                maxLength={500}
                onChange={(e) =>
                  patch({
                    pairs: q.pairs!.map((p, j) => (i === j ? { ...p, right: e.target.value } : p)),
                  })
                }
              />
            </label>
            <button
              className="text-button"
              disabled={q.pairs!.length <= 2}
              aria-label={`حذف الزوج ${i + 1}`}
              onClick={() => patch({ pairs: q.pairs!.filter((_, j) => j !== i) })}
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <button
          className="secondary small"
          disabled={(q.pairs?.length || 0) >= 10}
          onClick={() => patch({ pairs: [...q.pairs!, { left: '', right: '' }] })}
        >
          <Plus size={15} />
          زوج جديد
        </button>
      </div>
    );
  return (
    <div className="qs-key-fields">
      <p>
        {kind === 'order'
          ? 'اكتب العناصر بالترتيب الصحيح من الأعلى إلى الأسفل.'
          : kind === 'multiple'
            ? 'حدد جميع الإجابات الصحيحة.'
            : 'حدد الإجابة الصحيحة؛ تظهر العلامة للمعلم فقط.'}
      </p>
      {q.options.map((text, i) => {
        const correct =
          kind === 'multiple' ? q.correctChoices?.includes(i) : kind !== 'order' && q.correct === i;
        return (
          <div className={`qs-option-editor ${correct ? 'is-correct' : ''}`} key={i}>
            {kind === 'order' ? (
              <span className="qs-order-number">{i + 1}</span>
            ) : (
              <input
                type={kind === 'multiple' ? 'checkbox' : 'radio'}
                name={`correct-${q.id}`}
                aria-label={`اعتماد الخيار ${i + 1}`}
                checked={!!correct}
                onChange={() =>
                  patch(
                    kind === 'multiple'
                      ? {
                          correctChoices: correct
                            ? q.correctChoices!.filter((n) => n !== i)
                            : [...(q.correctChoices || []), i],
                        }
                      : { correct: i },
                  )
                }
              />
            )}
            <FormulaEditor
              tools={false}
              showPreview={false}
              ariaLabel={`الخيار ${i + 1}`}
              value={text}
              onChange={(value) =>
                patch({
                  options: q.options.map((v, j) => (j === i ? value : v)),
                  ...(kind === 'order' ? { orderCorrect: q.options.map((_, j) => j) } : {}),
                })
              }
            />
            {correct && <Check size={16} />}
          </div>
        );
      })}
      {['multiple', 'order'].includes(kind) && (
        <div className="button-row">
          <button
            className="secondary small"
            disabled={q.options.length >= 10}
            onClick={() =>
              patch({
                options: [...q.options, ''],
                ...(kind === 'order'
                  ? { orderCorrect: Array.from({ length: q.options.length + 1 }, (_, i) => i) }
                  : {}),
              })
            }
          >
            <Plus size={14} />
            عنصر
          </button>
          <button
            className="text-button"
            disabled={q.options.length <= 2}
            onClick={() =>
              patch({
                options: q.options.slice(0, -1),
                correctChoices: q.correctChoices?.filter((i) => i < q.options.length - 1),
                ...(kind === 'order'
                  ? { orderCorrect: q.options.slice(0, -1).map((_, i) => i) }
                  : {}),
              })
            }
          >
            حذف آخر عنصر
          </button>
        </div>
      )}
    </div>
  );
}
