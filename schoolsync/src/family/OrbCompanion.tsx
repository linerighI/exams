/**
 * Functional Blue Orb Jordanian period and dismissal companion sheet.
 */
import { ArrowRight, Bell, BookOpen, CalendarDays, Clock, Sparkles } from 'lucide-react';
import { Orb } from '../Orb';
import type { Language } from '../i18n';
import type { Homework, State } from '../types';
import { tr } from '../translations';
import { formatClock, liveDayPulse, weekdayOfDate } from '../jordanTime';

export function OrbCompanion({
  data,
  lang,
  go,
  openWork,
  focus,
}: {
  data: State;
  lang: Language;
  go: (tab: string) => void;
  openWork: (h: Homework) => void;
  focus: () => void;
}) {
  const ar = lang === 'ar';
  const isStudent = data.user.role === 'student';
  const todayLessons = data.lessons
    .filter((l) => l.weekday === weekdayOfDate(data.date))
    .sort((a, b) => a.start.localeCompare(b.start));
  const pulse = liveDayPulse(data, todayLessons);
  const nextWork = data.homework.find((h) => !h.submission);
  const todayAbsent = data.student?.today_status === 'absent';
  const orbTone = todayAbsent ? 'red' : pulse.status === 'after' ? 'green' : 'blue';

  return (
    <div className="companion-sheet">
      <div className="companion-hero">
        <Orb size={1.08} tone={orbTone} speed={pulse.status === 'active' ? 0.72 : 0.45} />
        <div className="companion-hero-copy">
          <span className="eyebrow">
            {ar ? 'متابعة الدوام المدرسي' : 'LIVE SCHOOL DAY PULSE'}
          </span>
          <h3>
            {pulse.activeLesson
              ? ar
                ? `الحصة ${pulse.activeLesson.period_number || ''} · ${pulse.activeLesson.subject}`
                : `${pulse.activeLesson.subject} in progress`
              : pulse.nextLesson
                ? ar
                  ? `الحصة القادمة: ${pulse.nextLesson.subject}`
                  : `Up next: ${pulse.nextLesson.subject}`
                : pulse.status === 'after'
                  ? ar
                    ? 'انتهى الدوام المدرسي لهذا اليوم'
                    : 'School day finished'
                  : ar
                    ? 'لا توجد حصص مجدولة اليوم'
                    : 'No classes scheduled today'}
          </h3>
          <p>
            {pulse.activeLesson
              ? ar
                ? `متبقي ${pulse.minutesLeftInLesson} دقيقة لانتهاء الحصة (${formatClock(pulse.activeLesson.end, lang)}) · نهاية الدوام ${formatClock(pulse.endStr, lang)}`
                : `${pulse.minutesLeftInLesson} min left in lesson · Dismissal ${formatClock(pulse.endStr, lang)}`
              : todayLessons.length
                ? ar
                  ? `بداية الدوام ${formatClock(pulse.startStr, lang)} · نهاية الدوام ${formatClock(pulse.endStr, lang)}`
                  : `Starts ${formatClock(pulse.startStr, lang)} · Dismissal ${formatClock(pulse.endStr, lang)}`
                : ar
                  ? 'يمكنك مراجعة الجدول الأسبوعي أو التنبيهات.'
                  : 'Check your weekly schedule or recent school alerts.'}
          </p>
        </div>
      </div>

      <div className="companion-actions">
        <button className="companion-action-card t-surface" onClick={() => go('schedule')}>
          <span className="companion-action-lead">
            <span className="companion-icon-pill">
              <CalendarDays size={18} />
            </span>
            <span className="companion-action-copy">
              <strong>{ar ? 'جدول الحصص الكامل' : 'Full weekly schedule'}</strong>
              <small>
                {todayLessons.length
                  ? ar
                    ? `${todayLessons.length} حصص اليوم · حتى ${formatClock(pulse.endStr, lang)}`
                    : `${todayLessons.length} classes today · ends ${formatClock(pulse.endStr, lang)}`
                  : ar
                    ? 'الأحد – الخميس'
                    : 'Sun – Thu schedule'}
              </small>
            </span>
          </span>
          <ArrowRight size={17} className="companion-chevron" />
        </button>

        {nextWork && (
          <button className="companion-action-card t-surface" onClick={() => openWork(nextWork)}>
            <span className="companion-action-lead">
              <span className="companion-icon-pill">
                <BookOpen size={18} />
              </span>
              <span className="companion-action-copy">
                <strong>{nextWork.title}</strong>
                <small>
                  {tr(nextWork.subject)} · {nextWork.due}
                </small>
              </span>
            </span>
            <ArrowRight size={17} className="companion-chevron" />
          </button>
        )}

        <button className="companion-action-card t-surface" onClick={() => go('alerts')}>
          <span className="companion-action-lead">
            <span className="companion-icon-pill">
              <Bell size={18} />
            </span>
            <span className="companion-action-copy">
              <strong>{ar ? 'التنبيهات والملاحظات الفورية' : 'Alerts & teacher notes'}</strong>
              <small>
                {todayAbsent
                  ? ar
                    ? 'تم تسجيل غياب اليوم — اضغط لعرض التنبيه'
                    : 'Absence recorded today — view alert'
                  : ar
                    ? `${data.notifications.filter((n) => !n.read).length} تنبيهات جديدة`
                    : `${data.notifications.filter((n) => !n.read).length} unread alerts`}
              </small>
            </span>
          </span>
          <ArrowRight size={17} className="companion-chevron" />
        </button>

        {isStudent && (
          <button className="companion-action-card t-surface" onClick={focus}>
            <span className="companion-action-lead">
              <span className="companion-icon-pill">
                <Clock size={18} />
              </span>
              <span className="companion-action-copy">
                <strong>{ar ? 'جلسة تركيز للدراسة' : 'Start a study timer'}</strong>
                <small>{ar ? 'مؤقت مذاكرة بدون تشتيت' : 'Distraction-free study session'}</small>
              </span>
            </span>
            <Sparkles size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
