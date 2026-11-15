/**
 * Jordanian Ministry of Education timetable and live bell-schedule calculations
 * (Sunday–Thursday workweek, Periods 1–8 with configurable duration and break).
 */
import type { Language } from './i18n';
import type { Lesson, School, State } from './types';

export interface PeriodSlot {
  periodNumber: number;
  start: string;
  end: string;
  labelAr: string;
  labelEn: string;
}

export const JORDAN_WEEKDAYS = [
  { id: 0, ar: 'الأحد', en: 'Sun' },
  { id: 1, ar: 'الإثنين', en: 'Mon' },
  { id: 2, ar: 'الثلاثاء', en: 'Tue' },
  { id: 3, ar: 'الأربعاء', en: 'Wed' },
  { id: 4, ar: 'الخميس', en: 'Thu' },
];

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatClock(hhmm: string, lang: Language): string {
  const [h24, m] = hhmm.split(':').map(Number);
  const period = lang === 'ar' ? (h24 >= 12 ? 'م' : 'ص') : h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function nowMinutesInZone(timezone: string): number {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || 'Asia/Amman',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
  return minutesOf(formatted);
}

/** Build official Period 1..N bell slots from school start_time, period_minutes, break_minutes. */
export function buildPeriodSlots(school: School): PeriodSlot[] {
  const count = Math.max(1, Math.min(10, Number(school.period_count || 8)));
  const pMin = Number(school.period_minutes || 45);
  const bMin = Number(school.break_minutes || 5);
  const startTotal = minutesOf(school.start_time || '08:00');
  return Array.from({ length: count }, (_, idx) => {
    const n = idx + 1;
    const s = startTotal + idx * (pMin + bMin);
    const e = s + pMin;
    return {
      periodNumber: n,
      start: formatMinutes(s),
      end: formatMinutes(e),
      labelAr: `حصة ${n}`,
      labelEn: `Period ${n}`,
    };
  });
}

export function weekdayOfDate(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

export function liveDayPulse(data: State, lessonsToday: Lesson[]) {
  const slots = buildPeriodSlots(data.school);
  const now = nowMinutesInZone(data.school.timezone);
  const sorted = [...lessonsToday].sort((a, b) => a.start.localeCompare(b.start));
  const startStr = sorted[0]?.start || data.school.start_time;
  const endStr = sorted.at(-1)?.end || slots.at(-1)?.end || data.school.end_time;
  const startMin = minutesOf(startStr);
  const endMin = minutesOf(endStr);

  const activeLesson = sorted.find((l) => minutesOf(l.start) <= now && minutesOf(l.end) > now) || null;
  const nextLesson = sorted.find((l) => minutesOf(l.start) > now) || null;
  const activeSlot = slots.find((s) => minutesOf(s.start) <= now && minutesOf(s.end) > now) || null;

  const progress =
    endMin > startMin ? Math.max(0, Math.min(100, ((now - startMin) / (endMin - startMin)) * 100)) : 0;

  let status: 'active' | 'before' | 'break' | 'after' | 'holiday' = 'holiday';
  if (sorted.length > 0) {
    if (now < startMin) status = 'before';
    else if (now >= endMin) status = 'after';
    else status = activeLesson ? 'active' : 'break';
  }

  return {
    slots,
    now,
    startStr,
    endStr,
    activeLesson,
    nextLesson,
    activeSlot,
    progress,
    status,
    minutesLeftInLesson: activeLesson ? Math.max(0, minutesOf(activeLesson.end) - now) : 0,
    minutesUntilDismissal: sorted.length && now < endMin ? Math.max(0, endMin - now) : 0,
  };
}
