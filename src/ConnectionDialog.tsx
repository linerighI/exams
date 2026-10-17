import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, CheckCircle2, ChevronDown, Loader2, Monitor, RefreshCw, ShieldCheck, Wifi, X } from 'lucide-react';
import Orb from './BlueOrb';
import type { TeacherConnection } from './types';
import './connection.css';

type Device = { host: string; school: string; pairingVersion?: number };
export default function ConnectionDialog({ connection, tone, onConnected, onClose }: {
  connection: TeacherConnection; tone: 'red' | 'green' | 'blue';
  onConnected: (info: TeacherConnection) => void; onClose: () => void;
}) {
  const [phase, setPhase] = useState<'search' | 'choose' | 'pairing' | 'done'>(connection.connected ? 'done' : 'search');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [manual, setManual] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(connection);
  const box = useRef<HTMLDivElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const pairing = phase === 'pairing';
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { mounted.current = false; document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (phase !== 'search') return;
    let active = true;
    setError('');
    void window.desktop?.discover().then(items => {
      if (!active) return;
      setDevices(items);
      setSelected(items.length === 1 ? items[0].host : '');
      setPhase('choose');
    }).catch(() => { if (active) { setError('تعذر البحث الآن. تحقق من الشبكة ثم حاول مرة أخرى.'); setPhase('choose'); } });
    return () => { active = false; };
  }, [phase]);
  useEffect(() => { if (selected && phase === 'choose') codeInput.current?.focus(); }, [selected, phase]);
  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!window.desktop || pairing) return;
    setPhase('pairing'); setError('');
    try {
      const info = await window.desktop.connectTeacher(selected || manual.trim(), code);
      if (!mounted.current) return;
      setResult(info); onConnected(info); setPhase('done');
    } catch (failure) {
      if (mounted.current) { setError((failure as Error).message); setPhase('choose'); }
    }
  };
  const connected = phase === 'done';
  return createPortal(
    <div className="connection-overlay" onClick={event => { if (event.target === event.currentTarget && !pairing) onClose(); }}>
      <div className="connection-dialog" role="dialog" aria-modal="true" aria-labelledby="connection-title" ref={box} dir="rtl"
        onKeyDown={event => {
          if (event.key === 'Escape' && !pairing) { event.stopPropagation(); onClose(); }
          if (event.key === 'Tab') {
            const items = [...(box.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), summary') || [])].filter(item => item.getClientRects().length > 0);
            const first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <header className="connect-header">
          <span><Wifi size={17} /> اتصال المدرسة</span>
          <button className="connect-close" aria-label="إغلاق لوحة الاتصال" disabled={pairing} onClick={onClose}><X size={20} /></button>
        </header>
        <div className={`connect-hero ${connected ? 'is-connected' : ''}`}>
          <div className="connect-orb" aria-hidden="true"><Orb size={1.35} tone={connected ? tone : 'red'} animationSpeedBase={0.35} /></div>
          <span className="connect-eyebrow">{connected ? 'كل شيء جاهز' : 'خطوة واحدة، ثم تبقى متصلًا'}</span>
          <h2 id="connection-title">{connected ? (result.local ? 'جهاز المعلم جاهز' : 'أهلًا بك في الصف') : 'لنصل إلى جهاز المعلم'}</h2>
          <p>{connected ? (result.school || 'تم حفظ اتصالك بأمان') : 'اختر جهاز المعلم، وأدخل رمز الاتصال الذي يظهر لديه.'}</p>
        </div>
        {connected ? (
          <div className="connect-success" role="status">
            <div className="connect-success-card"><CheckCircle2 size={24} /><div><strong>اتصال آمن ومحفوظ</strong><p>{result.local ? 'يمكن للطلاب الآن العثور على هذا الجهاز.' : 'في المرة القادمة ستحتاج إلى رمز الطالب فقط.'}</p></div></div>
            <button className="connect-primary" onClick={onClose}>{result.local ? 'العودة لتسجيل الدخول' : 'متابعة إلى تسجيل الدخول'} <ArrowLeft size={18} /></button>
            {!result.local && <button className="connect-text" onClick={() => { setPhase('search'); setCode(''); }}>الاتصال بجهاز آخر</button>}
          </div>
        ) : (
          <form className="connect-form" onSubmit={event => void connect(event)}>
            <div className="connect-section-title"><strong>الأجهزة القريبة</strong><button type="button" className="connect-text" disabled={phase === 'search' || pairing} onClick={() => setPhase('search')}><RefreshCw size={14} /> تحديث البحث</button></div>
            {phase === 'search' ? <div className="connect-search" role="status"><Loader2 size={22} className="spin" /><span>نبحث عن جهاز المعلم على شبكتك…</span></div> : devices.length ? (
              <div className="connect-devices" role="group" aria-label="أجهزة المعلمين">
                {devices.map(device => <button type="button" key={device.host} aria-pressed={selected === device.host} className={`connect-device ${selected === device.host ? 'selected' : ''}`} disabled={pairing || device.pairingVersion !== 1}
                  onClick={() => { setSelected(device.host); setManual(''); setError(''); }}>
                  <span className="connect-device-icon"><Monitor size={22} /></span><span className="connect-device-label"><strong>{device.school}</strong><small>{device.pairingVersion === 1 ? 'جهاز المعلم' : 'يحتاج تطبيق المعلم إلى تحديث'} · <bdi>{device.host}</bdi></small></span><span className="connect-radio">{selected === device.host && <Check size={13} />}</span>
                </button>)}
              </div>
            ) : <div className="connect-empty"><Wifi size={24} /><strong>لم يظهر جهاز المعلم بعد</strong><p>تأكد أن الجهازين على الشبكة نفسها، وأن المعلم شغّل الجهاز الرئيسي.</p></div>}
            <details className="connect-manual"><summary>لم يظهر الجهاز؟ <ChevronDown size={14} /></summary><label>عنوان جهاز المعلم<input dir="ltr" placeholder="192.168.1.10" disabled={pairing} value={manual} onChange={event => { setManual(event.target.value); setSelected(''); }} /></label></details>
            <label className="connect-code-label" htmlFor="teacher-connect-code">رمز الاتصال</label>
            <input ref={codeInput} className="connect-code-input" id="teacher-connect-code" dir="ltr" autoComplete="off" spellCheck={false} placeholder="ABCD-EFGH-JKLM" maxLength={14} disabled={pairing} value={code}
              onChange={event => setCode((event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).match(/.{1,4}/g) || []).join('-'))} />
            <p className="connect-code-hint">اطلب الرمز من المعلم: الإعدادات ← ربط أجهزة الطلاب. ستدخل رمز الطالب بعد الاتصال.</p>
            {error && <div className="connect-error" role="alert">{error}</div>}
            <button type="submit" className="connect-primary" disabled={pairing || !(selected || manual.trim()) || code.replaceAll('-', '').length !== 12}>
              {pairing ? <><Loader2 size={18} className="spin" /> جارٍ التحقق والاتصال…</> : <>الاتصال بجهاز المعلم <ArrowLeft size={18} /></>}
            </button>
            <div className="connect-security"><ShieldCheck size={15} /><span>نتحقق من هوية الجهاز تلقائيًا. لا تحتاج إلى كتابة بصمة الأمان.</span></div>
          </form>
        )}
      </div>
    </div>, document.body,
  );
}
