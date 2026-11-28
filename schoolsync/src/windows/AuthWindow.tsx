/**
 * Floating frosted-glass Login window with interactive Login Blue Orb (live server/tunnel
 * status & Connection Dialog trigger) rendered directly over the orbiting 3D campus.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { KeyRound, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { getCustomServerBase, getServerBase, isStandaloneClient, probeServer } from '../api';
import type { Language } from '../i18n';
import { Orb, type OrbTone } from '../Orb';
import { discoverAndSwitchServer, getAutoDiscoverEnabled } from '../registry';
import type { DemoRole, LoginRequest } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { SetupWindow } from './SetupWindow';

interface AuthWindowProps {
  setupRequired: boolean;
  demo: boolean;
  busy: boolean;
  error: string;
  schoolName: string;
  lang: Language;
  orbTone: OrbTone;
  onOrbToneChange: (tone: OrbTone) => void;
  onOpenConnectionOrb: () => void;
  onReloadConfig: () => Promise<void>;
  onSignIn: (req: LoginRequest) => Promise<void>;
  onSwitchDemoRole?: (role: DemoRole) => Promise<void>;
  onSetupComplete: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onErrorChange: (err: string) => void;
}

/** Floating Login card with live Login Blue Orb over the 3D campus. */
export function AuthWindow({
  setupRequired,
  demo,
  busy,
  error,
  schoolName,
  lang,
  orbTone,
  onOrbToneChange,
  onOpenConnectionOrb,
  onReloadConfig,
  onSignIn,
  onSwitchDemoRole,
  onSetupComplete,
  onBusyChange,
  onErrorChange,
}: AuthWindowProps) {
  const [portal, setPortal] = useState<'staff' | 'family'>('staff');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [serverOnline, setServerOnline] = useState(true);
  const [probing, setProbing] = useState(false);

  const checkServer = useCallback(async () => {
    setProbing(true);
    try {
      await probeServer();
      setServerOnline(true);
      onOrbToneChange('green');
    } catch {
      if ((isStandaloneClient() || getCustomServerBase()) && getAutoDiscoverEnabled()) {
        const disc = await discoverAndSwitchServer({ forceBypassCdn: true, currentUrl: getServerBase() });
        if (disc.ok) {
          setServerOnline(true);
          onOrbToneChange('green');
          if (disc.switched) await onReloadConfig();
          return;
        }
      }
      setServerOnline(false);
      onOrbToneChange('red');
    } finally {
      setProbing(false);
    }
  }, [onOrbToneChange, onReloadConfig]);

  useEffect(() => {
    void checkServer();
  }, [checkServer]);

  if (setupRequired) {
    return (
      <SetupWindow
        busy={busy}
        error={error}
        lang={lang}
        onSetupComplete={onSetupComplete}
        onBusyChange={onBusyChange}
        onErrorChange={onErrorChange}
      />
    );
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    await onSignIn(
      portal === 'staff' ? { portal: 'staff', email, password } : { portal: 'family', nationalId, password },
    );
  };

  return (
    <FloatingWindow
      id="login"
      title={schoolName}
      subtitle={lang === 'ar' ? 'اختر بوابة الدخول للمتابعة على المجسم' : 'Sign in over the 3D campus'}
      dock="center"
      width={408}
      zIndex={40}
      onFocus={() => {}}
    >
      <div className="sp-login-orb-stage">
        <button
          type="button"
          className="sp-login-orb-btn"
          onClick={onOpenConnectionOrb}
          title={lang === 'ar' ? 'اتصال الخادم والنفق السحابي' : 'Server & Cloud Connection'}
        >
          <Orb size={74} tone={orbTone} speed={probing ? 1.25 : 0.6} />
        </button>
        <button type="button" className={`sp-orb-pill is-${orbTone}`} onClick={onOpenConnectionOrb}>
          <i />
          <span>
            {serverOnline
              ? lang === 'ar'
                ? 'متصل بخادم المدرسة · تغيير الرابط'
                : 'School Server Connected · Settings'
              : lang === 'ar'
                ? 'تعذر الاتصال · اضغط لإعداد الخادم'
                : 'Offline · Tap Orb to Connect'}
          </span>
        </button>
      </div>

      <div className="sp-segmented">
        <button
          type="button"
          className={portal === 'staff' ? 'is-active' : ''}
          onClick={() => {
            setPortal('staff');
            onErrorChange('');
          }}
        >
          <ShieldCheck size={14} />
          <span>{lang === 'ar' ? 'الإدارة والمعلمون' : 'Staff & Principal'}</span>
        </button>
        <button
          type="button"
          className={portal === 'family' ? 'is-active' : ''}
          onClick={() => {
            setPortal('family');
            onErrorChange('');
          }}
        >
          <UserCheck size={14} />
          <span>{lang === 'ar' ? 'الأهل والطلبة' : 'Family & Student'}</span>
        </button>
      </div>

      <form className="sp-form" onSubmit={(e) => void handleLogin(e)}>
        {error && <p className="sp-alert">{error}</p>}

        {portal === 'staff' ? (
          <label className="sp-field">
            <span>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
            <input
              type="email"
              required
              autoComplete="username"
              placeholder="omar.ayasreh@alshereqi.edu.jo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : (
          <label className="sp-field">
            <span>{lang === 'ar' ? 'الرقم الوطني' : 'National ID'}</span>
            <input inputMode="numeric" required placeholder="0000000001" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          </label>
        )}

        <label className="sp-field">
          <span>{lang === 'ar' ? 'كلمة المرور' : 'Password'}</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <button type="submit" className="sp-btn-primary" disabled={busy}>
          <KeyRound size={15} />
          <span>{busy ? (lang === 'ar' ? 'جارٍ الدخول…' : 'Signing in…') : (lang === 'ar' ? 'دخول' : 'Sign in')}</span>
        </button>

        {demo && (
          <div className="sp-demo-strip">
            <small>
              <Sparkles size={12} />
              {lang === 'ar'
                ? 'بيئة اختبار معزولة (دخول فوري بدون إنشاء حساب)'
                : 'Isolated Sandbox · 1-Click Role Preview'}
            </small>
            <div className="sp-demo-chips">
              {[
                { role: 'admin' as DemoRole, ar: 'المدير', en: 'Principal' },
                { role: 'assistant' as DemoRole, ar: 'مساعد المدير', en: 'Assistant' },
                { role: 'teacher' as DemoRole, ar: 'معلم (جناح غرب)', en: 'Teacher (West)' },
                { role: 'teacher2' as DemoRole, ar: 'معلم (جناح شرق)', en: 'Teacher (East)' },
                { role: 'parent' as DemoRole, ar: 'ولي أمر', en: 'Parent' },
                { role: 'student' as DemoRole, ar: 'طالب', en: 'Student' },
              ].map((item) => (
                <button
                  key={item.role}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onSwitchDemoRole
                      ? void onSwitchDemoRole(item.role)
                      : void onSignIn({ portal: 'staff', email: 'rami@schoolsync.demo', password: 'SchoolSync!2026' })
                  }
                >
                  {lang === 'ar' ? item.ar : item.en}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </FloatingWindow>
  );
}
