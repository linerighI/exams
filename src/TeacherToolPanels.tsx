import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, ImagePlus, Plus, Trash2 } from 'lucide-react';
import MathText, { FormulaEditor } from './MathText';
import { api } from './api';
import type { Exam, Question } from './types';
import {
  allocateQuestions,
  convertUnit,
  describeNumbers,
  unitGroups,
  type UnitGroup,
} from './teacherUtilities';
const ScientificCalculator = lazy(() => import('./ScientificCalculator'));
type Context = {
  grade: string;
  subject: string;
  term: 'الأول' | 'الثاني';
  teacherId: string;
  notify: (message: string) => void;
  openExam: (exam: Exam) => void;
};
const fmt = (value: number) =>
  Number(value.toPrecision(10)).toLocaleString('en-US', {
    maximumSignificantDigits: 10,
    useGrouping: false,
  });
async function copy(text: string, notify: Context['notify']) {
  try {
    await navigator.clipboard.writeText(text);
    notify('تم النسخ؛ يمكنك لصقه في محرر السؤال');
  } catch {
    notify('تعذر النسخ. حدد النص وانسخه يدويًا.');
  }
}
export function TeacherCalculator() {
  return (
    <div className="teacher-calculator-wrap">
      <Suspense fallback={<p>جارٍ تجهيز الآلة العلمية…</p>}>
        <ScientificCalculator />
      </Suspense>
      <details className="tool-explainer">
        <summary>استخدام الآلة الحاسبة</summary>
        <p>
          جذور وقوى وكسور ونسب مئوية ودوال مثلثية. اختر وحدة الزاوية الصحيحة، ثم أدخل العدد واضغط
          الدالة.
        </p>
        <ul>
          <li>DEG للدرجات، وRAD للراديان، وGRAD للغراد.</li>
          <li>زر S ⇄ D للتبديل بين الكسر والقيمة العشرية.</li>
          <li>راجع التقريب ووحدة القياس قبل اعتماد الإجابة.</li>
        </ul>
        <small>آلة مفتوحة المصدر مستوحاة من Casio؛ ليست منتجًا رسميًا من CASIO.</small>
      </details>
    </div>
  );
}
export function TeacherDrawing({
  insert,
  notify,
}: {
  insert: (image: string) => void;
  notify: Context['notify'];
}) {
  const frame = useRef<HTMLIFrameElement>(null),
    [mode, setMode] = useState('graph'),
    [ready, setReady] = useState(false),
    [image, setImage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'geometry-ready') setReady(true);
      if (e.data?.type === 'geometry-error') {
        setBusy(false);
        notify('تعذر تجهيز الرسم');
      }
      if (e.data?.type === 'geometry-exported') {
        setBusy(false);
        if (
          typeof e.data.image === 'string' &&
          e.data.image.length <= 3000000 &&
          /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(e.data.image)
        )
          setImage(e.data.image);
        else notify('الرسم كبير جدًا. بسّطه ثم حاول مرة أخرى.');
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    if (!busy) return;
    const timeout = setTimeout(() => {
      setBusy(false);
      notify('لم يكتمل تصدير الرسم. حاول مرة أخرى.');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [busy]);
  return (
    <>
      <div className="tool-inline-toolbar">
        <div className="tools-segmented">
          {[
            ['graph', 'الرسم البياني'],
            ['geometry', 'الهندسة'],
          ].map(([id, label]) => (
            <button
              key={id}
              className={mode === id ? 'active' : ''}
              aria-pressed={mode === id}
              onClick={() => {
                setReady(false);
                setImage('');
                setMode(id);
              }}
              disabled={mode === id}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="primary small"
          disabled={!ready || busy}
          onClick={() => {
            setBusy(true);
            frame.current?.contentWindow?.postMessage({ type: 'geometry-export' }, location.origin);
          }}
        >
          <ImagePlus size={16} />
          {busy ? 'جارٍ التصدير…' : 'التقاط الرسم للسؤال'}
        </button>
      </div>
      <iframe
        ref={frame}
        className="teacher-geometry-frame"
        key={mode}
        title="GeoGebra للمعلم"
        src={`geometry.html${mode === 'graph' ? '?student=1' : ''}`}
        sandbox="allow-scripts allow-same-origin"
      />
      {!ready && (
        <p className="tools-hint" role="status">
          جارٍ تحميل مساحة الرسم المحلية…
        </p>
      )}
      <p className="tools-hint">
        ارسم الشكل أو أدخل الدالة ثم التقطه. راجع العناصر والتسميات قبل إضافته للسؤال. GeoGebra
        للاستخدام التعليمي.
      </p>
      {image && (
        <div className="teacher-graph-preview">
          <img src={image} alt="معاينة الرسم الملتقط" />
          <button className="primary" onClick={() => insert(image)}>
            نقل الرسم إلى مسودة السؤال
            <ArrowLeft size={16} />
          </button>
        </div>
      )}
    </>
  );
}
type WritingDraft = {
  text: string;
  options: string[];
  correct: number;
  explanation: string;
  chapter: string;
  difficulty: string;
  title: string;
  questions: Question[];
};
const blankQuestion = () => ({
  text: '',
  options: ['', '', '', ''],
  correct: 0,
  explanation: '',
  chapter: '',
  difficulty: 'متوسط',
});
const initialDraft = (): WritingDraft => ({ ...blankQuestion(), title: '', questions: [] });
export function QuestionWorkshop({
  context,
  image,
  clearImage,
  transfer,
  consumeTransfer,
}: {
  context: Context;
  image: string;
  clearImage: () => void;
  transfer?: { id: string; text: string };
  consumeTransfer?: () => void;
}) {
  const key = `teacher-tools-writing:${context.teacherId}`;
  const appliedTransfer = useRef('');
  const [draft, setDraft] = useState<WritingDraft>(() => {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (
          value &&
          typeof value.text === 'string' &&
          Array.isArray(value.options) &&
          value.options.length === 4 &&
          value.options.every((o: unknown) => typeof o === 'string') &&
          Array.isArray(value.questions)
        )
          return { ...initialDraft(), ...value };
      } catch {}
      return initialDraft();
    }),
    [busy, setBusy] = useState(false),
    [locallySaved, setLocallySaved] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    if (!transfer || appliedTransfer.current === transfer.id) return;
    appliedTransfer.current = transfer.id;
    const joined = `${draft.text}${draft.text ? '\n' : ''}${transfer.text}`;
    if (joined.length > 2000)
      setError('لم يُضف النص لأنه يتجاوز حد السؤال (2000 حرف). مسودتك الأصلية محفوظة.');
    else setDraft((p) => ({ ...p, text: joined }));
    consumeTransfer?.();
  }, [transfer?.id]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setLocallySaved(true);
    } catch {
      setLocallySaved(false);
    }
  }, [draft, key]);
  const patch = (change: Partial<WritingDraft>) => {
    setDraft((p) => ({ ...p, ...change }));
    setError('');
  };
  const question = (): Question => {
    if (draft.text.trim().length < 3 || draft.text.length > 2000)
      throw Error('اكتب نصًا للسؤال من ٣ إلى ٢٠٠٠ حرف');
    if (
      draft.options.some((o) => !o.trim() || o.length > 800) ||
      new Set(draft.options.map((o) => o.trim())).size !== 4
    )
      throw Error('أدخل أربعة بدائل مختلفة وغير فارغة');
    return {
      id: crypto.randomUUID(),
      text: draft.text.trim(),
      options: draft.options.map((o) => o.trim()),
      correct: draft.correct,
      explanation: draft.explanation,
      chapter: draft.chapter,
      difficulty: draft.difficulty,
      page: 1,
      ...(image ? { image } : {}),
    };
  };
  const add = () => {
    try {
      const q = question();
      if (draft.questions.length >= 100) throw Error('تسع هذه المسودة ١٠٠ سؤال كحد أقصى');
      patch({ ...blankQuestion(), questions: [...draft.questions, q] });
      clearImage();
      context.notify('أضيف السؤال إلى قائمة المسودة');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const stems = context.subject.includes('لغة')
    ? [
        'اقرأ النص الآتي، ثم اختر الإجابة الصحيحة:',
        'ما المعنى الأنسب للكلمة في سياقها؟',
        'أي الجمل الآتية تعبّر عن الفكرة الرئيسة؟',
      ]
    : [
        'أي العبارات الآتية صحيحة؟',
        'استنتج من المعطيات الآتية:',
        'ما التفسير الأنسب للظاهرة الآتية؟',
      ];
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (!context.grade || !context.subject) throw Error('حدد الصف والمبحث أعلى الصفحة أولًا');
      if (!draft.title.trim()) throw Error('أدخل عنوان مسودة الامتحان');
      const qs = [...draft.questions];
      if (draft.text.trim() || draft.options.some((o) => o.trim()) || image) qs.push(question());
      if (!qs.length) throw Error('أضف سؤالًا واحدًا على الأقل');
      if (qs.length > 100) throw Error('الحد الأقصى ١٠٠ سؤال');
      const exam = await api('/api/exams', 'POST', {
        title: draft.title.trim(),
        subject: context.subject,
        grade: context.grade,
        section: '',
        term: context.term,
        kind: 'نصفي',
        duration: 45,
        total: 20,
        difficulty: 'مختلط',
        cameraRequired: false,
        calculatorAllowed: false,
        geogebraAllowed: false,
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 86400000).toISOString(),
        questions: qs,
      });
      localStorage.removeItem(key);
      setDraft(initialDraft());
      clearImage();
      context.notify('حُفظت مسودة غير منشورة. راجع الإعدادات والأسئلة قبل الاعتماد.');
      context.openExam(exam);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="question-workshop">
      <div className="tools-hint">
        <ShieldNote />
        مساحة تحرير يدوية لجميع المباحث. حدّد ناتج التعلم، واكتب بدائل عادلة، ثم راجع المصدر
        والإجابة.
      </div>
      <div className="tool-writing-grid">
        <section>
          <label className="field">
            الوحدة / الدرس
            <input
              maxLength={300}
              value={draft.chapter}
              onChange={(e) => patch({ chapter: e.target.value })}
            />
          </label>
          <span className="tool-field-label">بداية مقترحة</span>
          <div className="tool-stems">
            {stems.map((stem) => (
              <button
                key={stem}
                onClick={() => patch({ text: draft.text ? `${draft.text}\n${stem}` : stem })}
              >
                {stem}
              </button>
            ))}
          </div>
          <label className="tool-field-label" htmlFor="question-workshop-text">
            نص السؤال ومعادلاته
          </label>
          <FormulaEditor
            ariaLabel="نص مسودة السؤال"
            value={draft.text}
            onChange={(text) => patch({ text: text.slice(0, 2000) })}
          />
          <div className="tool-option-inputs">
            {draft.options.map((option, i) => (
              <div className="tool-option-field" key={i}>
                <input
                  type="radio"
                  name="workshop-correct"
                  aria-label={`اعتماد البديل ${i + 1} إجابة صحيحة`}
                  checked={draft.correct === i}
                  onChange={() => patch({ correct: i })}
                />
                <span>{['أ', 'ب', 'ج', 'د'][i]}</span>
                <FormulaEditor
                  ariaLabel={`البديل ${i + 1}`}
                  tools={false}
                  showPreview={false}
                  value={option}
                  onChange={(value) =>
                    patch({
                      options: draft.options.map((o, j) => (i === j ? value.slice(0, 800) : o)),
                    })
                  }
                />
              </div>
            ))}
          </div>
          <div className="tool-form-grid">
            <label className="field">
              مستوى الصعوبة
              <select
                value={draft.difficulty}
                onChange={(e) => patch({ difficulty: e.target.value })}
              >
                {['سهل', 'متوسط', 'صعب'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
            <div className="field">
              تفسير الإجابة / مرجعها
              <FormulaEditor
                tools={false}
                showPreview={false}
                value={draft.explanation}
                onChange={(explanation) => patch({ explanation: explanation.slice(0, 3000) })}
              />
            </div>
          </div>
          {image && (
            <div className="tool-question-image">
              <img src={image} alt="رسم السؤال" />
              <button className="text-button" onClick={clearImage}>
                إزالة الرسم
              </button>
            </div>
          )}
          <div className="tool-actions">
            <button
              className="secondary"
              onClick={() =>
                void copy(
                  `${draft.text}\n${draft.options.map((o, i) => `${['أ', 'ب', 'ج', 'د'][i]}. ${o}`).join('\n')}\nالإجابة: ${['أ', 'ب', 'ج', 'د'][draft.correct]}\n${draft.explanation}`,
                  context.notify,
                )
              }
            >
              <Copy size={16} />
              نسخ السؤال
            </button>
            <button className="primary" onClick={add}>
              <Plus size={17} />
              إضافة إلى القائمة
            </button>
          </div>
        </section>
        <aside className="tool-question-preview">
          <span className="tools-kicker">معاينة السؤال · الإجابة للمعلم فقط</span>
          <h3>
            <MathText text={draft.text || 'اكتب سؤالك لتظهر المعاينة هنا'} />
          </h3>
          {draft.options.map((o, i) => (
            <div key={i} className={draft.correct === i ? 'is-correct' : ''}>
              <span>{['أ', 'ب', 'ج', 'د'][i]}</span>
              <MathText text={o || 'نص البديل'} />
              {draft.correct === i && <CheckCircle2 size={16} />}
            </div>
          ))}
          <p>راجع صحة الصياغة والمعلومات، وتأكد أن هناك إجابة واحدة صحيحة وأربعة بدائل مميزة.</p>
        </aside>
      </div>
      <div className="tool-draft-list">
        {!locallySaved && (
          <p className="tool-error" role="alert">
            تعذّر الحفظ المحلي؛ احفظ القائمة كمسودة امتحان قبل مغادرة الصفحة.
          </p>
        )}
        <h3>
          قائمة المسودة <span>{draft.questions.length} أسئلة</span>
        </h3>
        {draft.questions.map((q, i) => (
          <div key={q.id}>
            <span>{i + 1}</span>
            <p>{q.text}</p>
            <button
              aria-label={`حذف السؤال ${i + 1} من المسودة`}
              onClick={() => patch({ questions: draft.questions.filter((x) => x.id !== q.id) })}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <label className="field">
          عنوان مسودة الامتحان
          <input
            maxLength={300}
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="مثال: مراجعة الوحدة الأولى"
          />
        </label>
        <p className="tools-hint">
          تُحفظ القائمة على هذا الجهاز لهذا الحساب. اختر الصف والمبحث أعلى الصفحة؛ حفظها كمسودة لا
          ينشرها للطلاب.
        </p>
        <button className="primary" disabled={busy} onClick={() => void save()}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ مسودة وفتحها للمراجعة'}
          <ArrowLeft size={16} />
        </button>
      </div>
      {error && (
        <p className="tool-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function ShieldNote() {
  return <CheckCircle2 size={16} />;
}
export function EquationWorkshop({
  notify,
  insert,
}: {
  notify: Context['notify'];
  insert?: (value: string) => void;
}) {
  const [value, setValue] = useState('احسب \\( \\frac{3}{4} + \\frac{1}{2} \\).');
  const snippets = [
    '\\frac{a}{b}',
    '\\sqrt{x}',
    'x^{n}',
    '\\sum_{i=1}^{n} x_i',
    '\\int_a^b f(x)\\,dx',
    '\\vec{F}=m\\vec{a}',
    '\\mathrm{H_2O}',
    '\\mathrm{CO_2}',
    '\\Delta T',
    '\\angle ABC=60^\\circ',
  ];
  return (
    <>
      <p className="tools-hint">
        اكتب النص بالعربية وأحط الصيغة بـ \( و \). تُنسخ بنفس التنسيق الذي يستخدمه محرر الأسئلة.
      </p>
      <div className="tool-equation-snippets">
        {snippets.map((s) => (
          <button key={s} onClick={() => setValue((v) => `${v} \\( ${s} \\) `)}>
            <MathText text={`\\(${s}\\)`} />
          </button>
        ))}
      </div>
      <FormulaEditor
        ariaLabel="محرر الصيغ العلمية"
        value={value}
        onChange={(v) => setValue(v.slice(0, 5000))}
      />
      <button className="primary" onClick={() => void copy(value, notify)}>
        <Copy size={16} />
        نسخ النص والصيغ
      </button>
      {insert && (
        <button
          className="secondary"
          disabled={!value.trim() || value.length > 2000}
          onClick={() => insert(value)}
        >
          أضف إلى مسودة السؤال <ArrowLeft size={16} />
        </button>
      )}
    </>
  );
}
export function UnitConverter() {
  const [group, setGroup] = useState<UnitGroup>('length'),
    [value, setValue] = useState('100'),
    [from, setFrom] = useState('cm'),
    [to, setTo] = useState('m');
  let result = '',
    error = '';
  try {
    result = fmt(convertUnit(group, value, from, to));
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <>
      <div className="tool-form-grid">
        <label className="field">
          نوع القياس
          <select
            value={group}
            onChange={(e) => {
              const g = e.target.value as UnitGroup;
              setGroup(g);
              setFrom(unitGroups[g].units[0][0]);
              setTo(unitGroups[g].units[1][0]);
            }}
          >
            {Object.entries(unitGroups).map(([key, g]) => (
              <option key={key} value={key}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          القيمة
          <input
            dir="ltr"
            aria-label="قيمة التحويل"
            maxLength={50}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <label className="field">
          من
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {unitGroups[group].units.map((u) => (
              <option key={u[0]} value={u[0]}>
                {u[1]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          إلى
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            {unitGroups[group].units.map((u) => (
              <option key={u[0]} value={u[0]}>
                {u[1]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="tool-error">
          {error}
        </p>
      ) : (
        <div className="tool-result">
          <span>نتيجة التحويل</span>
          <output aria-label="ناتج التحويل" dir="ltr">
            {result}
          </output>
          <small>{unitGroups[group].units.find((u) => u[0] === to)?.[1]}</small>
        </div>
      )}
      <p className="tools-hint">
        وحدات مترية ثابتة؛ دون تحويل عملات أو أسعار. الدونم المستخدم هنا يساوي ١٠٠٠ متر مربع.
      </p>
    </>
  );
}
export function StatisticsTool({ notify }: { notify: Context['notify'] }) {
  const [text, setText] = useState('12, 16, 14, 18, 20');
  let result: ReturnType<typeof describeNumbers> | undefined,
    error = '';
  try {
    result = describeNumbers(text);
  } catch (e) {
    error = (e as Error).message;
  }
  const labels = {
    count: 'عدد القيم',
    sum: 'المجموع',
    mean: 'المتوسط الحسابي',
    median: 'الوسيط',
    min: 'أصغر قيمة',
    max: 'أكبر قيمة',
    range: 'المدى',
    populationSD: 'الانحراف المعياري للمجتمع',
  };
  return (
    <>
      <label className="field">
        الأعداد / الدرجات
        <textarea
          aria-label="بيانات الإحصاء"
          dir="ltr"
          maxLength={15000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <p className="tools-hint">
        افصل الأعداد بمسافة أو فاصلة، واستخدم النقطة العشرية. تُقبل الأرقام العربية والإنجليزية؛
        الحد ١٠٠٠ قيمة.
      </p>
      {error ? (
        <p role="alert" className="tool-error">
          {error}
        </p>
      ) : (
        result && (
          <>
            <div className="tool-statistics-grid">
              {Object.entries(labels).map(([key, label]) => (
                <div key={key}>
                  <span>{label}</span>
                  <output>{fmt(result![key as keyof typeof result])}</output>
                </div>
              ))}
            </div>
            <button
              className="secondary"
              onClick={() =>
                void copy(
                  Object.entries(labels)
                    .map(([k, label]) => `${label}: ${fmt(result![k as keyof typeof result])}`)
                    .join('\n'),
                  notify,
                )
              }
            >
              <Copy size={16} />
              نسخ الملخص
            </button>
          </>
        )
      )}
    </>
  );
}
export function BlueprintTool({ context }: { context: Context }) {
  const [count, setCount] = useState(20),
    [rows, setRows] = useState([
      { title: 'الوحدة الأولى', weight: 4 },
      { title: 'الوحدة الثانية', weight: 3 },
      { title: 'الوحدة الثالثة', weight: 3 },
    ]);
  let counts: number[] = [],
    error = '';
  try {
    counts = allocateQuestions(
      count,
      rows.map((r) => r.weight),
    );
  } catch (e) {
    error = (e as Error).message;
  }
  const total = rows.reduce((a, b) => a + b.weight, 0);
  return (
    <>
      <div className="blueprint-summary">
        <div>
          <h3>وزّع أسئلتك على الوحدات</h3>
          <span>حدد الأولوية، وسنحسب نصيب كل وحدة.</span>
        </div>
        <label className="field tool-narrow">
          إجمالي عدد الأسئلة
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="tool-blueprint-table">
        <div className="tool-blueprint-row heading">
          <span>الوحدة / الناتج</span>
          <span>الوزن</span>
          <span>النسبة</span>
          <span>الأسئلة</span>
          <span />
        </div>
        {rows.map((row, i) => (
          <div className="tool-blueprint-row" key={i}>
            <input
              aria-label={`اسم الوحدة ${i + 1}`}
              maxLength={150}
              value={row.title}
              onChange={(e) =>
                setRows(rows.map((r, j) => (i === j ? { ...r, title: e.target.value } : r)))
              }
            />
            <input
              aria-label={`وزن الوحدة ${i + 1}`}
              type="number"
              min={0}
              max={1000}
              value={row.weight}
              onChange={(e) =>
                setRows(
                  rows.map((r, j) => (i === j ? { ...r, weight: Number(e.target.value) } : r)),
                )
              }
            />
            <span>{total ? Math.round((row.weight / total) * 100) : 0}%</span>
            <strong data-testid="allocated-count">{counts[i] ?? '—'}</strong>
            <button
              aria-label={`حذف الوحدة ${i + 1}`}
              disabled={rows.length <= 1}
              onClick={() => setRows(rows.filter((_, j) => i !== j))}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <details className="blueprint-help">
        <summary>كيف تُحسب الحصص؟</summary>
        <p>
          الوزن هو أولوية الوحدة بحسب زمن تدريسها وأهمية نواتج التعلم. يُوزّع العدد تناسبيًا مع
          الحفاظ على المجموع. هذا جدول تخطيط؛ لا يغيّر الامتحانات المنشورة.
        </p>
      </details>
      <div className="tool-actions">
        <button
          className="secondary"
          disabled={rows.length >= 20}
          onClick={() => setRows([...rows, { title: 'وحدة جديدة', weight: 1 }])}
        >
          <Plus size={16} />
          إضافة وحدة
        </button>
        <button
          className="primary"
          disabled={!!error}
          onClick={() =>
            void copy(
              `${context.subject || 'المبحث'} · الصف ${context.grade || '—'} · الفصل ${context.term}\n${rows.map((r, i) => `${r.title}: ${counts[i]} أسئلة`).join('\n')}\nالمجموع: ${count}`,
              context.notify,
            )
          }
        >
          <Copy size={16} />
          نسخ جدول المواصفات
        </button>
      </div>
      {error && (
        <p className="tool-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
export function RubricTool({ notify }: { notify: Context['notify'] }) {
  const [objective, setObjective] = useState('تفسير الفكرة وتطبيقها مع تبرير الإجابة'),
    [rows, setRows] = useState([
      { title: 'دقة المعلومات', marks: 4 },
      { title: 'خطوات الحل / الأدلة', marks: 4 },
      { title: 'وضوح العرض', marks: 2 },
    ]);
  const total = rows.reduce((a, b) => a + b.marks, 0),
    valid =
      rows.every(
        (r) => r.title.trim() && Number.isFinite(r.marks) && r.marks >= 1 && r.marks <= 100,
      ) && total <= 1000;
  return (
    <>
      <label className="field">
        ناتج التعلم / المهمة
        <textarea
          maxLength={1000}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
      </label>
      <p className="tools-hint">
        خطط لتقييم المقال والمشروع والأداء العملي. هذه أداة إعداد؛ لا تضيف أنواع إجابة أو تصحيحًا
        آليًا إلى امتحان الاختيار من متعدد.
      </p>
      {rows.map((r, i) => (
        <div className="tool-rubric-row" key={i}>
          <label className="field">
            المعيار {i + 1}
            <input
              maxLength={150}
              value={r.title}
              onChange={(e) =>
                setRows(rows.map((r, j) => (i === j ? { ...r, title: e.target.value } : r)))
              }
            />
          </label>
          <label className="field">
            الدرجة القصوى
            <input
              type="number"
              min={1}
              max={100}
              value={r.marks}
              onChange={(e) =>
                setRows(rows.map((r, j) => (i === j ? { ...r, marks: Number(e.target.value) } : r)))
              }
            />
          </label>
          <button
            aria-label={`حذف المعيار ${i + 1}`}
            disabled={rows.length <= 1}
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="tool-actions">
        <button
          className="secondary"
          disabled={rows.length >= 12}
          onClick={() => setRows([...rows, { title: '', marks: 1 }])}
        >
          <Plus size={16} />
          معيار آخر
        </button>
        <span>المجموع: {fmt(total)} درجات</span>
        <button
          className="primary"
          disabled={!valid || !objective.trim()}
          onClick={() =>
            void copy(
              `المهمة / ناتج التعلم: ${objective}\n${rows.map((r) => `${r.title}: ${r.marks} درجات\n  متقن: يحقق المعيار كاملًا.\n  جزئي: يحقق بعض المتطلبات؛ حدد الأدلة والنواقص.\n  لم يتحقق: لا يقدم دليلًا كافيًا على المعيار.`).join('\n')}\nالمجموع: ${total}\nحدد وصف الأداء والدرجات الجزئية لكل معيار قبل استخدام السلم.`,
              notify,
            )
          }
        >
          <Copy size={16} />
          نسخ سلم التقدير
        </button>
      </div>
      <p className="tools-hint">
        عدّل أوصاف الأداء والدرجات الجزئية قبل الاستخدام لتناسب المهمة والصف.
      </p>
    </>
  );
}
