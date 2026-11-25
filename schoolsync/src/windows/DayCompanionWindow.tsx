/**
 * Floating Day Companion window opened from the bottom-left Blue Orb (`DayPulse`):
 * visualizes live Jordanian school-day progress, current/next period, dismissal countdown,
 * and quick server connection status over the 3D viewport.
 */
import { Clock, Radio, Sparkles } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock, liveDayPulse, weekdayOfDate } from '../jordanTime';
import { DayPulse } from '../Orb';
import type { State } from '../types';
import { FloatingWindow } from './FloatingWindow';

interface DayCompanionWindowProps {
  data: State;
  lang: Language;
  offline: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onOpenConnection: () => void;
}

/** Floating Blue Orb Day Companion showing live school rhythm without leaving 3D. */
export function DayCompanionWindow({
  data,
  lang,
  offline,
  zIndex,
  onFocus,
  onClose,
  onOpenConnection,
}: DayCompanionWindowProps) {
  const ar = lang === 'ar';
  const weekday = weekdayOfDate(data.date);
  const allLessons = data.schoolWorkspace?.lessons || data.lessons || [];
  const todays = allLessons.filter((l) => l.weekday === weekday);
  const pulse = liveDayPulse(data, todays);

  const tone = offline ? 'red' : pulse.status === 'active' ? 'green' : 'blue';
  const statusLabel = (() => {
    if (pulse.status === 'active') return ar ? 'الحصة جارية الآن' : 'Class in session';
    if (pulse.status === 'break') return ar ? 'استراحة بين الحصص' : 'Break time';
    if (pulse.status === 'before') return ar ? 'قبل بداية الدوام' : 'Before school';
    if (pulse.status === 'after') return ar ? 'انتهى الدوام المدرسي' : 'School day complete';
    return ar ? 'لا توجد حصص مجدولة اليوم' : 'No lessons today';
  })();

  return (
    <FloatingWindow
      id="day-companion"
      title={ar ? 'نبض اليوم الدراسي' : 'Day Companion'}
      subtitle={data.school.name}
      dock="left"
      width={380}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-orb-dialog-stage">
        <DayPulse
          progress={pulse.progress}
          tone={tone}
          size={84}
          lang={lang}
          onClick={() => {}}
        />
        <strong>{statusLabel}</strong>
      </div>

      <div className="sp-kpi-grid">
        <div className="sp-kpi-card">
          <Clock size={14} className="is-blue" />
          <strong>{pulse.activeSlot ? (ar ? pulse.activeSlot.labelAr : pulse.activeSlot.labelEn) : '—'}</strong>
          <small>{ar ? 'الحصة الحالية' : 'Current'}</small>
        </div>
        <div className="sp-kpi-card">
          <Sparkles size={14} className="is-emerald" />
          <strong>{pulse.minutesUntilDismissal} {ar ? 'د' : 'm'}</strong>
          <small>{ar ? 'حتى نهاية الدوام' : 'To dismissal'}</small>
        </div>
      </div>

      {pulse.activeLesson && (
        <div className="sp-live-banner is-live">
          <div className="sp-live-banner-dot" />
          <div className="sp-live-banner-text">
            <strong>{pulse.activeLesson.subject} · {pulse.activeLesson.section}</strong>
            <small>
              {pulse.activeLesson.teacher} · {formatClock(pulse.activeLesson.start, lang)} – {formatClock(pulse.activeLesson.end, lang)}
            </small>
          </div>
        </div>
      )}

      {!pulse.activeLesson && pulse.nextLesson && (
        <div className="sp-info-row">
          <div>
            <strong>{ar ? 'الحصة القادمة:' : 'Up next:'} {pulse.nextLesson.subject}</strong>
            <small>{pulse.nextLesson.teacher} · {formatClock(pulse.nextLesson.start, lang)}</small>
          </div>
        </div>
      )}

      <button type="button" className="sp-btn-soft" onClick={onOpenConnection}>
        <Radio size={14} />
        <span>{ar ? 'حالة اتصال الخادم والنفق السحابي' : 'Server & Cloud Link Status'}</span>
      </button>
    </FloatingWindow>
  );
}
