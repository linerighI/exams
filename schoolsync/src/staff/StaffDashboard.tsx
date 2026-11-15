/**
 * Staff `Dashboard` (`الرئيسية`) Live Command Center: features the functional
 * Blue Orb school pulse, 4-tile KPI strip, instant 1-tap attendance roll-call
 * strip, active classes canvas grid, and live Jordanian timetable overview.
 */
import { useMemo, useRef } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, Check, CheckCircle2, GraduationCap, ShieldCheck, Users, X } from 'lucide-react';
import { pulseToggle } from '../animation';
import { StudentAvatar } from '../components/StudentAvatar';
import { isManagerRole } from '../experience';
import type { Language } from '../i18n';
import { formatClock, liveDayPulse, weekdayOfDate } from '../jordanTime';
import { DayPulse } from '../Orb';
import { AnimatedProgressBar, CountValue, WinButton, WinExpander, animateSuccessFlash, useStaggerGrid } from '../schoolsync-ui';
import { tr } from '../translations';
import type { State, Student } from '../types';
import { Empty, Section } from '../ui';

export function StaffDashboard({
  data,
  lang,
  busy: _busy = false,
  mutate,
  go,
  onOpenProfile,
  onOpenSection,
}: {
  data: State;
  lang: Language;
  busy?: boolean;
  mutate?: (url: string, body: unknown, success?: string) => Promise<boolean>;
  go: (tab: string) => void;
  onOpenProfile?: (studentId: string) => void;
  onOpenSection: (section: string) => void;
}) {
  const ar = lang === 'ar';
  const manager = isManagerRole(data.user.role);
  const lessonsAll = data.schoolWorkspace?.lessons || [];
  const weekday = weekdayOfDate(data.date);
  const todayLessons = lessonsAll
    .filter((l) => l.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start));
  const pulse = liveDayPulse(data, todayLessons);

  const sectionNames = useMemo(() => {
    const seen = new Set(data.classes.map((c) => c.name));
    for (const s of data.students) if (s.section) seen.add(s.section);
    return [...seen];
  }, [data.classes, data.students]);

  const classCards = sectionNames.map((name) => {
    const meta = data.classes.find((c) => c.name === name);
    const enrolled = data.students.filter((s) => s.section === name);
    const absent = enrolled.filter((s) => s.today_status === 'absent').length;
    const present = Math.max(0, enrolled.length - absent);
    const pct = enrolled.length ? Math.round((present / enrolled.length) * 100) : 100;
    const lessonsCount = todayLessons.filter((l) => l.section === name).length;
    return { name, location: meta?.location || meta?.room || '', total: enrolled.length, present, pct, lessonsCount };
  });

  const absentStudents = data.students.filter((s) => s.today_status === 'absent');
  const absentTotal = absentStudents.length;
  const totalStudents = data.students.length;
  const attendancePct = totalStudents ? Math.round(((totalStudents - absentTotal) / totalStudents) * 100) : 100;
  // Preserve stable roster order so toggling attendance never shifts rows under the user's cursor.
  const quickRoster = data.students.slice(0, 6);

  const dashRef = useRef<HTMLDivElement>(null);
  useStaggerGrid(dashRef, '[data-stagger]', [data.date, classCards.length, todayLessons.length]);

  const quickToggle = async (e: React.MouseEvent<HTMLButtonElement>, s: Student) => {
    e.stopPropagation();
    if (!mutate) return;
    pulseToggle(e.currentTarget);
    animateSuccessFlash(e.currentTarget.closest<HTMLElement>('.quick-student-row'));
    const nextStatus = s.today_status === 'absent' ? 'present' : 'absent';
    await mutate(
      '/attendance/quick',
      { studentId: s.id, status: nextStatus },
      nextStatus === 'absent'
        ? ar
          ? `تم تسجيل غياب ${s.name.split(' ')[0]} وإشعار ولي الأمر فوراً`
          : `Marked ${s.name.split(' ')[0]} absent & notified parent`
        : ar
          ? `تم تسجيل حضور ${s.name.split(' ')[0]}`
          : `Marked ${s.name.split(' ')[0]} present`,
    );
  };

  return (
    <div ref={dashRef} className="staff-dashboard">
      <div className="page-intro" data-reveal>
        <div className="eyebrow">
          {data.school.name} ·{' '}
          {ar ? (data.user.role === 'admin' ? 'المدير' : data.user.role === 'assistant' ? 'مساعد المدير' : 'المعلم') : data.user.role}
        </div>
        <h1>
          {ar ? `أهلاً، ${data.user.name.split(' ')[0]}` : `Hello, ${data.user.name.split(' ')[0]}`}
          <span className="greeting-dot">.</span>
        </h1>
      </div>

      <section className="staff-hero-pulse t-surface" data-reveal>
        <div className="staff-hero-top">
          <div className="staff-hero-copy">
            <span className="live-badge">
              <i className="t-live-dot" />
              {pulse.activeSlot
                ? ar ? `الحصة ${pulse.activeSlot.periodNumber} جارية الآن` : `Period ${pulse.activeSlot.periodNumber} Live`
                : ar ? 'نبض اليوم المدرسي المباشر' : 'Live School Pulse'}
            </span>
            <h2>
              {pulse.activeLesson ? (
                `${tr(pulse.activeLesson.subject)} · ${pulse.activeLesson.section}`
              ) : (
                <>
                  {ar ? 'الدوام' : 'Hours'}{' '}
                  <bdi className="clock-token">{formatClock(data.school.start_time, lang)}</bdi> –{' '}
                  <bdi className="clock-token">{formatClock(pulse.endStr, lang)}</bdi>
                </>
              )}
            </h2>
            <p>
              {ar
                ? `نسبة الحضور العام اليوم ${attendancePct}٪ · ${totalStudents - absentTotal} حاضر من ${totalStudents}`
                : `${attendancePct}% attendance today · ${totalStudents - absentTotal}/${totalStudents} present`}
            </p>
            <div className="staff-hero-actions">
              <button type="button" className="hero-pill-btn primary t-surface" onClick={() => go('students')}>
                <Users size={14} />
                {ar ? 'تفقّد الطلاب اليوم' : 'Roll Call'}
              </button>
              {manager && (
                <button type="button" className="hero-pill-btn t-surface" onClick={() => go('management')}>
                  <ShieldCheck size={14} />
                  {ar ? 'لوحة الإدارة' : 'Admin Canvas'}
                </button>
              )}
            </div>
          </div>
          <DayPulse
            progress={pulse.progress}
            onClick={() => go('schedule')}
            tone={absentTotal > 0 ? 'red' : pulse.status === 'after' ? 'green' : 'blue'}
            speed={pulse.status === 'active' ? 0.72 : 0.48}
            size={86}
          />
        </div>
        <AnimatedProgressBar
          percent={attendancePct}
          tone={absentTotal > 0 ? 'warn' : 'ok'}
          label={ar ? 'نسبة الحضور العام اليوم' : 'Attendance rate today'}
        />
      </section>

      <div className="kpi-strip four" data-reveal>
        <button className="kpi-box t-surface" data-stagger onClick={() => go('students')}>
          <Users size={18} />
          <strong><CountValue value={totalStudents} /></strong>
          <small>{ar ? 'الطلاب' : 'Students'}</small>
        </button>
        <button className={`kpi-box t-surface ${absentTotal > 0 ? 'warn' : 'ok'}`} data-stagger onClick={() => go('students')}>
          <CheckCircle2 size={18} />
          <strong><CountValue value={absentTotal} /></strong>
          <small>{ar ? 'غياب اليوم' : 'Absent'}</small>
        </button>
        <button className="kpi-box t-surface" data-stagger onClick={() => go(manager ? 'management' : 'schedule')}>
          <BookOpen size={18} />
          <strong><CountValue value={sectionNames.length} /></strong>
          <small>{ar ? 'الشعب النشطة' : 'Classes'}</small>
        </button>
        <button className="kpi-box ok t-surface" data-stagger onClick={() => go(manager ? 'management' : 'schedule')}>
          <GraduationCap size={18} />
          <strong><CountValue value={data.teachers.length || 1} /></strong>
          <small>{ar ? 'الكادر مكتمل' : 'Staff'}</small>
        </button>
      </div>

      <Section title={ar ? 'الشعب النشطة ونسبة الحضور' : 'Active Classes'} action={ar ? 'كل الطلاب' : 'All students'} onAction={() => go('students')} />
      {classCards.length ? (
        <div className="active-classes-grid" data-reveal>
          {classCards.map((c) => (
            <button key={c.name} className="active-class-card t-surface" data-stagger onClick={() => onOpenSection(c.name)}>
              <div className="row-between">
                <span className="live-badge">
                  <i className="t-live-dot" /> {ar ? 'مباشر' : 'LIVE'}
                </span>
                <ArrowUpRight size={16} />
              </div>
              <h3>{c.name}</h3>
              <small>
                {c.location || (ar ? 'شعبة دراسية' : 'Section')} · {ar ? `${c.lessonsCount} حصص اليوم` : `${c.lessonsCount} periods`}
              </small>
              <div className="ratio-row">
                <span>{ar ? 'نسبة الحضور' : 'Attendance'}</span>
                <strong>{c.present}/{c.total}</strong>
              </div>
              <AnimatedProgressBar
                percent={c.pct}
                tone={c.pct < 85 ? 'warn' : 'ok'}
                label={c.name}
              />
            </button>
          ))}
        </div>
      ) : (
        <Empty title={ar ? 'لا توجد شعب مضافة بعد' : 'No classes configured yet'} detail={ar ? 'تستطيع الإدارة إضافة الشعب والطلاب من تبويب الإدارة.' : 'Add classes and students from Management.'} />
      )}

      {quickRoster.length > 0 && (
        <WinExpander
          title={ar ? 'التفقّد السريع للطلاب' : 'Quick Roll Call'}
          subtitle={absentTotal > 0 ? (ar ? `${absentTotal} غياب مسجّل اليوم` : `${absentTotal} absent today`) : (ar ? 'تبديل فوري بضغطة واحدة' : '1-tap instant switch')}
          badge={quickRoster.length}
          icon={<Users size={16} />}
          defaultOpen={absentTotal > 0}
        >
          <div className="quick-roster-strip">
            {quickRoster.map((s) => {
              const isAbsent = s.today_status === 'absent';
              const isPresent = !isAbsent;
              return (
                <div key={s.id} className={`quick-student-row t-stagger-row ${isAbsent ? 'is-absent' : ''}`} data-stagger onClick={() => onOpenProfile?.(s.id)}>
                  <div className="student-card-identity">
                    <StudentAvatar name={s.name} initialsText={s.initials} color={s.color} size="sm" />
                    <div>
                      <strong>{s.name}</strong>
                      <small>{s.section} · {isAbsent ? (ar ? 'غائب اليوم' : 'Absent') : ar ? 'حاضر' : 'Present'}</small>
                    </div>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isPresent}
                      aria-label={ar ? `تبديل حضور ${s.name}` : `Toggle attendance for ${s.name}`}
                      className={`att-toggle ${isPresent ? 'on' : 'off'}`}
                      onClick={(e) => void quickToggle(e, s)}
                    >
                      <span className="att-knob">{isPresent ? <Check size={14} /> : <X size={14} />}</span>
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <WinButton variant="subtle" onClick={() => go('students')}>
              {ar ? 'فتح كل الطلاب ←' : 'Full roster →'}
            </WinButton>
          </div>
        </WinExpander>
      )}

      <WinExpander
        title={ar ? 'الجدول اليومي المباشر' : "Today's Schedule"}
        subtitle={todayLessons.length ? (ar ? 'الحصص المجدولة لهذا اليوم' : 'Scheduled periods today') : (ar ? 'لا توجد حصص مجدولة اليوم' : 'No classes scheduled today')}
        badge={todayLessons.length}
        icon={<CalendarDays size={16} />}
        defaultOpen={todayLessons.length > 0 && todayLessons.length <= 4}
      >
        {todayLessons.length ? (
          <div className="today-periods-list">
            {todayLessons.slice(0, 6).map((l) => (
              <div className="period-row-card t-stagger-row" data-stagger key={l.id}>
                <span className="period-badge">
                  <CalendarDays size={15} />
                  {ar ? `حصة ${l.period_number || 1}` : `P${l.period_number || 1}`}
                </span>
                <div className="period-row-copy">
                  <strong>{tr(l.subject)} · {l.section}</strong>
                  <small>{l.teacher} · {l.room}</small>
                </div>
                <bdi className="period-time clock-token">{formatClock(l.start, lang)}</bdi>
              </div>
            ))}
          </div>
        ) : (
          <Empty title={ar ? 'لا توجد حصص مجدولة اليوم' : 'No lessons today'} detail={ar ? 'أضف الحصص من شاشة الجدول.' : 'Assign periods from the Schedule tab.'} />
        )}
        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <WinButton variant="subtle" onClick={() => go('schedule')}>
            {ar ? 'فتح المحرر الكامل ←' : 'Open schedule →'}
          </WinButton>
        </div>
      </WinExpander>
    </div>
  );
}
