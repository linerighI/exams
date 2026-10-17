import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  GripHorizontal,
  HelpCircle,
  LayoutGrid,
  MessageCircle,
  Minimize2,
  Plus,
  Search,
  Send,
  Sparkles,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import BlueOrb from './BlueOrb';
import StudentExamPanel from './StudentExamPanel';
import type { Attempt, Exam, Student } from './types';
import {
  allowedGuideAction,
  findHelpTopic,
  guideTone,
  helpTopics,
  normalizeHelp,
  studentGuideAnswer,
  type GuideAction,
  type GuideAnswer,
  type GuideContext,
  type HelpTopic,
} from './studentGuide';
import { useStudentGuide } from './StudentGuideContext';
import './studentCompanion.css';
const CompanionOrb = memo(BlueOrb);
type Message = {
  id: number;
  role: 'student' | 'guide';
  text: string;
  actions?: GuideAnswer['actions'];
};
export default function StudentCompanion({
  student,
  teacherId,
  page,
  exams,
  attempts,
  connected,
  busy,
  suspended,
  navigate,
  resume,
}: {
  student: Student;
  teacherId: string;
  page: string;
  exams: Exam[];
  attempts: Attempt[];
  connected: boolean;
  busy: boolean;
  suspended: boolean;
  navigate: (page: string) => void;
  resume: (attempt: Attempt) => void;
}) {
  const store = useStudentGuide()!;
  const exam = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const key = `student-companion:${teacherId}:${student.id}`;
  const [preferences] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || '{}');
    } catch {
      return {};
    }
  });
  const [quiet, setQuiet] = useState(preferences?.quiet === true),
    [small, setSmall] = useState(preferences?.small === true),
    [open, setOpen] = useState(false),
    [tab, setTab] = useState('help'),
    [text, setText] = useState(''),
    [category, setCategory] = useState('all');
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight });
  const widgetHeight = small ? 182 : 338;
  const clamp = (y: number, height = window.innerHeight) =>
    Math.max(78, Math.min(height - widgetHeight - 30, y));
  const [y, setY] = useState(() =>
    clamp(
      typeof preferences?.position === 'number' && Number.isFinite(preferences.position)
        ? preferences.position * innerHeight
        : innerHeight - 310,
    ),
  );
  const button = useRef<HTMLButtonElement>(null),
    input = useRef<HTMLInputElement>(null),
    end = useRef<HTMLDivElement>(null),
    sequence = useRef(1),
    panel = useRef<HTMLElement>(null);
  const [messages, setMessages] = useState<Message[]>([]),
    [tip, setTip] = useState<{ text: string; topic: HelpTopic } | null>(null),
    [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [focusEnd, setFocusEnd] = useState(0),
    [focusRemaining, setFocusRemaining] = useState(12);
  const seen = useRef(new Set<string>()),
    drag = useRef<{ pointer: number; startY: number; origin: number } | null>(null);
  const active = attempts.filter((a) => !a.submittedAt);
  const context: GuideContext = {
    name: student.name.split(' ')[0],
    page,
    connected,
    available: exams.filter(
      (e) =>
        e.status === 'published' &&
        Date.parse(e.opensAt) <= Date.now() &&
        Date.parse(e.closesAt) > Date.now() &&
        !attempts.some((a) => a.examId === e.id),
    ).length,
    active: active.length,
    published: attempts.filter(
      (a) =>
        a.submittedAt &&
        a.score != null &&
        exams.some((e) => e.id === a.examId && e.resultsPublished),
    ).length,
    waiting: attempts.filter(
      (a) =>
        a.submittedAt &&
        !(a.score != null && exams.some((e) => e.id === a.examId && e.resultsPublished)),
    ).length,
    exam,
  };
  const tone = guideTone(context),
    hidden = suspended || !!exam?.modalOpen;
  const stateLabel = exam?.finished
    ? 'تم تأكيد التسليم'
    : exam?.saveState === 'error'
      ? 'الحفظ يحتاج مساعدة المعلم'
      : exam?.saveState === 'saving'
        ? 'جارٍ الحفظ على الجهاز'
        : !(exam?.online ?? connected)
          ? 'تحقق من الاتصال'
          : exam?.frozen
            ? 'جارٍ التسليم'
            : exam?.answered === exam?.total && exam
              ? 'جاهز للمراجعة'
              : exam
                ? `${exam.answered} / ${exam.total} إجابات`
                : 'أنا معك، خطوة بخطوة';
  const welcome = () =>
    `أهلًا ${context.name}، أنا رفيقك. أساعدك في استخدام التطبيق وتنظيم خطواتك، برسائل جاهزة تعمل دون إنترنت. ماذا تحتاج الآن؟`;
  useEffect(() => {
    const resize = () => {
      setViewport({ width: innerWidth, height: innerHeight });
      setY((p) => clamp(p));
    };
    window.addEventListener('resize', resize);
    setY((p) => clamp(p));
    return () => window.removeEventListener('resize', resize);
  }, [small]);
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ quiet, small, position: y / viewport.height }));
    } catch {}
  }, [quiet, small, y, key, viewport.height]);
  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);
  useEffect(() => {
    if (open) {
      if (tab === 'help' && !exam) input.current?.focus();
      else panel.current?.focus();
    }
  }, [open, tab, !!exam]);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [messages, open]);
  useEffect(() => {
    if (!focusEnd || !open || tab !== 'focus' || exam) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((focusEnd - Date.now()) / 1000));
      setFocusRemaining(left);
      if (!left) setFocusEnd(0);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [focusEnd, open, tab, !!exam]);
  useEffect(() => {
    if (!open || tab !== 'focus') {
      setFocusEnd(0);
      setFocusRemaining(12);
    }
  }, [open, tab]);
  useEffect(() => {
    if (quiet || hidden) return;
    const id = exam?.id || 'space';
    let event: string | undefined,
      next: typeof tip = null;
    if (exam?.saveState === 'error') {
      event = `${id}:save-error`;
      next = { topic: 'save', text: 'تعذر الحفظ على جهازك. أبقِ التطبيق مفتوحًا وأبلغ المعلم.' };
    } else if (!(exam?.online ?? connected)) {
      event = `${id}:offline`;
      next = {
        topic: 'connection',
        text: 'الاتصال غير متاح. اقرأ حالة الحفظ، وأبلغ المعلم إن استمر الانقطاع.',
      };
    } else if (exam?.finished) {
      event = `${id}:finished`;
      next = { topic: 'results', text: 'وصلت محاولتك. أحسنت إكمال خطوات التسليم.' };
    } else if (exam && !exam.frozen && exam.answered === exam.total) {
      event = `${id}:ready`;
      next = { topic: 'submit', text: 'أجبت عن الجميع! خذ مراجعة أخيرة ثم أكّد التسليم.' };
    } else if (exam && !exam.frozen && exam.remaining > 0 && exam.remaining <= 300) {
      event = `${id}:time`;
      next = { topic: 'time', text: 'بقيت خمس دقائق أو أقل. راجع الوقت والأسئلة المتروكة بهدوء.' };
    } else if (exam?.finishRequested && exam.missing.length) {
      event = `${id}:missing`;
      next = {
        topic: 'review',
        text: `بقي ${exam.missing.length} أسئلة. أستطيع أخذك لأول سؤال غير مجاب.`,
      };
    } else if (!exam) {
      event = 'welcome';
      next = { topic: 'ready', text: 'أنا رفيقك. اضغط كرتي للمساعدة، واسحب المقبض لتحريكي.' };
    }
    if (event && !seen.current.has(event)) {
      seen.current.add(event);
      setTip(next);
    }
  }, [
    quiet,
    hidden,
    connected,
    exam?.id,
    exam?.online,
    exam?.finished,
    exam?.answered,
    exam?.total,
    exam?.frozen,
    exam?.remaining,
    exam?.finishRequested,
    exam?.saveState,
  ]);
  useEffect(() => {
    if (!tip) return;
    const timer = setTimeout(() => setTip(null), 9000);
    return () => clearTimeout(timer);
  }, [tip]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const ask = (topic: HelpTopic | null, question?: string) => {
    if (exam) {
      setOpen(true);
      setTip(null);
      return;
    }
    const answer = studentGuideAnswer(topic, context);
    setMessages((previous) =>
      [
        ...previous,
        {
          id: sequence.current++,
          role: 'student' as const,
          text: question || helpTopics.find((t) => t.id === topic)?.title || 'أحتاج للمساعدة',
        },
        { id: sequence.current++, role: 'guide' as const, ...answer },
      ].slice(-24),
    );
    setText('');
    setOpen(true);
    setTab('help');
    setTip(null);
  };
  useEffect(() => {
    store.setHelper((topic) => ask(topic));
    return () => store.setHelper(null);
  });
  const run = (id: GuideAction) => {
    if (busy || !allowedGuideAction(id, context)) return;
    if (id === 'focus' || id === 'checklist') {
      setOpen(true);
      setTab(id === 'focus' ? 'focus' : 'ready');
      return;
    }
    if (['home', 'exams', 'results', 'resume'].includes(id)) {
      if (exam?.finished) store.run('home');
      setOpen(false);
      if (id === 'resume' && active[0]) resume(active[0]);
      else navigate(id === 'home' ? 'dashboard' : id === 'resume' ? 'exams' : id);
      return;
    }
    if (!exam || !['mark', 'next', 'previous', 'missing', 'review'].includes(id)) setOpen(false);
    store.run(id);
  };
  const categories = [
    ['all', 'الكل'],
    ['exam', 'الامتحان'],
    ['connection', 'الحفظ والاتصال'],
    ['tools', 'الأدوات'],
    ['results', 'النتائج'],
    ['account', 'حسابي'],
    ['getting-ready', 'الاستعداد'],
  ];
  const filtered = helpTopics.filter(
    (t) =>
      (category === 'all' || t.category === category) &&
      (!text.trim() ||
        normalizeHelp(`${t.title} ${t.keywords.join(' ')}`).includes(normalizeHelp(text))),
  );
  const primaryTopics: HelpTopic[] = exam
    ? ['progress', 'save', 'review', 'time', 'submit', 'calculator']
    : page === 'results'
      ? ['results', 'submit', 'resume', 'logout', 'connection', 'focus']
      : ['start', 'ready', 'save', 'results', 'connection', 'logout'];
  const panelWidth = Math.min(exam ? 350 : 410, viewport.width - 24),
    panelLeft = viewport.width >= 1200 ? 184 : 12;
  const panelTop = exam ? Math.max(76, Math.min(y - 130, viewport.height - 520)) : 76;
  return createPortal(
    <div className={`student-companion-root ${quiet ? 'is-quiet' : ''}`}>
      <aside
        className={`student-companion is-${tone} ${small ? 'is-small' : ''} ${exam ? 'in-exam' : ''}`}
        style={{ top: y }}
        hidden={hidden}
        aria-label="رفيق الطالب"
      >
        <div className="companion-controls">
          <button
            aria-label={quiet ? 'إيقاف وضع التركيز' : 'تشغيل وضع التركيز'}
            aria-pressed={quiet}
            title="إيقاف الحركة والتلميحات"
            onClick={() => {
              setQuiet((v) => !v);
              setTip(null);
            }}
          >
            <VolumeX size={14} />
          </button>
          <button
            className="companion-drag"
            aria-label="تحريك رفيقي لأعلى أو أسفل"
            title="اسحب لأعلى أو أسفل · أو استخدم السهمين"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              drag.current = { pointer: e.pointerId, startY: e.clientY, origin: y };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag.current?.pointer === e.pointerId)
                setY(clamp(drag.current.origin + e.clientY - drag.current.startY));
            }}
            onPointerUp={(e) => {
              drag.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                setY((p) => clamp(p + (e.key === 'ArrowUp' ? -40 : 40)));
              }
              if (e.key === 'Home') {
                e.preventDefault();
                setY(78);
              }
              if (e.key === 'End') {
                e.preventDefault();
                setY(clamp(innerHeight));
              }
            }}
          >
            <GripHorizontal size={19} />
          </button>
          <button
            aria-label={small ? 'تكبير رفيقي' : 'تصغير رفيقي'}
            onClick={() => setSmall((v) => !v)}
          >
            {small ? <Plus size={15} /> : <Minimize2 size={14} />}
          </button>
        </div>
        <button
          ref={button}
          className="companion-ball"
          aria-label="مرافق الطالب"
          aria-expanded={open}
          aria-controls="student-guide-panel"
          onClick={() => {
            setOpen((v) => !v);
            setTip(null);
            setTab('help');
          }}
        >
          <span className="companion-orbit-halo" aria-hidden="true" />
          <svg className="companion-progress-ring" viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="74" />
            <circle
              cx="80"
              cy="80"
              r="74"
              pathLength="100"
              strokeDasharray={`${exam ? (exam.answered / exam.total) * 100 : 100} 100`}
            />
          </svg>
          <span className="companion-orb-art" aria-hidden="true">
            <CompanionOrb size={small ? 1.04 : 1.75} tone={tone} animationSpeedBase={0.22} />
          </span>
          <span className="companion-spark" aria-hidden="true">
            <Sparkles size={small ? 13 : 18} />
          </span>
          <span className="companion-face" aria-hidden="true">
            <i />
            <i />
          </span>
        </button>
        {!small && (
          <>
            <strong className="companion-name">
              رفيقك <span>معك في كل خطوة</span>
            </strong>
            <span className="companion-state">{stateLabel}</span>
          </>
        )}
        {exam && !exam.finished ? (
          <button
            className="companion-finish"
            aria-label="تسليم الامتحان"
            disabled={busy || exam.frozen}
            onClick={() => run('submit')}
          >
            {exam.frozen
              ? 'جارٍ التسليم…'
              : exam.answered === exam.total
                ? 'مراجعة وتسليم'
                : 'تسليم الامتحان'}
            {exam.answered === exam.total ? <CheckCheck size={15} /> : <Send size={14} />}
          </button>
        ) : (
          <button
            className="companion-ask"
            onClick={() => {
              setOpen(true);
              setTab('help');
              setTip(null);
            }}
          >
            {exam ? <LayoutGrid size={14} /> : <MessageCircle size={14} />}
            {exam ? 'أدوات المحاولة' : small ? 'مساعدة' : 'اسأل رفيقك'}
          </button>
        )}
        {!small && exam && !exam.finished && (
          <span className="companion-question-position">
            السؤال {exam.current} من {exam.total}
          </span>
        )}
      </aside>
      {tip && !open && !hidden && !quiet && !small && (
        <div
          className="companion-tip"
          role="status"
          style={{
            top: Math.max(80, Math.min(y + 45, viewport.height - 155)),
            left: viewport.width >= 1200 ? 174 : 145,
            maxWidth: Math.max(
              130,
              Math.min(250, viewport.width - (viewport.width >= 1200 ? 194 : 165)),
            ),
          }}
        >
          <button
            className="companion-tip-dismiss"
            aria-label="إخفاء تلميح رفيقي"
            onClick={() => setTip(null)}
          >
            <X size={13} />
          </button>
          <p>{tip.text}</p>
          <button className="companion-tip-more" onClick={() => ask(tip.topic)}>
            ساعدني
            <ArrowLeft size={13} />
          </button>
        </div>
      )}
      {open && !hidden && exam && (
        <StudentExamPanel
          context={context}
          busy={busy}
          onAction={run}
          onClose={close}
          panelRef={panel}
          style={{
            left: panelLeft,
            width: panelWidth,
            top: panelTop,
            maxHeight: Math.min(500, viewport.height - panelTop - 25),
          }}
        />
      )}
      {open && !hidden && !exam && (
        <section
          ref={panel}
          id="student-guide-panel"
          className="student-guide-panel"
          role="dialog"
          aria-label="دليل رفيق الطالب"
          tabIndex={-1}
          style={{ left: panelLeft, width: panelWidth, top: 76, maxHeight: viewport.height - 105 }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <header>
            <div className="guide-header-mark">
              <Sparkles size={22} />
            </div>
            <div>
              <h2>رفيقك، هنا للمساعدة</h2>
              <p>دليل جاهز · يعمل دون إنترنت</p>
            </div>
            <button
              aria-label="بدء محادثة مساعدة جديدة"
              title="محادثة جديدة"
              onClick={() => {
                setMessages([]);
                setText('');
                setTab('help');
              }}
            >
              <Plus size={17} />
            </button>
            <button aria-label="إغلاق دليل رفيقي" onClick={close}>
              <X size={18} />
            </button>
          </header>
          <div className={`guide-live-status is-${tone}`}>
            <span>
              {connected ? <Wifi size={15} /> : <WifiOff size={15} />} {stateLabel}
            </span>
          </div>
          <nav className="guide-tabs" aria-label="أقسام رفيقي">
            {[
              ['help', 'المساعدة'],
              ['ready', 'الاستعداد'],
              ['focus', 'لحظة تركيز'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="guide-content">
            {tab === 'help' ? (
              <>
                <div
                  className="guide-conversation"
                  role="log"
                  aria-label="رسائل المساعدة"
                  aria-live="polite"
                >
                  <article className="guide-message from-guide">
                    <span>رفيقك</span>
                    <p>{welcome()}</p>
                  </article>
                  {messages.map((m) => (
                    <article key={m.id} className={`guide-message from-${m.role}`}>
                      <span>{m.role === 'guide' ? 'رفيقك · إرشاد جاهز' : 'أنت'}</span>
                      <p>{m.text}</p>
                      {m.actions?.length ? (
                        <div className="guide-message-actions">
                          {m.actions.map((a) => (
                            <button
                              key={a.id}
                              disabled={busy || !allowedGuideAction(a.id, context)}
                              onClick={() => run(a.id)}
                            >
                              {a.label}
                              <ArrowLeft size={13} />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                  <div ref={end} />
                </div>
                {!text && !messages.length && (
                  <div className="guide-quick-questions">
                    {primaryTopics.map((id) => (
                      <button key={id} onClick={() => ask(id)}>
                        <HelpCircle size={14} />
                        {helpTopics.find((t) => t.id === id)?.title}
                      </button>
                    ))}
                  </div>
                )}
                <details className="guide-library">
                  <summary>
                    كل أسئلة المساعدة <span>{helpTopics.length}</span>
                  </summary>
                  <div className="guide-categories">
                    {categories.map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={category === id}
                        className={category === id ? 'active' : ''}
                        onClick={() => setCategory(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="guide-faq-list">
                    {filtered.map((t) => (
                      <button key={t.id} onClick={() => ask(t.id)}>
                        {t.title}
                        <ArrowLeft size={13} />
                      </button>
                    ))}
                    {!filtered.length && <p>جرّب كلمة مثل «الحفظ» أو «الوقت».</p>}
                  </div>
                </details>
              </>
            ) : tab === 'ready' ? (
              <div className="guide-readiness">
                <span className="guide-section-icon">
                  <CheckCheck size={25} />
                </span>
                <h3>ثلاث خطوات، وبداية أوضح.</h3>
                <p>تذكيرك الشخصي قبل الامتحان. لا يغيّر شروط الدخول أو تعليمات المعلم.</p>
                {[
                  'قرأت اسم الامتحان ومدته وموعده.',
                  'أعرف الفرق بين الحفظ على جهازي والوصول للمعلم.',
                  'أعرف كيف أراجع إجاباتي وأؤكد التسليم.',
                ].map((label, i) => (
                  <label key={label} className={checks[i] ? 'checked' : ''}>
                    <input
                      type="checkbox"
                      checked={checks[i]}
                      onChange={(e) =>
                        setChecks((values) =>
                          values.map((v, j) => (i === j ? e.target.checked : v)),
                        )
                      }
                    />
                    <span>{label}</span>
                    {checks[i] && <Check size={17} />}
                  </label>
                ))}
                <div className="guide-readiness-count">
                  {checks.filter(Boolean).length} / 3{' '}
                  <span>
                    {checks.every(Boolean)
                      ? 'اكتملت قائمتك. اتبع تعليمات المعلم.'
                      : 'خطوة صغيرة في كل مرة.'}
                  </span>
                </div>
                <button className="guide-solid-button" onClick={() => ask('start')}>
                  ما خطوتي التالية؟
                  <ArrowLeft size={15} />
                </button>
              </div>
            ) : (
              <div className="guide-focus">
                <div className="guide-focus-clock">
                  <svg viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="53" />
                    <circle
                      cx="60"
                      cy="60"
                      r="53"
                      pathLength="100"
                      strokeDasharray={`${focusEnd ? ((12 - focusRemaining) / 12) * 100 : focusRemaining === 0 ? 100 : 0} 100`}
                    />
                  </svg>
                  <strong>{focusRemaining === 0 ? <Check size={31} /> : focusRemaining}</strong>
                </div>
                <h3>
                  {focusRemaining === 0
                    ? 'عد إلى سؤالك، خطوة بخطوة.'
                    : !focusEnd
                      ? 'لحظة قصيرة لترتيب أفكارك.'
                      : focusRemaining > 8
                        ? 'أرح كتفيك، وخذ وقتك.'
                        : focusRemaining > 4
                          ? 'اقرأ المطلوب بهدوء.'
                          : 'اختر خطوتك التالية.'}
                </h3>
                <p>يمكنك مراجعة سؤال آخر والعودة لما تركته. هذه الوقفة لا توقف عدّاد الامتحان.</p>
                <button
                  className="guide-solid-button"
                  onClick={() => {
                    if (focusEnd) {
                      setFocusEnd(0);
                      setFocusRemaining(12);
                    } else {
                      setFocusRemaining(12);
                      setFocusEnd(Date.now() + 12000);
                    }
                  }}
                >
                  {focusEnd ? 'إنهاء الوقفة' : 'ابدأ وقفة ١٢ ثانية'}
                </button>
              </div>
            )}
          </div>
          {tab === 'help' && (
            <form
              className="guide-question-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) ask(findHelpTopic(text), text.trim());
              }}
            >
              <Search size={17} />
              <input
                ref={input}
                aria-label="اسأل رفيقك عن استخدام التطبيق"
                maxLength={250}
                placeholder="اسأل عن الوقت، الحفظ، النتائج…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button aria-label="إرسال سؤال المساعدة" disabled={!text.trim()}>
                <ArrowLeft size={18} />
              </button>
            </form>
          )}
          <footer>
            <span>
              <Check size={12} />
              إرشاد للاستخدام، دون تقديم إجابات الامتحان
            </span>
            <button
              aria-pressed={quiet}
              onClick={() => {
                setQuiet((v) => !v);
                setTip(null);
              }}
            >
              {quiet ? 'وضع هادئ مفعّل' : 'وضع هادئ'}
            </button>
          </footer>
        </section>
      )}
    </div>,
    document.body,
  );
}
