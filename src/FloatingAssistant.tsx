import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OrbToolWindow from './OrbToolWindow';
import LiveRoomDock from './LiveRoomDock';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUp,
  ArrowUpLeft,
  BookOpen,
  Check,
  Expand,
  Minimize2,
  Minus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import useOrbWindowMotion from './useOrbWindowMotion';
import './orbMotion.css';
import Orb from './BlueOrb';
import { api } from './api';
import MathText from './MathText';
import { assistantCommands } from './assistantCommands';
import type { Exam } from './types';
import './floating.css';
import AssistantProposal from './AssistantProposal';
import SpeechReadButton from './SpeechReadButton';
import SpeechDictation, { appendDictation } from './SpeechDictation';
import { activateWorkspaceCard } from './assistantWorkspaceActions';
import WorkflowGuide, { ToolsWorkflow, orbTools } from './WorkflowGuide';

type Props = {
  navigate: (page: string) => void;
  openExam: (exam: Exam) => void;
  updated: () => void;
  teacherId?: string;
  page?: string;
};
export default function FloatingAssistant({
  navigate,
  openExam,
  updated,
  teacherId = 'master',
  page = 'assistant',
}: Props) {
  const [overlayHost] = useState(() => document.createElement('div'));
  const [tool, setTool] = useState(''),
    [toolMinimized, setToolMinimized] = useState(false);
  useEffect(() => {
    overlayHost.className = 'teacher-orb-overlay';
    const place = () => {
      const dialogs = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].filter(
        (dialog) => !dialog.classList.contains('has-orb-dock'),
      );
      const parent = dialogs.at(-1) || document.body;
      if (overlayHost.parentElement !== parent) parent.append(overlayHost);
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => {
      observer.disconnect();
      overlayHost.remove();
    };
  }, [overlayHost]);
  const positionKey = `teacher-orb-position:${teacherId}`;
  const [open, setOpen] = useState(false),
    [text, setText] = useState(''),
    [chat, setChat] = useState<any>(),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(''),
    [error, setError] = useState(''),
    [position, setPosition] = useState(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
        if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y))
          return {
            x: Math.max(10, Math.min(innerWidth - 84, saved.x)),
            y: Math.max(10, Math.min(innerHeight - 84, saved.y)),
          };
      } catch {}
      return { x: 26, y: window.innerHeight - 108 };
    });
  const drag = useRef<
      { x: number; y: number; left: number; top: number; moved: boolean } | undefined
    >(undefined),
    skipClick = useRef(false),
    input = useRef<HTMLTextAreaElement>(null),
    ball = useRef<HTMLButtonElement>(null),
    end = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const panelMotion = useOrbWindowMotion<HTMLElement>(open, ball);
  const closePanel = () =>
    panelMotion.minimize(() => {
      setOpen(false);
      ball.current?.focus();
    });
  const [pane, setPane] = useState<'context' | 'workflow' | 'chat'>('context');
  const [layout, setLayout] = useState<{ order: string[]; workflow: string[] }>({
      order: [],
      workflow: [],
    }),
    [savingLayout, setSavingLayout] = useState(false),
    [layoutError, setLayoutError] = useState('');
  useEffect(() => {
    if (!open || pane !== 'workflow') return;
    let live = true;
    const load = () => {
      setSavingLayout(true);
      setLayoutError('');
      void api('/api/workspace')
        .then((v) => {
          if (live) setLayout(v);
        })
        .catch((e) => {
          if (live) setLayoutError(e.message);
        })
        .finally(() => {
          if (live) setSavingLayout(false);
        });
    };
    load();
    window.addEventListener('workspace-updated', load);
    return () => {
      live = false;
      window.removeEventListener('workspace-updated', load);
    };
  }, [pane, open, teacherId]);
  const saveLayout = async (next: typeof layout) => {
    setSavingLayout(true);
    setLayoutError('');
    try {
      setLayout(await api('/api/workspace', 'PUT', next));
    } catch (e) {
      setLayoutError((e as Error).message);
    } finally {
      setSavingLayout(false);
    }
  };
  let toolSubject = '';
  try {
    toolSubject =
      JSON.parse(localStorage.getItem(`teacher-tools-preferences:${teacherId}`) || '{}').subject ||
      '';
  } catch {}
  const openTool = (id: string) => {
    setTool(id);
    setToolMinimized(false);
    closePanel();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(positionKey, JSON.stringify(position));
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [position, positionKey]);
  const clamp = (x: number, y: number) => ({
    x: Math.max(10, Math.min(window.innerWidth - 84, x)),
    y: Math.max(10, Math.min(window.innerHeight - 84, y)),
  });
  useEffect(() => {
    const resize = () => setPosition((p) => clamp(p.x, p.y));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (open && pane === 'chat') input.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        closePanel();
        ball.current?.focus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, pane, panelMotion.minimizing]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'nearest' });
  }, [chat, pending, open]);
  const [voiceListening, setVoiceListening] = useState(false);
  async function send() {
    if (voiceListening) {
      setError('أوقف الإملاء أولًا، ثم راجع الرسالة وأرسلها.');
      return;
    }
    if (!text.trim() || busy) return;
    const message = text.trim();
    setText('');
    setPending(message);
    setError('');
    setBusy(true);
    try {
      const result = await api('/api/assistant/messages', 'POST', {
        message,
        conversationId: chat?.id,
      });
      setChat(result.conversation);
      updated();
    } catch (e) {
      setError((e as Error).message);
      setText(message);
    } finally {
      setPending('');
      setBusy(false);
      input.current?.focus();
    }
  }
  async function activate(card: any) {
    setError('');
    try {
      if (activateWorkspaceCard(card, navigate)) {
        closePanel();
        return;
      }
      if (card.kind === 'command') {
        setText(card.command);
        input.current?.focus();
        return;
      }
      if (card.kind === 'prompt') {
        await api('/api/bank/prompt', 'PUT', { prompt: card.prompt });
        return;
      }
      if (card.kind === 'exam') {
        const exam = (await api('/api/exams')).find((e: Exam) => e.id === card.id);
        if (!exam) throw Error('الامتحان غير موجود');
        openExam(exam);
        closePanel();
        return;
      }
      const page =
        card.page ||
        (['book', 'question'].includes(card.kind)
          ? 'books'
          : card.kind === 'student'
            ? 'students'
            : 'results');
      if (
        [
          'books',
          'exams',
          'students',
          'results',
          'settings',
          'live',
          'assistant',
          'tools',
          'monitor',
        ].includes(page)
      ) {
        navigate(page);
        closePanel();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const above = position.y > window.innerHeight / 2;
  const width = Math.min(410, window.innerWidth - 24),
    height = Math.min(
      580,
      Math.max(180, above ? position.y - 24 : window.innerHeight - position.y - 98),
    );
  const menu =
    text.startsWith('/') && !text.includes(' ')
      ? assistantCommands
          .filter((c) => `${c.ar} ${c.id} ${c.aliases.join(' ')}`.includes(text.slice(1)))
          .slice(0, 5)
      : [];
  const dockDragHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      skipClick.current = false;
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        left: position.x,
        top: position.y,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      const start = drag.current;
      if (!start) return;
      const dx = event.clientX - start.x,
        dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) > 5) start.moved = true;
      if (start.moved) setPosition(clamp(start.left + dx, start.top + dy));
    },
    onPointerUp: () => {
      skipClick.current = !!drag.current?.moved;
      drag.current = undefined;
    },
    onPointerCancel: () => {
      skipClick.current = true;
      drag.current = undefined;
    },
  };
  return createPortal(
    <div
      className="floating-assistant"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          closePanel();
        }
      }}
    >
      {tool && (
        <div hidden={toolMinimized}>
          <OrbToolWindow
            key={tool}
            tool={tool}
            teacherId={teacherId}
            openExam={openExam}
            onClose={() => setTool('')}
            onMinimize={() => setToolMinimized(true)}
            minimized={toolMinimized}
            dockRef={ball}
          />
        </div>
      )}
      <AnimatePresence>
        {open && (
          <motion.section
            ref={panelMotion.ref}
            key="orb-chat"
            role="dialog"
            aria-label="المساعد العائم"
            className={`orb-chat ${expanded ? 'is-expanded' : ''}`}
            layout
            style={{
              width: expanded ? Math.min(960, window.innerWidth - 32) : width,
              height: expanded ? window.innerHeight - 32 : height,
              left: expanded
                ? Math.max(16, (window.innerWidth - 960) / 2)
                : Math.max(12, Math.min(position.x, window.innerWidth - width - 12)),
              top: expanded ? 16 : above ? Math.max(12, position.y - height - 12) : position.y + 86,
            }}
            initial={false}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
          >
            <header>
              <div>
                <Sparkles size={17} />
                <strong>مساحتك المساعدة</strong>
              </div>
              <div>
                <button
                  aria-label="محادثة عائمة جديدة"
                  disabled={busy}
                  onClick={() => {
                    setPane('chat');
                    setChat(undefined);
                    setText('');
                    setError('');
                  }}
                >
                  <Plus size={17} />
                </button>
                <button
                  aria-label={expanded ? 'استعادة حجم المساعد' : 'تكبير المساعد العائم'}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <Minimize2 size={16} /> : <Expand size={16} />}
                </button>
                <button
                  aria-label="فتح المساعد الكامل"
                  onClick={() => {
                    navigate('assistant');
                    closePanel();
                  }}
                >
                  <ArrowUpLeft size={16} />
                </button>
                <button aria-label="تصغير المساعد العائم" onClick={closePanel}>
                  <Minus size={17} />
                </button>
                <button
                  aria-label="إغلاق المساعد العائم"
                  onClick={() => {
                    closePanel();
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <nav role="tablist" className="orb-panel-tabs" aria-label="أقسام الكرة">
              {(
                [
                  ['context', 'لهذه الصفحة'],
                  ['workflow', 'مساري'],
                  ['chat', 'المحادثة'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={pane === id} onClick={() => setPane(id)}>
                  {pane === id && (
                    <motion.span
                      className="orb-tab-highlight"
                      layoutId={`orb-tab-${teacherId}`}
                      transition={
                        reduced ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 34 }
                      }
                    />
                  )}
                  <span className="orb-tab-label">{label}</span>
                </button>
              ))}
            </nav>
            <motion.div
              className="orb-pane"
              key={pane}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {pane === 'context' && (
                <div className="orb-utility-body">
                  <div className="orb-quick-tools">
                    <button onClick={() => openTool('calculator')}>الآلة الحاسبة</button>
                    <button onClick={() => openTool('geometry')}>GeoGebra</button>
                    {tool && toolMinimized && (
                      <button
                        onClick={() => {
                          setToolMinimized(false);
                          closePanel();
                        }}
                      >
                        استعادة الأداة
                      </button>
                    )}
                  </div>
                  <WorkflowGuide
                    page={page}
                    teacherId={teacherId}
                    navigate={(target) => {
                      navigate(target);
                      closePanel();
                    }}
                  />
                </div>
              )}
              {pane === 'workflow' && (
                <div className="orb-utility-body">
                  <ToolsWorkflow
                    tools={orbTools}
                    subject={toolSubject}
                    layout={layout}
                    onChange={(v) => void saveLayout(v)}
                    saving={savingLayout}
                    onTool={openTool}
                  />
                  {layoutError && <p role="alert">{layoutError}</p>}
                </div>
              )}
              {pane === 'chat' && (
                <>
                  <div className="orb-thread" aria-live="polite">
                    {!chat && !pending && (
                      <div className="orb-welcome">
                        <div aria-hidden="true">
                          <Orb size={1.1} animationSpeedBase={0.5} />
                        </div>
                        <h3>ماذا ننجز؟</h3>
                        <div className="orb-shortcuts">
                          {['/امتحان ', '/كتاب', '/إحصاءات'].map((command) => (
                            <button
                              key={command}
                              onClick={() => {
                                setText(command);
                                input.current?.focus();
                              }}
                            >
                              {command.replace('/', '')}
                              <ArrowUpLeft size={12} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chat?.messages.map((message: any) => (
                      <motion.article
                        initial={reduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        key={message.id}
                        className={`orb-message ${message.role}`}
                      >
                        <small>{message.role === 'user' ? 'أنت' : 'المساعد'}</small>
                        <MathText text={message.text} />
                        {message.role === 'assistant' && <SpeechReadButton text={message.text} />}
                        {message.cards?.length > 0 && (
                          <div className="orb-results">
                            {message.cards.map((card: any, i: number) => (
                              <div className={`orb-result ${card.kind}`} key={`${card.id}-${i}`}>
                                <BookOpen size={18} />
                                <div>
                                  <strong>{card.title}</strong>
                                  <small>{card.subtitle}</small>
                                  {card.value && <b>{card.value}</b>}
                                </div>
                                {card.prompt && (
                                  <details>
                                    <summary>معاينة الطلب</summary>
                                    <MathText text={card.prompt} />
                                  </details>
                                )}
                                {card.kind === 'proposal' ? (
                                  <AssistantProposal card={card} onApplied={() => updated()} />
                                ) : (
                                  <button onClick={() => void activate(card)}>
                                    {card.kind === 'prompt' ? (
                                      <>
                                        اعتماد <Check size={13} />
                                      </>
                                    ) : (
                                      <>
                                        فتح <ArrowUpLeft size={13} />
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.article>
                    ))}
                    {pending && (
                      <article className="orb-message user">
                        <small>أنت</small>
                        <MathText text={pending} />
                      </article>
                    )}
                    {busy && (
                      <div className="orb-working">
                        <Orb size={0.33} animationSpeedBase={2} />
                        <span>يفكر…</span>
                      </div>
                    )}
                    {error && (
                      <p className="error-note" role="alert">
                        {error}
                      </p>
                    )}
                    <div ref={end} />
                  </div>
                  <form
                    className="orb-composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                  >
                    {menu.length > 0 && (
                      <div className="orb-command-list">
                        {menu.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setText(`/${c.ar} `);
                              input.current?.focus();
                            }}
                          >
                            <strong>/{c.ar}</strong>
                            <small>{c.label}</small>
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={input}
                      aria-label="رسالة المساعد العائم"
                      placeholder="اسأل أو اكتب /"
                      rows={2}
                      maxLength={6000}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <SpeechDictation
                      inputRef={input}
                      disabled={busy}
                      onListeningChange={setVoiceListening}
                      onText={(spoken) => setText((current) => appendDictation(current, spoken))}
                    />
                    <button
                      type="submit"
                      aria-label="إرسال للمساعد العائم"
                      disabled={busy || voiceListening || !text.trim()}
                    >
                      <ArrowUp size={18} />
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
      <LiveRoomDock
        position={position}
        dragHandlers={dockDragHandlers}
        consumeDrag={() => {
          const moved = skipClick.current;
          skipClick.current = false;
          return moved;
        }}
        onOpen={() => setOpen(false)}
      />
      <motion.button
        ref={ball}
        className={`assistant-orb ${open ? 'is-open' : ''} ${busy ? 'is-busy' : ''}`}
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={reduced ? undefined : { scale: 0.92 }}
        aria-label="المساعد العائم"
        aria-expanded={open}
        title="المساعد · اسحب للتحريك"
        style={{ left: position.x, top: position.y }}
        {...dockDragHandlers}
        onClick={() => {
          if (skipClick.current) {
            skipClick.current = false;
            return;
          }
          if (open) closePanel();
          else setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            setPosition((p) =>
              clamp(
                p.x + (e.key === 'ArrowRight' ? 24 : e.key === 'ArrowLeft' ? -24 : 0),
                p.y + (e.key === 'ArrowDown' ? 24 : e.key === 'ArrowUp' ? -24 : 0),
              ),
            );
          }
        }}
      >
        <div aria-hidden="true">
          <Orb size={0.8} animationSpeedBase={busy ? 2 : 0.6} />
        </div>
        <AnimatePresence>
          {open && (
            <motion.span
              className="orb-close-mark"
              initial={{ opacity: 0, rotate: reduced ? 0 : -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: reduced ? 0 : 90, scale: 0.5 }}
            >
              <X size={18} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>,
    overlayHost,
  );
}
