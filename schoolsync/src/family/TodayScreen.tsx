/**
 * Parent and Student `Today` (`اليوم`) screen anchored around the live Blue Orb
 * Jordanian period/dismissal tracker, daily classes, homework, and behavior notes.
 */
import { ArrowUpRight, Bell, BookOpen, CalendarDays, CheckCheck, Clock, Sun } from 'lucide-react';
import type { Language } from '../i18n';
import { words } from '../i18n';
import { formatClock, liveDayPulse, weekdayOfDate } from '../jordanTime';
import { DayPulse } from '../Orb';
import { AnimatedProgressBar, WinButton, WinExpander } from '../schoolsync-ui';
import { tr } from '../translations';
import type { Homework, Lesson, State } from '../types';
import { Empty } from '../ui';
import { TodayUpdatesExpander } from './TodayUpdatesExpander';

export interface FamilyScreenProps {
  data: State;
  lang: Language;
  go: (tab: string) => void;
  openWork: (work: Homework) => void;
  openLesson: (lesson: Lesson) => void;
  openFocus: () => void;
  openNotice: () => void;
  openCompanion: () => void;
  preview?: boolean;
}

export function TodayScreen(props: FamilyScreenProps) {
  const { data, lang, go, openWork, openLesson, openFocus, openNotice, openCompanion, preview = false } =
    props;
  const ar = lang === 'ar';
  const t = words[lang];
  const family = data.user.role === 'parent' || preview;
  const lessons = data.lessons
    .filter((l) => l.weekday === weekdayOfDate(data.date))
    .sort((a, b) => a.start.localeCompare(b.start));
  const pulse = liveDayPulse(data, lessons);
  const recorded = data.attendance.filter((a) => a.date === data.date);
  const pending = data.homework.filter((h) => !h.submission);
  const unreadAlerts = data.notifications.filter((n) => !n.read).length;
  const schoolDate = new Date(`${data.date}T12:00:00Z`);

  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">
          <span className="tiny-sun">
            <Sun size={14} />
          </span>
          {schoolDate.toLocaleDateString(ar ? 'ar-JO' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </div>
        <h1>
          {preview
            ? ar
              ? `يوم ${data.student?.name.split(' ')[0]}`
              : `${data.student?.name.split(' ')[0]}’s day`
            : `${ar ? 'أهلاً،' : 'Hey,'} ${data.user.name.split(' ')[0]}`}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {family
            ? ar
              ? `متابعة ${data.student?.name.split(' ')[0] || 'الطالب'} حسب التوقيت المدرسي.`
              : 'Live school timetable, attendance, and notes.'
            : t.hello}
        </p>
      </div>

      <section className="day-card t-surface" data-reveal>
        <div className="card-top">
          <span className="eyebrow dark">{t.day}</span>
          <span className="small-pill">
            <span className={pulse.activeLesson ? 'status-dot t-live-dot' : 'status-dot quiet'} />
            {pulse.activeLesson
              ? ar
                ? `الحصة ${pulse.activeLesson.period_number || ''} الآن`
                : 'In class now'
              : lessons.length
                ? pulse.status === 'before'
                  ? ar
                    ? 'قبل الطابور'
                    : 'Before start'
                  : ar
                    ? 'انتهى الدوام'
                    : 'Day complete'
                : ar
                  ? 'عطلة / بدون حصص'
                  : 'No lessons'}
          </span>
        </div>

        <div className="day-body">
          <div>
            <h2>
              {pulse.activeLesson
                ? pulse.activeLesson.subject
                : pulse.nextLesson
                  ? pulse.nextLesson.subject
                  : ar
                    ? 'اليوم الدراسي'
                    : 'School Day'}
            </h2>
            <p>
              {pulse.activeLesson
                ? ar
                  ? `تنتهي ${formatClock(pulse.activeLesson.end, lang)} (متبقي ${pulse.minutesLeftInLesson} د) · خروج المدرسة ${formatClock(pulse.endStr, lang)}`
                  : `Ends ${formatClock(pulse.activeLesson.end, lang)} · Dismissal ${formatClock(pulse.endStr, lang)}`
                : pulse.nextLesson
                  ? ar
                    ? `تبدأ ${formatClock(pulse.nextLesson.start, lang)} · نهاية الدوام ${formatClock(pulse.endStr, lang)}`
                    : `Starts ${formatClock(pulse.nextLesson.start, lang)} · Ends ${formatClock(pulse.endStr, lang)}`
                  : lessons.length
                    ? ar
                      ? `ينتهي الدوام ${formatClock(pulse.endStr, lang)}`
                      : `Dismissal ${formatClock(pulse.endStr, lang)}`
                    : ar
                      ? 'لا توجد حصص مجدولة اليوم'
                      : 'No classes scheduled today'}
            </p>
            <button
              className="round-link"
              aria-label={ar ? 'عرض الجدول' : 'Open schedule'}
              onClick={() => go('schedule')}
            >
              <ArrowUpRight size={22} />
            </button>
          </div>
          <DayPulse
            progress={pulse.progress}
            onClick={openCompanion}
            tone={data.student?.today_status === 'absent' ? 'red' : pulse.status === 'after' ? 'green' : 'blue'}
            speed={pulse.status === 'active' ? 0.72 : 0.48}
          />
        </div>

        <div className="day-progress">
          <div>
            <span>
              {lessons.length
                ? ar
                  ? `${Math.round(pulse.progress)}٪ من اليوم الدراسي`
                  : `${Math.round(pulse.progress)}% complete`
                : ar
                  ? 'لا توجد حصص اليوم'
                  : 'No classes today'}
            </span>
            <span>
              {ar ? `الخروج ${formatClock(pulse.endStr, lang)}` : `Ends ${formatClock(pulse.endStr, lang)}`}
            </span>
          </div>
          <AnimatedProgressBar
            percent={pulse.progress}
            tone={data.student?.today_status === 'absent' ? 'warn' : pulse.status === 'after' ? 'ok' : 'default'}
            label={ar ? 'تقدم اليوم الدراسي' : 'School day progress'}
          />
          <div className="day-foot">
            <span>
              <CheckCheck size={14} />
              {recorded.some((a) => a.status === 'absent')
                ? ar
                  ? 'تنبيه: مسجّل غياب اليوم'
                  : 'Recorded absent today'
                : recorded.length
                  ? ar
                    ? 'الحضور مسجّل اليوم'
                    : 'Attendance recorded'
                  : ar
                    ? 'بانتظار تسجيل الحضور'
                    : 'Attendance pending'}
            </span>
            <span>{data.student?.section ? `${ar ? 'الشعبة' : 'Class'} ${data.student.section}` : ''}</span>
          </div>
        </div>
      </section>

      <div className="feature-pair" data-reveal>
        <button className="mini-card lavender t-surface" data-stagger onClick={() => (family ? go('homework') : openFocus())}>
          <div className="mini-top">
            <span className="icon-tile">{family ? <BookOpen size={20} /> : <Clock size={20} />}</span>
            <ArrowUpRight size={19} />
          </div>
          <h3>{family ? (ar ? 'الواجبات' : 'Homework') : ar ? 'جلسة تركيز' : 'Focus timer'}</h3>
          <p>
            {family
              ? ar
                ? pending.length
                  ? `${pending.length} واجبات للمتابعة`
                  : 'جميع الواجبات منجزة'
                : `${pending.length} pending`
              : ar
                ? 'مذاكرة بدون تشتيت'
                : 'Quiet study session'}
          </p>
        </button>

        <button className="mini-card sky t-surface" data-stagger onClick={() => go('alerts')}>
          <div className="mini-top">
            <span className="icon-tile">
              <Bell size={20} />
            </span>
            <ArrowUpRight size={19} />
          </div>
          <h3>{ar ? 'التنبيهات الفورية' : 'School Alerts'}</h3>
          <p>
            {unreadAlerts
              ? ar
                ? `${unreadAlerts} تنبيهات جديدة`
                : `${unreadAlerts} unread updates`
              : ar
                ? 'متابعة الغياب والملاحظات'
                : 'Absence & behavior updates'}
          </p>
        </button>
      </div>

      <WinExpander
        title={t.next}
        subtitle={lessons.length ? (ar ? `${lessons.length} حصص مجدولة اليوم` : `${lessons.length} classes today`) : (ar ? 'لا توجد حصص مجدولة اليوم' : 'No classes today')}
        badge={lessons.length}
        icon={<CalendarDays size={16} />}
        defaultOpen={lessons.length > 0 && lessons.length <= 4}
      >
        {lessons.length ? (
          <div className="lesson-preview">
            {lessons.slice(0, 3).map((l) => (
              <button key={l.id} className="lesson-row t-stagger-row" data-stagger onClick={() => openLesson(l)}>
                <span className={`subject-icon ${l.color}`}>
                  <BookOpen size={20} />
                </span>
                <span className="row-copy">
                  <strong>
                    {l.period_number ? (ar ? `الحصة ${l.period_number} · ` : `P${l.period_number} · `) : ''}
                    {tr(l.subject)}
                  </strong>
                  <small>
                    {l.room} · {l.teacher}
                  </small>
                </span>
                <span className="row-time">
                  {formatClock(l.start, lang)}
                  <ArrowUpRight size={15} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty title={ar ? 'لا توجد حصص اليوم' : 'No classes today'} detail={ar ? 'يمكنك تصفح الجدول الأسبوعي للأيام الدراسية.' : 'Check weekly timetable for school days.'} />
        )}
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <WinButton variant="subtle" onClick={() => go('schedule')}>
            {ar ? 'فتح الجدول الأسبوعي ←' : 'Full schedule →'}
          </WinButton>
        </div>
      </WinExpander>

      <TodayUpdatesExpander
        data={data}
        lang={lang}
        preview={preview}
        pending={pending}
        go={go}
        openNotice={openNotice}
        openWork={openWork}
      />
    </>
  );
}
