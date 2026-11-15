/**
 * Jordanian Timetable Views for Staff:
 * 1) `grid`: Master Horizontal Class × Period 1–8 Matrix (matching reference)
 * 2) `cards`: Mobile-friendly vertical Period timeline with break indicators
 * 3) `official`: Printable Ministry-style Master Matrix Document
 */
import { useRef } from 'react';
import { Clock, MapPin, Plus, Printer, Trash2 } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock, type PeriodSlot } from '../jordanTime';
import { useStaggerGrid } from '../schoolsync-ui';
import { tr } from '../translations';
import type { Lesson, State } from '../types';
import { initials } from '../ui';

export type ScheduleViewMode = 'grid' | 'cards' | 'official';

export function ScheduleViews({
  mode,
  data,
  lang,
  manager,
  busy,
  weekdayLabel,
  sections,
  slots,
  dayLessons,
  activePeriod,
  onPickSlot,
  onDeleteLesson,
}: {
  mode: ScheduleViewMode;
  data: State;
  lang: Language;
  manager: boolean;
  busy: boolean;
  weekdayLabel: string;
  sections: string[];
  slots: PeriodSlot[];
  dayLessons: Lesson[];
  activePeriod: number | null;
  onPickSlot: (section: string, periodNumber: number) => void;
  onDeleteLesson: (lessonId: string) => void;
}) {
  const ar = lang === 'ar';
  const breakMins = data.school.break_minutes ?? 5;
  const viewsRef = useRef<HTMLDivElement>(null);
  useStaggerGrid(
    viewsRef,
    '.matrix-lesson-tile, .period-slot-card, .slot-lesson-card',
    [mode, weekdayLabel, dayLessons.length, sections.length],
  );

  const findLesson = (section: string, slot: PeriodSlot) =>
    dayLessons.find(
      (l) =>
        l.section === section &&
        (l.period_number === slot.periodNumber || (!l.period_number && l.start === slot.start)),
    );

  const renderMatrixTable = (interactive: boolean) => (
    <div className="matrix-table-scroll">
      <table className="pro-matrix-table">
        <thead>
          <tr>
            <th className="matrix-sec-col">
              <span className="matrix-col-title">{ar ? 'الشعب / الصفوف' : 'Classes'}</span>
            </th>
            {slots.map((slot) => (
              <th key={slot.periodNumber} className={activePeriod === slot.periodNumber ? 'is-now' : ''}>
                <span className="matrix-col-title">{ar ? slot.labelAr : slot.labelEn}</span>
                <span className="matrix-col-time">
                  <bdi className="clock-token">{formatClock(slot.start, lang)}</bdi> –{' '}
                  <bdi className="clock-token">{formatClock(slot.end, lang)}</bdi>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => {
            const classMeta = data.classes.find((c) => c.name === sec);
            return (
              <tr key={sec}>
                <td className="matrix-sec-col">
                  <div className="matrix-sec-inner">
                    <span className="matrix-sec-accent" aria-hidden="true" />
                    <div>
                      <strong>{sec}</strong>
                      <small>{classMeta?.location || classMeta?.room || (ar ? 'المبنى الرئيسي' : 'Main Building')}</small>
                    </div>
                  </div>
                </td>
                {slots.map((slot) => {
                  const l = findLesson(sec, slot);
                  return (
                    <td key={slot.periodNumber}>
                      {l ? (
                        <div className={`matrix-lesson-tile t-surface ${l.color}`}>
                          <div className="tile-top">
                            <strong>{tr(l.subject)}</strong>
                            {interactive && manager && (
                              <button
                                type="button"
                                className="tile-del-btn"
                                aria-label={ar ? 'حذف الحصة' : 'Delete lesson'}
                                disabled={busy}
                                onClick={() => onDeleteLesson(l.id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                          <div className="tile-teacher">
                            <span className="tile-avatar">{initials(l.teacher)}</span>
                            <span>{l.teacher}</span>
                          </div>
                        </div>
                      ) : interactive && manager ? (
                        <button
                          type="button"
                          className="matrix-empty-btn"
                          aria-label={ar ? `إضافة ${slot.labelAr} لـ ${sec}` : `Add ${slot.labelEn} for ${sec}`}
                          onClick={() => onPickSlot(sec, slot.periodNumber)}
                        >
                          <Plus size={15} />
                        </button>
                      ) : (
                        <div className="matrix-dash">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (mode === 'official') {
    return (
      <section ref={viewsRef as React.RefObject<HTMLElement>} className="official-sheet-wrap t-pop" data-reveal>
        <div className="official-sheet">
          <header className="official-sheet-head">
            <div className="official-ministry">
              <strong>{ar ? 'المملكة الأردنية الهاشمية' : 'Hashemite Kingdom of Jordan'}</strong>
              <span>{ar ? 'وزارة التربية والتعليم' : 'Ministry of Education'}</span>
              <small>{ar ? 'التوقيت المدرسي الرسمي' : 'Official School Schedule'}</small>
            </div>
            <div className="official-center">
              <h2>{ar ? 'الجدول المدرسي العام' : 'Master School Timetable'}</h2>
              <span className="official-day-pill">{weekdayLabel}</span>
            </div>
            <div className="official-school">
              <strong>{data.school.name}</strong>
              <div className="official-actions">
                <span className="official-badge">{ar ? 'وثيقة رسمية' : 'Official'}</span>
                <button type="button" className="mini-icon-btn" onClick={() => window.print()} aria-label={ar ? 'طباعة' : 'Print'}>
                  <Printer size={15} />
                </button>
              </div>
            </div>
          </header>
          {renderMatrixTable(false)}
          {data.school.duty_notes && (
            <footer className="official-foot">
              <strong>{ar ? 'أساتذة المناوبة والملاحظات:' : 'Duty & Notes:'}</strong> {data.school.duty_notes}
            </footer>
          )}
        </div>
      </section>
    );
  }

  if (mode === 'grid') {
    return (
      <section ref={viewsRef as React.RefObject<HTMLElement>} className="matrix-card-shell t-pop" data-reveal>
        {renderMatrixTable(true)}
      </section>
    );
  }

  return (
    <div ref={viewsRef} className="periods-stack" data-reveal>
      {slots.map((slot, idx) => {
        const isNow = activePeriod === slot.periodNumber;
        const slotLessons = dayLessons.filter(
          (l) => l.period_number === slot.periodNumber || (!l.period_number && l.start === slot.start),
        );
        return (
          <div key={slot.periodNumber}>
            <article className={`period-slot-card t-surface ${isNow ? 'active-slot' : ''}`}>
              <div className="period-slot-head">
                <div className="period-slot-title">
                  <span className={`period-num-badge ${isNow ? 'live' : ''}`}>
                    {ar ? slot.labelAr : slot.labelEn}
                  </span>
                  <div>
                    <strong>
                      <bdi className="clock-token">{formatClock(slot.start, lang)}</bdi> –{' '}
                      <bdi className="clock-token">{formatClock(slot.end, lang)}</bdi>
                    </strong>
                    <small>
                      {isNow
                        ? ar ? 'الحصة جارية الآن' : 'Period in progress'
                        : ar ? `${slotLessons.length} شعب مجدولة` : `${slotLessons.length} classes scheduled`}
                    </small>
                  </div>
                </div>
                {manager && (
                  <button
                    type="button"
                    className="assign-slot-btn"
                    onClick={() => onPickSlot(sections[0] || 'الصف التاسع - أ', slot.periodNumber)}
                  >
                    <Plus size={15} />
                    {ar ? 'تعيين حصة' : 'Assign'}
                  </button>
                )}
              </div>
              {slotLessons.length ? (
                <div className="slot-lessons-grid">
                  {slotLessons.map((l) => (
                    <div className={`slot-lesson-card ${l.color}`} key={l.id}>
                      <div className="slot-lesson-main">
                        <span className="slot-sec-tag">{l.section}</span>
                        <strong>{tr(l.subject)}</strong>
                        <small>
                          <Clock size={12} /> {l.teacher} · <MapPin size={12} /> {l.room}
                        </small>
                      </div>
                      {manager && (
                        <button
                          type="button"
                          className="mini-icon-btn muted"
                          aria-label={ar ? 'حذف الحصة' : 'Delete lesson'}
                          disabled={busy}
                          onClick={() => onDeleteLesson(l.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="slot-empty-row">
                  <span>{ar ? 'لا توجد حصص مسجلة في هذه الفترة' : 'No classes assigned in this period'}</span>
                </div>
              )}
            </article>
            {idx < slots.length - 1 && breakMins > 0 && (
              <div className="break-divider">
                <span>{ar ? `استراحة ${breakMins} دقائق بين الحصتين` : `${breakMins} min break`}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
