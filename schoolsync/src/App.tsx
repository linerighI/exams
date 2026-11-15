/**
 * Root SchoolSync application shell: routes authenticated users across strictly
 * separated Family and Staff experiences and mounts mobile navigation.
 */
import { useRef, useState } from 'react';
import { Bell, Check, ChevronDown, LoaderCircle, Menu, UserRound, WifiOff } from 'lucide-react';
import { api } from './api';
import { usePressFeedback, useReveal } from './animation';
import { AppMainViews, buildBottomNav } from './components/AppMainViews';
import { AppSidebarDrawer } from './components/AppSidebarDrawer';
import { SheetHost } from './components/SheetHost';
import { isManagerRole, isSchoolRole, viewFor } from './experience';
import { FamilyChooser } from './FamilyChooser';
import { useSchoolSync } from './hooks/useSchoolSync';
import Login from './Login';
import { Navigation } from './Navigation';
import { Setup } from './Setup';
import { tr } from './translations';
import type { Homework, Lesson, State } from './types';
import { Brand, ErrorContext, Motion, initials } from './ui';

export default function App() {
  const s = useSchoolSync();
  const [sheet, setSheet] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [work, setWork] = useState<Homework | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [studentFilter, setStudentFilter] = useState('all');

  const shell = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);

  usePressFeedback(shell, `${s.auth}-${s.familyWelcome}`);
  useReveal(main, `${s.auth}-${s.tab}-${s.child}-${s.switching}`);

  const go = (next: string) => {
    s.setTab(s.data ? viewFor(s.data.user.role, next) : next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  if (s.loading) {
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" />
        <p>{tr('A calmer school day is on its way.')}</p>
      </div>
    );
  }

  if (s.setupRequired && !s.auth) {
    return (
      <Setup
        busy={s.busy}
        error={s.error}
        onSubmit={async (values) => {
          s.setBusy(true);
          s.setError('');
          try {
            await api('/setup', values);
            s.setSetupRequired(false);
            s.setChild('');
            s.setTab('dashboard');
            await s.refresh();
          } catch (e) {
            s.setError(tr((e as Error).message));
          } finally {
            s.setBusy(false);
          }
        }}
      />
    );
  }

  if (!s.auth || !s.data)
    return (
      <Login demo={s.demo} busy={s.busy} error={s.error} schoolName={s.schoolName} signIn={s.signIn} onServerChanged={s.reloadConfig} lang={s.lang} setLang={s.setLang} />
    );

  const data = s.data;
  const staff = isSchoolRole(data.user.role);
  const manager = isManagerRole(data.user.role);
  const view = viewFor(data.user.role, s.tab);
  const unread = data.notifications.filter((n) => !n.read).length;
  const nav = buildBottomNav(s.lang, staff, manager);

  const selectStudent = (id: string) => {
    s.setFamilyWelcome(false);
    setSheet('');
    if (id !== data.student?.id) {
      s.setSwitching(true);
      s.setChild(id);
    }
    go('today');
  };

  const loadStudentState = async (studentId: string, nextStep: () => void) => {
    if (studentId !== data.student?.id) {
      s.setBusy(true);
      s.setError('');
      try {
        ++s.requestNumber.current;
        const next = await api<State>(`/state?student=${encodeURIComponent(studentId)}`);
        s.setData(next);
        s.setChild(studentId);
      } catch (e) {
        s.setError(tr((e as Error).message));
        s.setBusy(false);
        return;
      }
      s.setBusy(false);
    }
    nextStep();
  };

  if (data.user.role === 'parent' && s.familyWelcome && data.students.length > 0) {
    return (
      <ErrorContext.Provider value={s.error}>
        <div className="app-shell family-entry" ref={shell}>
          <header className="app-header">
            <Brand />
            <button
              className="avatar small lilac"
              aria-label={s.lang === 'ar' ? 'فتح الملف الشخصي' : 'Open account'}
              onClick={() => {
                s.setFamilyWelcome(false);
                go('you');
              }}
            >
              {initials(data.user.name) || <UserRound size={16} />}
            </button>
          </header>
          {s.error && <p className="entry-error" role="alert">{s.error}</p>}
          <FamilyChooser data={data} lang={s.lang} onSelect={selectStudent} busy={s.switching} />
        </div>
      </ErrorContext.Provider>
    );
  }

  return (
    <ErrorContext.Provider value={s.error}>
      <div className={`app-shell ${staff ? 'staff-space' : 'family-space'}`} ref={shell}>
        <header className="app-header">
          <div className="app-header-brand-row">
            <button
              type="button"
              className="sidebar-trigger-btn"
              aria-label={s.lang === 'ar' ? 'فتح القائمة الجانبية' : 'Open sidebar menu'}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
              <span>{s.lang === 'ar' ? 'القائمة' : 'Menu'}</span>
            </button>
            <button className="brand-link-btn" onClick={() => go(staff ? 'dashboard' : 'today')}>
              <Brand />
            </button>
          </div>
          <div className="header-actions">
            <button
              className="icon-button notification-button"
              aria-label={tr('Notifications')}
              onClick={() => {
                setSheet('notifications');
                void s.mutate('/notifications/read', {}, tr('Updates marked as read'));
              }}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </button>
            <button
              className={`avatar small ${data.student?.color || 'lilac'}`}
              aria-label={s.lang === 'ar' ? 'فتح الملف الشخصي' : 'Open account'}
              onClick={() => go('you')}
            >
              {initials(data.user.name) || <UserRound size={16} />}
            </button>
          </div>
        </header>

        <div className="school-strip">
          <span>
            <span className="status-dot" />
            {data.school.name}
          </span>
          <span className="portal-context">
            {staff
              ? s.lang === 'ar'
                ? data.user.role === 'admin'
                  ? 'إدارة المدرسة · المدير'
                  : data.user.role === 'assistant'
                    ? 'إدارة المدرسة · مساعد المدير'
                    : 'مساحة المعلم'
                : 'SCHOOL SPACE'
              : s.lang === 'ar'
                ? 'مساحة العائلة'
                : 'FAMILY SPACE'}
          </span>
        </div>

        {s.offline && (
          <div className="connection-banner">
            <WifiOff size={15} />
            {tr('Offline · Showing the last loaded records')}
          </div>
        )}

        {s.error && (
          <div role="alert" className="error-banner">
            {s.error}
            <button onClick={() => { s.setError(''); void s.refresh(); }}>{tr('Retry')}</button>
          </div>
        )}

        {!staff && data.student && (
          <div className="selected-child-bar">
            <button onClick={() => setSheet('children')} aria-label={s.lang === 'ar' ? 'اختيار الطالب' : 'Choose a student'}>
              <span className={`avatar ${data.student.color || 'blue'}`}>{data.student.initials || '—'}</span>
              <span>
                <small>{s.lang === 'ar' ? 'نتابع اليوم' : 'TODAY, WE’RE FOLLOWING'}</small>
                <strong>{data.student.name}</strong>
              </span>
              <span className="child-class">{tr(data.student.section || '')}</span>
              <ChevronDown size={15} />
            </button>
          </div>
        )}

        <main ref={main} className={s.switching ? 'is-switching' : ''} aria-busy={s.switching}>
          <Motion identity={`${view}-${data.student?.id}-${studentFilter}`}>
            <AppMainViews
              view={view}
              data={data}
              lang={s.lang}
              staff={staff}
              manager={manager}
              busy={s.busy}
              dark={s.dark}
              setDark={s.setDark}
              layoutMode={s.layoutMode}
              setLayoutMode={s.setLayoutMode}
              setLang={s.setLang}
              studentFilter={studentFilter}
              setStudentFilter={setStudentFilter}
              go={go}
              openSheet={setSheet}
              openWork={(h) => { setWork(h); setSheet('work'); }}
              openLesson={(l) => { setLesson(l); setSheet('lesson'); }}
              openStudentProfile={(id) => void loadStudentState(id, () => go('student-profile'))}
              openFamilyPreview={(id) => { if (staff && !s.busy) void loadStudentState(id, () => setSheet('family-preview')); }}
              mutate={s.mutate}
              onLogout={s.logout}
            />
          </Motion>
        </main>

        <Navigation items={nav} value={view === 'student-profile' ? 'students' : view} onChange={go} />
        {s.toast && (
          <div className="toast" role="status">
            <Check size={17} />
            {s.toast}
          </div>
        )}

        <SheetHost
          sheet={sheet}
          setSheet={setSheet}
          data={data}
          lang={s.lang}
          staff={staff}
          busy={s.busy}
          switching={s.switching}
          work={work}
          setWork={setWork}
          lesson={lesson}
          go={go}
          selectStudent={selectStudent}
          mutate={s.mutate}
        />

        <AppSidebarDrawer
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          data={data}
          view={view}
          lang={s.lang}
          dark={s.dark}
          staff={staff}
          manager={manager}
          setDark={s.setDark}
          setLang={s.setLang}
          go={go}
          openSheet={setSheet}
          onLogout={s.logout}
        />
      </div>
    </ErrorContext.Provider>
  );
}
