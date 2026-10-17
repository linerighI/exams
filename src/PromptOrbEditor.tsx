import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Loader2, Sparkles } from 'lucide-react';
import BlueOrb from './BlueOrb';
import FocusWindow from './FocusWindow';
import { api } from './api';
import './workflow.css';
export default function PromptOrbEditor({
  prompt,
  onApply,
}: {
  prompt: string;
  onApply: (text: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [closing,setClosing] = useState(false),
    [instructions, setInstructions] = useState(''),
    [proposal, setProposal] = useState(''),
    [base, setBase] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const latest = useRef(prompt);
  latest.current = prompt;
  const reduced = useReducedMotion();
  const closeTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
  const close=(clear=false)=>{setClosing(true);clearTimeout(closeTimer.current);closeTimer.current=setTimeout(()=>{setOpen(false);setClosing(false);if(clear)setProposal('');},reduced?0:220);};
  const propose = async () => {
    setBusy(true);
    setError('');
    setProposal('');
    const original = prompt;
    try {
      const result = await api('/api/bank/prompt/rewrite', 'POST', {
        prompt: original,
        instructions,
        provider: 'gemini',
      });
      setBase(original);
      setProposal(result.prompt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        className="prompt-orb-launch"
        onClick={() => setOpen(true)}
        aria-label="تعديل الطلب بمدار Gemini"
      >
        <span className="prompt-orb">
          <BlueOrb size={0.65} />
        </span>
        <span>
          <strong>حرّر طلبك مع Gemini</strong>
          <small>صف التغيير، راجع الاقتراح، ثم طبّقه.</small>
        </span>
        <Sparkles size={19} />
      </button>
      {open && (
        <FocusWindow title="مدار الطلب · Gemini" onClose={() => close()} wide>
          <motion.div
            className={`prompt-orb-window ${closing?'is-closing':''}`}
            initial={
              reduced ? false : { opacity: 0, scale: 0.82, clipPath: 'circle(8% at 90% 100%)' }
            }
            animate={{ opacity: 1, scale: 1, clipPath: 'circle(150% at 90% 100%)' }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          >
            <div className="roster-intro">
              <span className="roster-orb">
                <BlueOrb size={0.85} />
              </span>
              <div>
                <h3>ما التغيير الذي تريده؟</h3>
                <p>يُرسل نص الطلب وتعليماتك إلى Gemini؛ دون قوائم الطلاب أو أرقامهم.</p>
              </div>
            </div>
            <div className="prompt-suggestions">
              {[
                'اجعل الطلب أوضح وأقصر دون حذف شروط الاستيراد',
                'ركز على الفهم والتطبيق بدل الحفظ',
                'أضف رسومًا للأسئلة الهندسية مع المحافظة على SVG الآمن',
              ].map((s) => (
                <button
                  className="secondary small"
                  key={s}
                  disabled={busy}
                  onClick={() => setInstructions(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="field">
              التعديل المطلوب
              <textarea
                aria-label="تعليمات تعديل الطلب"
                value={instructions}
                maxLength={3000}
                disabled={busy}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="مثال: وزّع الصعوبة ووضّح متطلبات الرسوم…"
              />
            </label>
            <button
              className="primary"
              disabled={busy || !instructions.trim()}
              onClick={() => void propose()}
            >
              {busy ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}اقتراح تعديل
              عبر Gemini
            </button>
            {busy && (
              <p role="status">Gemini يعيد صياغة الطلب… يمكنك تصغير النافذة والعودة إليها.</p>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
                <button
                  className="text-button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('workflow-navigate', { detail: 'settings' }),
                    )
                  }
                >
                  فتح إعدادات Gemini
                </button>
              </div>
            )}
            {proposal && (
              <div className="prompt-proposal">
                <label className="field">
                  راجع الاقتراح وعدّله
                  <textarea
                    aria-label="اقتراح الطلب"
                    value={proposal}
                    maxLength={40000}
                    onChange={(e) => setProposal(e.target.value)}
                  />
                </label>
                {base !== prompt && (
                  <p role="alert">تغير الطلب الأصلي؛ اطلب اقتراحًا جديدًا قبل التطبيق.</p>
                )}
                <div className="button-row">
                  <button
                    className="primary"
                    disabled={busy || base !== prompt || !proposal.trim()}
                    onClick={async () => {
                      if (base !== latest.current) return;
                      setBusy(true);
                      setError('');
                      try {
                        await api('/api/bank/prompt', 'PUT', { prompt: proposal });
                        onApply(proposal);
                        close(true);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    تطبيق التعديل وحفظه
                  </button>
                  <button className="text-button" onClick={() => setProposal('')}>
                    تجاهل الاقتراح
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </FocusWindow>
      )}
    </>
  );
}
