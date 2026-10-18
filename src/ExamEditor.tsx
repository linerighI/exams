import { useState, useEffect } from 'react';
import {
  FileText,
  BookOpen,
  Plus,
  Trash2,
  ImagePlus,
  CheckCircle2,
  ArrowRight,
  Pencil,
  Eye,
  X,
} from 'lucide-react';
import { api, fileBase64 } from './api';
import MathText, { FormulaEditor } from './MathText';
import GeometryEditor from './GeometryEditor';
import ExamBankPicker from './ExamBankPicker';
import type { Exam, Question } from './types';
import AudioAttachment from './AudioAttachment';
import AudioPlayer from './AudioPlayer';
import ExamAppearanceEditor from './ExamAppearanceEditor';
import ExamDeliverySettings from './ExamDeliverySettings';
import { defaultDelivery, groupKey, poolGroups } from './examDelivery';
const uid = () => crypto.randomUUID();
const localDate = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export default function ExamEditor({
  initial,
  onSave,
  onCancel,
  notify,
}: {
  initial?: Exam;
  onSave: (exam: Exam) => void;
  onCancel: () => void;
  notify: (message: string) => void;
}) {
  const [form, setForm] = useState(
    () =>
      initial || {
        delivery: undefined as Exam['delivery'],
        calculatorAllowed: false,
        geogebraAllowed: false,
        appearance: undefined as Exam['appearance'],
        audio: undefined as Exam['audio'],
        title: '',
        subject: '',
        grade: '',
        section: '',
        term: 'الأول',
        kind: 'نصفي',
        duration: 45,
        total: 20,
        difficulty: 'متوسط',
        cameraRequired: false,
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 86400000).toISOString(),
        questions: [] as Question[],
      },
  );
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [editIndex, setEditIndex] = useState(0);
  const [geometry, setGeometry] = useState(false);
  const [editorStep, setEditorStep] = useState(initial?.questions.length ? 2 : 0);
  const [editQuestion, setEditQuestion] = useState(false);
  const [reviewPool, setReviewPool] = useState(false);
  const randomDelivery = form.delivery;
  const reviewTitle = randomDelivery ? 'مراجعة التوزيع والمجموعة' : 'مراجعة الأسئلة';
  useEffect(() => {
    document.querySelector('.editor-surface')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [editorStep]);
  const update = (key: string, value: any) => {
    setApproved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const patchQuestion = (patch: Partial<Question>) =>
    update(
      'questions',
      form.questions.map((q, i) => (i === editIndex ? { ...q, ...patch } : q)),
    );
  const save = async (publish = false) => {
    setBusy(true);
    try {
      if (!form.title.trim() || !form.subject.trim() || !form.grade.trim())
        throw Error('أدخل اسم الامتحان والمادة والصف');
      if (publish && !approved) throw Error('أكد مراجعة الأسئلة قبل النشر');
      const exam = await api(
        initial ? `/api/exams/${initial.id}` : '/api/exams',
        initial ? 'PUT' : 'POST',
        form,
      );
      if (publish) {
        await api(`/api/exams/${exam.id}/publish`, 'POST');
        exam.status = 'published';
      }
      onSave(exam);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const q = form.questions[editIndex];
  return (
    <>
      <div className="page-title">
        <div>
          <button className="back-link" onClick={onCancel}>
            <ArrowRight size={17} /> العودة للامتحانات
          </button>
          <h1>
            {initial ? 'تعديل الامتحان' : 'لنصنع امتحانًا رائعًا'} <span className="subtle">✦</span>
          </h1>
          <p>من بنكك المعتمد إلى امتحان مدروس، وكل شيء تحت إشرافك.</p>
        </div>
        <span className="pill blue">{initial ? `النسخة ${initial.version}` : 'امتحان جديد'}</span>
      </div>
      <div className="exam-stages" role="tablist" aria-label="خطوات إعداد الامتحان">
        {['اختيار من البنك', 'إعدادات الامتحان', reviewTitle].map((title, i) => (
          <button
            role="tab"
            aria-selected={editorStep === i}
            key={title}
            onClick={() => setEditorStep(i)}
            className={editorStep === i ? 'active' : ''}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            <strong>{title}</strong>
            <small>
              {['بنوك وأسئلة معتمدة', 'الصف والوقت والدرجات', randomDelivery ? 'مجموعة الأسئلة ونصيب كل طالب' : 'معاينة كما يراها الطالب'][i]}
            </small>
          </button>
        ))}
      </div>
      {geometry && q && (
        <GeometryEditor
          notify={notify}
          geometryId={q.geometryId}
          initialPrompt={q.text}
          onClose={() => setGeometry(false)}
          onSave={(image, geometryId) => patchQuestion({ image, geometryId, bankId: undefined })}
        />
      )}
      <div className="editor-layout">
        <div className="editor-main">
          <section className="card editor-section" hidden={editorStep !== 0}>
            <div className="manual-start"><h3>ابدأ بطريقتك</h3><p>اكتب أسئلتك بنفسك أو اختر أسئلة معتمدة من البنك.</p><button className="secondary" onClick={() => { update('delivery', undefined); setEditorStep(1); }}>إنشاء امتحان فارغ يدويًا — دون ذكاء اصطناعي</button></div>
            <ExamBankPicker
              existing={form.questions}
              notify={notify}
              onAdd={(questions, book) => {
                setApproved(false);
                setForm((prev) => ({
                  ...prev,
                  title: prev.title || `امتحان ${book.subject}`,
                  subject: prev.subject || book.subject,
                  grade: prev.grade || book.grade,
                  term: prev.term || book.term,
                  questions: [...prev.questions, ...questions],
                  delivery:
                    prev.delivery ||
                    (!initial ? defaultDelivery([...prev.questions, ...questions]) : undefined),
                }));
                setEditIndex(form.questions.length);
                setEditorStep(2);
                notify(`أضيف ${questions.length} سؤالًا إلى الامتحان`);
              }}
            />
          </section>
          <section className="card editor-section" hidden={editorStep !== 1}>
            <div className="section-heading">
              <span className="step">٢</span>
              <div>
                <h2>إعدادات الامتحان</h2>
                <p>اضبط التفاصيل بما يناسب طلابك.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field span2">
                اسم الامتحان
                <input
                  placeholder="مثلًا: امتحان العلوم النصفي"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                />
              </label>
              <label className="field">
                المادة
                <input
                  placeholder="العلوم"
                  value={form.subject}
                  onChange={(e) => update('subject', e.target.value)}
                />
              </label>
              <label className="field">
                الصف
                <input
                  placeholder="السابع"
                  value={form.grade}
                  onChange={(e) => update('grade', e.target.value)}
                />
              </label>
              <label className="field">
                الشعبة
                <input
                  placeholder="اتركها فارغة لجميع الشعب"
                  value={form.section}
                  onChange={(e) => update('section', e.target.value)}
                />
              </label>
              <label className="field">
                الفصل الدراسي
                <select value={form.term} onChange={(e) => update('term', e.target.value)}>
                  <option>الأول</option>
                  <option>الثاني</option>
                </select>
              </label>
              <label className="field">
                نوع الامتحان
                <select value={form.kind} onChange={(e) => update('kind', e.target.value)}>
                  <option>نصفي</option>
                  <option>نهائي</option>
                </select>
              </label>
              <label className="field">
                المدة بالدقائق
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={form.duration}
                  onChange={(e) => update('duration', Number(e.target.value))}
                />
              </label>
              <label className="field">
                الدرجة الكلية
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={form.total}
                  onChange={(e) => update('total', Number(e.target.value))}
                />
              </label>
              <label className="field">
                عدد الأسئلة المضافة
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={form.delivery?.count || form.questions.length}
                  readOnly
                />
              </label>
              <label className="field">
                بداية الإتاحة
                <input
                  type="datetime-local"
                  value={localDate(new Date(form.opensAt))}
                  onChange={(e) => {
                    if (e.target.value) update('opensAt', new Date(e.target.value).toISOString());
                  }}
                />
              </label>
              <label className="field">
                نهاية الإتاحة
                <input
                  type="datetime-local"
                  value={localDate(new Date(form.closesAt))}
                  onChange={(e) => {
                    if (e.target.value) update('closesAt', new Date(e.target.value).toISOString());
                  }}
                />
              </label>
            </div>
            <div className="difficulty-row">
              <span>مستوى الصعوبة</span>
              <div className="segmented">
                {['سهل', 'متوسط', 'صعب', 'مختلط'].map((level) => (
                  <button
                    key={level}
                    className={form.difficulty === level ? 'selected' : ''}
                    onClick={() => update('difficulty', level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={form.cameraRequired}
                onChange={(e) => update('cameraRequired', e.target.checked)}
              />{' '}
              الكاميرا شرط لبدء هذا الامتحان، مع إمكانية استثناء الطالب
            </label>
            <div className="exam-tool-permissions">
              <h3>أدوات الطالب أثناء الامتحان</h3>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!form.calculatorAllowed}
                  onChange={(e) => update('calculatorAllowed', e.target.checked)}
                />
                السماح بالآلة الحاسبة
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!form.geogebraAllowed}
                  onChange={(e) => update('geogebraAllowed', e.target.checked)}
                />
                السماح بـ GeoGebra للرسم والاستكشاف
              </label>
              <small className="muted">تُحفظ الصلاحيات مع الامتحان وتعمل الأدوات محليًا.</small>
            </div>
            <ExamDeliverySettings

              questions={form.questions}
              delivery={form.delivery}
              onChange={(value) => {
                update('delivery', value);
                setReviewPool(false);
              }}
            />
            <ExamAppearanceEditor value={form.appearance} onChange={value=>update('appearance',value)}/>
            <AudioAttachment value={form.audio} onChange={value=>update('audio',value)} label="تعليمات صوتية للامتحان"/>
          </section>
          <section className="card editor-section questions-section" hidden={editorStep !== 2}>
            {randomDelivery && (
              <div className="random-delivery-review">
                <div className="section-heading">
                  <span className="step">٣</span>
                  <div>
                    <h2>مراجعة التوزيع والمجموعة</h2>
                    <p>يُسحب نموذج الطالب عند بدء المحاولة وفق التوزيع المعتمد أدناه.</p>
                  </div>
                </div>
                <div className="delivery-summary">
                  <strong>{form.questions.length} سؤالًا في المجموعة</strong>
                  <span aria-hidden="true">←</span>
                  <strong>{randomDelivery.count} سؤالًا لكل طالب</strong>
                </div>
                <p className="info-note">
                  لا توجد ورقة أسئلة موحدة للطلاب. يحصل كل طالب على العدد والتوزيع نفسيهما،
                  وقد يشترك الطلاب في بعض الأسئلة. تُحفظ أسئلة كل محاولة وإجاباتها للتصحيح.
                </p>
                <div className="delivery-table" role="table" aria-label="ملخص توزيع الأسئلة العشوائية">
                  <div role="row">
                    <strong role="columnheader">الموضوع / الصعوبة</strong>
                    <strong role="columnheader">في المجموعة</strong>
                    <strong role="columnheader">لكل طالب</strong>
                  </div>
                  {poolGroups(form.questions).map((group) => {
                    const count = randomDelivery.quotas.find((quota) =>
                      groupKey(quota.chapter, quota.difficulty) === groupKey(group.chapter, group.difficulty),
                    )?.count || 0;
                    return (
                      <div role="row" key={groupKey(group.chapter, group.difficulty)}>
                        <span role="cell">{group.chapter}<small>{group.difficulty}</small></span>
                        <span role="cell">{group.available}</span>
                        <strong role="cell">{count}</strong>
                      </div>
                    );
                  })}
                </div>
                <p className="muted">يتحقق النظام عند النشر من صحة التوزيع وكفاية النماذج لطلاب الصف.</p>
                <div className="random-review-actions">
                  <button className="secondary small" onClick={() => setEditorStep(1)}>
                    <Pencil size={16} /> تعديل التوزيع
                  </button>
                  <button className="secondary small" onClick={() => setEditorStep(0)}>
                    <BookOpen size={16} /> إضافة من البنك
                  </button>
                  <button className="primary small" aria-expanded={reviewPool} onClick={() => setReviewPool(!reviewPool)}>
                    <Eye size={16} /> {reviewPool ? 'إخفاء أسئلة المجموعة' : 'مراجعة أسئلة المجموعة'}
                  </button>
                </div>
              </div>
            )}
            <div hidden={!!randomDelivery && !reviewPool}>
            <div className="section-heading">
              <span className="step">٣</span>
              <div>
                <h2>
                  {randomDelivery ? 'أسئلة المجموعة' : 'مراجعة الأسئلة'} <span className="count">{form.questions.length}</span>
                </h2>
                <p>{randomDelivery ? 'هذه مجموعة السحب الكاملة؛ ترتيبها هنا لا يمثل نموذج طالب.' : 'اختر الإجابة الصحيحة وعدّل أي سؤال قبل الاعتماد.'}</p>
              </div>
              <button
                className="secondary small"
                onClick={() => {
                  update('questions', [
                    ...form.questions,
                    {
                      id: uid(),
                      text: '',
                      options: ['', '', '', ''],
                      correct: 0,
                      explanation: '',
                      page: 1,
                    },
                  ]);
                  setEditIndex(form.questions.length);
                  setEditQuestion(true);
                }}
              >
                <Plus size={16} /> سؤال
              </button>
            </div>
            {q ? (
              <>
                <div className="question-tabs">
                  {form.questions.map((question, i) => (
                    <button
                      key={question.id}
                      className={i === editIndex ? 'selected' : ''}
                      onClick={() => setEditIndex(i)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <div className="question-heading">
                  <strong>السؤال {editIndex + 1}</strong>
                  <button className="text-button" onClick={() => setEditorStep(0)}>
                    <BookOpen size={16} /> إضافة من البنك
                  </button>
                  <button
                    className="danger-icon"
                    aria-label="حذف السؤال"
                    onClick={() => {
                      update(
                        'questions',
                        form.questions.filter((_, i) => i !== editIndex),
                      );
                      setEditIndex(Math.max(0, editIndex - 1));
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="question-mode-switch">
                  <button
                    className={!editQuestion ? 'active' : ''}
                    onClick={() => setEditQuestion(false)}
                  >
                    <Eye size={16} />
                    معاينة السؤال
                  </button>
                  <button
                    className={editQuestion ? 'active' : ''}
                    onClick={() => setEditQuestion(true)}
                  >
                    <Pencil size={16} />
                    تعديل السؤال
                  </button>
                </div>
                {!editQuestion && (
                  <div className="teacher-question-preview">
                    <span className="eyebrow">
                      السؤال {editIndex + 1} · صفحة {q.page}
                    </span>
                    <h2>
                      <MathText text={q.text} />
                    </h2>
                    <button className="secondary small" onClick={() => setGeometry(true)}>
                      رسم لهذا السؤال · GeoGebra
                    </button>
                    {q.image && <img src={q.image} alt="رسم السؤال" />}
                    {q.audio && <AudioPlayer audio={q.audio}/>}
                    <div className="preview-answers">
                      {q.options.map((option, i) => (
                        <button
                          key={i}
                          className={q.correct === i ? 'correct' : ''}
                          onClick={() => patchQuestion({ correct: i })}
                        >
                          <span className="preview-radio">
                            {q.correct === i && <CheckCircle2 size={17} />}
                          </span>
                          <span className="preview-letter">{['أ', 'ب', 'ج', 'د'][i]}</span>
                          <MathText text={option} />
                          {q.correct === i && <small>الإجابة الصحيحة</small>}
                        </button>
                      ))}
                    </div>
                    <div className="answer-explanation">
                      <strong>تفسير الإجابة · للمعلم فقط</strong>
                      <MathText text={q.explanation} />
                    </div>
                  </div>
                )}
                <div className="question-edit-fields" hidden={!editQuestion}>
                  <AudioAttachment value={q.audio} onChange={audio=>patchQuestion({audio})} label="صوت لهذا السؤال"/>
                  <FormulaEditor value={q.text} onChange={(text) => patchQuestion({ text })} />
                  <button className="secondary" onClick={() => setGeometry(true)}>
                    إنشاء رسم هندسي · GeoGebra
                  </button>
                  {q.image && (
                    <div className="attached-image">
                      <img src={q.image} />
                      <button onClick={() => patchQuestion({ image: undefined })}>
                        <X size={16} /> إزالة الصورة
                      </button>
                    </div>
                  )}
                  <div className="answer-editor">
                    {q.options.map((option, i) => (
                      <div
                        key={i}
                        className={`answer-edit-option ${q.correct === i ? 'correct' : ''}`}
                      >
                        <input
                          type="radio"
                          name="correct"
                          aria-label={`اعتماد الخيار ${i + 1}`}
                          checked={q.correct === i}
                          onChange={() => patchQuestion({ correct: i })}
                        />
                        <span>{['أ', 'ب', 'ج', 'د'][i]}</span>
                        <FormulaEditor
                          ariaLabel={`الخيار ${i + 1}`}
                          tools={false}
                          showPreview={false}
                          value={option}
                          onChange={(value) =>
                            patchQuestion({
                              options: q.options.map((o, j) => (j === i ? value : o)),
                            })
                          }
                        />
                        {q.correct === i && <CheckCircle2 size={17} />}
                      </div>
                    ))}
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      الموضوع / الفصل
                      <input
                        value={q.chapter || ''}
                        placeholder="عام"
                        onChange={(e) => patchQuestion({ chapter: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      صعوبة السؤال
                      <select
                        value={q.difficulty || 'متوسط'}
                        onChange={(e) => patchQuestion({ difficulty: e.target.value })}
                      >
                        {['سهل', 'متوسط', 'صعب'].map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      صفحة المصدر
                      <input
                        type="number"
                        min={1}
                        value={q.page}
                        onChange={(e) => patchQuestion({ page: Number(e.target.value) })}
                      />
                    </label>
                    <label className="image-upload">
                      <ImagePlus size={18} /> إرفاق صورة
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 1500000)
                              return notify('الصورة يجب أن تكون أصغر من 1.5 ميجابايت');
                            patchQuestion({ image: await fileBase64(file) });
                          }
                        }}
                      />
                    </label>
                    <div className="field span2">
                      تفسير الإجابة للمعلم
                      <FormulaEditor
                        tools={false}
                        showPreview={false}
                        value={q.explanation}
                        onChange={(explanation) => patchQuestion({ explanation })}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty compact">
                <FileText size={36} />
                <h3>الأسئلة ستظهر هنا</h3>
                <p>اختر أسئلة من البنك، أو أضف سؤالًا يدويًا للمراجعة.</p>
              </div>
            )}
            </div>
          </section>
          <div className="editor-step-controls">
            <button
              className="secondary"
              disabled={editorStep === 0}
              onClick={() => setEditorStep(editorStep - 1)}
            >
              الخطوة السابقة
            </button>
            {editorStep < 2 && (
              <button className="primary" onClick={() => setEditorStep(editorStep + 1)}>
                التالي: {editorStep === 0 ? 'إعدادات الامتحان' : reviewTitle}
              </button>
            )}
          </div>
        </div>
        <aside className="editor-summary card">
          <div className="summary-icon">
            <FileText size={30} />
          </div>
          <h2>ملخص الامتحان</h2>
          <p>{form.title || 'امتحانك الجديد'}</p>
          <dl>
            <div>
              <dt>المادة</dt>
              <dd>{form.subject || '—'}</dd>
            </div>
            <div>
              <dt>الصف</dt>
              <dd>{form.grade || '—'}</dd>
            </div>
            <div>
              <dt>الأسئلة</dt>
              <dd>
                {form.delivery
                  ? `${form.delivery.count} للطالب / ${form.questions.length} في المجموعة`
                  : form.questions.length}
              </dd>
            </div>
            <div>
              <dt>المدة</dt>
              <dd>{form.duration} دقيقة</dd>
            </div>
            <div>
              <dt>الدرجة</dt>
              <dd>{form.total}</dd>
            </div>
          </dl>
          <div className="info-note">{randomDelivery ? 'راجع توزيع الموضوعات والصعوبات وأسئلة المجموعة قبل الاعتماد.' : 'راجع كل سؤال وإجابته ورسمه قبل الاعتماد.'}</div>
          <label className="check-label approval">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />{' '}
            {randomDelivery ? 'راجعت التوزيع وأسئلة المجموعة وإجاباتها وأعتمد السحب العشوائي.' : 'راجعت الأسئلة والإجابات وأعتمد محتوى الامتحان.'}
          </label>
          <button
            className="primary wide"
            disabled={busy || !approved || !form.questions.length}
            onClick={() => void save(true)}
          >
            اعتماد ونشر الامتحان
          </button>
          <button className="secondary wide" disabled={busy} onClick={() => void save()}>
            حفظ كمسودة
          </button>
          <p className="muted tiny">التعديل بعد بدء المحاولات ينشئ نسخة جديدة.</p>
        </aside>
      </div>
    </>
  );
}
