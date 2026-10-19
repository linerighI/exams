import { useRef, useState, type ReactNode } from 'react';
import { Activity, CheckCircle2, Clock3, Download, Eye, RefreshCw, Search } from 'lucide-react';
import BlueOrb from './BlueOrb';
import type { Attempt, Exam } from './types';
import './monitoring.css';
import { openLiveLab } from './LiveLab';

export default function TeacherMonitoring({
  exams,
  attempts,
  connected,
  busy,
  initialResults,
  refresh,
  publish,
  closeExam,
  exportResults,
  renderAttempts,
}: {
  exams: Exam[];
  attempts: Attempt[];
  connected: boolean;
  busy: boolean;
  initialResults: boolean;
  refresh: () => void;
  publish: (id: string) => void;
  closeExam: (id: string) => void;
  exportResults: () => void;
  renderAttempts: (attempts: Attempt[], results: boolean) => ReactNode;
}) {
  const [scope, setScope] = useState('all'),
    [selected, setSelected] = useState(''),
    [query, setQuery] = useState('');
  const [results, setResults] = useState(initialResults),
    [attention, setAttention] = useState(false);
  const detail = useRef<HTMLElement>(null);
  const active = attempts.filter((attempt) => !attempt.submittedAt);
  const submitted = attempts.filter((attempt) => !!attempt.submittedAt);
  const review = attempts.filter((attempt) => attempt.status === 'review'||attempt.gradingPending);
  const graded = submitted.flatMap((attempt) => {
    const exam = exams.find((exam) => exam.id === attempt.examId);
    return attempt.score != null && exam?.total ? [(attempt.score / exam.total) * 100] : [];
  });
  const visibleExams = exams.filter(
    (exam) =>
      exam.status !== 'draft' &&
      (!selected || exam.id === selected) &&
      (scope === 'all' ||
        (scope === 'active'
          ? active.some((attempt) => attempt.examId === exam.id)
          : scope === 'closed'
            ? exam.status === 'closed'
            : !exam.resultsPublished)),
  );
  const visibleAttempts = attempts.filter(
    (attempt) =>
      (!selected || attempt.examId === selected) &&
      (!attention || attempt.status === 'review'||attempt.gradingPending) &&
      (!results || !!attempt.submittedAt) &&
      `${attempt.studentName} ${attempt.studentId} ${attempt.examTitle}`.includes(query),
  );
  const focus = (examId = '', grades = false) => {
    setSelected(examId);
    setResults(grades);
    setAttention(false);
    setQuery('');
    requestAnimationFrame(() =>
      detail.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    );
  };
  return (
    <div className="teacher-monitoring">
      <div className="page-title">
        <div>
          <h1>المتابعة والنتائج</h1>
          <p>تابع المحاولات، راجع الدرجات، ثم انشر النتائج.</p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={refresh}>
            <RefreshCw size={16} />
            تحديث
          </button>
          <button className="primary" onClick={exportResults}>
            <Download size={17} />
            تصدير النتائج
          </button>
        </div>
      </div>
      <div className="monitor-metrics" aria-label="ملخص المحاولات">
        {[
          [active.length, 'محاولات جارية', Activity],
          [submitted.length, 'تم تسليمها', CheckCircle2],
          [review.length, 'تحتاج مراجعة', Clock3],
          [
            graded.length
              ? `${Math.round(graded.reduce((sum, value) => sum + value, 0) / graded.length)}٪`
              : '—',
            'متوسط الدرجات',
            Eye,
          ],
        ].map(([value, label, Icon]: any) => (
          <div key={label}>
            <span>
              <Icon size={17} />
              {label}
            </span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="monitor-overview">
        <section className="monitor-orb-card">
          <button
            className="monitor-orb"
            aria-label="فتح غرفة المراقبة"
            onClick={() => openLiveLab()}
          >
            <BlueOrb size={1.55} tone="blue" animationSpeedBase={0.2} />
          </button>
          <div>
            <span className={`pill ${connected ? 'blue' : 'amber'}`}>
              {connected ? 'متصل بالمدرسة' : 'الاتصال غير متاح'}
            </span>
            <h2>
              {review.length
                ? `${review.length} محاولات تحتاج قرارك`
                : active.length
                  ? `${active.length} محاولات جارية`
                  : 'كل شيء تحت المتابعة'}
            </h2>
            <p>
              {review.length
                ? 'افتح المراقبة أو راجع الإجابات المتأخرة.'
                : 'افتح الأجهزة والإجابات والكاميرات المباشرة.'}
            </p>
            <div className="button-row">
              <button className="secondary small" onClick={() => openLiveLab()}>
                فتح المراقبة
              </button>
              {review.length > 0 && (
                <button
                  className="text-button"
                  aria-label="عرض المحاولات التي تحتاج مراجعة"
                  onClick={() => {
                    setAttention(true);
                    setSelected('');
                    setResults(false);
                    setQuery('');
                    detail.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                  }}
                >
                  مراجعة الإجابات
                </button>
              )}
            </div>
          </div>
        </section>
        <section className="monitor-upcoming">
          <h2>مواعيد الامتحانات</h2>
          {exams
            .filter((exam) => exam.status === 'published')
            .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt))
            .slice(0, 3)
            .map((exam) => (
              <button key={exam.id} onClick={() => focus(exam.id)}>
                <span className="monitor-date">
                  <b>{new Date(exam.opensAt).toLocaleDateString('ar-JO', { day: 'numeric' })}</b>
                  <small>
                    {new Date(exam.opensAt).toLocaleDateString('ar-JO', { month: 'short' })}
                  </small>
                </span>
                <span>
                  <strong>{exam.title}</strong>
                  <small>
                    الصف {exam.grade} ·{' '}
                    {new Date(exam.opensAt).toLocaleTimeString('ar-JO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </small>
                </span>
              </button>
            ))}
          {!exams.some((exam) => exam.status === 'published') && <p>لا توجد امتحانات منشورة.</p>}
        </section>
      </div>
      <section className="monitor-exams">
        <header>
          <h2>امتحاناتك</h2>
          <nav aria-label="تصفية المتابعة">
            {[
              ['all', 'الكل'],
              ['active', 'جارية'],
              ['unpublished', 'بانتظار النشر'],
              ['closed', 'مغلقة'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={scope === id}
                onClick={() => {
                  setScope(id);
                  setSelected('');
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>
        <div className="monitor-exam-grid">
          {visibleExams.map((exam) => {
            const group = attempts.filter((attempt) => attempt.examId === exam.id),
              done = group.filter((attempt) => !!attempt.submittedAt).length;
            return (
              <article key={exam.id}>
                <div>
                  <span className="monitor-subject">
                    <Activity size={18} />
                  </span>
                  <div>
                    <h3>{exam.title}</h3>
                    <small>
                      {exam.subject} · الصف {exam.grade}
                    </small>
                  </div>
                  <span className={`pill ${exam.status === 'closed' ? 'gray' : 'blue'}`}>
                    {exam.status === 'closed' ? 'مغلق' : 'منشور'}
                  </span>
                </div>
                <div className="monitor-card-counts">
                  <span>{group.length - done} جاري</span>
                  <span>
                    {done} / {group.length} تسليم
                  </span>
                </div>
                <progress
                  aria-label={`تسليم ${exam.title}`}
                  value={done}
                  max={Math.max(1, group.length)}
                />
                <footer>
                  <button onClick={() => focus(exam.id)}>عرض الطلاب</button>
                  <button onClick={() => focus(exam.id, true)}>الدرجات</button>
                  <button disabled={busy || exam.resultsPublished} onClick={() => publish(exam.id)}>
                    {exam.resultsPublished ? 'النتائج منشورة' : 'نشر النتائج'}
                  </button>
                </footer>
                <details>
                  <summary>إجراءات الامتحان</summary>
                  <button
                    disabled={busy || exam.status === 'closed'}
                    onClick={() => closeExam(exam.id)}
                  >
                    إغلاق الإتاحة
                  </button>
                </details>
              </article>
            );
          })}
        </div>
        {!visibleExams.length && <p className="monitor-empty">لا توجد امتحانات ضمن هذا التصنيف.</p>}
      </section>
      <section ref={detail} className="monitor-attempts">
        <header>
          <h2>{attention ? 'محاولات تحتاج مراجعة' : 'محاولات الطلاب'}</h2>
          <div className="monitor-mode">
            <button aria-pressed={!results} onClick={() => setResults(false)}>
              المتابعة
            </button>
            <button aria-pressed={results} onClick={() => setResults(true)}>
              الدرجات
            </button>
          </div>
        </header>
        <div className="monitor-filters">
          <label>
            <Search size={16} />
            <input
              aria-label="البحث في المحاولات"
              placeholder="اسم الطالب أو الامتحان…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="امتحان المتابعة"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">كل الامتحانات</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </select>
          <button aria-pressed={attention} onClick={() => setAttention((value) => !value)}>
            تحتاج مراجعة ({review.length})
          </button>
        </div>
        {renderAttempts(visibleAttempts, results)}
      </section>
    </div>
  );
}
