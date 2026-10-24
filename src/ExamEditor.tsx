import SelectionIndicator from './SelectionIndicator';
import MorphMark from './MorphMark';
import ExamIssues from './ExamIssues';
import { examIssues, issuesFromError, type ExamIssue } from './examValidation';
import { guideToField, useSceneMotion } from './appMotion';
import ExamQuestionStudio from './ExamQuestionStudio';
import { refreshBankQuestions } from './refreshBankQuestions';
import { useState, useEffect, useRef } from 'react';
import { FileText, BookOpen, CheckCircle2, ArrowRight, Pencil, Eye } from 'lucide-react';
import { api } from './api';
import ExamBankPicker from './ExamBankPicker';
import type { Exam, Question } from './types';
import AudioAttachment from './AudioAttachment';
import ExamAppearanceEditor from './ExamAppearanceEditor';
import ExamDeliverySettings from './ExamDeliverySettings';
import { defaultDelivery, groupKey, poolGroups } from './examDelivery';
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
        shuffleQuestions: false,
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
  const [editorStep, setEditorStep] = useState(2);
  const root = useRef<HTMLDivElement>(null);
  const stages = useRef<HTMLDivElement>(null);
  const [issues, setIssues] = useState<ExamIssue[]>([]);
  useSceneMotion(root, '.editor-section:not([hidden]) > .section-heading', editorStep);
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
  const refreshQuestions = async () => {
    setBusy(true);
    try {
      update('questions', await refreshBankQuestions(form.questions));
      notify('حُدّثت الأسئلة من البنك. راجعها وأكد اعتمادها قبل النشر.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const locate = (issue: ExamIssue) => {
    const field = String(issue.path[0]);
    setEditorStep(field === 'questions' ? 2 : field === 'approved' ? 3 : 1);
    if (field === 'questions') setReviewPool(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (field === 'questions' && typeof issue.path[1] === 'number')
          root.current?.querySelector('.question-studio')?.dispatchEvent(
            new CustomEvent('qs-focus-question', {
              detail: { index: issue.path[1], field: issue.path[2] },
            }),
          );
        else {
          const target = root.current?.querySelector<HTMLElement>(`[data-exam-field="${field}"]`);
          if (target) guideToField(target);
        }
      }),
    );
  };
  const save = async (publish = false) => {
    const problems = examIssues(form, publish, approved);
    setIssues(problems);
    if (problems.length) {
      requestAnimationFrame(() =>
        root.current
          ?.querySelector('.exam-issues')
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
      );
      return;
    }

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
      const message = (e as Error).message;
      setIssues(issuesFromError(e));
      notify(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div ref={root} className="exam-editor-root">
      <div className="page-title">
        <div>
          <button className="back-link" onClick={onCancel}>
            <ArrowRight size={17} /> العودة للامتحانات
          </button>
          <h1>{form.title || (initial ? 'تعديل الامتحان' : 'إنشاء امتحان')}</h1>
          <p>أسئلتك وإعداداتك ومعاينة الطالب، في مساحة واحدة.</p>
        </div>
        <span className="pill blue">{initial ? `النسخة ${initial.version}` : 'امتحان جديد'}</span>
      </div>
      <ExamIssues issues={issues} onSelect={locate} />
      <div
        ref={stages}
        className="exam-stages selection-track"
        role="tablist"
        aria-label="خطوات إعداد الامتحان"
      >
        <SelectionIndicator
          root={stages}
          selector='button[aria-selected="true"]'
          value={editorStep}
        />
        {[
          [2, 'بناء الامتحان'],
          [1, 'الإعدادات والمظهر'],
          [3, 'مراجعة ونشر'],
        ].map(([step, title], i) => (
          <button
            role="tab"
            aria-selected={editorStep === step}
            key={title}
            onClick={() => setEditorStep(Number(step))}
            className={editorStep === step ? 'active' : ''}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            <strong>{title}</strong>
            <small>
              {
                [
                  'اكتب أو اسحب من الأدوات',
                  'الصف والوقت والهوية البصرية',
                  'تحقق من التفاصيل واعتمد المحتوى',
                ][i]
              }
            </small>
          </button>
        ))}
      </div>
      <div className={`editor-layout exam-studio-layout ${editorStep === 2 ? 'is-building' : ''}`}>
        <div className="editor-main">
          <section className="card editor-section" hidden={editorStep !== 0}>
            <div className="manual-start">
              <h3>أسئلة من بنكك</h3>
              <p>اختر الأسئلة المعتمدة، أو عد لكتابة أسئلتك.</p>
              <button className="secondary" onClick={() => setEditorStep(2)}>
                العودة لبناء الامتحان
              </button>
            </div>
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
                  data-exam-field="title"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                />
              </label>
              <label className="field">
                المادة
                <input
                  placeholder="العلوم"
                  data-exam-field="subject"
                  value={form.subject}
                  onChange={(e) => update('subject', e.target.value)}
                />
              </label>
              <label className="field">
                الصف
                <input
                  placeholder="السابع"
                  data-exam-field="grade"
                  value={form.grade}
                  onChange={(e) => update('grade', e.target.value)}
                />
              </label>
              <label className="field">
                الشعبة
                <input
                  placeholder="اتركها فارغة لجميع الشعب"
                  data-exam-field="section"
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
                  data-exam-field="duration"
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
                  data-exam-field="total"
                  value={form.total}
                  onChange={(e) => update('total', Number(e.target.value))}
                />
              </label>
              <label className="field">
                عدد الأسئلة لكل طالب
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={form.delivery?.count || form.questions.length}
                  readOnly
                />
              </label>
              <label className="field">
                بداية الإتاحة
                <input
                  type="datetime-local"
                  data-exam-field="opensAt"
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
                  data-exam-field="closesAt"
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
            <div data-exam-field="delivery">
              <ExamDeliverySettings
                questions={form.questions}
                delivery={form.delivery}
                shuffleQuestions={!!form.shuffleQuestions}
                onShuffleChange={(value)=>update('shuffleQuestions',value)}
                onChange={(value) => {
                  update('delivery', value);
                  setReviewPool(false);
                }}
              />
            </div>
            <ExamAppearanceEditor
              value={form.appearance}
              onChange={(value) => update('appearance', value)}
            />
            <AudioAttachment
              value={form.audio}
              onChange={(value) => update('audio', value)}
              label="تعليمات صوتية للامتحان"
            />
          </section>
          <section className="card editor-section questions-section" hidden={editorStep !== 2}>
            {form.questions.some((q) => q.bankId) && (
              <button
                className="secondary small"
                disabled={busy}
                onClick={() => void refreshQuestions()}
              >
                تحديث الأسئلة من البنك
              </button>
            )}
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
                  لا توجد ورقة أسئلة موحدة للطلاب. يحصل كل طالب على العدد والتوزيع نفسيهما، وقد
                  يشترك الطلاب في بعض الأسئلة. تُحفظ أسئلة كل محاولة وإجاباتها للتصحيح.
                </p>
                <div
                  className="delivery-table"
                  role="table"
                  aria-label="ملخص توزيع الأسئلة العشوائية"
                >
                  <div role="row">
                    <strong role="columnheader">الموضوع / الصعوبة</strong>
                    <strong role="columnheader">في المجموعة</strong>
                    <strong role="columnheader">لكل طالب</strong>
                  </div>
                  {poolGroups(form.questions).map((group) => {
                    const count =
                      randomDelivery.quotas.find(
                        (quota) =>
                          groupKey(quota.chapter, quota.difficulty) ===
                          groupKey(group.chapter, group.difficulty),
                      )?.count || 0;
                    return (
                      <div role="row" key={groupKey(group.chapter, group.difficulty)}>
                        <span role="cell">
                          {group.chapter}
                          <small>{group.difficulty}</small>
                        </span>
                        <span role="cell">{group.available}</span>
                        <strong role="cell">{count}</strong>
                      </div>
                    );
                  })}
                </div>
                <p className="muted">
                  يتحقق النظام عند النشر من صحة التوزيع وكفاية النماذج لطلاب الصف.
                </p>
                <div className="random-review-actions">
                  <button className="secondary small" onClick={() => setEditorStep(1)}>
                    <Pencil size={16} /> تعديل التوزيع
                  </button>
                  <button className="secondary small" onClick={() => setEditorStep(0)}>
                    <BookOpen size={16} /> إضافة من البنك
                  </button>
                  <button
                    className="primary small"
                    aria-expanded={reviewPool}
                    onClick={() => setReviewPool(!reviewPool)}
                  >
                    <Eye size={16} />{' '}
                    {reviewPool ? 'إخفاء أسئلة المجموعة' : 'مراجعة أسئلة المجموعة'}
                  </button>
                </div>
              </div>
            )}
            <div hidden={!!randomDelivery && !reviewPool}>
              <ExamQuestionStudio
                questions={form.questions}
                onChange={(questions) => update('questions', questions)}
                onBank={() => setEditorStep(0)}
                notify={notify}
                total={form.total}
                random={!!randomDelivery}
              />
            </div>
          </section>
          {editorStep === 3 && (
            <section className="card editor-section qs-final-review">
              <div className="section-heading">
                <CheckCircle2 size={26} />
                <div>
                  <h2>راجع ثم انشر بثقة</h2>
                  <p>راجع المحتوى في خطوة البناء، والتوقيت والصف في الإعدادات.</p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>الامتحان</dt>
                  <dd>{form.title || 'أضف عنوانًا في الإعدادات'}</dd>
                </div>
                <div>
                  <dt>المادة والصف</dt>
                  <dd>
                    {form.subject || '—'} · {form.grade || '—'}
                  </dd>
                </div>
                <div>
                  <dt>نموذج الطالب</dt>
                  <dd>
                    {randomDelivery
                      ? `${randomDelivery.count} أسئلة من مجموعة ${form.questions.length}`
                      : `${form.questions.length} أسئلة ثابتة`}
                  </dd>
                </div>
                <div>
                  <dt>الوقت والدرجة</dt>
                  <dd>
                    {form.duration} دقيقة · {form.total} درجة
                  </dd>
                </div>
              </dl>
              <p className="info-note">
                الإجابات الكتابية والرسم تحتاج تصحيح المعلم بعد التسليم، ثم يمكن نشر النتائج.
              </p>
              <div className="button-row">
                <button className="secondary" onClick={() => setEditorStep(2)}>
                  مراجعة الأسئلة
                </button>
                <button className="secondary" onClick={() => setEditorStep(1)}>
                  تعديل الإعدادات
                </button>
              </div>
            </section>
          )}
          <div className="editor-step-controls">
            <button
              className="secondary"
              disabled={editorStep === 2}
              onClick={() => setEditorStep(editorStep === 3 ? 1 : 2)}
            >
              الخطوة السابقة
            </button>
            {editorStep !== 3 && (
              <button
                className="primary"
                onClick={() => setEditorStep(editorStep === 2 ? 1 : editorStep === 0 ? 2 : 3)}
              >
                التالي:{' '}
                {editorStep === 2
                  ? 'الإعدادات والمظهر'
                  : editorStep === 0
                    ? 'بناء الامتحان'
                    : 'مراجعة ونشر'}
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
          <div className="info-note">
            {randomDelivery
              ? 'راجع توزيع الموضوعات والصعوبات وأسئلة المجموعة قبل الاعتماد.'
              : 'راجع كل سؤال وإجابته ورسمه قبل الاعتماد.'}
          </div>
          <label className="check-label approval">
            <input
              type="checkbox"
              data-exam-field="approved"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />{' '}
            {randomDelivery
              ? 'راجعت التوزيع وأسئلة المجموعة وإجاباتها وأعتمد السحب العشوائي.'
              : 'راجعت الأسئلة والإجابات وأعتمد محتوى الامتحان.'}
          </label>
          <button
            className="primary wide"
            disabled={busy || !approved || !form.questions.length}
            onClick={() => void save(true)}
          >
            <MorphMark shape={busy ? 'working' : 'check'} />
            اعتماد ونشر الامتحان
          </button>
          <button className="secondary wide" disabled={busy} onClick={() => void save()}>
            <MorphMark shape={busy ? 'working' : 'saved'} />
            حفظ كمسودة
          </button>
          <p className="muted tiny">التعديل بعد بدء المحاولات ينشئ نسخة جديدة.</p>
        </aside>
      </div>
    </div>
  );
}
