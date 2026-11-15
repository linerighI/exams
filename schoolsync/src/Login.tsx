/**
 * Orb-centered Prism Studio login screen inspired by the sister Exams application.
 * Displays real-time server & cloud-tunnel health through the interactive Orb color/speed
 * and opens the Server & Cloud Link dialog when tapped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe, School, Wifi } from 'lucide-react';
import { gsap, quietMotion, usePressFeedback } from './animation';
import { getCustomServerBase, probeServer, type ServerProbeResult } from './api';
import { OrbConnectionDialog } from './components/OrbConnectionDialog';
import type { Language } from './i18n';
import { LoginCredentialsStep } from './LoginCredentialsStep';
import { getLoginStoryCopy } from './loginStory';
import { Orb } from './Orb';
import { Brand } from './ui';

export type LoginRequest =
  | { portal: 'family'; nationalId: string; password: string }
  | { portal: 'staff'; email: string; password: string };

/** Redesigned 1-step Prism Studio login flow revolving around the interactive status Orb. */
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
  const story = getLoginStoryCopy(portal, lang);
  const orbText = busy || probing
    ? (ar ? 'جارٍ الاتصال بالخادم…' : 'Connecting…')
    : orbTone === 'green'
      ? (ar ? 'تم الاتصال بخادم المدرسة بأمان' : 'Connected safely')
      : serverOnline
        ? customServer
          ? (ar ? 'نفق سحابي نشط · اضغط للتعديل' : 'Cloud link active · Tap to edit')
          : (ar ? 'خادم المدرسة متصل · اضغط للرابط السحابي' : 'School server ready · Tap for link')
        : (ar ? 'الخادم غير متصل · اضغط للربط' : 'Server offline · Tap to link');

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
          <section className="login-story" aria-label={ar ? 'حالة الخادم ودليل الدخول' : 'Server status and guide'}>
            <div className="prism-story-head">
              <div className="prism-story-brand">
                <span className="prism-wordmark" dir="ltr">schoolsync.</span>
                <span className="prism-school">{schoolTitle}</span>
              </div>
              <button
                type="button"
                className={`prism-orb-trigger connection-orb-button is-${orbTone}`}
                aria-label={ar ? 'حالة الاتصال بالخادم — اضغط للإعداد' : 'Server connection status — tap to configure'}
                onClick={() => setConnectOpen(true)}
              >
                <Orb size={132} tone={orbTone} speed={busy || probing ? 1.15 : 0.44} />
                <span className="orb-connection-label" aria-live="polite"><i />{orbText}</span>
              </button>
            </div>
            <div className="prism-caption">
              <span className="prism-story-label">{story.eyebrow}</span>
              <h1>{story.headline}</h1>
            </div>
            <ol className="prism-guide">
              {story.steps.map(([title, desc], idx) => (
                <li key={title}>
                  <span className="prism-step-number" aria-hidden="true">{idx + 1}</span>
                  <div><strong>{title}</strong><p>{desc}</p></div>
                </li>
              ))}
            </ol>
            <button type="button" className="prism-network-note" onClick={() => setConnectOpen(true)}>
              {customServer ? <Globe size={15} /> : <Wifi size={15} />}
              <span>
                {customServer
                  ? (ar ? `متصل عبر الرابط السحابي: ${customServer}` : `Connected via cloud URL: ${customServer}`)
                  : (ar ? 'اضغط هنا أو على الكرة لربط الهاتف بخادم المدرسة من أي شبكة' : 'Tap here or the Orb to connect via cloud tunnel from any network')}
              </span>
            </button>
          </section>
          <section className="card login-card">
            <div className="login-card-icon" aria-hidden="true"><School size={26} /></div>
            <h2>{ar ? 'أهلاً بك من جديد' : 'Welcome back'}</h2>
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
