/**
 * School-Wide Daily Schedule Window: opened from the right-side FloorPill schedule icon,
 * displaying all classes & periods for the selected day with live active period highlight,
 * Class Lead Teachers, and a Universal Schedule Template tab for managers.
 */
import { useEffect, useState } from 'react';
import { CalendarDays, Compass } from 'lucide-react';
import { api } from '../api';
import type { Language } from '../i18n';
import { JORDAN_WEEKDAYS, formatClock, minutesOf, nowMinutesInZone, weekdayOfDate } from '../jordanTime';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { isManagerRole, type Lesson, type State } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { SegmentedTabs } from './SegmentedTabs';
import { UniversalSchedulePanel } from './UniversalScheduleWindow';

interface OverviewResponse {
  weekday: number;
  slots: { periodNumber: number; start: string; end: string }[];
  classes: { id: string; name: string; grade_level: string; room: string }[];
  leadTeachers: Record<string, { id: string; name: string }>;
  lessons: Lesson[];
}

interface SchoolScheduleWindowProps {
  data: State;
  rooms: ResolvedSpatialRoom[];
  lang: Language;
  busy: boolean;
  onClose: () => void;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Floating school-wide daily schedule grid + universal template editor. */
export function SchoolScheduleWindow({
  data,
  rooms,
  lang,
  busy,
  onClose,
  onSelectRoom,
  mutate,
}: SchoolScheduleWindowProps) {
  const todayWd = weekdayOfDate(data.date);
  const [weekday, setWeekday] = useState(todayWd >= 0 && todayWd <= 4 ? todayWd : 0);
  const [tab, setTab] = useState<'daily' | 'universal'>('daily');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const manager = isManagerRole(data.user.role);

  useEffect(() => {
    let alive = true;
    void api<OverviewResponse>(`/schedule/overview?weekday=${weekday}`)
      .then((res) => { if (alive) setOverview(res); })
      .catch(() => { if (alive) setOverview(null); });
    return () => { alive = false; };
  }, [weekday, data.lessons.length, data.schoolWorkspace?.lessons.length]);

  const nowMin = nowMinutesInZone(data.school.timezone);
  const isToday = weekday === todayWd;

  return (
    <FloatingWindow
      id="school-daily-schedule"
      title={lang === 'ar' ? 'جدول المدرسة اليومي' : 'Daily School Schedule'}
      subtitle={
        overview
          ? lang === 'ar'
            ? `${overview.classes.length} صفاً · ${overview.lessons.length} حصة`
            : `${overview.classes.length} classes · ${overview.lessons.length} lessons`
          : undefined
      }
      dock="center"
      width={620}
      zIndex={62}
      onFocus={() => {}}
      onClose={onClose}
    >
      <div className="sp-tab-pane">
        {manager && (
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'daily', label: lang === 'ar' ? 'جدول اليوم للمدرسة' : 'School Daily Grid' },
              { id: 'universal', label: lang === 'ar' ? 'الجدول الموحد للكل' : 'Universal Template' },
            ]}
          />
        )}

        {tab === 'daily' ? (
          <>
            <div className="sp-weekday-pills">
              {JORDAN_WEEKDAYS.map((d) => (
                <button key={d.id} type="button" className={weekday === d.id ? 'is-active' : ''} onClick={() => setWeekday(d.id)}>
                  {lang === 'ar' ? d.ar : d.en}
                </button>
              ))}
            </div>

            <div className="sp-sched-grid">
              {!overview || overview.classes.length === 0 ? (
                <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد صفوف دراسية بعد' : 'No classes configured yet'}</p>
              ) : (
                overview.classes.map((cls) => {
                  const clsLessons = overview.lessons.filter((l) => l.section === cls.name);
                  const lead = overview.leadTeachers[cls.name];
                  const room = rooms.find((r) => r.className === cls.name);
                  return (
                    <div key={cls.id} className="sp-sched-class-card">
                      <div className="sp-sched-class-head">
                        <div>
                          <strong>{cls.name}</strong>
                          <small>
                            {lead
                              ? `${lang === 'ar' ? 'مربي الصف: ' : 'Lead: '}${lead.name}`
                              : lang === 'ar' ? 'بدون مربي صف' : 'No lead teacher'}
                          </small>
                        </div>
                        {room && (
                          <button type="button" className="sp-btn-soft" onClick={() => { onSelectRoom(room); onClose(); }}>
                            <Compass size={13} />
                            <span>{room.label}</span>
                          </button>
                        )}
                      </div>

                      {clsLessons.length === 0 ? (
                        <p className="sp-mini-hint">
                          <CalendarDays size={12} /> {lang === 'ar' ? 'لا توجد حصص في هذا اليوم' : 'No lessons scheduled'}
                        </p>
                      ) : (
                        <div className="sp-sched-periods">
                          {clsLessons.map((l) => {
                            const active = isToday && minutesOf(l.start) <= nowMin && minutesOf(l.end) > nowMin;
                            return (
                              <div key={l.id} className={`sp-sched-pill ${active ? 'is-live' : ''}`}>
                                <strong>{l.subject}</strong>
                                <small>{l.teacher} · {formatClock(l.start, lang)}</small>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <UniversalSchedulePanel data={data} lang={lang} busy={busy} onDone={() => setTab('daily')} mutate={mutate} />
        )}
      </div>
    </FloatingWindow>
  );
}
