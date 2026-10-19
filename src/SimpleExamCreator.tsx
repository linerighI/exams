import MorphMark from './MorphMark';
import ExamIssues from './ExamIssues';
import { examIssues, issuesFromError, type ExamIssue } from './examValidation';
import { guideToField, useSceneMotion } from './appMotion';
import ExamQuestionStudio from './ExamQuestionStudio';
import { refreshBankQuestions } from './refreshBankQuestions';
import AudioPlayer from './AudioPlayer';
import { useEffect, useState, useRef } from 'react';
import AudioAttachment from './AudioAttachment';
import ExamAppearanceEditor from './ExamAppearanceEditor';
import { api } from './api';
import MathText from './MathText';
import BankWizard from './BankWizard';
import FocusWindow from './FocusWindow';
import { deliveryForCount } from './examDelivery';
import type { Exam, Question } from './types';
import './teacherEasy.css';

export default function SimpleExamCreator({
  onSaved,
  onAdvanced,
  onBooks,
}: {
  onSaved: (exam: Exam) => void;
  onAdvanced: () => void;
  onBooks: () => void;
}) {
  const localTime = (date: Date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [form, setForm] = useState({
    title: '',
    subject: '',
    grade: '',
    section: '',
    duration: 45,
    total: 20,
    term: 'الأول',
    kind: 'نصفي',
    calculatorAllowed: false,
    geogebraAllowed: false,
    cameraRequired: false,
    appearance: undefined as Exam['appearance'],
    audio: undefined as Exam['audio'],
    opensAt: localTime(new Date()),
    closesAt: localTime(new Date(Date.now() + 86400000)),
  });
  const [bankOpen, setBankOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]),
    [books, setBooks] = useState<any[]>([]),
    [pool, setPool] = useState<any[]>([]);
  const [bookId, setBookId] = useState(''),
    [source, setSource] = useState('manual'),
    [editing, setEditing] = useState<Question>();
  const [random, setRandom] = useState(false),
    [count, setCount] = useState(5),
    [approved, setApproved] = useState(false);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<Exam>();
  const savedScene = useRef<HTMLElement>(null);
  useSceneMotion(savedScene, '.simple-success-mark, h1, p', saved?.id);
  const [draftId, setDraftId] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const [issues, setIssues] = useState<ExamIssue[]>([]);
  useSceneMotion(root, ':scope > header, :scope > section > h2');
  const locate = (issue: ExamIssue) => {
    if (issue.path[0] === 'questions' && typeof issue.path[1] === 'number')
      root.current?.querySelector('.question-studio')?.dispatchEvent(
        new CustomEvent('qs-focus-question', {
          detail: { index: issue.path[1], field: issue.path[2] },
        }),
      );
    else {
      const target = root.current?.querySelector<HTMLElement>(
        `[data-exam-field="${issue.path[0]}"]`,
      );
      if (target) guideToField(target);
    }
  };
  useEffect(() => {
    void api('/api/books')
      .then(setBooks)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let live = true;
    setPool([]);
    if (bookId)
      void api(`/api/books/${bookId}/questions`)
        .then((items) => {
          if (live)
            setPool(
              items.filter((q: any) => q.status === 'approved' && (!q.requiresImage || q.image)),
            );
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [bookId]);
  const patch = (key: string, value: any) => {
    setForm((old) => ({ ...old, [key]: value }));
    setApproved(false);
  };
  const refreshQuestions = async () => {
    setBusy(true);
    setError('');
    try {
      setQuestions(await refreshBankQuestions(questions));
      setApproved(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = async (publish: boolean) => {
    const problems = examIssues({ ...form, questions }, publish, approved);
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
    setError('');
    try {
      if (!form.title.trim() || !form.subject.trim() || !form.grade.trim())
        throw Error('أدخل اسم الامتحان والمادة والصف.');
      if (publish && (!approved || !questions.length))
        throw Error('أضف الأسئلة ثم أكد مراجعتها قبل النشر.');
      const delivery = random ? deliveryForCount(questions, count) : undefined;
      if (random && !delivery)
        throw Error('عدد أسئلة الطالب يجب أن يكون بين 1 وحجم المجموعة (حتى 100).');
      const opensAt = new Date(form.opensAt).toISOString(),
        closesAt = new Date(form.closesAt).toISOString();
      if (closesAt <= opensAt) throw Error('يجب أن يكون موعد الإغلاق بعد موعد الفتح.');
      const exam = await api(
        draftId ? `/api/exams/${draftId}` : '/api/exams',
        draftId ? 'PUT' : 'POST',
        { ...form, opensAt, closesAt, questions, delivery, difficulty: 'مختلط' },
      );
      setDraftId(exam.id);
      if (publish) {
        await api(`/api/exams/${exam.id}/publish`, 'POST');
        exam.status = 'published';
      }
      setSaved(exam);
      onSaved(exam);
    } catch (e) {
      setError((e as Error).message);
      setIssues(issuesFromError(e));
    } finally {
      setBusy(false);
    }
  };
  if (saved)
    return (
      <section ref={savedScene} className="card simple-exam">
        <span className="simple-success-mark">
          <MorphMark shape="check" size={32} />
        </span>
        <h1>{saved.status === 'published' ? 'امتحانك جاهز للطلاب' : 'حُفظت المسودة'}</h1>
        <p>{saved.title}</p>
        {saved.status === 'published' && (
          <p>
            رمز الامتحان: <strong dir="ltr">{saved.code}</strong>
          </p>
        )}
        <button
          className="primary"
          onClick={() => {
            setSaved(undefined);
            setDraftId('');
            setQuestions([]);
            setApproved(false);
            setEditing(undefined);
            patch('title', '');
          }}
        >
          إعداد امتحان آخر
        </button>
        <button className="secondary" onClick={onAdvanced}>
          عرض الامتحانات
        </button>
      </section>
    );
  return (
    <div className="simple-exam" ref={root}>
      <header className="page-title">
        <div>
          <h1>أنشئ امتحانك بسهولة</h1>
          <p>كل الخطوات في صفحة واحدة. لا تحتاج إلى ذكاء اصطناعي.</p>
        </div>
        <button className="secondary" onClick={onAdvanced}>
          العودة للوضع الكامل
        </button>
      </header>
      <ExamIssues issues={issues} onSelect={locate} />
      <section className="card">
        <h2>١. لمن هذا الامتحان؟</h2>
        <div className="form-grid">
          {(['title', 'subject', 'grade', 'section'] as const).map((key, i) => (
            <label className="field" key={key}>
              {['اسم الامتحان', 'المادة', 'الصف', 'الشعبة (اختياري)'][i]}
              <input
                data-exam-field={key}
                value={form[key]}
                onChange={(e) => patch(key, e.target.value)}
              />
            </label>
          ))}
          <label className="field">
            المدة بالدقائق
            <input
              type="number"
              min={1}
              max={240}
              data-exam-field="duration"
              value={form.duration}
              onChange={(e) => patch('duration', Number(e.target.value))}
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
              onChange={(e) => patch('total', Number(e.target.value))}
            />
          </label>
          <label className="field">
            يفتح في
            <input
              type="datetime-local"
              data-exam-field="opensAt"
              value={form.opensAt}
              onChange={(e) => patch('opensAt', e.target.value)}
            />
          </label>
          <label className="field">
            يغلق في
            <input
              type="datetime-local"
              data-exam-field="closesAt"
              value={form.closesAt}
              onChange={(e) => patch('closesAt', e.target.value)}
            />
          </label>
          <label className="field">
            الفصل
            <select value={form.term} onChange={(e) => patch('term', e.target.value)}>
              <option>الأول</option>
              <option>الثاني</option>
            </select>
          </label>
          <label className="field">
            النوع
            <select value={form.kind} onChange={(e) => patch('kind', e.target.value)}>
              <option>نصفي</option>
              <option>نهائي</option>
            </select>
          </label>
        </div>
      </section>
      <section className="card">
        <h2>٢. أضف أسئلتك</h2>
        {editing && (
          <div className="info-note">
            تعدّل سؤالًا موجودًا. احفظ التعديل أو ألغِه قبل النشر.{' '}
            <button className="text-button" onClick={() => setEditing(undefined)}>
              إلغاء تعديل السؤال
            </button>
          </div>
        )}
        <div className="simple-actions">
          <button
            className={source === 'manual' ? 'primary' : 'secondary'}
            onClick={() => setSource('manual')}
          >
            أكتب الأسئلة بنفسي
          </button>
          <button
            className={source === 'bank' ? 'primary' : 'secondary'}
            onClick={() => setSource('bank')}
          >
            أختار من البنك
          </button>
          <button className="text-button" onClick={() => setBankOpen(true)}>
            إنشاء بنك أو استيراد أسئلة
          </button>
        </div>
        {bankOpen && (
          <FocusWindow title="إنشاء أو استيراد بنك" onClose={() => setBankOpen(false)}>
            <BankWizard
              books={books}
              notify={setError}
              onImported={async (id) => {
                setBooks(await api('/api/books'));
                setBookId(id);
                setSource('bank');
                setBankOpen(false);
              }}
            />
          </FocusWindow>
        )}
        {source === 'manual' ? null : (
          <>
            <label className="field">
              البنك
              <select
                aria-label="البنك"
                value={bookId}
                onChange={(e) => {
                  setBookId(e.target.value);
                  const b = books.find((b) => b.id === e.target.value);
                  if (b) {
                    patch('subject', b.subject);
                    patch('grade', b.grade);
                  }
                }}
              >
                <option value="">اختر بنكًا</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} — {b.grade}
                  </option>
                ))}
              </select>
            </label>
            {bookId && !pool.length && (
              <p>
                لا توجد أسئلة معتمدة في هذا البنك بعد. راجعها واعتمدها من صفحة البنك، أو اكتب سؤالًا
                بنفسك.
              </p>
            )}
            <div className="simple-bank-list">
              {pool.map((q) => (
                <label className="simple-bank-question" key={q.id}>
                  <input
                    type="checkbox"
                    checked={questions.some((item) => item.bankId === q.id)}
                    onChange={(e) => {
                      setQuestions((old) =>
                        e.target.checked
                          ? [...old, { ...q, id: crypto.randomUUID(), bankId: q.id }]
                          : old.filter((item) => item.bankId !== q.id),
                      );
                      setApproved(false);
                    }}
                  />
                  <MathText text={q.text} />
                  {q.image && <img className="manual-image" src={q.image} alt="رسم السؤال" />}
                </label>
              ))}
            </div>
          </>
        )}
        <ExamQuestionStudio
          questions={questions}
          onChange={(value) => {
            setQuestions(value);
            setApproved(false);
          }}
          onBank={() => {
            setSource('bank');
            requestAnimationFrame(() =>
              document
                .querySelector('[aria-label="البنك"]')
                ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
            );
          }}
          notify={setError}
          total={form.total}
          random={random}
        />
      </section>
      <section className="card">
        <h2>٣. راجع ثم انشر — {questions.length} سؤالًا</h2>
        {questions.some((q) => q.bankId) && (
          <button
            className="secondary small"
            disabled={busy}
            onClick={() => void refreshQuestions()}
          >
            تحديث الأسئلة من البنك
          </button>
        )}
        <label className="check-label">
          <input
            type="checkbox"
            checked={random}
            onChange={(e) => {
              setRandom(e.target.checked);
              setApproved(false);
            }}
          />
          نموذج عشوائي مختلف لكل طالب
        </label>
        {random && (
          <label className="field">
            عدد الأسئلة لكل طالب
            <input
              type="number"
              min={1}
              max={Math.min(100, questions.length)}
              data-exam-field="delivery"
              value={count}
              onChange={(e) => {
                setCount(Number(e.target.value));
                setApproved(false);
              }}
            />
            <small>يتوزع العدد تلقائيًا على الموضوعات والصعوبات بنسبة وجودها في المجموعة.</small>
          </label>
        )}
        {(['calculatorAllowed', 'geogebraAllowed', 'cameraRequired'] as const).map((key, i) => (
          <label className="check-label" key={key}>
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => patch(key, e.target.checked)}
            />
            {['السماح بالآلة الحاسبة', 'السماح بالرسم في GeoGebra', 'اشتراط الكاميرا'][i]}
          </label>
        ))}
        <ExamAppearanceEditor
          value={form.appearance}
          onChange={(value) => patch('appearance', value)}
        />
        <AudioAttachment
          value={form.audio}
          onChange={(value) => patch('audio', value)}
          label="تعليمات صوتية للامتحان"
        />

        <label className="check-label">
          <input
            type="checkbox"
            data-exam-field="approved"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          راجعت الأسئلة والرسوم والإجابات والإعدادات وأعتمدها.
        </label>
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
        <div className="simple-actions">
          <button
            className="primary"
            disabled={busy || !!editing || !approved || !questions.length}
            onClick={() => void save(true)}
          >
            <MorphMark shape={busy ? 'working' : 'check'} />
            نشر الامتحان للطلاب
          </button>
          <button
            className="secondary"
            disabled={busy || !!editing}
            onClick={() => void save(false)}
          >
            <MorphMark shape={busy ? 'working' : 'saved'} />
            حفظ كمسودة
          </button>
        </div>
      </section>
    </div>
  );
}
