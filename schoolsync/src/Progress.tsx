import { useId, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  Clock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { State } from './types';
import type { Language } from './i18n';
import { Empty, Section } from './ui';
import { gsap, quietMotion } from './animation';
import { tr } from './translations';
export function GradesScreen({ data, lang }: { data: State; lang: Language }) {
  const [subject, setSubject] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const gradient = useId().replace(/:/g, '');
  const ar = lang === 'ar';
  const published = data.grades.filter((g) => g.published);
  const grades = published.filter((g) => subject === 'all' || g.subject === subject);
  const average = grades.length
    ? Math.round(grades.reduce((a, g) => a + (g.score / g.max) * 100, 0) / grades.length)
    : null;
  const active = grades.find((g) => g.id === selected) || grades.at(-1);
  const points = grades
    .map(
      (g, i) =>
        `${22 + (i * 276) / Math.max(1, grades.length - 1)},${120 - (g.score / g.max) * 95}`,
    )
    .join(' ');
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const line = root.current?.querySelector<SVGPolylineElement>('.learning-line');
      if (!line || quietMotion()) return;
      const length = line.getTotalLength();
      gsap.fromTo(
        line,
        { strokeDasharray: length, strokeDashoffset: length },
        {
          strokeDashoffset: 0,
          duration: 1.1,
          ease: 'power2.inOut',
          clearProps: 'stroke-dasharray,stroke-dashoffset',
        },
      );
      gsap.fromTo(
        '.learning-point',
        { scale: 0, transformOrigin: 'center' },
        { scale: 1, duration: 0.4, stagger: 0.04, ease: 'back.out(1.5)', delay: 0.3 },
      );
    }, root);
    return () => ctx.revert();
  }, [subject, data.student?.id, grades.length]);
  return (
    <div ref={root}>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">
          {ar ? 'نفهم التقدّم، ونحتفي بالخطوات' : 'PROGRESS, ONE STEP AT A TIME'}
        </div>
        <h1>
          {ar ? 'العلامات' : 'Grades'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {ar
            ? `رحلة ${data.student?.name.split(' ')[0] || 'طالبك'}، أوضح من مجرد أرقام.`
            : 'A learning journey, beyond the numbers.'}
        </p>
      </div>
      <div className="academic-filter" data-reveal>
        <span>
          <TrendingUp size={16} />
          {ar ? 'نظرة على التعلّم' : 'Learning overview'}
        </span>
        <label className="sr-only" htmlFor="grade-subject">
          {ar ? 'تصفية حسب المادة' : 'Filter by subject'}
        </label>
        <select
          id="grade-subject"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setSelected(null);
          }}
        >
          <option value="all">{ar ? 'جميع المواد' : 'All subjects'}</option>
          {[...new Set(published.map((g) => g.subject))].map((s) => (
            <option key={s} value={s}>
              {tr(s)}
            </option>
          ))}
        </select>
      </div>
      <section className="learning-overview" data-reveal>
        <div className="card-top">
          <span className="eyebrow">
            {ar ? 'متوسط العلامات المنشورة' : 'PUBLISHED GRADE AVERAGE'}
          </span>
          <span className="metric-badge">
            <ShieldCheck size={12} />
            {ar ? 'من سجلات المدرسة' : 'School records'}
          </span>
        </div>
        <div className="learning-average">
          {average ?? '—'}
          <small>{average !== null ? '٪' : ''}</small>
        </div>
        <p>
          {ar
            ? `${grades.length} علامات منشورة${subject === 'all' ? ' في المواد المختلفة' : ''}`
            : `${grades.length} published records`}
        </p>
        {grades.length > 1 ? (
          <svg
            className="learning-chart"
            viewBox="0 0 320 155"
            aria-label={ar ? 'تطور العلامات حسب التاريخ' : 'Grades in chronological order'}
            role="img"
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#6f9ddd" stopOpacity=".22" />
                <stop offset="1" stopColor="#6f9ddd" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[25, 70, 115].map((y) => (
              <path key={y} d={`M15 ${y}H308`} stroke="var(--line)" strokeDasharray="3 5" />
            ))}
            <polygon points={`22,146 ${points} 298,146`} fill={`url(#${gradient})`} />
            <polyline
              className="learning-line"
              points={points}
              fill="none"
              stroke="#719edf"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {grades.map((g, i) => (
              <g
                key={g.id}
                role="button"
                tabIndex={0}
                aria-label={`${g.subject} ${g.score} ${ar ? 'من' : 'out of'} ${g.max}`}
                onClick={() => setSelected(g.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(g.id);
                  }
                }}
              >
                <circle
                  cx={22 + (i * 276) / Math.max(1, grades.length - 1)}
                  cy={120 - (g.score / g.max) * 95}
                  r="15"
                  fill="transparent"
                />
                <circle
                  className="learning-point"
                  cx={22 + (i * 276) / Math.max(1, grades.length - 1)}
                  cy={120 - (g.score / g.max) * 95}
                  r={active?.id === g.id ? 5 : 3.5}
                  fill={active?.id === g.id ? '#447fd5' : '#a2bde5'}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              </g>
            ))}
          </svg>
        ) : (
          <div className="chart-waiting">
            <TrendingUp size={28} />
            <p>
              {ar
                ? 'يتّضح المسار مع نشر المزيد من العلامات.'
                : 'Your chart grows as grades are published.'}
            </p>
          </div>
        )}
        {active && (
          <div className="selected-milestone">
            <span>
              {tr(active.subject)} <small>· {active.title}</small>
            </span>
            <strong>
              {active.score}
              <small> / {active.max}</small>
            </strong>
          </div>
        )}
        <div className="chart-explanation">
          {ar
            ? 'اضغط على أي نقطة لاستكشاف العلامة. تُعرض العلامات المنشورة فقط.'
            : 'Select a point to explore. Only published grades are included.'}
        </div>
      </section>
      <Section title={ar ? 'كل خطوة في رحلته' : 'Every step along the way'} />
      {grades.length ? (
        grades
          .slice()
          .reverse()
          .map((g) => (
            <button
              className={`milestone-row ${selected === g.id ? 'selected' : ''}`}
              key={g.id}
              onClick={() => setSelected(g.id)}
            >
              <span className="subject-icon blue">
                <BookOpen size={18} />
              </span>
              <span className="row-copy">
                <strong>{tr(g.subject)}</strong>
                <small>
                  {g.title} ·{' '}
                  {new Date(`${g.date}T12:00:00Z`).toLocaleDateString(ar ? 'ar-JO' : 'en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </small>
              </span>
              <span className="grade-score">
                {g.score}
                <small>/{g.max}</small>
              </span>
            </button>
          ))
      ) : (
        <Empty
          title={ar ? 'رحلته تبدأ هنا' : 'Their journey starts here'}
          detail={
            ar
              ? 'تظهر العلامات بعد أن تنشرها المدرسة.'
              : 'Grades appear when the school publishes them.'
          }
        />
      )}
      <div className="progress-footnote">
        <Sparkles size={14} />
        {ar
          ? 'الأرقام جزء من الحكاية، وليست الحكاية كلها.'
          : 'Numbers are part of the story, never the whole story.'}
      </div>
    </div>
  );
}
export function AttendanceScreen({ data, lang }: { data: State; lang: Language }) {
  const [month, setMonth] = useState('all');
  const [filter, setFilter] = useState('all');
  const root = useRef<HTMLDivElement>(null);
  const ar = lang === 'ar';
  const months = [...new Set(data.attendance.map((a) => a.date.slice(0, 7)))].sort().reverse();
  const records = data.attendance.filter((a) => month === 'all' || a.date.startsWith(month));
  const count = (status: string) => records.filter((a) => a.status === status).length;
  const rate = records.length
    ? Math.round(((count('present') + count('late')) / records.length) * 100)
    : null;
  const filtered = records.filter((a) => filter === 'all' || a.status === filter);
  const incidents = data.incidents.filter((i) => i.status !== 'resolved');
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (quietMotion()) return;
      gsap.fromTo(
        '.attendance-arc',
        { strokeDasharray: '0 100' },
        { strokeDasharray: `${rate ?? 0} 100`, duration: 1.2, ease: 'power3.out' },
      );
    }, root);
    return () => ctx.revert();
  }, [rate, month, data.student?.id]);
  return (
    <div ref={root}>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">
          {ar ? 'حضور نطمئن إليه، ومتابعة باهتمام' : 'PRESENCE, WITH PEACE OF MIND'}
        </div>
        <h1>
          {ar ? 'الحضور والغياب' : 'Attendance'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {ar
            ? 'كل حصة مؤكدة، وكل متابعة في مكانها.'
            : 'Every recorded lesson. Every update, together.'}
        </p>
      </div>
      <div className="academic-filter" data-reveal>
        <span>
          <CalendarIcon />
          {ar ? 'سجل الحضور' : 'Attendance records'}
        </span>
        <label className="sr-only" htmlFor="attendance-month">
          {ar ? 'تصفية حسب الشهر' : 'Filter by month'}
        </label>
        <select id="attendance-month" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">{ar ? 'كل الفترات' : 'All periods'}</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Date(`${m}-15T12:00:00Z`).toLocaleDateString(ar ? 'ar-JO' : 'en-GB', {
                month: 'long',
                year: 'numeric',
              })}
            </option>
          ))}
        </select>
      </div>
      <section className="attendance-overview" data-reveal>
        <div className="attendance-ring">
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <circle className="attendance-track" cx="90" cy="90" r="72" />
            <circle
              className="attendance-arc"
              cx="90"
              cy="90"
              r="72"
              pathLength="100"
              strokeDasharray={`${rate ?? 0} 100`}
              transform="rotate(-90 90 90)"
            />
          </svg>
          <span>
            <strong>{rate === null ? '—' : `${rate}٪`}</strong>
            <small>{ar ? 'نسبة الحضور' : 'Attendance rate'}</small>
          </span>
          <i>
            <CheckCheck size={16} />
          </i>
        </div>
        <h2>
          {rate === null
            ? ar
              ? 'بانتظار أول تأكيد'
              : 'Waiting for the first check'
            : ar
              ? 'كل يوم، أقرب إلى التعلّم.'
              : 'A little closer to learning, every day.'}
        </h2>
        <p>
          {records.length
            ? ar
              ? `${records.length} حصص مسجّلة · تشمل النسبة الحضور والتأخر`
              : `${records.length} recorded lessons · present and late count as attended`
            : ar
              ? 'لا يعني غياب السجل أن الطالب غائب. تظهر الحالات بعد تسجيل المدرسة لها.'
              : 'An unrecorded check does not mean absence. Status appears after the school records it.'}
        </p>
        <div className="attendance-counts">
          {['present', 'absent', 'late', 'excused'].map((status) => (
            <button
              key={status}
              className={`attendance-count count-${status} ${filter === status ? 'selected' : ''}`}
              onClick={() => setFilter(filter === status ? 'all' : status)}
              aria-pressed={filter === status}
            >
              <i />
              <strong>{count(status)}</strong>
              <span>{tr(status)}</span>
            </button>
          ))}
        </div>
      </section>
      {incidents.map((i) => (
        <div className="attendance-alert" key={i.id} data-reveal>
          <ShieldCheck size={19} />
          <div>
            <h3>{ar ? 'المدرسة تتابع الحالة' : 'The school is following up'}</h3>
            <p>{i.detail}</p>
            <small>
              {ar
                ? 'الغياب غير المتوقع لا يؤكد مغادرة المدرسة.'
                : 'An unexpected absence does not confirm departure.'}
            </small>
          </div>
        </div>
      ))}
      <Section
        title={ar ? 'الحصص المسجّلة' : 'Recorded lessons'}
        action={filter !== 'all' ? (ar ? 'عرض الكل' : 'Show all') : undefined}
        onAction={() => setFilter('all')}
      />
      {filtered.length ? (
        filtered.map((a) => (
          <div className="attendance-record" key={a.id}>
            <span className={`attendance-symbol count-${a.status}`}>
              {a.status === 'late' ? <Clock size={17} /> : <CheckCheck size={18} />}
            </span>
            <span className="row-copy">
              <strong>{tr(a.subject)}</strong>
              <small>
                {new Date(`${a.date}T12:00:00Z`).toLocaleDateString(ar ? 'ar-JO' : 'en-GB', {
                  day: 'numeric',
                  month: 'long',
                })}{' '}
                · {a.start}
              </small>
            </span>
            <span className={`record-status status-${a.status}`}>{tr(a.status)}</span>
          </div>
        ))
      ) : (
        <Empty
          title={ar ? 'لا توجد سجلات في هذه الفترة' : 'No records in this period'}
          detail={
            ar
              ? 'ستجد هنا الحضور والغياب كما تسجّله المدرسة، دون افتراضات.'
              : 'Recorded school attendance appears here, without assumptions.'
          }
        />
      )}
      <p className="progress-footnote">
        <ShieldCheck size={13} />
        {ar
          ? 'كل حالة مصدرها سجل فعلي في المدرسة.'
          : 'Every status comes from an actual school record.'}
      </p>
    </div>
  );
}
function CalendarIcon() {
  return <ShieldCheck size={16} />;
}
