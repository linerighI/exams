/**
 * Family & Student Attendance History (`الحضور والغياب`) screen with animated
 * GSAP radial ring, count-up summary tiles, filter pills, and lesson records.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { CheckCheck, Clock, ShieldCheck } from 'lucide-react';
import { gsap, quietMotion } from '../animation';
import type { Language } from '../i18n';
import { CountValue, useStaggerGrid } from '../schoolsync-ui';
import { tr } from '../translations';
import type { State } from '../types';
import { Empty, Section } from '../ui';

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
        { strokeDasharray: `${rate ?? 0} 100`, duration: 1.05, ease: 'power3.out' },
      );
    }, root);
    return () => ctx.revert();
  }, [rate, month, data.student?.id]);

  useStaggerGrid(root, '.attendance-record', [month, filter, filtered.length]);

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
          <ShieldCheck size={16} />
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
      <section className="attendance-overview t-surface" data-reveal>
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
            <strong>{rate === null ? '—' : <CountValue value={rate} suffix="٪" />}</strong>
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
              className={`attendance-count t-surface count-${status} ${filter === status ? 'selected' : ''}`}
              onClick={() => setFilter(filter === status ? 'all' : status)}
              aria-pressed={filter === status}
            >
              <i />
              <strong>
                <CountValue value={count(status)} />
              </strong>
              <span>{tr(status)}</span>
            </button>
          ))}
        </div>
      </section>
      {incidents.map((i) => (
        <div className="attendance-alert t-pop" key={i.id} data-reveal>
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
          <div className="attendance-record t-stagger-row" key={a.id}>
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
