import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowUp, ArrowUpLeft, BookOpen, Check, Expand, Plus, Sparkles, X } from 'lucide-react';
import Orb from './BlueOrb';
import { api } from './api';
import MathText from './MathText';
import { assistantCommands } from './assistantCommands';
import type { Exam } from './types';
import './floating.css';

type Props = {
  navigate: (page: string) => void;
  openExam: (exam: Exam) => void;
  updated: () => void;
};
export default function FloatingAssistant({ navigate, openExam, updated }: Props) {
  const [open, setOpen] = useState(false),
    [text, setText] = useState(''),
    [chat, setChat] = useState<any>(),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(''),
    [error, setError] = useState(''),
    [position, setPosition] = useState({ x: 26, y: window.innerHeight - 108 });
  const drag = useRef<
      { x: number; y: number; left: number; top: number; moved: boolean } | undefined
    >(undefined),
    skipClick = useRef(false),
    input = useRef<HTMLTextAreaElement>(null),
    ball = useRef<HTMLButtonElement>(null),
    end = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
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
    if (open) input.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        ball.current?.focus();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'nearest' });
  }, [chat, pending, open]);
  async function send() {
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
        setOpen(false);
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
        ['books', 'exams', 'students', 'results', 'settings', 'live', 'assistant'].includes(page)
      ) {
        navigate(page);
        setOpen(false);
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
  return (
    <div className="floating-assistant">
      <AnimatePresence>
        {open && (
          <motion.section
            key="orb-chat"
            role="dialog"
            aria-label="المساعد العائم"
            className="orb-chat"
            style={{
              width,
              height,
              left: Math.max(12, Math.min(position.x, window.innerWidth - width - 12)),
              top: above ? Math.max(12, position.y - height - 12) : position.y + 86,
            }}
            initial={{ opacity: 0, y: reduced ? 0 : 16, scale: reduced ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <header>
              <div>
                <Sparkles size={17} />
                <strong>مساعدك</strong>
              </div>
              <div>
                <button
                  aria-label="محادثة عائمة جديدة"
                  disabled={busy}
                  onClick={() => {
                    setChat(undefined);
                    setText('');
                    setError('');
                  }}
                >
                  <Plus size={17} />
                </button>
                <button
                  aria-label="فتح المساعد الكامل"
                  onClick={() => {
                    navigate('assistant');
                    setOpen(false);
                  }}
                >
                  <Expand size={16} />
                </button>
                <button
                  aria-label="إغلاق المساعد العائم"
                  onClick={() => {
                    setOpen(false);
                    ball.current?.focus();
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </header>
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
                <article key={message.id} className={`orb-message ${message.role}`}>
                  <small>{message.role === 'user' ? 'أنت' : 'المساعد'}</small>
                  <MathText text={message.text} />
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
                        </div>
                      ))}
                    </div>
                  )}
                </article>
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
              <button
                type="submit"
                aria-label="إرسال للمساعد العائم"
                disabled={busy || !text.trim()}
              >
                <ArrowUp size={18} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
      <button
        ref={ball}
        className="assistant-orb"
        aria-label="المساعد العائم"
        aria-expanded={open}
        title="المساعد · اسحب للتحريك"
        style={{ left: position.x, top: position.y }}
        onPointerDown={(event) => {
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
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const dx = event.clientX - start.x,
            dy = event.clientY - start.y;
          if (Math.hypot(dx, dy) > 5) start.moved = true;
          if (start.moved) setPosition(clamp(start.left + dx, start.top + dy));
        }}
        onPointerUp={() => {
          skipClick.current = !!drag.current?.moved;
          drag.current = undefined;
        }}
        onPointerCancel={() => {
          skipClick.current = true;
          drag.current = undefined;
        }}
        onClick={() => {
          if (skipClick.current) {
            skipClick.current = false;
            return;
          }
          setOpen(!open);
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
        {open && <X size={18} className="orb-close-mark" />}
      </button>
    </div>
  );
}
