/**
 * Master School Schedule Matrix Grid: supports Horizontal (Classes x Periods) and
 * Transposed (Periods x Classes) views, live period glow, canceled X overlay,
 * absent-teacher warnings, per-column Start All, and per-class absence optimizer.
 */
import { Play, Plus, Radio, Sparkles, X } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock } from '../jordanTime';
import type { ScheduleLessonItem, ScheduleOverview } from './scheduleTypes';

interface ScheduleGridProps {
  overview: ScheduleOverview;
  isTransposed: boolean;
  isToday: boolean;
  autoActivePeriod: number | null;
  swapSource: { section: string; periodNumber: number; lessonId?: string } | null;
  manager: boolean;
  lang: Language;
  onStartPeriod: (periodNumber: number) => void;
  onOptimizeSection: (section: string) => void;
  onCellClick: (section: string, periodNumber: number, lesson?: ScheduleLessonItem) => void;
}

const COLOR_BG: Record<string, string> = {
  blue: 'rgba(0, 122, 255, 0.13)',
  peach: 'rgba(255, 149, 0, 0.14)',
  mint: 'rgba(52, 199, 89, 0.14)',
  lilac: 'rgba(175, 82, 222, 0.14)',
  pink: 'rgba(255, 45, 85, 0.13)',
  yellow: 'rgba(250, 204, 21, 0.18)',
};

/** Renders the interactive school-wide timetable matrix. */
export function ScheduleGrid({
  overview,
  isTransposed,
  isToday,
  autoActivePeriod,
  swapSource,
  manager,
  lang,
  onStartPeriod,
  onOptimizeSection,
  onCellClick,
}: ScheduleGridProps) {
  const { slots, classes, lessons, leadTeachers, school } = overview;
  const livePeriod =
    school.schedule_mode === 'auto'
      ? isToday ? autoActivePeriod : null
      : school.active_period;

  const findLesson = (sec: string, pNum: number) =>
    lessons.find((l) => l.section === sec && (l.period_number || 1) === pNum);

  const renderCell = (sec: string, pNum: number) => {
    const l = findLesson(sec, pNum);
    const isCanceled = l?.status === 'canceled';
    const isLive = Boolean(l && !isCanceled && livePeriod === pNum);
    const isSwapSrc = swapSource?.section === sec && swapSource?.periodNumber === pNum;
    const isAbsent = Boolean(l?.teacher_absent);

    return (
      <div
        key={`${sec}-${pNum}`}
        className={`sp-ms-cell ${manager ? 'is-editable' : ''} ${isLive ? 'is-live' : ''} ${isSwapSrc ? 'is-swap-src' : ''} ${swapSource && !isSwapSrc ? 'is-swap-tgt' : ''}`}
        onClick={() => manager && onCellClick(sec, pNum, l)}
      >
        {l ? (
          <div
            className={`sp-ms-card ${isCanceled ? 'is-canceled' : ''} ${isAbsent ? 'is-absent' : ''}`}
            style={{ background: isCanceled ? undefined : COLOR_BG[l.color || 'blue'] || COLOR_BG.blue }}
          >
            {isCanceled && (
              <div className="sp-ms-cancel-x"><X size={28} strokeWidth={2.5} /></div>
            )}
            {isLive && (
              <span className="sp-ms-live-tag"><Radio size={10} /> {lang === 'ar' ? 'مباشر' : 'LIVE'}</span>
            )}
            <strong className="sp-ms-subj">{l.subject}</strong>
            <div className="sp-ms-teacher">
              <span className="sp-ms-avatar">{l.teacher.slice(0, 2)}</span>
              <span>{l.teacher}</span>
              {isAbsent && <em>{lang === 'ar' ? 'غائب' : 'OFF'}</em>}
            </div>
          </div>
        ) : (
          manager && <div className="sp-ms-empty"><Plus size={15} /></div>
        )}
      </div>
    );
  };

  if (!isTransposed) {
    return (
      <div className="sp-ms-scroll">
        <div className="sp-ms-table">
          <div className="sp-ms-row is-head">
            <div className="sp-ms-corner">{lang === 'ar' ? 'الشعب / الصفوف' : 'Classes'}</div>
            {slots.map((s) => (
              <div key={s.periodNumber} className={`sp-ms-colhead ${livePeriod === s.periodNumber ? 'is-live' : ''}`}>
                <strong>{lang === 'ar' ? `حصة ${s.periodNumber}` : `Period ${s.periodNumber}`}</strong>
                <small>{formatClock(s.start, lang)} – {formatClock(s.end, lang)}</small>
                {manager && school.schedule_mode === 'manual' && (
                  <button type="button" className="sp-ms-start-btn" onClick={() => onStartPeriod(s.periodNumber)}>
                    <Play size={10} />
                    <span>{lang === 'ar' ? 'بدء الكل' : 'Start All'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {classes.map((cls) => {
            const lead = leadTeachers[cls.name];
            return (
              <div key={cls.id} className="sp-ms-row">
                <div className="sp-ms-rowhead">
                  <div>
                    <strong>{cls.name}</strong>
                    <small>{lead ? `${lang === 'ar' ? 'مربي: ' : 'Lead: '}${lead.name}` : cls.grade_level || '—'}</small>
                  </div>
                  {manager && (
                    <button
                      type="button"
                      className="sp-icon-btn"
                      title={lang === 'ar' ? 'ترتيب الغيابات تلقائياً' : 'Optimize Absences'}
                      onClick={() => onOptimizeSection(cls.name)}
                    >
                      <Sparkles size={13} />
                    </button>
                  )}
                </div>
                {slots.map((s) => renderCell(cls.name, s.periodNumber))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="sp-ms-scroll">
      <div className="sp-ms-table">
        <div className="sp-ms-row is-head">
          <div className="sp-ms-corner">{lang === 'ar' ? 'الحصص \\ الصفوف' : 'Periods \\ Classes'}</div>
          {classes.map((cls) => (
            <div key={cls.id} className="sp-ms-colhead">
              <strong>{cls.name}</strong>
              <small>{leadTeachers[cls.name]?.name || cls.grade_level || '—'}</small>
            </div>
          ))}
        </div>
        {slots.map((s) => (
          <div key={s.periodNumber} className="sp-ms-row">
            <div className={`sp-ms-rowhead ${livePeriod === s.periodNumber ? 'is-live' : ''}`}>
              <div>
                <strong>{lang === 'ar' ? `حصة ${s.periodNumber}` : `Period ${s.periodNumber}`}</strong>
                <small>{formatClock(s.start, lang)} – {formatClock(s.end, lang)}</small>
              </div>
              {manager && school.schedule_mode === 'manual' && (
                <button type="button" className="sp-icon-btn" onClick={() => onStartPeriod(s.periodNumber)} title={lang === 'ar' ? 'بدء الكل' : 'Start All'}>
                  <Play size={12} />
                </button>
              )}
            </div>
            {classes.map((cls) => renderCell(cls.name, s.periodNumber))}
          </div>
        ))}
      </div>
    </div>
  );
}
