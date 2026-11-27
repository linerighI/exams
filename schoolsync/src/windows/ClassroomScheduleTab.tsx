/**
 * Class timetable tab mounted inside ClassroomWindow: displays Sun-Thu Jordanian periods,
 * highlights the active period live, and lets managers add or remove lessons cleanly.
 */
import { useState, type FormEvent } from 'react';
import { CalendarRange, Plus, Trash2 } from 'lucide-react';
import type { Language } from '../i18n';
import {
  JORDAN_WEEKDAYS,
  buildPeriodSlots,
  formatClock,
  minutesOf,
  nowMinutesInZone,
  weekdayOfDate,
} from '../jordanTime';
import type { State } from '../types';
import { GlassSelect } from './GlassSelect';
import { UniversalScheduleWindow } from './UniversalScheduleWindow';

interface ClassroomScheduleTabProps {
  className: string;
  roomLabel: string;
  data: State;
  lang: Language;
  manager: boolean;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Weekly timetable view & inline lesson creator for a selected classroom. */
export function ClassroomScheduleTab({
  className,
  roomLabel,
  data,
  lang,
  manager,
  busy,
  mutate,
}: ClassroomScheduleTabProps) {
  const todayWd = weekdayOfDate(data.date);
  const [weekday, setWeekday] = useState(todayWd >= 0 && todayWd <= 4 ? todayWd : 0);
  const [adding, setAdding] = useState(false);
  const [universalOpen, setUniversalOpen] = useState(false);

  const slots = buildPeriodSlots(data.school);
  const [periodNumber, setPeriodNumber] = useState(1);
  const [teacherId, setTeacherId] = useState(
    data.teachers.find((t) => t.classes.includes(className))?.id || data.teachers[0]?.id || '',
  );
  const [subject, setSubject] = useState(data.subjects[0]?.name || 'الرياضيات');

  const allLessons = data.schoolWorkspace?.lessons || data.lessons || [];
  const dayLessons = allLessons
    .filter((l) => l.section === className && l.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start));

  const nowMin = nowMinutesInZone(data.school.timezone);
  const isToday = weekday === todayWd;

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    const ok = await mutate(
      '/lessons',
      {
        section: className,
        teacherId,
        subject,
        room: roomLabel || className,
        weekday,
        periodNumber,
        color: 'blue',
      },
      lang === 'ar' ? 'تمت إضافة الحصة بنجاح' : 'Lesson added',
    );
    if (ok) setAdding(false);
  };

  return (
    <div className="sp-tab-pane">
      <div className="sp-weekday-pills">
        {JORDAN_WEEKDAYS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={weekday === d.id ? 'is-active' : ''}
            onClick={() => setWeekday(d.id)}
          >
            {lang === 'ar' ? d.ar : d.en}
          </button>
        ))}
      </div>

      <div className="sp-list-stack">
        {dayLessons.length === 0 ? (
          <p className="sp-empty-note">
            {lang === 'ar' ? 'لا توجد حصص مجدولة في هذا اليوم.' : 'No lessons on this day.'}
          </p>
        ) : (
          dayLessons.map((l) => {
            const activeNow =
              isToday && minutesOf(l.start) <= nowMin && minutesOf(l.end) > nowMin;
            return (
              <div key={l.id} className={`sp-lesson-card ${activeNow ? 'is-live' : ''}`}>
                <div className="sp-lesson-meta">
                  <strong>
                    {l.subject}
                    {activeNow && (
                      <span className="sp-live-chip">
                        {lang === 'ar' ? 'الآن' : 'LIVE'}
                      </span>
                    )}
                  </strong>
                  <small>
                    {l.teacher} · {formatClock(l.start, lang)} – {formatClock(l.end, lang)}
                  </small>
                </div>
                {manager && (
                  <button
                    type="button"
                    className="sp-icon-btn is-danger"
                    title={lang === 'ar' ? 'حذف الحصة' : 'Delete lesson'}
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/lessons/${l.id}/delete`,
                        {},
                        lang === 'ar' ? 'تم حذف الحصة' : 'Lesson deleted',
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {manager && !adding && (
        <div className="sp-row-actions">
          <button type="button" className="sp-btn-soft" onClick={() => setAdding(true)}>
            <Plus size={14} />
            <span>{lang === 'ar' ? 'إضافة حصة في هذا اليوم' : 'Add Lesson'}</span>
          </button>
          <button type="button" className="sp-btn-primary" onClick={() => setUniversalOpen(true)}>
            <CalendarRange size={14} />
            <span>{lang === 'ar' ? 'جدول موحد للجميع' : 'Universal Schedule'}</span>
          </button>
        </div>
      )}

      {universalOpen && (
        <UniversalScheduleWindow
          data={data}
          lang={lang}
          busy={busy}
          onClose={() => setUniversalOpen(false)}
          mutate={mutate}
        />
      )}

      {manager && adding && (
        <form className="sp-inline-box" onSubmit={(e) => void handleAdd(e)}>
          <div className="sp-row-2">
            <div className="sp-field">
              <span>{lang === 'ar' ? 'الحصة' : 'Period'}</span>
              <GlassSelect
                ariaLabel={lang === 'ar' ? 'الحصة' : 'Period'}
                value={String(periodNumber)}
                options={slots.map((s) => ({
                  value: String(s.periodNumber),
                  label: `${lang === 'ar' ? s.labelAr : s.labelEn} (${s.start})`,
                }))}
                onChange={(val) => setPeriodNumber(Number(val))}
              />
            </div>
            <label className="sp-field">
              <span>{lang === 'ar' ? 'المادة' : 'Subject'}</span>
              <input
                list="sp-subjects-list"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <datalist id="sp-subjects-list">
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="sp-field">
            <span>{lang === 'ar' ? 'المعلم' : 'Teacher'}</span>
            <GlassSelect
              ariaLabel={lang === 'ar' ? 'المعلم' : 'Teacher'}
              value={teacherId}
              options={data.teachers.map((t) => ({ value: t.id, label: t.name }))}
              onChange={setTeacherId}
            />
          </div>
          <div className="sp-row-actions">
            <button type="button" className="sp-btn-ghost" onClick={() => setAdding(false)}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="sp-btn-primary" disabled={busy}>
              {lang === 'ar' ? 'حفظ الحصة' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
