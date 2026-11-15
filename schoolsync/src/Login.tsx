/**
 * Minimal Orb-centered Prism Studio login screen.
 * Centers the interactive live-status Orb in the ambient stage with zero text clutter,
 * opening the Server & Cloud Link dialog when the Orb is tapped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap, quietMotion, usePressFeedback } from './animation';
import { getCustomServerBase, probeServer, type ServerProbeResult } from './api';
import { OrbConnectionDialog } from './components/OrbConnectionDialog';
import type { Language } from './i18n';
import { LoginCredentialsStep } from './LoginCredentialsStep';
import { Orb } from './Orb';
import { Brand } from './ui';

export type LoginRequest =
  | { portal: 'family'; nationalId: string; password: string }
  | { portal: 'staff'; email: string; password: string };

/** Clean Orb-first Prism login flow with real-time server & cloud-tunnel status. */
export default function Login({
  demo, busy, error, schoolName: initialSchool, signIn, onServerChanged, lang, setLang,
}: {
  demo: boolean;
  busy: boolean;
  error: string;
  schoolName?: string;
  signIn: (input: LoginRequest) => Promise<void>;
  onServerChanged: () => Promise<void>;
  lang: Language;
  setLang: (lang: Language) => void;
}) {
  const [portal, setPortal] = useState<'family' | 'staff'>(
    new URLSearchParams(location.search).get('portal') === 'school' ? 'staff' : 'family',
  );
  const [visible, setVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [connectOpen, setConnectOpen] = useState(false);
  const [schoolTitle, setSchoolTitle] = useState(initialSchool || 'مدرسة محمد الشريقي الثانوية للبنين');
  const [serverOnline, setServerOnline] = useState(true);
  const [orbTone, setOrbTone] = useState<'blue' | 'green' | 'red'>('blue');
  const [probing, setProbing] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const wallpaper = useRef<HTMLDivElement>(null);
  const greenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ar = lang === 'ar';
  usePressFeedback(root);

  useEffect(() => {
    if (initialSchool) setSchoolTitle(initialSchool);
  }, [initialSchool]);

  const flashGreen = useCallback(() => {
    clearTimeout(greenTimer.current);
    setOrbTone('green');
    greenTimer.current = setTimeout(() => setOrbTone('blue'), 2200);
  }, []);

  const checkServer = useCallback(async () => {
    setProbing(true);
    try {
      const info = await probeServer();
      setServerOnline(true);
      setSchoolTitle(info.schoolName);
      setOrbTone((prev) => (prev === 'red' ? 'green' : prev));
    } catch {
      setServerOnline(false);
      setOrbTone('red');
    } finally {
      setProbing(false);
    }
  }, []);

  useEffect(() => {
    void checkServer();
    const timer = setInterval(() => void checkServer(), 15000);
    const onFocus = () => void checkServer();
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(greenTimer.current);
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkServer]);

  useEffect(() => {
    if (error && !serverOnline) setOrbTone('red');
  }, [error, serverOnline]);

  useEffect(() => {
    if (!wallpaper.current || quietMotion()) return;
    const ctx = gsap.context(() => {
      const blobs = wallpaper.current!.querySelectorAll('i');
      gsap.to(blobs, {
        y: (i: number) => (i % 2 ? -22 : 18),
        x: (i: number) => (i % 2 ? 12 : -10),
        rotation: (i: number) => (i % 2 ? 4 : -4),
        duration: 11, stagger: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });
    }, wallpaper);
    return () => ctx.revert();
  }, []);

  const handlePortalSwitch = (next: 'family' | 'staff') => {
    setPortal(next);
    setUsername('');
    setPassword('');
  };

  const handleSignIn = async (req: LoginRequest) => {
    if (!error) setOrbTone('green');
    await signIn(req);
  };

  const handleConnected = async (info: ServerProbeResult) => {
    setServerOnline(true);
    setSchoolTitle(info.schoolName);
    flashGreen();
    await onServerChanged();
  };

  const customServer = getCustomServerBase();
  const orbText = busy || probing
    ? (ar ? 'جارٍ الاتصال…' : 'Connecting…')
    : orbTone === 'green'
      ? (ar ? 'متصل بالخادم' : 'Connected')
      : serverOnline
        ? customServer
          ? (ar ? 'سحابي متصل' : 'Cloud active')
          : (ar ? 'متصل' : 'Online')
        : (ar ? 'غير متصل · اضغط للربط' : 'Offline · Tap to link');

  return (
    <div className="entry-screen prism-login welcome-studio" ref={root}>
      <div className="prism-wallpaper" ref={wallpaper} aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <div className="prism-topbar">
        <Brand />
        <button type="button" className="text-button" onClick={() => setLang(ar ? 'en' : 'ar')}>
          {ar ? 'English' : 'العربية'}
        </button>
      </div>
      <div className="welcome-frame">
        <div className="login-layout">
          <section className="login-story prism-orb-stage" aria-label={ar ? 'حالة الاتصال بالخادم' : 'Server connection'}>
            <div className="prism-orb-halo" aria-hidden="true" />
            <button
              type="button"
              className={`prism-orb-trigger connection-orb-button is-${orbTone}`}
              aria-label={ar ? 'حالة الاتصال بالخادم — اضغط للإعداد' : 'Server connection status — tap to configure'}
              onClick={() => setConnectOpen(true)}
            >
              <Orb size={168} tone={orbTone} speed={busy || probing ? 1.15 : 0.44} />
              <span className="orb-connection-label" aria-live="polite"><i />{orbText}</span>
            </button>
          </section>
          <section className="card login-card">
            <div className="prism-card-head">
              <span className="prism-school">{schoolTitle}</span>
              <h2>{ar ? 'تسجيل الدخول' : 'Sign in'}</h2>
            </div>
            <LoginCredentialsStep
              portal={portal} onSelectPortal={handlePortalSwitch} username={username} setUsername={setUsername}
              password={password} setPassword={setPassword} visible={visible} setVisible={setVisible}
              busy={busy} error={error} demo={demo} lang={lang} signIn={handleSignIn}
            />
          </section>
        </div>
      </div>
      <OrbConnectionDialog
        open={connectOpen} lang={lang} tone={orbTone} schoolName={schoolTitle}
        onConnected={handleConnected} onResetLocal={onServerChanged} onClose={() => setConnectOpen(false)}
      />
    </div>
  );
}
