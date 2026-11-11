import { tr, setLanguage } from './translations';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  GraduationCap,
  TrendingUp,
  ContactRound,
  House,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { api } from './api';
import type { Homework, Lesson, State } from './types';
import { Brand, Empty, ErrorContext, Motion, Section, Sheet, initials } from './ui';
import { Home, HomeworkScreen, Schedule } from './screens';
import { Inbox } from './Inbox';
import { Staff } from './Staff';
import { words, type Language } from './i18n';
import Login, { type LoginRequest } from './Login';
import { FamilyChooser } from './FamilyChooser';
import { GradesScreen, AttendanceScreen } from './Progress';
import { Navigation } from './Navigation';
import { usePressFeedback, useReveal } from './animation';
import { Companion } from './Companion';
import { Setup } from './Setup';
import { SchoolDashboard, SchoolClasses, SchoolTimetable } from './SchoolWorkspace';
import { FamilyPreview } from './FamilyPreview';
import { homeFor, viewFor, isSchoolRole } from './experience';
export default function App() {
  const [data, setData] = useState<State | null>(null);
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('today');
  const [child, setChild] = useState('');
  const [sheet, setSheet] = useState('');
  const [work, setWork] = useState<Homework | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lang, setLang] = useState<Language>(() =>
    localStorage.getItem('schoolsync-language') === 'en' ? 'en' : 'ar',
  );
  const [dark, setDark] = useState(() => localStorage.getItem('schoolsync-dark') === 'true');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [demo, setDemo] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [familyWelcome, setFamilyWelcome] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [staffTool, setStaffTool] = useState('');
  const [staffLesson, setStaffLesson] = useState('');
  const shell = useRef<HTMLDivElement>(null);
  usePressFeedback(shell, `${auth}-${familyWelcome}`);
  const main = useRef<HTMLElement>(null);
  useReveal(main, `${auth}-${tab}-${child}-${staffTool}-${switching}`);
  const requestNumber = useRef(0);
  const t = words[lang];
  setLanguage(lang);
  const refresh = useCallback(async () => {
    const request = ++requestNumber.current;
    try {
      const state = await api<State>(
        `/state${child ? `?student=${encodeURIComponent(child)}` : ''}`,
      );
      if (request !== requestNumber.current) return;
      setData(state);
      setAuth(true);
      setOffline(false);
      setError('');
    } catch (e) {
      if (request !== requestNumber.current) return;
      const err = e as Error & { status?: number };
      if (err.status === 401) {
        setAuth(false);
        setData(null);
      } else {
        setError(tr(err.message));
        setOffline(!navigator.onLine);
      }
    } finally {
      if (request === requestNumber.current) {
        setLoading(false);
        setSwitching(false);
      }
    }
  }, [child]);
  useEffect(() => {
    api<{ demo: boolean; setupRequired: boolean }>('/config')
      .then((c) => {
        setDemo(c.demo);
        setSetupRequired(c.setupRequired);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!auth) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 8000);
    const sync = () => void refresh();
    const off = () => setOffline(true);
    window.addEventListener('online', sync);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [auth, refresh]);
  useEffect(() => {
    if (!auth) return;
    let socket: WebSocket;
    let reconnect: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`,
      );
      socket.onmessage = () => void refresh();
      socket.onclose = () => {
        if (!closed) reconnect = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(reconnect);
      socket?.close();
    };
  }, [auth, refresh]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('schoolsync-language', lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('schoolsync-dark', String(dark));
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const go = (next: string) => {
    setTab(data ? viewFor(data.user.role, next) : next);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const mutate = async (url: string, body: unknown, success = tr('Saved successfully')) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      await api(url, body);
      await refresh();
      setToast(tr(success));
      return true;
    } catch (e) {
      setError(tr((e as Error).message));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const signIn = async (input: LoginRequest) => {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ entryStudentId?: string }>(
        input.portal === 'family' ? '/family-login' : '/login',
        input,
      );
      setFamilyWelcome(true);
      ++requestNumber.current;
      const state = await api<State>(
        `/state${result.entryStudentId ? `?student=${encodeURIComponent(result.entryStudentId)}` : ''}`,
      );
      setChild(result.entryStudentId || '');
      setData(state);
      setTab(homeFor(state.user.role));
      setStaffTool('');
      setStaffLesson('');
      setSheet('');
      setAuth(true);
      setOffline(false);
      setLoading(false);
    } catch (e) {
      setError(tr((e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <LoaderCircle className="spin" />
        <p>{tr('A calmer school day is on its way.')}</p>
      </div>
    );
  if (setupRequired && !auth)
    return (
      <Setup
        busy={busy}
        error={error}
        onSubmit={async (values) => {
          setBusy(true);
          setError('');
          try {
            await api('/setup', values);
            setSetupRequired(false);
            setChild('');
            setTab('dashboard');
            await refresh();
          } catch (e) {
            setError(tr((e as Error).message));
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  if (!auth || !data)
    return (
      <Login demo={demo} busy={busy} error={error} signIn={signIn} lang={lang} setLang={setLang} />
    );
  const staff = isSchoolRole(data.user.role);
  const view = viewFor(data.user.role, tab);
  const unread = data.notifications.filter((n) => !n.read).length;
  const props = {
    data,
    lang,
    go,
    openWork: (h: Homework) => {
      setWork(h);
      setSheet('work');
    },
    openLesson: (l: Lesson) => {
      setLesson(l);
      setSheet('lesson');
    },
    openFocus: () => setSheet('focus'),
    openNotice: () => setSheet('notices'),
    openCompanion: () => setSheet('companion'),
  };
  const selectStudent = (id: string) => {
    setFamilyWelcome(false);
    setSheet('');
    if (id !== data.student?.id) {
      setSwitching(true);
      setChild(id);
    }
    go('today');
  };
  const openStaffTool = async (tool: string, section?: string, lessonId?: string) => {
    if (!staff) return;
    setStaffTool(tool);
    setStaffLesson(lessonId || '');
    const selected = section ? data.students.find((s) => s.section === section) : undefined;
    if (selected && selected.section !== data.student?.section) {
      setBusy(true);
      try {
        ++requestNumber.current;
        const state = await api<State>(`/state?student=${encodeURIComponent(selected.id)}`);
        setData(state);
        setChild(selected.id);
      } catch (e) {
        setError(tr((e as Error).message));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    const administrative = [
      'account',
      'family',
      'guardian',
      'school',
      'schedule',
      'lesson',
      'announcement',
      'student',
    ].includes(tool);
    go(administrative ? 'management' : 'classroom');
  };
  const openClass = async (section: string) => {
    await openStaffTool('', section);
  };
  const openFamilyPreview = async (id: string) => {
    if (!staff || busy) return;
    setBusy(true);
    setError('');
    try {
      ++requestNumber.current;
      const state = await api<State>(`/state?student=${encodeURIComponent(id)}`);
      setData(state);
      setChild(id);
      setSheet('family-preview');
    } catch (e) {
      setError(tr((e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  const nav = staff
    ? [
        { id: 'dashboard', label: lang === 'ar' ? 'الرئيسية' : 'Dashboard', icon: House },
        { id: 'classes', label: lang === 'ar' ? 'الشعب والطلاب' : 'Classes', icon: GraduationCap },
        data.user.role === 'admin'
          ? {
              id: 'management',
              label: lang === 'ar' ? 'إدارة المدرسة' : 'Administration',
              icon: ShieldCheck,
            }
          : { id: 'classroom', label: lang === 'ar' ? 'أعمال الصف' : 'Classroom', icon: BookOpen },
        { id: 'schedule', label: lang === 'ar' ? 'جدول الحصص' : 'Timetable', icon: CalendarDays },
        { id: 'inbox', label: t.inbox, icon: MessageCircle },
      ]
    : [
        { id: 'today', label: t.today, icon: House },
        { id: 'schedule', label: t.schedule, icon: CalendarDays },
        { id: 'grades', label: lang === 'ar' ? 'العلامات' : 'Grades', icon: TrendingUp },
        { id: 'attendance', label: lang === 'ar' ? 'الحضور' : 'Attendance', icon: Check },
        { id: 'inbox', label: t.inbox, icon: MessageCircle },
      ];
  if (data.user.role === 'parent' && data.students.length > 1 && familyWelcome)
    return (
      <ErrorContext.Provider value={error}>
        <div className="app-shell family-entry" ref={shell}>
          <header className="app-header">
            <Brand />
            <button
              className="avatar small lilac"
              aria-label={tr('Open profile')}
              onClick={() => {
                setFamilyWelcome(false);
                go('you');
              }}
            >
              {initials(data.user.name)}
            </button>
          </header>
          {error && (
            <p className="entry-error" role="alert">
              {error}
            </p>
          )}
          <FamilyChooser data={data} lang={lang} onSelect={selectStudent} busy={switching} />
        </div>
      </ErrorContext.Provider>
    );
  return (
    <ErrorContext.Provider value={error}>
      <div className={`app-shell ${staff ? 'staff-space' : 'family-space'}`} ref={shell}>
        <header className="app-header">
          <Brand />
          <div className="header-actions">
            <button
              className="icon-button notification-button"
              aria-label={tr('Notifications')}
              onClick={() => {
                setSheet('notifications');
                void mutate('/notifications/read', {}, tr('Updates marked as read'));
              }}
            >
              <Bell size={21} />
              {unread > 0 && <i />}
            </button>
            <button
              className={`avatar small ${data.student?.color || 'lilac'}`}
              aria-label={tr('Open profile')}
              onClick={() => go('you')}
            >
              {initials(data.user.name)}
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
              ? lang === 'ar'
                ? data.user.role === 'admin'
                  ? 'إدارة المدرسة'
                  : 'مساحة المعلم'
                : 'SCHOOL SPACE'
              : lang === 'ar'
                ? 'مساحة العائلة'
                : 'FAMILY SPACE'}
          </span>
        </div>
        {data.demo && (
          <div className="demo-ribbon">
            {tr('DEMO SCHOOL')}
            <span>{tr('Fictional data · Changes are saved')}</span>
          </div>
        )}
        {offline && (
          <div className="connection-banner">
            <WifiOff size={15} />
            {tr('Offline · Showing the last loaded records')}
          </div>
        )}
        {error && (
          <div role="alert" className="error-banner">
            {error}
            <button
              onClick={() => {
                setError('');
                void refresh();
              }}
            >
              {tr('Retry')}
            </button>
          </div>
        )}
        {!staff && (
          <div className="selected-child-bar">
            <button
              onClick={() => setSheet('children')}
              aria-label={lang === 'ar' ? 'اختيار الطالب' : 'Choose a student'}
            >
              <span className={`avatar ${data.student?.color || 'blue'}`}>
                {data.student?.initials || '—'}
              </span>
              <span>
                <small>
                  {staff
                    ? lang === 'ar'
                      ? 'منظور العائلة'
                      : 'FAMILY VIEW'
                    : lang === 'ar'
                      ? 'نتابع اليوم'
                      : 'TODAY, WE’RE FOLLOWING'}
                </small>
                <strong>
                  {data.student?.name || (lang === 'ar' ? 'اختر الطالب' : 'Choose student')}
                </strong>
              </span>
              <span className="child-class">{tr(data.student?.section || '')}</span>
              <ChevronDown size={15} />
            </button>
          </div>
        )}
        <main ref={main} className={switching ? 'is-switching' : ''} aria-busy={switching}>
          {switching && (
            <div className="student-switch-loading" role="status">
              <LoaderCircle className="spin" size={24} />
              <span>{lang === 'ar' ? 'نجهّز يومه…' : 'Opening their day…'}</span>
            </div>
          )}
          <Motion
            identity={`${view}-${staff ? (view === 'classroom' ? data.student?.section : 'school') : data.student?.id}`}
          >
            {!staff && view === 'today' && <Home {...props} />}
            {view === 'schedule' &&
              (staff ? (
                <SchoolTimetable data={data} lang={lang} action={openStaffTool} />
              ) : (
                <Schedule {...props} />
              ))}
            {!staff && view === 'grades' && <GradesScreen data={data} lang={lang} />}
            {!staff && view === 'attendance' && <AttendanceScreen data={data} lang={lang} />}
            {!staff && view === 'homework' && <HomeworkScreen {...props} />}
            {!staff && view === 'notes' && (
              <div className="note-screen">
                <div className="page-intro" data-reveal>
                  <span className="eyebrow">
                    {lang === 'ar' ? 'كلمات تصل من المدرسة' : 'FROM YOUR SCHOOL'}
                  </span>
                  <h1>
                    {lang === 'ar' ? 'ملاحظات المدرسة' : 'School notes'}
                    <span className="greeting-dot">.</span>
                  </h1>
                </div>
                {data.notes.map((n) => (
                  <article className="journal-note" key={n.id} data-reveal>
                    <Sparkles size={20} />
                    <p>{n.content}</p>
                    <strong>{n.author}</strong>
                    <small>{n.created.slice(0, 10)}</small>
                  </article>
                ))}
              </div>
            )}
            {view === 'inbox' && <Inbox data={data} mutate={mutate} busy={busy} />}
            {staff && view === 'dashboard' && (
              <SchoolDashboard data={data} lang={lang} go={go} action={openStaffTool} />
            )}
            {staff && view === 'classes' && (
              <SchoolClasses
                data={data}
                lang={lang}
                onOpenClass={openClass}
                onPreview={openFamilyPreview}
                busy={busy}
              />
            )}
            {staff && view === 'classroom' && (
              <Staff
                key={`classroom-${data.student?.section}-${staffTool}-${staffLesson}`}
                data={data}
                mutate={mutate}
                busy={busy}
                mode="classroom"
                initialTool={staffTool}
                initialLessonId={staffLesson}
                onSectionChange={openClass}
              />
            )}
            {data.user.role === 'admin' && view === 'management' && (
              <Staff
                key={`management-${staffTool}`}
                data={data}
                mutate={mutate}
                busy={busy}
                mode="management"
                initialTool={staffTool}
              />
            )}
            {view === 'you' && (
              <>
                <div className="page-intro" data-reveal>
                  <div className="eyebrow">{tr('GROWING AT YOUR OWN PACE')}</div>
                  <h1>
                    {t.you}
                    <span className="greeting-dot">.</span>
                  </h1>
                  <p>{t.profile}</p>
                </div>
                <div className="profile-card" data-reveal>
                  <span className={`avatar big ${data.student?.color || 'mint'}`}>
                    {initials(data.user.name)}
                  </span>
                  <div>
                    <h2>{data.user.name}</h2>
                    <p>
                      {tr(data.user.role)} · {data.school.name}
                    </p>
                    <small>
                      {tr('Signed in as')}
                      {data.user.name} · {tr(data.user.role)}
                    </small>
                  </div>
                </div>

                <Section title={t.settings} />
                <div className="settings-list" data-reveal>
                  <label>
                    <span>
                      <Moon size={18} />
                      {t.dark}
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={dark}
                      onChange={(e) => setDark(e.target.checked)}
                    />
                  </label>
                  <label>
                    <span>{t.language}</span>
                    <select value={lang} onChange={(e) => setLang(e.target.value as Language)}>
                      <option value="en">{tr('English')}</option>
                      <option value="ar">العربية</option>
                    </select>
                  </label>
                  <button onClick={() => setSheet('privacy')}>
                    <ShieldCheck size={18} />
                    {tr('Your data & privacy')}
                    <ArrowUpRight size={17} />
                  </button>
                  <button onClick={() => setSheet('password')}>
                    <ShieldCheck size={18} />
                    {data.user.role === 'parent'
                      ? lang === 'ar'
                        ? 'تغيير رمز دخول الطالب'
                        : 'Change child access code'
                      : tr('Change password')}
                    <ArrowUpRight size={17} />
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await api('/logout', {});
                        ++requestNumber.current;
                        setData(null);
                        setAuth(false);
                        setChild('');
                        setTab('today');
                      } catch (e) {
                        setError(tr((e as Error).message));
                      }
                    }}
                  >
                    <LogOut size={18} />
                    {t.logout}
                  </button>
                </div>
              </>
            )}
          </Motion>
        </main>
        <Navigation items={nav} value={view} onChange={go} />
        {toast && (
          <div className="toast" role="status">
            <Check size={17} />
            {toast}
          </div>
        )}
        {staff && sheet === 'family-preview' && (
          <Sheet
            title={
              lang === 'ar'
                ? `معاينة ولي الأمر · ${data.student?.name}`
                : `Family preview · ${data.student?.name}`
            }
            onClose={() => setSheet('')}
          >
            <FamilyPreview key={data.student?.id} data={data} lang={lang} />
          </Sheet>
        )}
        {!staff && sheet === 'children' && (
          <Sheet
            title={lang === 'ar' ? 'يوم مختلف، واهتمام واحد' : 'Different days. The same care.'}
            onClose={() => setSheet('')}
          >
            <FamilyChooser
              data={data}
              lang={lang}
              compact
              onSelect={selectStudent}
              busy={switching}
            />
          </Sheet>
        )}
        {sheet === 'work' && work && (
          <Sheet title={work.subject} onClose={() => setSheet('')}>
            <div className={`work-detail ${work.color}`}>
              <span className="eyebrow dark">
                {tr('DUE')}
                {work.due}
              </span>
              <h2>{work.title}</h2>
              <p>{work.description}</p>
              <small>
                {tr('Assigned by')}
                {work.teacher}
              </small>
            </div>
            {data.user.role === 'student' ? (
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await mutate(
                      `/homework/${work.id}/submit`,
                      { content: f.get('content') },
                      tr('Your work has been submitted'),
                    )
                  )
                    setSheet('');
                }}
              >
                <label>
                  {tr('Your work')}
                  <textarea
                    name="content"
                    defaultValue={work.submission || ''}
                    placeholder={tr('Share your answer, working, or reflection…')}
                    rows={7}
                    required
                    maxLength={4000}
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {busy
                    ? tr('Submitting…')
                    : work.submission
                      ? tr('Update submission')
                      : tr('Submit your work')}
                  <ArrowRight size={17} />
                </button>
              </form>
            ) : (
              <div className="surface">
                <strong>{work.submission ? tr('Submitted work') : tr('Not submitted yet')}</strong>
                <p className="pre-wrap">
                  {work.submission || tr('The student’s submitted answer will appear here.')}
                </p>
              </div>
            )}
          </Sheet>
        )}
        {sheet === 'lesson' && lesson && (
          <Sheet title={lesson.subject} onClose={() => setSheet('')}>
            <div className={`work-detail ${lesson.color}`}>
              <span className="eyebrow dark">{tr('YOUR TIMETABLE')}</span>
              <h2>
                {lesson.start} — {lesson.end}
              </h2>
              <p>
                {lesson.room} · {lesson.teacher}
              </p>
              <small>
                {tr('Class')}
                {lesson.section}
              </small>
            </div>
            <Section title={tr('A little preparation')} />
            {data.homework
              .filter((h) => h.subject === lesson.subject)
              .map((h) => (
                <button
                  className="homework-row"
                  key={h.id}
                  onClick={() => {
                    setWork(h);
                    setSheet('work');
                  }}
                >
                  <BookOpen size={20} />
                  <span className="row-copy">
                    <strong>{h.title}</strong>
                    <small>
                      {tr('Due')}
                      {h.due}
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            <button
              className="secondary"
              onClick={() => {
                setSheet('');
                go('inbox');
              }}
            >
              {tr('Talk to your teacher')}
              <MessageCircle size={17} />
            </button>
          </Sheet>
        )}
        {!staff && sheet === 'companion' && (
          <Sheet
            title={lang === 'ar' ? 'رفيق يومك' : tr('Your day companion')}
            onClose={() => setSheet('')}
          >
            <Companion
              data={data}
              lang={lang}
              go={(next) => {
                setSheet('');
                go(next);
              }}
              openWork={(h) => {
                setWork(h);
                setSheet('work');
              }}
              focus={() => setSheet('focus')}
            />
          </Sheet>
        )}
        {data.user.role === 'student' && sheet === 'focus' && (
          <Sheet title={tr('A moment to focus')} onClose={() => setSheet('')}>
            <Focus />
          </Sheet>
        )}
        {['notifications', 'notices'].includes(sheet) && (
          <Sheet
            title={sheet === 'notifications' ? t.notifications : tr('The school noticeboard')}
            onClose={() => setSheet('')}
          >
            {(sheet === 'notifications' ? data.notifications : data.announcements).length ? (
              (sheet === 'notifications' ? data.notifications : data.announcements).map((n) => (
                <article className="notice" key={n.id}>
                  <span className="notice-icon">
                    <Bell size={18} />
                  </span>
                  <div>
                    <small>{n.created.slice(0, 10)}</small>
                    <h3>{n.title}</h3>
                    <p>{n.content}</p>
                  </div>
                </article>
              ))
            ) : (
              <Empty
                title={tr('A quiet moment')}
                detail={tr('New school updates will appear here.')}
              />
            )}
          </Sheet>
        )}
        {sheet === 'privacy' && (
          <Sheet title={tr('Your data, with care')} onClose={() => setSheet('')}>
            <div className="privacy-copy">
              <ShieldCheck size={32} />
              <h3>{tr('A space built around trust.')}</h3>
              <p>
                {tr(
                  'Your account only sees school records authorized for your role. Guardian accounts are linked to specific students; teachers work with assigned classes.',
                )}
              </p>
              <p>
                {data.demo
                  ? tr(
                      'This is a local demonstration with fictional data. Do not enter real student information in this demo.',
                    )
                  : tr(
                      'Contact your school administrator for access, corrections, retention, and deletion requests.',
                    )}
              </p>
              <p>
                {tr(
                  'Records synchronize while the app is open. Background push notifications are not configured in this version.',
                )}
              </p>
              <small>
                {tr('School timezone:')}
                {data.school.timezone}
              </small>
            </div>
          </Sheet>
        )}
        {sheet === 'password' && (
          <Sheet
            title={
              data.user.role === 'parent'
                ? lang === 'ar'
                  ? 'تغيير رمز دخول الطالب'
                  : 'Change child access code'
                : tr('Change password')
            }
            onClose={() => setSheet('')}
          >
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const values = Object.fromEntries(new FormData(e.currentTarget));
                if (
                  await mutate(
                    data.user.role === 'parent' ? '/family-code' : '/password',
                    data.user.role === 'parent'
                      ? { ...values, studentId: data.student?.id }
                      : values,
                    tr('Password updated'),
                  )
                )
                  setSheet('');
              }}
            >
              <label>
                {data.user.role === 'parent'
                  ? lang === 'ar'
                    ? 'رمز الطالب الحالي'
                    : 'Current child code'
                  : tr('Current password')}
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                {data.user.role === 'parent'
                  ? lang === 'ar'
                    ? 'رمز الطالب الجديد'
                    : 'New child code'
                  : tr('New password')}
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={data.user.role === 'parent' ? 8 : 12}
                  required
                />
              </label>
              <p className="form-help">
                {data.user.role === 'parent'
                  ? lang === 'ar'
                    ? `يُغيّر رمز ${data.student?.name.split(' ')[0]} فقط. تظل بيانات الأشقاء تفتح حساب العائلة نفسه، وتُغلق الجلسات الأخرى.`
                    : 'Changes only this child’s code. Sibling credentials still open the same family account. Other sessions are signed out.'
                  : tr('Use at least 12 characters. Other sessions will be signed out.')}
              </p>
              <button className="primary" disabled={busy}>
                {busy ? tr('Saving…') : tr('Save changes')}
              </button>
            </form>
          </Sheet>
        )}
      </div>
    </ErrorContext.Provider>
  );
}
function Focus() {
  const [duration, setDuration] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    deadline.current = Date.now() + left * 1000;
    const tick = () => {
      const value = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(value);
      if (!value) setRunning(false);
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [running]);
  return (
    <div className="focus-content">
      <span className="eyebrow">{tr('ONE SMALL SESSION. ONE STEP FORWARD.')}</span>
      <div
        className="focus-clock"
        role="timer"
        aria-label={`${Math.floor(left / 60)} minutes ${left % 60} seconds remaining`}
        style={{ '--progress': `${(1 - left / (duration * 60)) * 100}%` } as React.CSSProperties}
      >
        <span>
          {Math.floor(left / 60)
            .toString()
            .padStart(2, '0')}
          <small>:{(left % 60).toString().padStart(2, '0')}</small>
        </span>
      </div>
      <h3>
        {left === 0
          ? tr('A little win. Well done.')
          : running
            ? tr('You’ve got this.')
            : tr('Make a little room for focus.')}
      </h3>
      <p>
        {left === 0
          ? tr('Stand up, stretch, and take a breath.')
          : tr('Choose one thing. Everything else can wait.')}
      </p>
      <div className="segmented">
        {[15, 25, 45].map((m) => (
          <button
            className={duration === m ? 'selected' : ''}
            disabled={running}
            key={m}
            onClick={() => {
              setDuration(m);
              setLeft(m * 60);
            }}
          >
            {m} {tr('min')}
          </button>
        ))}
      </div>
      <div className="focus-actions">
        <button
          className="icon-button secondary"
          aria-label={tr('Reset timer')}
          onClick={() => {
            setRunning(false);
            setLeft(duration * 60);
          }}
        >
          <RotateCcw size={19} />
        </button>
        <button className="primary" disabled={left === 0} onClick={() => setRunning(!running)}>
          {running ? <Pause size={17} /> : <Play size={17} />}
          {running ? tr('Pause for a moment') : tr('Let’s begin')}
        </button>
      </div>
    </div>
  );
}
