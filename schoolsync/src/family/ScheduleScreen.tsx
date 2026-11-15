/**
 * Parent & Student Jordanian Sunday–Thursday weekly timetable screen showing
 * Period 1..8 timing, active class countdown, breaks, and school dismissal time.
 */
import { useRef, useState } from 'react';
import { ArrowUpRight, Check, Clock, Info, MapPin } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock, JORDAN_WEEKDAYS, minutesOf, nowMinutesInZone, weekdayOfDate } from '../jordanTime';
import {
  WinButton,
  WinCommandBar,
  WinInfoBar,
  WinSideDrawer,
  useSlidingPill,
  useStaggerGrid,
} from '../schoolsync-ui';
import { tr } from '../translations';
import type { Lesson, State } from '../types';
import { Empty, initials } from '../ui';

export function ScheduleScreen({
  data,
  lang,
  openLesson,
}: {
  data: State;
  lang: Language;
  openLesson: (l: Lesson) => void;
}) {
  const ar = lang === 'ar';
  const defaultDay = weekdayOfDate(data.date);
  const [weekday, setWeekday] = useState(defaultDay <= 4 ? defaultDay : 0);
  const [infoOpen, setInfoOpen] = useState(false);
  const dayRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const now = weekday === defaultDay ? nowMinutesInZone(data.school.timezone) : -1;

  const lessons = data.lessons
    .filter((l) => l.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start));

  useSlidingPill(dayRef, 'button.selected', [weekday, ar]);
  useStaggerGrid(timelineRef, '.timeline-item', [weekday, lessons.length]);

  const endTime = lessons.at(-1)?.end || data.school.end_time;
  const breakMins = data.school.break_minutes ?? 5;

  return (
    <div className="family-schedule-screen">
      <div className="page-intro schedule-intro" data-reveal>
        <div className="eyebrow">
          {ar ? 'التوقيت المدرسي الأردني · الأحد – الخميس' : 'SUNDAY – THURSDAY SCHEDULE'}
        </div>
        <h1>
          {ar ? 'الجدول' : 'Timetable'}
          <span className="greeting-dot">.</span>
        </h1>
      </div>

      <WinCommandBar
        title={ar ? `الدوام ${formatClock(data.school.start_time, lang)} – الانصراف ${formatClock(endTime, lang)}` : `${formatClock(data.school.start_time, lang)} – Dismissal ${formatClock(endTime, lang)}`}
        subtitle={ar ? `${lessons.length} حصص اليوم · استراحة ${breakMins} دقائق` : `${lessons.length} periods · ${breakMins}m break`}
        actions={
          <WinButton variant="subtle" onClick={() => setInfoOpen(true)}>
            <Info size={15} />
            {ar ? 'تفاصيل الدوام' : 'Hours'}
          </WinButton>
        }
      />

      <WinSideDrawer
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title={ar ? 'تفاصيل الدوام المدرسي' : 'School Bell Overview'}
        subtitle={data.school.name}
      >
        <WinInfoBar
          tone="info"
          title={ar ? 'نظام الحصص اليومي' : 'Daily Bell Timing'}
          message={`${formatClock(data.school.start_time, lang)} – ${formatClock(endTime, lang)}`}
        />
        <WinInfoBar
          tone="ok"
          title={ar ? `مدة الحصة ${data.school.period_minutes ?? 45} دقيقة` : `${data.school.period_minutes ?? 45}m per period`}
          message={ar ? `الاستراحة بين الحصص ${breakMins} دقائق` : `${breakMins}m break between periods`}
        />
      </WinSideDrawer>

      <div ref={dayRef} className="schedule-day-strip t-pill-track t-pill-track-primary" data-reveal>
        {JORDAN_WEEKDAYS.map((d) => {
          const count = data.lessons.filter((l) => l.weekday === d.id).length;
          return (
            <button
              key={d.id}
              className={`day-tab-btn ${weekday === d.id ? 'selected' : ''}`}
              onClick={() => setWeekday(d.id)}
            >
              <span>{ar ? d.ar : d.en}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>

      {lessons.length ? (
        <div ref={timelineRef} className="timeline" data-reveal>
          {lessons.map((l, idx) => {
            const sMin = minutesOf(l.start);
            const eMin = minutesOf(l.end);
            const active = now >= sMin && now < eMin;
            const complete = now >= eMin;
            const periodLabel = ar ? `الحصة ${l.period_number || idx + 1}` : `Period ${l.period_number || idx + 1}`;
            return (
              <div key={l.id}>
                <div className={`timeline-item ${active ? 'current' : ''}`}>
                  <div className="time-label">
                    <strong>{formatClock(l.start, lang)}</strong>
                    <small>{formatClock(l.end, lang)}</small>
                    <i />
                  </div>
                  <button className={`schedule-card t-surface ${l.color}`} onClick={() => openLesson(l)}>
                    <div className="card-top">
                      <span className="eyebrow dark">
                        {periodLabel} {active ? (ar ? '· جارية الآن' : '· NOW') : ''}
                      </span>
                      <span>{complete ? <Check size={16} /> : <ArrowUpRight size={16} />}</span>
                    </div>
                    <h2>{tr(l.subject)}</h2>
                    <div className="tile-teacher family-teacher">
                      <span className="tile-avatar">{initials(l.teacher)}</span>
                      <span>{l.teacher}</span>
                    </div>
                    <div className="schedule-foot">
                      <span>
                        <MapPin size={13} />
                        {l.room}
                      </span>
                      <span>
                        <Clock size={13} />
                        {active
                          ? ar
                            ? `متبقي ${eMin - now} د`
                            : `${eMin - now}m left`
                          : `${eMin - sMin} ${ar ? 'د' : 'min'}`}
                      </span>
                    </div>
                  </button>
                </div>
                {idx < lessons.length - 1 && breakMins > 0 && (
                  <div className="break-divider compact">
                    <span>{ar ? `استراحة ${breakMins} د` : `${breakMins}m break`}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty
          title={ar ? 'لا توجد حصص مجدولة لهذا اليوم' : 'No classes scheduled'}
          detail={ar ? 'لم تضف الإدارة حصصاً لهذا اليوم بعد.' : 'Lessons for this day have not been posted yet.'}
        />
      )}
    </div>
  );
}
