/**
 * Upgraded Blue Orb Command Companion window: combines live Jordanian school-day pulse,
 * attendance & teacher radar summary, Quick Spatial Actions (`OrbCommandGrid`), full bell timeline,
 * and 1-click Isolated Sandbox role switcher when running in demo/sandbox mode.
 */
import { useMemo, useState } from 'react';
import { Clock, ShieldCheck, Sparkles, Users } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock, liveDayPulse, weekdayOfDate } from '../jordanTime';
import { DayPulse } from '../Orb';
import { isSchoolRole, type State } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { OrbCommandGrid, SandboxRolePanel, type OrbCompanionActions } from './OrbCommandGrid';
import { SegmentedTabs } from './SegmentedTabs';

interface DayCompanionWindowProps {
  data: State;
  lang: Language;
  offline: boolean;
  demo: boolean;
  zIndex: number;
  actions: OrbCompanionActions;
  onFocus: () => void;
  onClose: () => void;
  onOpenConnection: () => void;
}

const ROLE_AR: Record<string, string> = {
  admin: 'المدير العام',
  assistant: 'مساعد المدير',
  teacher: 'معلم',
  parent: 'ولي أمر',
  student: 'طالب',
};

/** Apple Spatial Blue Orb Command Hub: live school pulse, quick tools, timeline & sandbox roles. */
export function DayCompanionWindow({
  data,
  lang,
  offline,
  demo,
  zIndex,
  actions,
  onFocus,
  onClose,
  onOpenConnection,
}: DayCompanionWindowProps) {
  const ar = lang === 'ar';
  const [tab, setTab] = useState<'pulse' | 'timeline' | 'sandbox'>('pulse');
  const weekday = weekdayOfDate(data.date);
  const allLessons = data.schoolWorkspace?.lessons || data.lessons || [];
  const todays = useMemo(() => allLessons.filter((l) => l.weekday === weekday), [allLessons, weekday]);
  const pulse = useMemo(() => liveDayPulse(data, todays), [data, todays]);

  const presentCount = useMemo(
    () => data.students.filter((s) => s.today_status === 'present').length,
    [data.students],
  );
  const attRate = data.students.length ? Math.round((presentCount / data.students.length) * 100) : 0;
  const activeTeachers = (data.teacherPresence || []).filter(
    (t) => t.status === 'in_class' || t.status === 'on_campus',
  ).length;

  const tone = offline ? 'red' : pulse.status === 'active' ? 'green' : 'blue';
  const statusLabel = (() => {
    if (offline) return ar ? 'وضع عدم الاتصال' : 'Offline';
    if (pulse.status === 'active') return ar ? 'الحصة جارية الآن' : 'Class in session';
    if (pulse.status === 'break') return ar ? 'استراحة بين الحصص' : 'Break time';
    if (pulse.status === 'before') return ar ? 'قبل بداية الدوام' : 'Before school';
    if (pulse.status === 'after') return ar ? 'انتهى الدوام المدرسي' : 'School day complete';
    return ar ? 'لا توجد حصص مجدولة اليوم' : 'No lessons today';
  })();

  const tabs: { id: 'pulse' | 'timeline' | 'sandbox'; label: string }[] = [
    { id: 'pulse', label: ar ? 'النبض والأوامر' : 'Command Hub' },
    { id: 'timeline', label: ar ? 'توقيت الحصص' : 'Bell Slots' },
    ...(demo ? [{ id: 'sandbox' as const, label: ar ? 'تبديل الأدوار' : 'Roles' }] : []),
  ];

  return (
    <FloatingWindow
      id="day-companion"
      title={ar ? 'مساعد SchoolSync الذكي' : 'SchoolSync Companion'}
      subtitle={data.school.name}
      dock="left"
      width={424}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
      headerActions={
        demo ? (
          <span className="sp-orb-role-tag">
            <ShieldCheck size={11} style={{ marginInlineEnd: 3 }} />
            {ar ? 'تجريبي' : 'Sandbox'}
          </span>
        ) : undefined
      }
    >
      <div className="sp-orb-hero">
        <DayPulse progress={pulse.progress} tone={tone} size={62} lang={lang} compact onClick={() => {}} />
        <div className="sp-orb-hero-meta">
          <span className="sp-orb-role-tag">
            {data.user.name} · {ar ? ROLE_AR[data.user.role] || data.user.role : data.user.role}
          </span>
          <strong>{statusLabel}</strong>
          <small>
            {pulse.activeSlot
              ? `${ar ? pulse.activeSlot.labelAr : pulse.activeSlot.labelEn} · ${formatClock(pulse.activeSlot.start, lang)} – ${formatClock(pulse.activeSlot.end, lang)}`
              : `${ar ? 'نهاية الدوام بعد' : 'Dismissal in'} ${pulse.minutesUntilDismissal} ${ar ? 'د' : 'm'}`}
          </small>
        </div>
      </div>

      <SegmentedTabs value={tab} onChange={setTab} items={tabs} />

      {tab === 'pulse' && (
        <div className="sp-tab-pane">
          {isSchoolRole(data.user.role) && (
            <div className="sp-kpi-grid">
              <div className="sp-kpi-card">
                <Clock size={14} className="is-blue" />
                <strong>{pulse.activeSlot ? (ar ? pulse.activeSlot.labelAr : pulse.activeSlot.labelEn) : '—'}</strong>
                <small>{ar ? 'الحصة الحالية' : 'Period'}</small>
              </div>
              <div className="sp-kpi-card">
                <Users size={14} className="is-emerald" />
                <strong>{attRate}%</strong>
                <small>{ar ? `حضور (${presentCount}/${data.students.length})` : `Attendance (${presentCount})`}</small>
              </div>
              <div className="sp-kpi-card">
                <Sparkles size={14} className="is-blue" />
                <strong>{activeTeachers}</strong>
                <small>{ar ? 'معلم نشط' : 'Active Staff'}</small>
              </div>
            </div>
          )}

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

          <OrbCommandGrid
            data={data}
            lang={lang}
            actions={actions}
            onOpenConnection={() => {
              onClose();
              onOpenConnection();
            }}
            onCloseCompanion={onClose}
          />
        </div>
      )}

      {tab === 'timeline' && (
        <div className="sp-orb-timeline">
          {pulse.slots.map((slot) => {
            const isNow = pulse.activeSlot?.periodNumber === slot.periodNumber;
            const slotLessons = todays.filter((l) => (l.period_number || 1) === slot.periodNumber);
            return (
              <div key={slot.periodNumber} className={`sp-orb-slot ${isNow ? 'is-now' : ''}`}>
                <div>
                  <strong>{ar ? slot.labelAr : slot.labelEn}</strong>
                  <small style={{ display: 'block', color: 'var(--sp-muted)', fontSize: '0.72rem' }}>
                    {formatClock(slot.start, lang)} – {formatClock(slot.end, lang)}
                  </small>
                </div>
                <span className="sp-po-badge">
                  {slotLessons.length
                    ? ar ? `${slotLessons.length} حصة نشطة` : `${slotLessons.length} lessons`
                    : ar ? 'فراغ' : 'Open'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {demo && tab === 'sandbox' && actions.onSwitchDemoRole && (
        <SandboxRolePanel
          data={data}
          lang={lang}
          onSwitchRole={async (role) => {
            await actions.onSwitchDemoRole?.(role);
            onClose();
          }}
        />
      )}
    </FloatingWindow>
  );
}
