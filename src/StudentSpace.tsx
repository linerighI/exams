import { useLayoutEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { gsap } from './animato';
import { Flip } from 'gsap/Flip';
import { useStudentWorkspaceMotion, prefersQuietMotion } from './appMotion';
gsap.registerPlugin(Flip);
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
function ExamPaper({ exam }: { exam: Exam }) {
  return (
    <div className="student-paper-art" aria-hidden="true">
      <div className="student-paper-back" />
      <div className="student-cover-paper">
        <span>{exam.subject}</span>
        <strong>{exam.title}</strong>
        <small>
          الصف {exam.grade} · الفصل {exam.term}
        </small>
        <svg className="student-paper-lines" viewBox="0 0 180 100" fill="none">
          <g stroke="#e2eaf5" strokeWidth="3" strokeLinecap="round">
            <path d="M17 12H161M45 30H161M17 52H161M45 70H161M17 92H161" />
          </g>
          <g stroke="#94b5df" strokeWidth="1.5">
            <circle cx="23" cy="30" r="5" />
            <circle cx="23" cy="70" r="5" />
          </g>
        </svg>
        <div className="student-paper-seal">
          <GraduationCap size={16} />
          <span>امتحانات الشريقي</span>
        </div>
      </div>
    </div>
  );
}

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
  const scene = useRef<HTMLDivElement>(null);
  useStudentWorkspaceMotion(scene, page);
  const filterState = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [code, setCode] = useState('');
  useLayoutEffect(() => {
    if (!filterState.current || prefersQuietMotion()) return;
    const context = gsap.context(() => {
      Flip.from(filterState.current!, { duration: 0.45, ease: 'power3.inOut', scale: true });
    }, scene);
    filterState.current = null;
    return () => context.revert();
  }, [filter]);
  const completed = attempts.filter((a) => !!a.submittedAt);
  const active = attempts.filter((a) => !a.submittedAt);
  const resultReady = (a: Attempt) =>
    a.score != null && exams.some((e) => e.id === a.examId && e.resultsPublished);
  const published = completed.filter(resultReady);
  const ready = exams.filter((e) => available(e) && !attempts.some((a) => a.examId === e.id));
  const upcoming = exams
    .filter((e) => e.status === 'published' && Date.parse(e.opensAt) > Date.now())
    .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt));
  const nextExam = exams.find((e) => e.id === active[0]?.examId) || ready[0] || upcoming[0];
  const nextAttempt = nextExam && active.find((a) => a.examId === nextExam.id);
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
            <article className="exam-card student-exam-card" key={e.id} data-flip-id={e.id}>
              <div className="student-card-cover">
                <ExamPaper exam={e} />
              </div>
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
                disabled={busy || !connected || !!attempt?.submittedAt || (!canStart && !attempt)}
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
    <div className="student-space" ref={scene} data-student-page={page}>
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
              ? 'امتحاناتك ومواعيدك ونتائجك، في مكان واحد.'
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
          <div className="student-summary" aria-label="ملخص الامتحانات">
            {[
              [ready.length, 'متاح الآن'],
              [active.length, 'قيد الإجابة'],
              [completed.length, 'تم التسليم'],
              [published.length, 'نتائج منشورة'],
            ].map(([value, title]) => (
              <button
                key={title}
                className="student-summary-item"
                onClick={() => {
                  setFilter(
                    title === 'متاح الآن'
                      ? 'ready'
                      : title === 'قيد الإجابة'
                        ? 'active'
                        : title === 'تم التسليم'
                          ? 'done'
                          : 'all',
                  );
                  navigate(title === 'نتائج منشورة' ? 'results' : 'exams');
                }}
              >
                <strong>{value}</strong>
                <span>{title}</span>
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="student-dashboard-layout">
            <div className="student-dashboard-main">
              <section className="student-next-exam" aria-label="الامتحان التالي">
                <div className="student-next-content">
                  <div className="student-next-label">
                    <BookOpen size={18} aria-hidden="true" />
                    <span>{nextAttempt ? 'أكمل امتحانك' : 'الامتحان التالي'}</span>
                    <i />
                  </div>
                  {nextExam ? (
                    <>
                      <div className="student-next-topline">
                        <span>
                          {nextExam.subject} / الفصل {nextExam.term}
                        </span>
                        <span className={`student-badge ${available(nextExam) ? 'blue' : 'muted'}`}>
                          {nextAttempt
                            ? 'قيد الإجابة'
                            : available(nextExam)
                              ? 'متاح الآن'
                              : 'قريبًا'}
                        </span>
                      </div>
                      <h2 className="student-feature-title">{nextExam.title}</h2>
                      <p className="student-feature-class">
                        الصف {nextExam.grade}
                        {nextExam.section ? ` · الشعبة ${nextExam.section}` : ''}
                      </p>
                      <div className="student-feature-facts">
                        <span>
                          <Clock3 size={16} />
                          <strong>{nextExam.duration}</strong> دقيقة
                        </span>
                        <span>
                          <GraduationCap size={17} />
                          <strong>{nextExam.total}</strong> درجة
                        </span>
                      </div>
                      <div className="student-next-date">
                        <CalendarDays size={18} aria-hidden="true" />
                        <div>
                          <span>{available(nextExam) ? 'متاح حتى' : 'يبدأ في'}</span>
                          <strong>
                            {date(available(nextExam) ? nextExam.closesAt : nextExam.opensAt)}
                          </strong>
                        </div>
                      </div>
                      <div className="student-next-footer">
                        <button
                          className="primary student-launch"
                          disabled={busy || !connected || (!nextAttempt && !available(nextExam))}
                          onClick={() => (nextAttempt ? resume(nextAttempt) : start(nextExam))}
                        >
                          {nextAttempt
                            ? 'متابعة الامتحان'
                            : available(nextExam)
                              ? 'ابدأ الامتحان'
                              : 'بانتظار موعد الامتحان'}
                          <ArrowLeft size={19} />
                        </button>
                        <span>
                          <ShieldCheck size={15} />
                          الحفظ تلقائي أثناء الإجابة
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="student-next-empty">
                      <h2>لا يوجد امتحان متاح حاليًا</h2>
                      <p>ستظهر هنا الامتحانات التي ينشرها معلموك لصفك وشعبتك.</p>
                      <button className="text-button" onClick={() => navigate('exams')}>
                        لديك رمز امتحان؟
                        <ArrowLeft size={17} />
                      </button>
                    </div>
                  )}
                </div>
                {nextExam && (
                  <div className="student-exam-ticket">
                    <ExamPaper exam={nextExam} />
                  </div>
                )}
              </section>
              <section className="student-section student-other-exams">
                <header>
                  <div>
                    <span className="student-kicker">قائمة الامتحانات</span>
                    <h2>بقية امتحاناتك</h2>
                  </div>
                  <button className="text-button" onClick={() => navigate('exams')}>
                    كل الامتحانات
                    <ArrowLeft size={16} />
                  </button>
                </header>
                {exams.some((e) => e.id !== nextExam?.id) ? (
                  cards(exams.filter((e) => e.id !== nextExam?.id).slice(0, 3))
                ) : (
                  <p className="student-no-more">لا توجد امتحانات أخرى في قائمتك.</p>
                )}
              </section>
            </div>
            <aside className="student-agenda">
              <section className="student-join-panel">
                <div className="student-aside-heading">
                  <LockKeyhole size={18} />
                  <h2>لديك رمز امتحان؟</h2>
                </div>
                <p>أدخل الرمز الذي أعطاك إياه المعلم.</p>
                <form
                  className="student-dashboard-code"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (code.trim() && connected && !busy) start(undefined, code.trim());
                  }}
                >
                  <label className="sr-only" htmlFor="dashboard-exam-code">
                    رمز الامتحان
                  </label>
                  <input
                    id="dashboard-exam-code"
                    dir="ltr"
                    placeholder="رمز الامتحان"
                    maxLength={32}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button
                    className="primary"
                    disabled={busy || !connected || !code.trim()}
                    aria-label="الانضمام بالرمز"
                  >
                    <ArrowLeft size={18} />
                  </button>
                </form>
              </section>
              <section>
                <div className="student-aside-heading">
                  <CalendarDays size={18} />
                  <h2>على جدولك</h2>
                </div>
                {upcoming.length ? (
                  upcoming.slice(0, 3).map((e) => (
                    <div className="student-agenda-item" key={e.id}>
                      <time dateTime={e.opensAt}>
                        <strong>
                          {new Date(e.opensAt).toLocaleDateString('ar-JO', { day: 'numeric' })}
                        </strong>
                        <small>
                          {new Date(e.opensAt).toLocaleDateString('ar-JO', { month: 'short' })}
                        </small>
                      </time>
                      <div>
                        <strong>{e.title}</strong>
                        <small>
                          {new Date(e.opensAt).toLocaleTimeString('ar-JO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>جدولك خالٍ الآن. سيظهر موعد امتحانك القادم هنا.</p>
                )}
              </section>
              <section>
                <div className="student-aside-heading">
                  <CheckCircle2 size={18} />
                  <h2>آخر تسليم</h2>
                </div>
                {completed.length ? (
                  <>
                    <strong>
                      {exams.find(
                        (e) =>
                          e.id ===
                          [...completed].sort((a, b) => b.submittedAt! - a.submittedAt!)[0].examId,
                      )?.title || 'امتحان مكتمل'}
                    </strong>
                    <p>يمكنك متابعة حالة النتيجة من سجل النتائج.</p>
                  </>
                ) : (
                  <p>لم تسلّم أي امتحان بعد.</p>
                )}
                <button className="text-button" onClick={() => navigate('results')}>
                  عرض النتائج
                  <ArrowLeft size={15} />
                </button>
              </section>
              <section className="student-preflight">
                <span className="student-kicker">قبل البدء</span>
                <p>
                  اقرأ التعليمات، وتأكد من الوقت المتاح. يمكنك تعليم أي سؤال للعودة إليه قبل
                  التسليم.
                </p>
              </section>
            </aside>
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
                if (code.trim() && connected && !busy) start(undefined, code.trim());
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
              <button className="primary small" disabled={busy || !connected || !code.trim()}>
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
                onClick={() => {
                  if (id === filter) return;
                  if (!prefersQuietMotion() && scene.current)
                    filterState.current = Flip.getState(
                      scene.current.querySelectorAll('.student-filter-marker, .student-exam-card'),
                    );
                  setFilter(id);
                }}
              >
                {filter === id && (
                  <span
                    className="student-filter-marker"
                    data-flip-id="student-filter-marker"
                    aria-hidden="true"
                  />
                )}
                <span>{label}</span>
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
            <span className="student-badge blue">سجل النتائج</span>
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
