/**
 * Authenticated view router for SchoolSync: builds role-filtered bottom
 * navigation items and mounts the active Family or Staff workspace screen.
 */
import {
  Bell,
  CalendarDays,
  Check,
  House,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { AlertsView } from './AlertsView';
import { SettingsView } from './SettingsView';
import { HomeworkScreen } from '../family/HomeworkScreen';
import { ScheduleScreen } from '../family/ScheduleScreen';
import { TodayScreen } from '../family/TodayScreen';
import { words, type Language } from '../i18n';
import { AttendanceScreen, GradesScreen } from '../Progress';
import { AdminHub } from '../staff/AdminHub';
import { ScheduleManager } from '../staff/ScheduleManager';
import { StaffDashboard } from '../staff/StaffDashboard';
import { StudentProfile } from '../staff/StudentProfile';
import { StudentsScreen } from '../staff/StudentsScreen';
import type { Homework, LayoutMode, Lesson, State } from '../types';

export function buildBottomNav(lang: Language, staff: boolean, manager: boolean) {
  const t = words[lang];
  if (staff) {
    return [
      { id: 'dashboard', label: lang === 'ar' ? 'الرئيسية' : 'Home', icon: House },
      { id: 'students', label: t.students, icon: Users },
      { id: 'schedule', label: t.schedule, icon: CalendarDays },
      manager
        ? { id: 'management', label: lang === 'ar' ? 'الإدارة' : 'Admin', icon: ShieldCheck }
        : { id: 'alerts', label: t.alerts, icon: Bell },
    ];
  }
  return [
    { id: 'today', label: t.today, icon: House },
    { id: 'schedule', label: t.schedule, icon: CalendarDays },
    { id: 'grades', label: lang === 'ar' ? 'العلامات' : 'Grades', icon: TrendingUp },
    { id: 'attendance', label: lang === 'ar' ? 'الحضور' : 'Attendance', icon: Check },
    { id: 'alerts', label: t.alerts, icon: Bell },
  ];
}

export function AppMainViews({
  view,
  data,
  lang,
  staff,
  manager,
  busy,
  dark,
  setDark,
  layoutMode,
  setLayoutMode,
  setLang,
  studentFilter,
  setStudentFilter,
  go,
  openSheet,
  openWork,
  openLesson,
  openStudentProfile,
  openFamilyPreview,
  mutate,
  onLogout,
}: {
  view: string;
  data: State;
  lang: Language;
  staff: boolean;
  manager: boolean;
  busy: boolean;
  dark: boolean;
  setDark: (v: boolean) => void;
  layoutMode: LayoutMode;
  setLayoutMode: (m: LayoutMode) => void;
  setLang: (v: Language) => void;
  studentFilter: string;
  setStudentFilter: (v: string) => void;
  go: (tab: string) => void;
  openSheet: (sheet: string) => void;
  openWork: (work: Homework) => void;
  openLesson: (lesson: Lesson) => void;
  openStudentProfile: (id: string) => void;
  openFamilyPreview: (id: string) => void;
  mutate: (path: string, body: unknown, success?: string) => Promise<boolean>;
  onLogout: () => Promise<void>;
}) {
  const familyProps = {
    data,
    lang,
    go,
    openWork,
    openLesson,
    openFocus: () => openSheet('focus'),
    openNotice: () => openSheet('notices'),
    openCompanion: () => openSheet('companion'),
  };

  return (
    <>
      {!staff && view === 'today' && <TodayScreen {...familyProps} />}
      {!staff && view === 'schedule' && <ScheduleScreen data={data} lang={lang} openLesson={openLesson} />}
      {!staff && view === 'homework' && <HomeworkScreen {...familyProps} />}
      {!staff && view === 'grades' && <GradesScreen data={data} lang={lang} />}
      {!staff && view === 'attendance' && <AttendanceScreen data={data} lang={lang} />}
      {!staff && view === 'notes' && (
        <div className="timeline-cards" data-reveal>
          {data.notes.map((n) => (
            <article className="journal-note" key={n.id}>
              <Sparkles size={18} />
              <p>{n.content}</p>
              <strong>{n.author}</strong>
              <small>{n.created.slice(0, 10)}</small>
            </article>
          ))}
        </div>
      )}

      {view === 'alerts' && <AlertsView data={data} lang={lang} mutate={mutate} busy={busy} />}

      {staff && view === 'dashboard' && (
        <StaffDashboard
          data={data}
          lang={lang}
          busy={busy}
          mutate={mutate}
          go={go}
          onOpenProfile={openStudentProfile}
          onOpenSection={(sec) => {
            setStudentFilter(sec);
            go('students');
          }}
        />
      )}
      {staff && view === 'students' && (
        <StudentsScreen
          data={data}
          lang={lang}
          initialSection={studentFilter}
          mutate={mutate}
          busy={busy}
          onOpenProfile={openStudentProfile}
          onPreview={openFamilyPreview}
        />
      )}
      {staff && view === 'student-profile' && (
        <StudentProfile
          data={data}
          lang={lang}
          mutate={mutate}
          busy={busy}
          onBack={() => go('students')}
          onPreview={openFamilyPreview}
        />
      )}
      {staff && view === 'schedule' && <ScheduleManager data={data} lang={lang} mutate={mutate} busy={busy} />}
      {manager && view === 'management' && <AdminHub data={data} lang={lang} mutate={mutate} busy={busy} />}

      {view === 'you' && (
        <SettingsView
          data={data}
          lang={lang}
          setLang={setLang}
          dark={dark}
          setDark={setDark}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
          busy={busy}
          mutate={mutate}
          openSheet={openSheet}
          onLogout={onLogout}
        />
      )}
    </>
  );
}
