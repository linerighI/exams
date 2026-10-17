import { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LockKeyhole,
  Search,
  ShieldCheck,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import type { Attempt, Exam, Student } from './types';
import './studentSpace.css';

const date = (value: string | number) =>
  new Date(value).toLocaleString('ar-JO', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const available = (exam: Exam) =>
  exam.status === 'published' &&
  Date.now() >= Date.parse(exam.opensAt) &&
  Date.now() < Date.parse(exam.closesAt);
export default function StudentSpace({
  page,
  student,
  exams,
  attempts,
  connected,
  busy,
  navigate,
  start,
  resume,
}: {
  page: string;
  student: Student;
  exams: Exam[];
  attempts: Attempt[];
  connected: boolean;
  busy: boolean;
  navigate: (page: string) => void;
  start: (exam?: Exam, code?: string) => void;
  resume: (attempt: Attempt) => void;
}) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [code, setCode] = useState('');
  const completed = attempts.filter((a) => !!a.submittedAt);
  const active = attempts.filter((a) => !a.submittedAt);
  const resultReady = (a: Attempt) =>
    a.score != null && exams.some((e) => e.id === a.examId && e.resultsPublished);
  const published = completed.filter(resultReady);
  const ready = exams.filter((e) => available(e) && !attempts.some((a) => a.examId === e.id));
  const upcoming = exams
    .filter((e) => e.status === 'published' && Date.parse(e.opensAt) > Date.now())
    .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt));
  const byExam = (exam: Exam) => attempts.find((a) => a.examId === exam.id);
  const filtered = exams
    .filter((e) => `${e.title} ${e.subject} ${e.grade}`.includes(search))
    .filter(
      (e) =>
        filter === 'all' ||
        (filter === 'ready'
          ? available(e) && !byExam(e)
          : filter === 'active'
            ? byExam(e) && !byExam(e)?.submittedAt
            : !!byExam(e)?.submittedAt),
    );
  const empty = (title: string, description: string) => (
    <div className="student-empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
  const cards = (list: Exam[]) =>
    list.length ? (
      <div className="student-exam-grid">
        {list.map((e) => {
          const attempt = byExam(e),
            canStart = available(e);
          return (
            <article className="exam-card student-exam-card" key={e.id}>
              <header>
                <span className="student-subject-icon">
                  <BookOpen size={22} />
                </span>
                <span
                  className={`student-badge ${attempt?.submittedAt ? 'mint' : attempt ? 'blue' : canStart ? 'mint' : 'muted'}`}
                >
                  {attempt?.submittedAt
                    ? 'تم التسليم'
                    : attempt
                      ? 'قيد الإجابة'
                      : canStart
                        ? 'متاح الآن'
                        : e.status === 'closed' || Date.parse(e.closesAt) <= Date.now()
                          ? 'انتهت الإتاحة'
                          : 'قريبًا'}
                </span>
              </header>
              <span className="student-kicker">
                {e.subject} · الفصل {e.term}
              </span>
              <h3>{e.title}</h3>
              <p>
                الصف {e.grade}
                {e.section ? ` · الشعبة ${e.section}` : ''}
              </p>
              <div className="student-card-meta">
                <span>
                  <Clock3 size={15} />
                  {e.duration} دقيقة
                </span>
                <span>
                  <GraduationCap size={16} />
                  {e.total} درجة
                </span>
              </div>
              <div className="student-card-date">
                <CalendarDays size={15} />
                <span>
                  {Date.parse(e.opensAt) > Date.now()
                    ? `يبدأ ${date(e.opensAt)}`
                    : `نهاية الإتاحة ${date(e.closesAt)}`}
                </span>
              </div>
              <button
                className={attempt?.submittedAt ? 'secondary wide' : 'primary wide'}
                disabled={busy || !!attempt?.submittedAt || (!canStart && !attempt)}
                onClick={() => (attempt ? resume(attempt) : start(e))}
              >
                {attempt?.submittedAt ? (
                  <>
                    <CheckCircle2 size={17} />
                    تم التسليم
                  </>
                ) : (
                  <>
                    {attempt
                      ? 'متابعة الامتحان'
                      : canStart
                        ? 'ابدأ الامتحان'
                        : 'بانتظار موعد الإتاحة'}
                    <ArrowLeft size={17} />
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    ) : (
      empty(
        'لا توجد امتحانات متاحة الآن',
        'ستظهر هنا الامتحانات المنشورة لصفك وشعبتك. يمكنك أيضًا استخدام رمز الامتحان الذي أعطاك إياه المعلم.',
      )
    );
  return (
    <div className="student-space">
      <div className="student-page-heading">
        <div>
          <span className="student-kicker">
            مساحتك التعليمية · الصف {student.grade} · {student.section}
          </span>
          <h1>
            {page === 'dashboard'
              ? `أهلًا بك، ${student.name.split(' ')[0]}`
              : page === 'results'
                ? 'نتائجي'
                : 'امتحاناتي'}
          </h1>
          <p>
            {page === 'dashboard'
              ? 'خطوة واضحة، تركيز أكثر، وكل إنجاز في مكانه.'
              : page === 'results'
                ? 'تابع ما أنجزته، واطّلع على درجاتك بعد نشرها من المعلم.'
                : 'امتحانات صفك ومحاولاتك، مرتبة لتعرف خطوتك التالية.'}
          </p>
        </div>
        <span className={`student-connection ${connected ? '' : 'offline'}`}>
          {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          {connected ? 'متصل بجهاز المعلم' : 'بانتظار الاتصال'}
        </span>
      </div>
      {!connected && (
        <div className="student-offline-note" role="status">
          الاتصال بجهاز المعلم غير متاح. قد تكون هذه آخر بيانات محفوظة؛ تُحفظ إجابات المحاولة
          الحالية على جهازك حتى يعود الاتصال.
        </div>
      )}
      {page === 'dashboard' ? (
        <>
          <section className="student-welcome-panel">
            <div className="student-welcome-copy">
              <span className="student-kicker">مساحة هادئة لتُظهر ما تعلمته</span>
              <h2>
                {active.length
                  ? 'لنُكمل ما بدأت.'
                  : ready.length
                    ? 'خطوتك التالية جاهزة.'
                    : 'كل بداية، فرصة جديدة.'}
              </h2>
              <p>
                {active.length
                  ? 'لديك محاولة بدأت بها. عد إليها وأكمل إجاباتك قبل انتهاء الوقت.'
                  : ready.length
                    ? `لديك ${ready.length} امتحان متاح. اقرأ التعليمات، وخذ وقتك في كل سؤال.`
                    : 'تابع هذه المساحة؛ ستظهر امتحاناتك عندما ينشرها المعلم.'}
              </p>
              <div className="student-hero-actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => (active[0] ? resume(active[0]) : navigate('exams'))}
                >
                  {active.length ? 'متابعة محاولتي' : 'استعراض امتحاناتي'}
                  <ArrowLeft size={17} />
                </button>
                <span>
                  <ShieldCheck size={15} />
                  إجاباتك تُحفظ أثناء الحل
                </span>
              </div>
            </div>
          </section>
          <div className="student-summary">
            {[
              [BookOpen, ready.length, 'متاح للبدء'],
              [Clock3, active.length, 'محاولات جارية'],
              [CheckCircle2, completed.length, 'امتحانات مكتملة'],
              [GraduationCap, published.length, 'نتائج منشورة'],
            ].map(([Icon, value, title]: any) => (
              <div key={title}>
                <span className="student-summary-icon">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{value}</strong>
                  <span>{title}</span>
                </div>
              </div>
            ))}
          </div>
          <section className="student-section">
            <header>
              <div>
                <span className="student-kicker">ابدأ من هنا</span>
                <h2>امتحاناتك الأقرب</h2>
              </div>
              <button className="text-button" onClick={() => navigate('exams')}>
                كل الامتحانات
                <ArrowLeft size={16} />
              </button>
            </header>
            {cards(
              [...exams]
                .sort(
                  (a, b) =>
                    Number(available(b)) - Number(available(a)) ||
                    Date.parse(a.opensAt) - Date.parse(b.opensAt),
                )
                .slice(0, 3),
            )}
          </section>
          <div className="student-support-grid">
            <section className="student-help-card">
              <span className="student-kicker">قبل أن تبدأ</span>
              <h3>دقيقة للاستعداد، فرق في التركيز.</h3>
              <ol>
                <li>اقرأ مدة الامتحان ووقت إتاحته.</li>
                <li>استخدم خريطة الأسئلة لمراجعة إجاباتك.</li>
                <li>حين تصبح الكرة خضراء، راجع ثم أكّد التسليم.</li>
              </ol>
            </section>
            <section className="student-help-card">
              <span className="student-kicker">على جدولك</span>
              <h3>{upcoming.length ? 'القادم في مساحتك' : 'أنت على اطلاع'}</h3>
              {upcoming.slice(0, 2).map((e) => (
                <div className="student-upcoming" key={e.id}>
                  <CalendarDays size={19} />
                  <div>
                    <strong>{e.title}</strong>
                    <span>{date(e.opensAt)}</span>
                  </div>
                </div>
              ))}
              {!upcoming.length && (
                <p>لا توجد امتحانات بموعد قادم حاليًا. نتائجك تبقى في صفحة «نتائجي» بعد نشرها.</p>
              )}
              <button className="text-button" onClick={() => navigate('results')}>
                الذهاب إلى نتائجي
                <ArrowLeft size={16} />
              </button>
            </section>
          </div>
        </>
      ) : page === 'exams' ? (
        <>
          <div className="student-exam-toolbar">
            <label className="student-search">
              <Search size={18} />
              <input
                aria-label="البحث في امتحاناتي"
                placeholder="ابحث عن امتحان أو مادة…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <form
              className="student-code-form"
              onSubmit={(e) => {
                e.preventDefault();
                start(undefined, code.trim());
              }}
            >
              <label htmlFor="student-exam-code">لديك رمز؟</label>
              <input
                id="student-exam-code"
                dir="ltr"
                placeholder="رمز الامتحان"
                maxLength={32}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="primary small" disabled={busy || !code.trim()}>
                انضمام
              </button>
            </form>
          </div>
          <div className="student-filter-row" aria-label="تصفية الامتحانات">
            {[
              ['all', 'الكل'],
              ['ready', 'متاح الآن'],
              ['active', 'بدأت به'],
              ['done', 'تم التسليم'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                className={filter === id ? 'active' : ''}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
            <span>{filtered.length} امتحانات</span>
          </div>
          {cards(filtered)}
        </>
      ) : (
        <>
          <div className="student-results-summary">
            <GraduationCap size={30} />
            <div>
              <strong>{published.length} نتائج منشورة</strong>
              <p>{completed.length - published.length} امتحانات مكتملة بانتظار نشر الدرجة</p>
            </div>
            <span className="student-badge blue">إنجازك، خطوة بخطوة</span>
          </div>
          {attempts.length ? (
            <div className="student-result-list">
              {[...attempts]
                .sort((a, b) => b.startedAt - a.startedAt)
                .map((a) => {
                  const exam = exams.find((e) => e.id === a.examId),
                    visible = resultReady(a);
                  return (
                    <article className="student-result-card" key={a.id}>
                      <span className={`student-result-symbol ${visible ? 'published' : ''}`}>
                        {visible ? <GraduationCap size={25} /> : <LockKeyhole size={23} />}
                      </span>
                      <div className="student-result-info">
                        <span className="student-kicker">{exam?.subject || 'امتحان محفوظ'}</span>
                        <h3>{a.examTitle || exam?.title || 'امتحان محفوظ'}</h3>
                        <p>
                          {a.submittedAt
                            ? `تم التسليم ${date(a.submittedAt)}`
                            : 'محاولة قيد الإجابة'}
                        </p>
                      </div>
                      <div className="student-result-score">
                        {visible ? (
                          <>
                            <strong>
                              {a.score}
                              <small> / {exam?.total ?? '—'}</small>
                            </strong>
                            <span>الدرجة المنشورة</span>
                          </>
                        ) : (
                          <>
                            <span className="student-badge muted">
                              {a.submittedAt ? 'بانتظار نشر النتيجة' : 'لم يُسلّم بعد'}
                            </span>
                            {!a.submittedAt && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => resume(a)}
                              >
                                متابعة الامتحان
                                <ArrowLeft size={15} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          ) : (
            empty(
              'النتائج ستظهر هنا',
              'عندما تُكمل امتحانًا، ستجد حالة التسليم هنا. تظهر الدرجة بعد أن ينشرها المعلم.',
            )
          )}
          <div className="student-results-note">
            <ShieldCheck size={18} />
            <p>الدرجة لا تظهر إلا بقرار المعلم. للاستفسار عن نتيجة أو إجابة، راجع معلم المادة.</p>
          </div>
        </>
      )}
    </div>
  );
}
