import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  ArrowUpLeft,
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  FileText,
  GraduationCap,
  History,
  Layers,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { api } from './api';
import MathText from './MathText';
import type { Exam, Attempt } from './types';
import './studio.css';
import { assistantCommands, parseCommand } from './assistantCommands';
import './assistantTools.css';
import ProviderSwitch from './ProviderSwitch';
import AssistantProposal from './AssistantProposal';
import SpeechReadButton from './SpeechReadButton';
import SpeechDictation, { appendDictation } from './SpeechDictation';
import { activateWorkspaceCard } from './assistantWorkspaceActions';
type Props = {
  notify: (s: string) => void;
  openExam: (e: Exam) => void;
  navigate: (p: string) => void;
  overview?: { exams: Exam[]; students: number; attempts: Attempt[] };
  createExam?: () => void;
};
const spring = { type: 'spring' as const, stiffness: 290, damping: 27 };

export function PaperScene({ kind = 'exam' }: { kind?: 'exam' | 'book' | 'insights' }) {
  return (
    <div className={`paper-scene scene-${kind}`} aria-hidden="true">
      <div className="paper-shadow" />
      <div className="scene-paper back">
        <span />
        <span />
        <span />
      </div>
      <div className="scene-paper front">
        <div className="paper-seal">
          {kind === 'exam' ? <GraduationCap /> : kind === 'book' ? <BookOpen /> : <TrendingUp />}
        </div>
        <i />
        <i />
        <i />
        {kind === 'insights' ? (
          <div className="mini-chart">
            <b />
            <b />
            <b />
            <b />
          </div>
        ) : (
          <div className="paper-formula">{kind === 'exam' ? 'x² + y²' : 'أ ب ج'}</div>
        )}
      </div>
      <div className="scene-badge">
        {kind === 'exam' ? <Check size={14} /> : <Sparkles size={14} />}
      </div>
    </div>
  );
}
export default function AssistantView({ notify, openExam, navigate, overview, createExam }: Props) {
  const [chats, setChats] = useState<any[]>([]),
    [chat, setChat] = useState<any>(),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(''),
    [books, setBooks] = useState<any[]>([]),
    [bookId, setBook] = useState(''),
    [picker, setPicker] = useState(false),
    [search, setSearch] = useState(''),
    [copied, setCopied] = useState('');
  const end = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  const reduced = useReducedMotion();
  const [activeCommand, setActiveCommand] = useState('');
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [commandIndex, setCommandIndex] = useState(0);
  const [modelInfo, setModelInfo] = useState<any>();
  const currentCommand = assistantCommands.find((c) => c.id === activeCommand);
  const commandQuery = message.startsWith('/') ? message.slice(1).trim().toLowerCase() : '';
  const commandOptions = assistantCommands.filter(
    (c) =>
      !commandQuery ||
      `${c.ar} ${c.id} ${c.label} ${c.aliases.join(' ')}`.toLowerCase().includes(commandQuery),
  );
  const showCommands =
    commandsOpen || (!activeCommand && message.startsWith('/') && !/\s/.test(message));
  const chooseCommand = (command: (typeof assistantCommands)[number]) => {
    setActiveCommand(command.id);
    setMessage('');
    setCommandsOpen(false);
    setPicker(false);
    setCommandIndex(0);
    input.current?.focus();
  };
  const commandText = (value: string) => {
    const parsed = parseCommand(value);
    return parsed ? (
      <>
        <mark className="command-token">/{parsed.command.ar}</mark> <MathText text={parsed.rest} />
      </>
    ) : (
      <MathText text={value} />
    );
  };
  useEffect(() => {
    void api('/api/assistant/status')
      .then(setModelInfo)
      .catch(() => setModelInfo({ ready: false }));
    void Promise.all([api('/api/assistant/conversations'), api('/api/books')])
      .then(([c, b]) => {
        setChats(c.slice().reverse());
        setBooks(b);
      })
      .catch((e) => notify(e.message));
  }, []);
  useEffect(() => {
    if (!chat?.messages.length && !busy) return;
    const timer = setTimeout(
      () => end.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'end' }),
      420,
    );
    return () => clearTimeout(timer);
  }, [chat?.messages.length, busy]);
  const [voiceListening, setVoiceListening] = useState(false);
  async function send(text = message) {
    if (voiceListening) {
      notify('أوقف الإملاء أولًا، ثم راجع الرسالة وأرسلها.');
      return;
    }
    if ((!text.trim() && !activeCommand) || busy) return;
    text = parseCommand(text) ? text : currentCommand ? `/${currentCommand.ar} ${text}` : text;
    setBusy(true);
    setPending(text);
    setMessage('');
    setPicker(false);
    setActiveCommand('');
    setCommandsOpen(false);
    try {
      const result = await api('/api/assistant/messages', 'POST', {
        conversationId: chat?.id,
        message: text,
        bookId: bookId || undefined,
      });
      setChat(result.conversation);
      setChats((await api('/api/assistant/conversations')).reverse());
      setPending('');
    } catch (e) {
      notify((e as Error).message);
      setMessage(text);
      setPending('');
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }
  const selectedBook = books.find((b) => b.id === bookId);
  const hasMessages = !!chat?.messages.length || !!pending;
  const newChat = () => {
    if (busy) return;
    setChat(undefined);
    setMessage('');
    setBook('');
    setActiveCommand('');
    setCommandsOpen(false);
    input.current?.focus();
  };
  const cards = [
    {
      kind: 'exam' as const,
      title: 'إنشاء امتحان بالمساعد',
      subtitle: 'حدد المادة وعدد الأسئلة',
      action: () => {
        chooseCommand(assistantCommands.find((c) => c.id === 'exam')!);
        input.current?.focus();
      },
      icon: GraduationCap,
    },
    {
      kind: 'book' as const,
      title: 'بنك الأسئلة',
      subtitle: 'أضف كتابًا أو راجع الأسئلة',
      action: () => navigate('books'),
      icon: BookOpen,
    },
    {
      kind: 'insights' as const,
      title: 'تحليل النتائج',
      subtitle: 'ملخص أداء الطلاب',
      action: () => void send('/إحصاءات لخص أداء الطلاب بناء على النتائج المتاحة'),
      icon: TrendingUp,
    },
  ];
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="ai-studio"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <aside className="studio-history">
          <header>
            <span className="history-title">
              <MessageCircle size={18} />
              مساحة محادثاتك
            </span>
            <motion.button
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="studio-icon"
              aria-label="محادثة جديدة"
              title="محادثة جديدة"
              onClick={newChat}
              disabled={busy}
            >
              <Plus size={20} />
            </motion.button>
          </header>
          <div className="history-search">
            <Search size={15} />
            <input
              aria-label="البحث في المحادثات"
              placeholder="ابحث عن فكرة سابقة…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span>⌘ K</span>
          </div>
          <div className="history-section-title">
            <span>المحادثات</span>
            <span>{chats.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="studio-history-list">
            {chats
              .filter((c) => c.title.includes(search))
              .map((c, i) => (
                <motion.button
                  key={c.id}
                  className={`studio-history-item ${chat?.id === c.id ? 'selected' : ''}`}
                  onClick={() => {
                    if (!busy) {
                      setChat(c);
                      setPicker(false);
                    }
                  }}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.2) }}
                  whileHover={{ x: -3 }}
                >
                  <span className="history-item-icon">
                    <MessageCircle size={15} />
                  </span>
                  <span>
                    <strong>{c.title}</strong>
                    <small>{c.messages?.length || 0} رسائل · مساحة المعلم</small>
                  </span>
                  <ArrowUpLeft size={15} />
                </motion.button>
              ))}
            {!chats.length && (
              <div className="history-empty">
                <History size={24} />
                <p>لا توجد محادثات بعد</p>
                <small>ستجد محادثاتك هنا.</small>
              </div>
            )}
          </div>
          <button className="history-library-link" onClick={() => navigate('books')}>
            <BookOpen size={18} />
            بنك الأسئلة
            <ArrowUpLeft size={15} />
          </button>
          <footer>
            <span className="history-avatar">
              <GraduationCap size={18} />
            </span>
            <span>
              <strong>مدرسة محمد الشريقي</strong>
              <small>مساحة المعلم الخاصة</small>
            </span>
            <span className="status-pip" />
          </footer>
        </aside>
        <section className="studio-chat">
          <header className="studio-chat-header">
            <div>
              <span className="studio-heading-icon">
                <Sparkles size={17} />
              </span>
              <strong>{chat?.title || 'محادثة جديدة'}</strong>
              <span className="studio-beta">مساعد المعلم</span>
            </div>
            <div>
              <ProviderSwitch
                disabled={busy}
                notify={notify}
                onChange={() => {
                  void api('/api/assistant/status')
                    .then(setModelInfo)
                    .catch(() => setModelInfo({ ready: false }));
                }}
              />
              <span
                className="studio-model"
                title={
                  modelInfo?.ready
                    ? modelInfo.model
                    : 'اضبط المزود والنموذج أو المفتاح من الإعدادات. الأوامر المباشرة تعمل دون النموذج.'
                }
              >
                <span className={modelInfo?.ready ? 'model-ready' : 'model-unready'} />
                {modelInfo?.provider === 'openai'
                  ? 'OpenAI'
                  : modelInfo?.provider === 'gemini'
                    ? 'Gemini'
                    : 'Ollama محلي'}
              </span>
              <button
                className="studio-icon"
                title="إعدادات المساعد"
                aria-label="إعدادات المساعد"
                onClick={() => navigate('settings')}
              >
                <MoreHorizontal size={20} />
              </button>
            </div>
          </header>
          <div className={`studio-scroll ${hasMessages ? 'has-messages' : ''}`}>
            <AnimatePresence mode="wait">
              {!hasMessages ? (
                <motion.div
                  className="studio-intro"
                  key="intro"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="intro-greeting">
                    <motion.div
                      className="assistant-emblem"
                      animate={reduced ? {} : { y: [0, -5, 0] }}
                      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Sparkles size={24} />
                      <span />
                    </motion.div>
                    <div>
                      <span>مساحة المعلم</span>
                      <h1>مرحبًا أستاذي، ماذا ننجز اليوم؟</h1>
                    </div>
                  </div>
                  {overview && (
                    <div className="home-overview" aria-label="ملخص المدرسة">
                      {[
                        [overview.exams.length, 'امتحاناتك'],
                        [overview.students, 'طالب مسجل'],
                        [overview.attempts.filter((a) => !a.submittedAt).length, 'محاولات نشطة'],
                        [overview.attempts.filter((a) => !!a.submittedAt).length, 'تم تسليمها'],
                      ].map(([value, label]) => (
                        <button
                          key={label}
                          onClick={() =>
                            navigate(
                              label === 'طالب مسجل'
                                ? 'students'
                                : label === 'محاولات نشطة'
                                  ? 'live'
                                  : label === 'تم تسليمها'
                                    ? 'results'
                                    : 'exams',
                            )
                          }
                        >
                          <b>{value}</b>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <nav className="teacher-home-shortcuts" aria-label="اختصارات المعلم">
                    <button onClick={createExam || (() => navigate('exams'))}>
                      <Plus size={16} />
                      إنشاء امتحان يدوي
                    </button>
                    <button onClick={() => navigate('students')}>
                      <GraduationCap size={16} />
                      إدارة الطلاب
                    </button>
                    <button onClick={() => navigate('tools')}>
                      <BookOpen size={16} />
                      فتح الأدوات
                    </button>
                  </nav>
                  <div className="studio-action-cards">
                    {cards.map((c, i) => (
                      <motion.button
                        key={c.kind}
                        className={`studio-action-card action-${c.kind}`}
                        onClick={c.action}
                        initial={{ opacity: 0, y: 25 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 + i * 0.09, ...spring }}
                        whileHover={{ y: -7, rotate: i === 0 ? -1 : 1 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <PaperScene kind={c.kind} />
                        <span className="action-card-bottom">
                          <span className="action-icon">
                            <c.icon size={16} />
                          </span>
                          <span>
                            <strong>{c.title}</strong>
                            <small>{c.subtitle}</small>
                          </span>
                          <ArrowUpLeft size={17} />
                        </span>
                      </motion.button>
                    ))}
                  </div>
                  {overview && (
                    <section className="home-recent">
                      <header>
                        <h3>آخر امتحاناتك</h3>
                        <div>
                          <button onClick={createExam}>+ امتحان يدوي</button>
                          <button onClick={() => navigate('exams')}>عرض الكل ↖</button>
                        </div>
                      </header>
                      {overview.exams.length ? (
                        <div>
                          {overview.exams
                            .slice(-3)
                            .reverse()
                            .map((e) => (
                              <button key={e.id} onClick={() => openExam(e)}>
                                <BookOpen size={17} />
                                <span>
                                  <strong>{e.title}</strong>
                                  <small>
                                    {e.subject} ·{' '}
                                    {e.status === 'draft'
                                      ? 'مسودة'
                                      : e.status === 'published'
                                        ? 'منشور'
                                        : 'مغلق'}
                                  </small>
                                </span>
                                <ArrowUpLeft size={14} />
                              </button>
                            ))}
                        </div>
                      ) : (
                        <p>مساحتك جاهزة لأول امتحان. استورد بنكًا أو ابدأ امتحانًا يدويًا.</p>
                      )}
                    </section>
                  )}
                  <div className="studio-starters">
                    <span>جرّب أن تسأل</span>
                    {['أنشئ امتحان رياضيات من 10 أسئلة', 'كيف أقرأ نتائج طلابي؟'].map((text) => (
                      <button
                        key={text}
                        onClick={() => {
                          setMessage(text);
                          input.current?.focus();
                        }}
                      >
                        {text}
                        <ArrowUpLeft size={13} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  className="studio-thread"
                  key={chat?.id || 'pending'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {chat?.messages.map((m: any) => (
                    <motion.article
                      key={m.id}
                      className={`studio-message ${m.role}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={spring}
                    >
                      <div className="message-avatar">
                        {m.role === 'user' ? <GraduationCap size={17} /> : <Sparkles size={17} />}
                      </div>
                      <div className="message-content">
                        <span className="message-byline">
                          {m.role === 'user' ? 'أنت' : 'المساعد'}
                          <small>{m.role === 'assistant' ? 'معك، خطوة بخطوة' : ''}</small>
                        </span>
                        <div className="message-prose">{commandText(m.text)}</div>
                        {m.role === 'assistant' && <SpeechReadButton text={m.text} />}
                        {m.cards?.length > 0 && (
                          <div className="assistant-result-grid">
                            {m.cards.map((card: any, i: number) => (
                              <motion.article
                                className={`assistant-result-card result-${card.kind}`}
                                key={`${card.kind}-${card.id}-${i}`}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i * 0.05, 0.3) }}
                              >
                                {['exam', 'book', 'insight', 'status'].includes(card.kind) && (
                                  <PaperScene
                                    kind={
                                      card.kind === 'exam'
                                        ? 'exam'
                                        : card.kind === 'book'
                                          ? 'book'
                                          : 'insights'
                                    }
                                  />
                                )}
                                <div className="result-content">
                                  <span className="result-label">
                                    {
                                      (
                                        {
                                          exam: 'مسودة امتحان',
                                          book: 'بنك أسئلة',
                                          question: 'من بنك المعرفة',
                                          student: 'ملف طالب',
                                          insight: 'من بيانات المدرسة',
                                          status: 'متابعة المختبر',
                                          command: 'أداة المساعد',
                                          prompt: 'اقتراح المساعد',
                                          navigation: 'مساحة العمل',
                                          proposal: 'اقتراح للمراجعة',
                                          tool: 'أداة المعلم',
                                          live_room: 'المتابعة المباشرة',
                                        } as any
                                      )[card.kind]
                                    }
                                  </span>
                                  <h3>
                                    <MathText text={card.title} />
                                  </h3>
                                  <p>{card.subtitle}</p>
                                  {card.image &&
                                    /^data:image\/(png|jpeg);base64,/.test(card.image) && (
                                      <img src={card.image} alt="رسم السؤال" />
                                    )}
                                  {card.value && (
                                    <strong className="result-value">{card.value}</strong>
                                  )}
                                  {card.note && <small>{card.note}</small>}
                                  {card.kind === 'prompt' && (
                                    <textarea
                                      className="result-prompt"
                                      aria-label="اقتراح طلب البنك"
                                      value={card.prompt}
                                      readOnly
                                    />
                                  )}
                                  {card.kind === 'exam' && (
                                    <div className="result-meta">
                                      <span>{card.count} أسئلة</span>
                                      <span>{card.duration} دقيقة</span>
                                      <span>{card.total} درجة</span>
                                    </div>
                                  )}
                                  {card.kind === 'proposal' && (
                                    <AssistantProposal card={card} onApplied={notify} />
                                  )}
                                  <button
                                    hidden={card.kind === 'proposal'}
                                    type="button"
                                    className="result-open"
                                    onClick={() =>
                                      void (async () => {
                                        try {
                                          if (activateWorkspaceCard(card, navigate)) return;
                                          if (card.kind === 'exam') {
                                            const list = await api('/api/exams');
                                            const found = list.find((e: Exam) => e.id === card.id);
                                            if (found) openExam(found);
                                            else notify('الامتحان غير موجود');
                                          } else if (card.kind === 'prompt') {
                                            await api('/api/bank/prompt', 'PUT', {
                                              prompt: card.prompt,
                                            });
                                            notify('حُفظ الطلب المعدّل في مكتبة البنوك');
                                          } else if (card.kind === 'book') {
                                            setBook(card.id);
                                            setActiveCommand('exam');
                                            input.current?.focus();
                                          } else if (card.kind === 'command') {
                                            const selected = assistantCommands.find(
                                              (c) => c.id === card.id,
                                            );
                                            if (selected) chooseCommand(selected);
                                          } else navigate(card.page || 'books');
                                        } catch (e) {
                                          notify((e as Error).message);
                                        }
                                      })()
                                    }
                                  >
                                    {card.kind === 'prompt'
                                      ? 'اعتماد هذا الطلب'
                                      : card.kind === 'exam'
                                        ? 'فتح للمراجعة'
                                        : card.kind === 'book'
                                          ? 'استخدم هذا البنك'
                                          : card.kind === 'command'
                                            ? 'استخدم الأمر'
                                            : 'فتح التفاصيل'}
                                    <ArrowUpLeft size={14} />
                                  </button>
                                </div>
                              </motion.article>
                            ))}
                          </div>
                        )}
                        {m.page && (
                          <button className="message-action" onClick={() => navigate(m.page)}>
                            فتح القسم
                            <ArrowUpLeft size={15} />
                          </button>
                        )}
                        {m.examId && !m.cards?.some((c: any) => c.kind === 'exam') && (
                          <button
                            className="message-action"
                            onClick={async () => {
                              try {
                                const exams = await api('/api/exams');
                                const exam = exams.find((e: any) => e.id === m.examId);
                                if (exam) openExam(exam);
                                else notify('المسودة غير موجودة');
                              } catch (e) {
                                notify((e as Error).message);
                              }
                            }}
                          >
                            <FileText size={16} />
                            مراجعة المسودة
                            <ArrowUpLeft size={15} />
                          </button>
                        )}
                        {m.role === 'assistant' && (
                          <button
                            className="message-copy"
                            aria-label="نسخ الرد"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(m.text);
                                setCopied(m.id);
                                setTimeout(() => setCopied(''), 2000);
                              } catch {
                                notify('تعذر نسخ الرد');
                              }
                            }}
                          >
                            {copied === m.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </motion.article>
                  ))}
                  {pending && (
                    <motion.article
                      className="studio-message user"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="message-avatar">
                        <GraduationCap size={17} />
                      </div>
                      <div className="message-content">
                        <span className="message-byline">أنت</span>
                        <div className="message-prose">{commandText(pending)}</div>
                      </div>
                    </motion.article>
                  )}
                  {busy && (
                    <motion.div
                      className="studio-thinking"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="message-avatar">
                        <Sparkles size={17} />
                      </div>
                      <div>
                        <span>نرتب أفكارك…</span>
                        <div className="thinking-dots">
                          {[0, 1, 2].map((i) => (
                            <motion.i
                              key={i}
                              animate={reduced ? {} : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={end} />
          </div>
          <div className="studio-composer-zone">
            {showCommands && (
              <div className="slash-menu" role="listbox" aria-label="أوامر المساعد">
                <header>
                  <strong>أدوات مساحة المعلم</strong>
                  <small>↑ ↓ للاختيار · Enter للتأكيد</small>
                </header>
                {commandOptions.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={i === commandIndex}
                    onMouseEnter={() => setCommandIndex(i)}
                    onClick={() => chooseCommand(c)}
                  >
                    <span className="command-token">/{c.ar}</span>
                    <div>
                      <strong>{c.label}</strong>
                      <small>{c.description}</small>
                    </div>
                    <span>/{c.id}</span>
                  </button>
                ))}
                {!commandOptions.length && (
                  <p>لا يوجد أمر مطابق. اضغط Escape لكتابة رسالة عادية.</p>
                )}
              </div>
            )}
            <AnimatePresence>
              {picker && (
                <motion.div
                  className="book-picker"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10 }}
                >
                  <div>
                    <strong>اختر كتابًا للمحادثة</strong>
                    <button
                      type="button"
                      className="studio-icon"
                      aria-label="إغلاق اختيار الكتاب"
                      onClick={() => setPicker(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {books.length ? (
                    books.map((b) => (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => {
                          setBook(b.id);
                          setPicker(false);
                        }}
                      >
                        <span className="picker-book-icon">
                          <BookOpen size={18} />
                        </span>
                        <span>
                          {b.title}
                          <small>
                            {b.subject} · الصف {b.grade}
                          </small>
                        </span>
                        {bookId === b.id && <Check size={15} />}
                      </button>
                    ))
                  ) : (
                    <button type="button" onClick={() => navigate('books')}>
                      <Plus size={18} />
                      أضف كتابك الأول
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <form
              className={`studio-composer ${busy ? 'working' : ''}`}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              {selectedBook && (
                <motion.div
                  className="composer-attachment"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <span>
                    <FileText size={17} />
                  </span>
                  <div>
                    <strong>{selectedBook.title}</strong>
                    <small>بنك محفوظ · أسئلة معتمدة</small>
                  </div>
                  <button type="button" aria-label="إزالة الكتاب" onClick={() => setBook('')}>
                    <X size={14} />
                  </button>
                </motion.div>
              )}
              {currentCommand && (
                <div className="composer-command">
                  <span className="command-token">/{currentCommand.ar}</span>
                  <span>{currentCommand.description}</span>
                  <button
                    type="button"
                    aria-label="إزالة الأمر"
                    onClick={() => setActiveCommand('')}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <textarea
                ref={input}
                aria-label="رسالتك للمساعد"
                maxLength={6000}
                placeholder={
                  currentCommand?.id === 'exam'
                    ? 'كم سؤالًا تريد؟ مثال: 10 أسئلة'
                    : currentCommand
                      ? 'أضف التفاصيل، أو أرسل الأمر مباشرة…'
                      : 'ما الذي يشغل بالك اليوم؟ اكتب / لعرض الأدوات'
                }
                value={message}
                rows={2}
                onChange={(e) => {
                  const value = e.target.value;
                  const parsed = parseCommand(value);
                  if (!activeCommand && parsed && /\s/.test(value)) {
                    setActiveCommand(parsed.command.id);
                    setMessage(parsed.rest);
                    setCommandsOpen(false);
                  } else setMessage(value);
                  setCommandIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setCommandsOpen(false);
                    if (message === '/') setMessage('');
                    return;
                  }
                  if (
                    showCommands &&
                    commandOptions.length &&
                    ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)
                  ) {
                    e.preventDefault();
                    if (e.key === 'ArrowDown')
                      setCommandIndex((i) => (i + 1) % commandOptions.length);
                    else if (e.key === 'ArrowUp')
                      setCommandIndex(
                        (i) => (i - 1 + commandOptions.length) % commandOptions.length,
                      );
                    else chooseCommand(commandOptions[commandIndex] || commandOptions[0]);
                    return;
                  }
                  if (e.key === 'Backspace' && !message && activeCommand) {
                    setActiveCommand('');
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="composer-tools">
                <div>
                  <SpeechDictation
                    inputRef={input}
                    disabled={busy}
                    onListeningChange={setVoiceListening}
                    onText={(spoken) => setMessage((current) => appendDictation(current, spoken))}
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    className={`composer-tool ${picker ? 'selected' : ''}`}
                    aria-label="إرفاق كتاب"
                    onClick={() => setPicker(!picker)}
                  >
                    <Paperclip size={17} />
                    <span>إرفاق كتاب</span>
                  </motion.button>
                  <button
                    type="button"
                    className="composer-tool"
                    aria-label="الأوامر"
                    onClick={() => {
                      setActiveCommand('');
                      setCommandsOpen(!commandsOpen);
                      setMessage('');
                      input.current?.focus();
                    }}
                  >
                    <span className="slash-icon">/</span>الأوامر
                  </button>
                </div>
                <motion.button
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.92 }}
                  type="submit"
                  className="composer-send"
                  disabled={busy || voiceListening || (!message.trim() && !activeCommand)}
                  aria-label="إرسال"
                  title="إرسال"
                >
                  <ArrowUp size={21} />
                </motion.button>
              </div>
            </form>
            <div className="composer-footnote">
              <span>
                <Layers size={12} />
                المسودات لك، والقرار لك.
              </span>
              <span>Enter للإرسال · Shift + Enter لسطر جديد</span>
            </div>
          </div>
        </section>
      </motion.div>
    </MotionConfig>
  );
}
