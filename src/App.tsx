import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Activity,
  BarChart3,
  Settings,
  GraduationCap,
  LogOut,
  Plus,
  ArrowLeft,
  Search,
  Bell,
  CheckCircle2,
  Info,
  Clock3,
  FileText,
  Sparkles,
  Wifi,
  ShieldCheck,
  Camera,
  Download,
  Eye,
  Copy,
  RefreshCw,
  ChevronLeft,
  FolderOpen,
  X,
  Wrench,
  FolderInput,
} from 'lucide-react';
import { api, setToken, download } from './api';
import type { Exam, Student, Attempt, Session } from './types';
import { LearningArt } from './Art';
import Welcome, { scope } from './Welcome';
import { StudentsView, SettingsView } from './Management';
import ExamEditor from './ExamEditor';
import StudentExam, { cameraProbe } from './StudentExam';
import { AssistantView, BooksView } from './Workspace';
import SidebarNavigation from './SidebarNavigation';
import ExamIllustration from './ExamIllustration';
import './teacherLayout.css';
import './surfaces.css';
import './schoolUpgrade.css';
import SchoolBrand from './SchoolBrand';
import MinistryBrand from './MinistryBrand';
import FloatingAssistant from './FloatingAssistant';
import StudentSpace from './StudentSpace';
import TeacherTools from './TeacherTools';
import TeacherMonitoring from './TeacherMonitoring';
import LiveLab, { openLiveLab } from './LiveLab';
import StudentLiveSession from './StudentLiveSession';
import { ZunisBrand, ZunisSplash } from './Zunis';
import './quietWorkspace.css';
import ExamFolders, { type ExamOrganization } from './ExamFolders';
import { findSnapshot, saveSnapshot, type Snapshot } from './offline';
const labels: Record<string, string> = {
  draft: 'مسودة',
  published: 'منشور',
  closed: 'مغلق',
  active: 'قيد الإجابة',
  submitted: 'تم التسليم',
  review: 'تحتاج مراجعة',
};
function Stat({
  label,
  value,
  note,
  icon: Icon,
  color,
}: {
  label: string;
  value: any;
  note: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty card">
      <div className="empty-icon">
        <FolderOpen size={40} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export default function App() {
  const [session, setSession] = useState<Session>();
  const sessionGuard = useRef('');
  const [page, setPage] = useState('dashboard');
  const [school, setSchool] = useState('مدرسة محمد الشريقي');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [hostInfo, setHostInfo] = useState<any>();
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [editing, setEditing] = useState<Exam>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [connection, setConnection] = useState(true);
  const [search, setSearch] = useState('');
  const [examCode, setExamCode] = useState('');
  const [photo, setPhoto] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [exitOpen, setExitOpen] = useState(false),
    [exitPassword, setExitPassword] = useState(''),
    [exitError, setExitError] = useState('');
  const [exitBusy, setExitBusy] = useState(false);
  useEffect(()=>{const navigate=(event:Event)=>{const value=(event as CustomEvent).detail;if(session?.role==='teacher'&&['assistant','books','tools','exams','students','settings','monitor'].includes(value))setPage(value);};window.addEventListener('workflow-navigate',navigate);return()=>window.removeEventListener('workflow-navigate',navigate);},[session?.role]);
  useEffect(() => {
    const restore = async () => {
      try {
        const saved: Session | null = window.desktop
          ? await window.desktop.studentSession()
          : JSON.parse(sessionStorage.getItem('student-session') || 'null');
        if (saved?.role !== 'student' || !saved.student) return;
        setToken(saved.token);
        sessionGuard.current = saved.token;
        setSession(saved);
        setPage('dashboard');
        const cached = await findSnapshot(saved.student.id, scope());
        if (cached && !cached.attempt.submittedAt) setSnapshot(cached);
      } catch {}
    };
    void restore();
  }, []);
  useEffect(() => {
    if (session?.role === 'student')
      sessionStorage.setItem('student-session', JSON.stringify(session));
    const prevent = (event: BeforeUnloadEvent) => {
      if (session?.role === 'student') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [session]);
  const notify = (message: string) => {
    if (sessionGuard.current === (session?.token || '')) setToast(message);
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  const refresh = async () => {
    if (!session) return;
    try {
      const [examData, attemptData, status] = await Promise.all([
        api('/api/exams'),
        api('/api/attempts'),
        api('/api/status'),
      ]);
      if (sessionGuard.current !== session.token) return;
      setExams(examData);
      setAttempts(attemptData);
      setSchool(status.school);
      if (session.role === 'teacher') {
        const data = await api('/api/students');
        if (sessionGuard.current !== session.token) return;
        setStudents(data);
      }
      setConnection(true);
    } catch {
      setConnection(false);
    }
  };
  useEffect(() => {
    if (!session) return;
    void refresh();
    let eventTimer: ReturnType<typeof setTimeout>;
    const unsubscribe = window.desktop?.onEvent(() => {
      clearTimeout(eventTimer);
      eventTimer = setTimeout(() => void refresh(), 200);
    });
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      clearInterval(timer);
      clearTimeout(eventTimer);
      unsubscribe?.();
    };
  }, [session]);
  const act = async (fn: () => Promise<any>, message?: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (message) notify(message);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const logout = async (password?: string) => {
    if (exitBusy) return;
    if (session?.role === 'student' && password === undefined) {
      setExitOpen(true);
      setExitError('');
      setExitPassword('');
      return;
    }
    if (snapshot && session?.role !== 'student') return;
    try {
      setExitBusy(true);
      await api('/api/logout', 'POST', session?.role === 'student' ? { password } : undefined);
    } catch (error) {
      if (session?.role === 'student') {
        setExitError((error as Error).message);
        return;
      }
    } finally {
      setExitBusy(false);
    }
    sessionStorage.removeItem('student-session');
    setExitOpen(false);
    setExitPassword('');
    setToken('');
    sessionGuard.current = '';
    setSession(undefined);
    setAttempts([]);
    setExams([]);
    setStudents([]);
    setEditing(undefined);
    setSnapshot(undefined);
    setPhoto('');
    setToast('');
  };
  const startExam = async (exam?: Exam, enteredCode?: string) => {
    if (!session?.student) return;
    setBusy(true);
    try {
      const old = await findSnapshot(session.student.id, scope());
      if (old) {
        setSnapshot(old);
        return;
      }
      const cameraAvailable = await cameraProbe();
      const result = await api('/api/attempts/start', 'POST', {
        examId: exam?.id,
        code: exam ? undefined : (enteredCode ?? examCode),
        cameraAvailable,
      });
      const cached: Snapshot = {
        ...result,
        studentId: session.student.id,
        scope: scope(),
        offset: result.serverNow - Date.now(),
        answers: result.attempt.answers,
        revisions: result.attempt.revisions,
        pending: {},
        submitPending: false,
      };
      await saveSnapshot(cached);
      setSnapshot(cached);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const resume = async (attempt: Attempt) => {
    setBusy(true);
    try {
      const old = await findSnapshot(session!.student!.id, scope());
      if (old?.attempt.id === attempt.id) {
        setSnapshot(old);
        return;
      }
      const result = await api(`/api/attempts/${attempt.id}`);
      const saved: Snapshot = {
        ...result,
        scope: scope(),
        studentId: session!.student!.id,
        offset: result.serverNow - Date.now(),
        answers: result.attempt.answers,
        revisions: result.attempt.revisions,
        pending: {},
        submitPending: false,
      };
      await saveSnapshot(saved);
      setSnapshot(saved);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const showPhoto = async (id: string) => {
    try {
      setPhoto((await api(`/api/photos/${id}`)).image);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const [examStatus, setExamStatus] = useState('all');
  const [examGrade, setExamGrade] = useState('');
  const [examFolder,setExamFolder]=useState('all');
  const [examOrganization,setExamOrganization]=useState<ExamOrganization>({folders:[],examFolders:{}});
  const [examMoving,setExamMoving]=useState<string[]>([]);
  useEffect(()=>{setExamFolder('all');setExamOrganization({folders:[],examFolders:{}});setExamMoving([]);},[session?.teacherId]);
  const teacher = session?.role === 'teacher';
  const nav: [string, string, any][] = teacher
    ? [
        ['assistant', 'الرئيسية والمساعد', Sparkles],
        ['books', 'الكتب وبنك الأسئلة', BookOpen],
        ['tools', 'الأدوات', Wrench],
        ['exams', 'الامتحانات', FileText],
        ['students', 'الطلاب والصفوف', Users],
        ['monitor', 'المتابعة والنتائج', Activity],
        ['settings', 'الإعدادات', Settings],
      ]
    : [
        ['dashboard', 'الرئيسية', LayoutDashboard],
        ['exams', 'امتحاناتي', BookOpen],
        ['results', 'نتائجي', BarChart3],
      ];
  const create = () => {
    setEditing(undefined);
    setPage('editor');
  };
  const filtered = exams.filter(
    (e) =>
      `${e.title} ${e.subject} ${e.grade}`.includes(search) &&
      (examStatus === 'all' || e.status === examStatus) &&
      (!examGrade || e.grade === examGrade) &&
      (!teacher || examFolder==='all' || (examFolder==='unfiled'?!examOrganization.examFolders[e.id]:examOrganization.examFolders[e.id]===examFolder)),
  );
  const cards = (list: Exam[]) =>
    list.length ? (
      <div className="exam-grid">
        {list.map((e) => {
          const attempt = attempts.find(
            (a) => a.examId === e.id && a.studentId === session?.student?.id,
          );
          const available =
            e.status === 'published' &&
            Date.now() >= Date.parse(e.opensAt) &&
            Date.now() < Date.parse(e.closesAt);
          return (
            <article className="exam-card" key={e.id} draggable={teacher&&page==='exams'} onDragStart={event=>{event.dataTransfer.setData('application/x-school-exam',e.id);event.dataTransfer.effectAllowed='move';}}>
              <div className="exam-card-top">
                {teacher&&page==='exams'&&<button className="exam-folder-move" aria-label={`نقل الامتحان إلى مجلد: ${e.title}`} title="نقل إلى مجلد" onClick={()=>setExamMoving([e.id])}><FolderInput size={17}/></button>}
                <ExamIllustration subject={e.subject} />
                <span
                  className={`pill ${e.status === 'published' ? 'green' : e.status === 'draft' ? 'amber' : 'gray'}`}
                >
                  {labels[e.status]}
                </span>
              </div>
              <span className="eyebrow">
                {e.subject} · الفصل {e.term}
              </span>
              <h3>{e.title}</h3>
              <p>
                الصف {e.grade}
                {e.section ? ` · الشعبة ${e.section}` : ''} · امتحان {e.kind}
              </p>
              <div className="exam-meta">
                <span>
                  <FileText size={15} />
                  {teacher
                    ? `${e.delivery?.count || e.questions.length} أسئلة${e.delivery ? ' · نماذج مختلفة' : ''}`
                    : 'اختيار من متعدد'}
                </span>
                <span>
                  <Clock3 size={15} />
                  {e.duration} دقيقة
                </span>
                <span>
                  <GraduationCap size={16} />
                  {e.total} درجة
                </span>
              </div>
              <div className="exam-card-footer">
                {teacher ? (
                  <>
                    <span className="exam-code" title="رمز الامتحان">
                      {e.code}
                      <button
                        aria-label="نسخ رمز الامتحان"
                        onClick={() => {
                          void navigator.clipboard.writeText(e.code);
                          notify('تم نسخ رمز الامتحان');
                        }}
                      >
                        <Copy size={14} />
                      </button>
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        setEditing(e);
                        setPage('editor');
                      }}
                    >
                      فتح الامتحان <ChevronLeft size={17} />
                    </button>
                  </>
                ) : (
                  <button
                    className="primary wide"
                    disabled={busy || !!attempt?.submittedAt || (!available && !attempt)}
                    onClick={() => (attempt ? void resume(attempt) : void startExam(e))}
                  >
                    {attempt?.submittedAt
                      ? 'تم التسليم'
                      : attempt
                        ? 'متابعة الامتحان'
                        : available
                          ? 'ابدأ الامتحان'
                          : 'بانتظار موعد الإتاحة'}
                    <ArrowLeft size={16} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    ) : (
      <Empty
        title={teacher ? 'مساحة لامتحانك الأول' : 'لا توجد امتحانات متاحة الآن'}
        description={
          teacher
            ? 'ارفع ملف المنهج، ودع الذكاء الاصطناعي يساعدك في إعداد الأسئلة.'
            : 'ستظهر هنا الامتحانات المنشورة لصفك وشعبتك.'
        }
        action={
          teacher ? (
            <button className="primary" onClick={create}>
              <Plus size={18} /> إنشاء أول امتحان
            </button>
          ) : undefined
        }
      />
    );
  const table = (results = false, rows = attempts) =>
    rows.length ? (
      <div className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الامتحان</th>
                <th>{results ? 'الدرجة' : 'الإجابات'}</th>
                <th>الحالة</th>
                <th>{results ? 'النتيجة' : 'الكاميرا'}</th>
                {teacher && <th>الإجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const e = exams.find((e) => e.id === a.examId);
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="table-person">
                        <span className="avatar small">
                          {(a.studentName || session?.student?.name || 'ط')[0]}
                        </span>
                        <div>
                          <strong>{a.studentName || session?.student?.name}</strong>
                          <small>{a.studentId}</small>
                        </div>
                      </div>
                    </td>
                    <td>{a.examTitle || e?.title || 'امتحان محفوظ'}</td>
                    <td>
                      {results
                        ? a.score === null
                          ? 'لم تُنشر'
                          : `${a.score} / ${e?.total || '—'}`
                        : `${Object.keys(a.answers).length} / ${a.questionCount || e?.delivery?.count || e?.questions.length || '—'}`}
                    </td>
                    <td>
                      <span
                        className={`pill ${a.status === 'active' ? 'blue' : a.status === 'review' ? 'amber' : 'green'}`}
                      >
                        {labels[a.status]}
                      </span>
                    </td>
                    <td>
                      {results ? (
                        e?.resultsPublished ? (
                          'منشورة'
                        ) : (
                          'بانتظار النشر'
                        )
                      ) : (
                        <div className="camera-cell">
                          {a.cameraRequests?.[0] && (
                            <small className="muted">
                              {a.cameraRequests[0].state === 'captured'
                                ? 'التُقطت الصورة'
                                : a.cameraRequests[0].state === 'pending'
                                  ? 'طلب قيد الانتظار'
                                  : a.cameraRequests[0].state === 'expired'
                                    ? 'انتهت مهلة التصوير'
                                    : a.cameraRequests[0].state.replace('failed: ', '')}
                            </small>
                          )}
                          <span>
                            {a.cameraAvailable ? 'متاحة' : a.cameraExempt ? 'استثناء' : 'غير متاحة'}
                          </span>
                          {a.photos?.map((p, i) => (
                            <button
                              key={p.id}
                              title={`الصورة ${i + 1}`}
                              onClick={() => void showPhoto(p.id)}
                            >
                              <Eye size={17} />
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    {teacher && (
                      <td>
                        <div className="table-actions">
                          {!a.submittedAt && (
                            <button
                              title="فتح بث كاميرا الطالب"
                              onClick={() => openLiveLab({ attemptId: a.id, cameras: true })}
                            >
                              <Camera size={17} />
                            </button>
                          )}
                          {a.status === 'review' && (
                            <>
                              <button
                                onClick={() =>
                                  void act(
                                    () =>
                                      api(`/api/attempts/${a.id}/review`, 'POST', { accept: true }),
                                    'تم قبول الإجابات المتأخرة',
                                  )
                                }
                              >
                                قبول المتأخر
                              </button>
                              <button
                                onClick={() =>
                                  void act(
                                    () =>
                                      api(`/api/attempts/${a.id}/review`, 'POST', {
                                        accept: false,
                                      }),
                                    'تم رفض الإجابات المتأخرة',
                                  )
                                }
                              >
                                رفض
                              </button>
                            </>
                          )}
                          {!!a.submittedAt && (
                            <button
                              title="السماح بمحاولة جديدة"
                              onClick={() =>
                                void act(
                                  () => api(`/api/attempts/${a.id}/reopen`, 'POST'),
                                  'يمكن للطالب بدء محاولة جديدة',
                                )
                              }
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <Empty
        title={results ? 'النتائج ستظهر هنا' : 'المختبر جاهز، ننتظر الطلاب'}
        description={
          results
            ? 'تُحسب الدرجات عند التسليم، ويقرر المعلم موعد نشرها.'
            : 'عند بدء الطلاب امتحاناتهم ستظهر حالاتهم وإجاباتهم هنا.'
        }
      />
    );
  return (
    <>
      <ZunisSplash/>
      {exitOpen && (
        <div className="modal-backdrop student-exit-overlay">
          <form
            className="modal card student-exit-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="خروج الطالب بإذن المعلم"
            onSubmit={(e) => {
              e.preventDefault();
              void logout(exitPassword);
            }}
          >
            <ShieldCheck size={30} />
            <h2>الخروج بإذن المعلم</h2>
            <p>
              تبقى جلسة الطالب مقفلة حتى يُدخل المعلم كلمة مرور حسابه. لا تُسلّم الإجابات تلقائيًا
              عند الخروج.
            </p>
            <label className="field">
              كلمة مرور المعلم للخروج
              <input
                autoFocus
                type="password"
                autoComplete="off"
                maxLength={128}
                value={exitPassword}
                onChange={(e) => setExitPassword(e.target.value)}
                required
              />
            </label>
            {exitError && (
              <p className="form-error" role="alert">
                {exitError}
              </p>
            )}
            <div className="button-row">
              <button className="primary" type="submit" disabled={exitBusy}>
                فتح الجلسة وتسجيل الخروج
              </button>
              <button type="button" className="secondary" onClick={() => setExitOpen(false)}>
                العودة للطالب
              </button>
            </div>
          </form>
        </div>
      )}
      {!session ? (
        <Welcome
          onLogin={(s) => {
            sessionGuard.current = s.token;
            setSession(s);
            setPage(s.role === 'teacher' ? 'assistant' : 'dashboard');
          }}
          onHost={setHostInfo}
          notify={notify}
          onResume={(s, c) => {
            sessionGuard.current = s.token;
            setSession(s);
            setSnapshot(c);
            setConnection(false);
          }}
        />
      ) : (
        <MotionConfig reducedMotion="user">
          <>
            <div
              className={`app-shell studio-mode ${session.role === 'student' ? 'student-session-shell' : 'teacher-session-shell'} ${snapshot ? 'student-exam-shell' : ''}`}
            >
              <aside className="sidebar">
                <div className="brand">
                  <div className="brand-mark">
                    <GraduationCap size={27} />
                  </div>
                  <div>
                    <strong>{school}</strong>
                    <span>الامتحانات الإلكترونية</span>
                  </div>
                </div>
                <div className="workspace-label">{teacher ? 'مساحة المعلم' : 'مساحة الطالب'}</div>
                <SidebarNavigation
                  items={nav}
                  page={teacher && ['live', 'results'].includes(page) ? 'monitor' : page}
                  disabled={!!snapshot}
                  select={(key) => {
                    setPage(key);
                    setSearch('');
                  }}
                />
                <div className="sidebar-tip">
                  <div className="tip-stars">✧ ✦</div>
                  <BookOpen size={27} />
                  <strong>{teacher ? 'أثر صغير، نجاح كبير' : 'خطوة أخرى نحو النجاح'}</strong>
                  <p>
                    {teacher
                      ? 'أسئلة مدروسة اليوم، تعلم أفضل غدًا.'
                      : 'خذ وقتك، اقرأ جيدًا، وثق بما تعلمته.'}
                  </p>
                </div>
                <div className={`network-status ${connection ? '' : 'disconnected'}`}>
                  <span />
                  <div>
                    <strong>{connection ? 'متصل بشبكة المدرسة' : 'الاتصال غير متاح'}</strong>
                    <small>{teacher ? 'الجهاز الرئيسي' : 'جهاز الطالب'}</small>
                  </div>
                  <Wifi size={16} />
                </div>
                <button
                  className="logout"
                  disabled={!!snapshot && teacher}
                  onClick={() => void logout()}
                >
                  <LogOut size={18} /> تسجيل الخروج
                </button>
              </aside>
              <div className="main-shell">
                <header className="topbar">
                  <div className="breadcrumb">
                    <span className="header-branding"><MinistryBrand /><SchoolBrand /></span>
                    مساحة {teacher ? 'المعلم' : 'الطالب'} <ChevronLeft size={15} />
                    <strong>
                      {snapshot
                        ? 'الامتحان'
                        : page === 'editor'
                          ? 'إنشاء امتحان'
                          : nav.find(
                              (n) =>
                                n[0] ===
                                (teacher && ['live', 'results'].includes(page) ? 'monitor' : page),
                            )?.[1]}
                    </strong>
                  </div>
                  <div className="topbar-actions">
                    <span className="date-text">
                      {new Date().toLocaleDateString('ar-JO', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </span>
                    <button
                      className="notification-button"
                      title="الإشعارات"
                      onClick={() => setNotifications(!notifications)}
                    >
                      <Bell size={20} />
                      {attempts.some((a) => a.status === 'review') && <i />}
                    </button>
                    <span className="topbar-divider" />
                    <div className="profile">
                      <span className="avatar">{teacher ? 'م' : session.student?.name[0]}</span>
                      <div>
                        <strong>
                          {teacher
                            ? session.teacher?.name || 'المعلم المسؤول'
                            : session.student?.name}
                        </strong>
                        <small>
                          {teacher
                            ? 'إدارة الامتحانات'
                            : `الصف ${session.student?.grade} · ${session.student?.section}`}
                        </small>
                      </div>
                    </div>
                  </div>
                  {notifications && (
                    <div className="notification-popover card">
                      <h3>الإشعارات</h3>
                      <p>
                        {attempts.some((a) => a.status === 'review')
                          ? `${attempts.filter((a) => a.status === 'review').length} محاولات تحتوي إجابات متأخرة تحتاج مراجعة.`
                          : 'لا توجد إشعارات جديدة.'}
                      </p>
                      <button className="text-button" onClick={() => setNotifications(false)}>
                        إغلاق
                      </button>
                    </div>
                  )}
                </header>
                <main>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={snapshot ? 'attempt' : page}
                      className={`page-surface ${page === 'assistant' ? 'assistant-surface' : ''} ${page === 'editor' ? 'editor-surface' : ''}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -7 }}
                      transition={{ duration: 0.18 }}
                    >
                      {snapshot ? (
                        <StudentExam
                          key={snapshot.attempt.id}
                          snapshot={snapshot}
                          notify={notify}
                          onExit={() => {
                            setSnapshot(undefined);
                            void refresh();
                          }}
                        />
                      ) : !teacher && session.student ? (
                        <StudentSpace
                          key={`${session.student.id}:${page}`}
                          page={page}
                          student={session.student}
                          exams={exams}
                          attempts={attempts}
                          connected={connection}
                          busy={busy}
                          navigate={setPage}
                          start={(exam, code) => void startExam(exam, code)}
                          resume={(attempt) => void resume(attempt)}
                        />
                      ) : page === 'tools' && teacher ? (
                        <TeacherTools
                          key={session.token}
                          teacherId={session.teacherId || session.teacher?.id || 'master'}
                          notify={notify}
                          openExam={(exam) => {
                            setEditing(exam);
                            setPage('editor');
                            void refresh();
                          }}
                        />
                      ) : page === 'assistant' && teacher ? (
                        <AssistantView
                          overview={{ exams, students: students.length, attempts }}
                          createExam={create}
                          notify={notify}
                          navigate={(p) => setPage(p === 'dashboard' ? 'assistant' : p)}
                          openExam={(e) => {
                            setEditing(e);
                            setPage('editor');
                            void refresh();
                          }}
                        />
                      ) : page === 'books' && teacher ? (
                        <BooksView
                          notify={notify}
                          navigate={setPage}
                          openExam={(e) => {
                            setEditing(e);
                            setPage('editor');
                            void refresh();
                          }}
                        />
                      ) : page === 'editor' && teacher ? (
                        <ExamEditor
                          key={editing?.id || 'new'}
                          initial={editing}
                          notify={notify}
                          onCancel={() => setPage('exams')}
                          onSave={(e) => {
                            setPage('exams');
                            void refresh();
                            notify(
                              e.status === 'published'
                                ? `نُشر الامتحان، رمزه ${e.code}`
                                : 'حُفظت المسودة',
                            );
                          }}
                        />
                      ) : page === 'dashboard' ? (
                        <>
                          <div className="page-title">
                            <div>
                              <span className="eyebrow">مساحة للتعلم والإنجاز</span>
                              <h1>
                                {teacher
                                  ? 'صباح المعرفة، وأهلًا بك'
                                  : 'أهلًا بك، ' + session.student?.name.split(' ')[0]}{' '}
                                <span className="wave">✦</span>
                              </h1>
                              <p>
                                {teacher
                                  ? 'كل ما تحتاجه لإعداد امتحاناتك ومتابعة طلابك في مكان واحد.'
                                  : 'امتحاناتك وتقدمك ونتائجك، في مكان واحد.'}
                              </p>
                            </div>
                            <span className="pill white">
                              <span className="dot green-dot" /> الفصل الدراسي
                            </span>
                          </div>
                          <section className="hero">
                            <div className="hero-copy">
                              <span className="hero-label">
                                <Sparkles size={15} />
                                {teacher ? 'ذكاء يساندك، وأنت تقود' : 'المعرفة تصنع الفرق'}
                              </span>
                              <h2>
                                {teacher ? (
                                  <>
                                    من صفحات المنهج،
                                    <br />
                                    إلى <span>امتحان متكامل.</span>
                                  </>
                                ) : (
                                  <>
                                    جاهز لتحدٍ جديد؟
                                    <br />
                                    أظهر <span>ما تعلمته.</span>
                                  </>
                                )}
                              </h2>
                              <p>
                                {teacher
                                  ? 'ارفع ملف PDF، حدد المستوى، وراجع أسئلتك. ابدأ تجربة امتحانات أسهل لك ولطلابك.'
                                  : 'اختر امتحانك المتاح، اقرأ الأسئلة بعناية، ودع كل إجابة تقربك من النجاح.'}
                              </p>
                              <button
                                className="hero-button"
                                onClick={teacher ? create : () => setPage('exams')}
                              >
                                {teacher ? <Plus size={19} /> : <BookOpen size={19} />}{' '}
                                {teacher ? 'إنشاء امتحان جديد' : 'استعراض امتحاناتي'}
                                <ArrowLeft size={19} />
                              </button>
                              <span className="hero-caption">
                                <ShieldCheck size={14} /> يعمل محليًا داخل المدرسة
                              </span>
                            </div>
                            <LearningArt />
                          </section>
                          <div className="stats-grid">
                            <Stat
                              label="الامتحانات"
                              value={exams.length}
                              note="في مساحة المدرسة"
                              icon={BookOpen}
                              color="blue"
                            />
                            <Stat
                              label={teacher ? 'الطلاب المسجلون' : 'امتحانات مكتملة'}
                              value={
                                teacher
                                  ? students.length
                                  : attempts.filter((a) => a.submittedAt).length
                              }
                              note={teacher ? 'جاهزون للتعلم' : 'خطوات نحو النجاح'}
                              icon={Users}
                              color="violet"
                            />
                            <Stat
                              label="محاولات نشطة"
                              value={attempts.filter((a) => !a.submittedAt).length}
                              note="الآن داخل المختبر"
                              icon={Activity}
                              color="cyan"
                            />
                            <Stat
                              label={teacher ? 'تم التسليم' : 'نتائج منشورة'}
                              value={
                                teacher
                                  ? attempts.filter((a) => a.submittedAt).length
                                  : attempts.filter((a) => a.score !== null).length
                              }
                              note={teacher ? 'إجابات محفوظة' : 'بقرار المعلم'}
                              icon={CheckCircle2}
                              color="green"
                            />
                          </div>
                          <div className="section-title">
                            <div>
                              <h2>{teacher ? 'امتحاناتك الأخيرة' : 'امتحانات متاحة لك'}</h2>
                              <p>
                                {teacher
                                  ? 'خطط، انشر، وتابع تقدم طلابك.'
                                  : 'اختر امتحانًا لتبدأ أو تابع محاولتك الحالية.'}
                              </p>
                            </div>
                            <button className="text-button" onClick={() => setPage('exams')}>
                              عرض الكل <ArrowLeft size={17} />
                            </button>
                          </div>
                          {cards(exams.slice(-3).reverse())}
                          <div className="dashboard-bottom">
                            <div className="card quick-card">
                              <span className="soft-icon">
                                <ShieldCheck size={23} />
                              </span>
                              <div>
                                <h3>كل الإجابات، في مكان آمن</h3>
                                <p>البيانات تُحفظ على جهاز المعلم داخل شبكة المدرسة.</p>
                              </div>
                            </div>
                            <div className="card quick-card">
                              <span className="soft-icon lavender">
                                <Sparkles size={23} />
                              </span>
                              <div>
                                <h3>
                                  {teacher ? 'المراجعة تصنع الجودة' : 'ثقتك تبدأ من استعدادك'}
                                </h3>
                                <p>
                                  {teacher
                                    ? 'راجع الأسئلة المولدة قبل اعتماد الامتحان.'
                                    : 'ابدأ في الموعد، وإجاباتك تُحفظ أثناء الحل.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : page === 'exams' ? (
                        <>
                          <div className="page-title">
                            <div>
                              <h1>{teacher ? 'إدارة الامتحانات' : 'امتحاناتي'}</h1>
                              <p>
                                {teacher
                                  ? 'مسوداتك وامتحاناتك المنشورة في مساحة واحدة.'
                                  : 'الامتحانات المنشورة لصفك، والمحاولات التي بدأت بها.'}
                              </p>
                            </div>
                            {teacher && (
                              <button className="primary" onClick={create}>
                                <Plus size={18} /> إنشاء امتحان
                              </button>
                            )}
                          </div>
                          <nav className="exam-status-tabs" aria-label="حالة الامتحان">
                            {[
                              ['all', 'الكل'],
                              ['draft', 'المسودات'],
                              ['published', 'المنشورة'],
                              ['closed', 'المغلقة'],
                            ].map(([id, label]) => (
                              <button
                                key={id}
                                aria-pressed={examStatus === id}
                                onClick={() => setExamStatus(id)}
                              >
                                {label}
                                <span>
                                  {
                                    exams.filter((exam) => id === 'all' || exam.status === id)
                                      .length
                                  }
                                </span>
                              </button>
                            ))}
                          </nav>
                          {teacher&&<ExamFolders key={session.token} exams={exams} organization={examOrganization} onOrganization={setExamOrganization} folder={examFolder} onFolder={setExamFolder} moving={examMoving} onMoving={setExamMoving} notify={notify}/>}
                          <div className="toolbar card">
                            <label className="search-box">
                              <Search size={19} />
                              <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                aria-label="البحث في الامتحانات"
                                placeholder="ابحث عن امتحان أو مادة…"
                              />
                            </label>
                            {!teacher && (
                              <form
                                className="exam-code-entry"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void startExam();
                                }}
                              >
                                <input
                                  dir="ltr"
                                  placeholder="رمز الامتحان"
                                  value={examCode}
                                  onChange={(e) => setExamCode(e.target.value)}
                                />
                                <button className="primary small" disabled={busy || !examCode}>
                                  انضمام
                                </button>
                              </form>
                            )}
                            <select
                              aria-label="صف الامتحانات"
                              value={examGrade}
                              onChange={(event) => setExamGrade(event.target.value)}
                            >
                              <option value="">كل الصفوف</option>
                              {Array.from(new Set(exams.map((exam) => exam.grade)))
                                .sort((a, b) => a.localeCompare(b, 'ar', { numeric: true }))
                                .map((grade) => (
                                  <option key={grade} value={grade}>
                                    الصف {grade}
                                  </option>
                                ))}
                            </select>
                            <span className="muted">{filtered.length} امتحانات</span>
                          </div>
                          {!filtered.length && exams.length > 0 ? (
                            <div className="empty card">
                              <Search size={30} />
                              <h3>{teacher&&examFolder!=='all'&&!search&&examStatus==='all'&&!examGrade?'هذا المجلد فارغ':'لا توجد امتحانات مطابقة'}</h3>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setSearch('');
                                  setExamStatus('all');
                                  setExamGrade('');
                                  setExamFolder('all');
                                }}
                              >
                                عرض كل الامتحانات
                              </button>
                            </div>
                          ) : (
                            cards(filtered)
                          )}
                        </>
                      ) : page === 'students' && teacher ? (
                        <StudentsView
                          students={students}
                          exams={exams}
                          notify={notify}
                          act={act}
                          onStudentLogin={async (student) => {
                            const login = await api('/api/login', 'POST', {
                              role: 'student',
                              code: student.code,
                            });
                            setToken(login.token);
                            sessionGuard.current = login.token;
                            localStorage.setItem(
                              'school-account-scope',
                              login.teacherId || 'master',
                            );
                            setExams([]);
                            setStudents([]);
                            setAttempts([]);
                            setSession(login);
                            setPage('dashboard');
                            setEditing(undefined);
                            setSearch('');
                            setExamCode('');
                          }}
                        />
                      ) : teacher && ['monitor', 'live', 'results'].includes(page) ? (
                        <TeacherMonitoring
                          key={page}
                          exams={exams}
                          attempts={attempts}
                          connected={connection}
                          busy={busy}
                          initialResults={page === 'results'}
                          refresh={() => void refresh()}
                          renderAttempts={(rows, results) => table(results, rows)}
                          publish={(id) =>
                            void act(
                              () => api(`/api/exams/${id}/results`, 'POST'),
                              'نُشرت نتائج الامتحان',
                            )
                          }
                          closeExam={(id) =>
                            void act(
                              () => api(`/api/exams/${id}/close`, 'POST'),
                              'أُغلقت الإتاحة لمحاولات جديدة',
                            )
                          }
                          exportResults={() =>
                            void act(async () => {
                              const { csv } = await api('/api/results.csv');
                              if (window.desktop) await window.desktop.exportCSV(csv);
                              else download('results.csv', csv);
                            })
                          }
                        />
                      ) : page === 'settings' && teacher ? (
                        <SettingsView
                          hostInfo={hostInfo}
                          notify={notify}
                          onSchool={setSchool}
                          onRestore={() => {
                            setSession(undefined);
                            setToken('');
                          }}
                        />
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </main>
                <footer className="app-footer">
                  <span>{school} · الامتحانات الإلكترونية</span>
                  <ZunisBrand/>
                </footer>
              </div>
            </div>
            {teacher && <LiveLab key={session.token} attempts={attempts} />}
            {!teacher && (
              <StudentLiveSession
                key={session.token}
                token={session.token}
                attemptId={snapshot?.attempt.id}
                page={snapshot ? 'exam' : page}
              />
            )}
            {teacher && (
              <FloatingAssistant
                key={session.token}
                teacherId={session.teacherId||'master'}
                page={page}
                navigate={setPage}
                openExam={(exam) => {
                  setEditing(exam);
                  setPage('editor');
                  void refresh();
                }}
                updated={() => void refresh()}
              />
            )}
          </>
        </MotionConfig>
      )}
      {toast && (
        <div className="toast" role="status">
          <Info size={20} />
          {toast}
          <button onClick={() => setToast('')} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
      )}
      {photo && (
        <div className="modal-backdrop">
          <div className="modal card">
            <div className="question-heading">
              <h2>صورة الطالب</h2>
              <button onClick={() => setPhoto('')}>
                <X size={22} />
              </button>
            </div>
            <img className="photo-preview" src={photo} alt="صورة التقطت بطلب المعلم" />
          </div>
        </div>
      )}
    </>
  );
}
