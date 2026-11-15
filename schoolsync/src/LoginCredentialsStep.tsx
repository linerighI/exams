/**
 * Prism-card credentials panel for Unified Student/Family (National ID) and Staff (Email) logins.
 */
import { ArrowLeft, BookOpen, Eye, EyeOff, GraduationCap, Loader2 } from 'lucide-react';
import type { Language } from './i18n';
import type { LoginRequest } from './Login';

export function LoginCredentialsStep({
  portal,
  onSelectPortal,
  username,
  setUsername,
  password,
  setPassword,
  visible,
  setVisible,
  busy,
  error,
  demo,
  lang,
  signIn,
}: {
  portal: 'family' | 'staff';
  onSelectPortal: (next: 'family' | 'staff') => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
  busy: boolean;
  error: string;
  demo: boolean;
  lang: Language;
  signIn: (input: LoginRequest) => Promise<void>;
}) {
  const ar = lang === 'ar';
  return (
    <div className="prism-card-inner">
      <div className="mode-switch" role="tablist" aria-label={ar ? 'نوع الحساب' : 'Account portal'}>
        <button
          type="button"
          role="tab"
          data-portal="family"
          aria-selected={portal === 'family'}
          className={portal === 'family' ? 'selected' : ''}
          onClick={() => onSelectPortal('family')}
        >
          <BookOpen size={17} />
          {ar ? 'طالب أو ولي أمر' : 'Student & Family'}
        </button>
        <button
          type="button"
          role="tab"
          data-portal="staff"
          aria-selected={portal === 'staff'}
          className={portal === 'staff' ? 'selected' : ''}
          onClick={() => onSelectPortal('staff')}
        >
          <GraduationCap size={17} />
          {ar ? 'معلم أو إدارة' : 'Teachers & School'}
        </button>
      </div>

      <form
        className="prism-form form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn(
            portal === 'family'
              ? { portal, nationalId: username, password }
              : { portal, email: username, password },
          );
        }}
      >
        <label className="prism-field">
          <span>
            {portal === 'family' ? (ar ? 'الرقم الوطني للطالب' : 'Student National ID') : ar ? 'البريد الإلكتروني' : 'Email'}
          </span>
          <input
            aria-label={portal === 'family' ? (ar ? 'الرقم الوطني للطالب' : 'Student National ID') : ar ? 'البريد الإلكتروني' : 'Email'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            type={portal === 'staff' ? 'email' : 'text'}
            inputMode={portal === 'family' ? 'numeric' : 'email'}
            maxLength={portal === 'family' ? 20 : 200}
            autoComplete="username"
            placeholder={portal === 'family' ? '200XXXXXXX' : 'name@alshereqi.edu.jo'}
            required
            dir="ltr"
          />
        </label>

        <label className="prism-field">
          <span>{ar ? 'كلمة المرور' : 'Password'}</span>
          <span className="prism-password">
            <input
              aria-label={ar ? 'كلمة المرور' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={visible ? 'text' : 'password'}
              placeholder={portal === 'family' ? '12345@Alshereqi.Edu' : '••••••••••••'}
              autoComplete="current-password"
              required
              dir="ltr"
            />
            <button
              type="button"
              className="password-visibility"
              aria-label={visible ? (ar ? 'إخفاء كلمة المرور' : 'Hide password') : ar ? 'إظهار كلمة المرور' : 'Show password'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>

        {error && (
          <div className="entry-error t-shake" role="alert">
            {error}
          </div>
        )}

        <button className="primary entry-continue" disabled={busy}>
          {busy ? <Loader2 size={18} className="spin" /> : <ArrowLeft size={18} />}
          <span>{busy ? (ar ? 'نفتح مساحتك…' : 'Opening your space…') : ar ? 'تسجيل الدخول' : 'Sign in'}</span>
        </button>
      </form>

      {demo && (
        <div className="entry-demo prism-demo-box">
          <span className="eyebrow">{ar ? 'جرّبها ببيانات تجريبية' : 'EXPLORE DEMO DATA'}</span>
          {portal === 'family' ? (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void signIn({ portal: 'family', nationalId: '0000000003', password: '00000@Alshereqi.Edu' })}
            >
              {ar ? 'تجربة حساب الطالب الموحّد' : 'Explore unified student portal'}
              <ArrowLeft size={15} />
            </button>
          ) : (
            <div className="staff-demo-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void signIn({ portal: 'staff', email: 'emma@schoolsync.demo', password: 'SchoolSync!2026' })}
              >
                {ar ? 'تجربة المعلم' : 'Teacher demo'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void signIn({ portal: 'staff', email: 'rami@schoolsync.demo', password: 'SchoolSync!2026' })}
              >
                {ar ? 'تجربة الإدارة' : 'Administrator demo'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="prism-card-footer">
        <img
          className="ministry-brand"
          src="./branding/ministry-jordan.png"
          alt={ar ? 'وزارة التربية والتعليم الأردنية' : 'Jordan Ministry of Education'}
        />
      </div>
    </div>
  );
}
