import { useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Brand, Motion } from './ui';
import type { Language } from './i18n';
import { Portrait } from './Portrait';
import { gsap, quietMotion, usePressFeedback } from './animation';
export type LoginRequest =
  | { portal: 'family'; nationalId: string; password: string }
  | { portal: 'staff'; email: string; password: string };
export default function Login({
  demo,
  busy,
  error,
  signIn,
  lang,
  setLang,
}: {
  demo: boolean;
  busy: boolean;
  error: string;
  signIn: (input: LoginRequest) => Promise<void>;
  lang: Language;
  setLang: (lang: Language) => void;
}) {
  const [portal, setPortal] = useState<'family' | 'staff'>(
    new URLSearchParams(location.search).get('portal') === 'school' ? 'staff' : 'family',
  );
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement>(null);
  const ar = lang === 'ar';
  usePressFeedback(root);
  useLayoutEffect(() => {
    if (!cards.current) return;
    const ctx = gsap.context(() => {
      for (const card of cards.current!.querySelectorAll<HTMLButtonElement>('button')) {
        const active = card.dataset.portal === portal;
        gsap.to(card, {
          y: active ? -6 : 4,
          scale: active ? 1 : 0.96,
          opacity: active ? 1 : 0.64,
          duration: quietMotion() ? 0 : 0.48,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      }
    }, cards);
    return () => ctx.revert();
  }, [portal, step]);
  const choose = (value: 'family' | 'staff') => {
    setPortal(value);
    setUsername('');
    setPassword('');
  };
  return (
    <div className="entry-screen" ref={root}>
      <header className="entry-header">
        <Brand />
        <button className="text-button" onClick={() => setLang(ar ? 'en' : 'ar')}>
          {ar ? 'English' : 'العربية'}
        </button>
      </header>
      <div
        className="entry-progress"
        aria-label={ar ? `الخطوة ${step + 1} من ٢` : `Step ${step + 1} of 2`}
      >
        <span className="entry-step">
          <i className="done" />
          <i className={step === 1 ? 'done' : ''} />
        </span>
        <span>{ar ? 'مساحة واحدة، وروابط أقرب' : 'One place. Closer connections.'}</span>
        {step === 1 ? (
          <button
            className="entry-back"
            aria-label={ar ? 'العودة لاختيار الحساب' : 'Back to account type'}
            onClick={() => setStep(0)}
          >
            <ArrowRight size={18} />
          </button>
        ) : (
          <span className="entry-badge">
            <ShieldCheck size={15} />
          </span>
        )}
      </div>
      <Motion identity={`login-${step}`}>
        {step === 0 ? (
          <>
            <div className="entry-intro" data-reveal>
              <span className="eyebrow">
                {ar ? 'أهلاً بك في سكول سينك' : 'WELCOME TO SCHOOLSYNC'}
              </span>
              <h1>
                {ar ? (
                  <>
                    من سيستخدم
                    <br />
                    هذه المساحة<span>؟</span>
                  </>
                ) : (
                  <>
                    Who’s joining
                    <br />
                    the school day<span>?</span>
                  </>
                )}
              </h1>
              <p>
                {ar
                  ? 'اختر مساحتك. صُمّمت التفاصيل لتناسب يومك.'
                  : 'Choose your space. Every detail is made for your day.'}
              </p>
            </div>
            <div className="portal-options" ref={cards} data-reveal>
              <button
                className={`portal-option ${portal === 'family' ? 'selected' : ''}`}
                data-portal="family"
                aria-pressed={portal === 'family'}
                onClick={() => choose('family')}
              >
                <span className="portal-selection">
                  {portal === 'family' ? <Check size={13} /> : <UsersRound size={14} />}
                </span>
                <span className="portal-card-label">{ar ? 'العائلة أولاً' : 'FAMILY FIRST'}</span>
                <Portrait variant={1} adult />
                <div className="portal-card-copy">
                  <h2>{ar ? 'ولي أمر' : 'Parent or guardian'}</h2>
                  <p>{ar ? 'قريب من يومهم، أينما كنت.' : 'A little closer to their day.'}</p>
                </div>
              </button>
              <button
                className={`portal-option staff-option ${portal === 'staff' ? 'selected' : ''}`}
                data-portal="staff"
                aria-pressed={portal === 'staff'}
                onClick={() => choose('staff')}
              >
                <span className="portal-selection">
                  {portal === 'staff' ? <Check size={13} /> : <GraduationCap size={15} />}
                </span>
                <span className="portal-card-label">{ar ? 'نصنع فرقاً' : 'MAKE A DIFFERENCE'}</span>
                <Portrait variant={0} adult />
                <div className="portal-card-copy">
                  <h2>{ar ? 'معلم أو إدارة' : 'Teachers & school'}</h2>
                  <p>{ar ? 'وقت أكثر لما يستحق الاهتمام.' : 'More room for what matters.'}</p>
                </div>
              </button>
            </div>
            <div className="entry-selection-copy" data-reveal>
              <span className="entry-selection-dot" />
              {portal === 'family'
                ? ar
                  ? 'كل أبنائك في حساب عائلي واحد.'
                  : 'Your children, together in one family account.'
                : ar
                  ? 'أدوات مدرستك، ومنظور العائلة أيضاً.'
                  : 'School tools, with the family perspective included.'}
            </div>
            <button className="primary entry-continue" onClick={() => setStep(1)} data-reveal>
              {ar ? 'متابعة' : 'Continue'}
              <ArrowLeft size={19} />
            </button>
            <p className="entry-foot" data-reveal>
              <LockKeyhole size={12} />
              {ar
                ? 'تواصل أقرب. وخصوصية تستحق الثقة.'
                : 'Closer connections. Thoughtfully protected.'}
            </p>
          </>
        ) : (
          <>
            <div className="entry-intro credentials-intro" data-reveal>
              <span className="entry-portal-pill">
                {portal === 'family' ? <HeartHandshake size={15} /> : <GraduationCap size={16} />}
                {portal === 'family'
                  ? ar
                    ? 'مساحة العائلة'
                    : 'FAMILY SPACE'
                  : ar
                    ? 'مساحة المدرسة'
                    : 'SCHOOL SPACE'}
              </span>
              <h1>
                {portal === 'family' ? (
                  ar ? (
                    <>
                      كل يومهم.
                      <br />
                      أقرب إليك<span>.</span>
                    </>
                  ) : (
                    <>
                      Their day.
                      <br />A little closer<span>.</span>
                    </>
                  )
                ) : ar ? (
                  <>
                    أهلاً بصنّاع
                    <br />
                    الأثر الجميل<span>.</span>
                  </>
                ) : (
                  <>
                    Welcome,
                    <br />
                    day makers<span>.</span>
                  </>
                )}
              </h1>
              <p>
                {portal === 'family'
                  ? ar
                    ? 'أدخل بيانات أي من أبنائك للوصول إلى حساب العائلة نفسه.'
                    : 'Use either child’s credentials to open your shared family account.'
                  : ar
                    ? 'مساحتك للتعليم، والمتابعة، والتواصل مع العائلة.'
                    : 'Your space to teach, follow up, and stay connected.'}
              </p>
            </div>
            <form
              className="entry-form form-stack"
              data-reveal
              onSubmit={(e) => {
                e.preventDefault();
                void signIn(
                  portal === 'family'
                    ? { portal, nationalId: username, password }
                    : { portal, email: username, password },
                );
              }}
            >
              <label>
                {portal === 'family'
                  ? ar
                    ? 'الرقم الوطني للطالب'
                    : 'Student national ID'
                  : ar
                    ? 'البريد الإلكتروني'
                    : 'Email'}
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  type={portal === 'staff' ? 'email' : 'text'}
                  inputMode={portal === 'family' ? 'numeric' : 'email'}
                  maxLength={portal === 'family' ? 10 : 200}
                  autoComplete="username"
                  placeholder={portal === 'family' ? '••••••••••' : 'name@school.edu'}
                  required
                  dir="ltr"
                />
              </label>
              <label>
                {portal === 'family'
                  ? ar
                    ? 'رمز الدخول'
                    : 'Access code'
                  : ar
                    ? 'كلمة المرور'
                    : 'Password'}
                <span className="password-input">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={visible ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    dir="ltr"
                  />
                  <button
                    type="button"
                    className="password-visibility"
                    aria-label={
                      visible
                        ? ar
                          ? 'إخفاء الرمز'
                          : 'Hide password'
                        : ar
                          ? 'إظهار الرمز'
                          : 'Show password'
                    }
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {error && (
                <div className="entry-error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary entry-continue" disabled={busy}>
                {busy
                  ? ar
                    ? 'نفتح مساحتك…'
                    : 'Opening your space…'
                  : ar
                    ? 'تسجيل الدخول'
                    : 'Sign in'}
                <ArrowLeft size={19} />
              </button>
            </form>
            {portal === 'family' && (
              <div className="family-login-note" data-reveal>
                <UsersRound size={19} />
                <p>
                  {ar
                    ? 'لكل طالب رمز مستقل، وللأشقاء حساب عائلة مشترك. بعد الدخول، اختر الطالب الذي تريد متابعته.'
                    : 'Each child has their own code. Siblings share a family account; choose a child after signing in.'}
                </p>
              </div>
            )}
            {demo && (
              <div className="entry-demo" data-reveal>
                <span className="eyebrow">
                  {ar ? 'جرّبها ببيانات خيالية' : 'EXPLORE WITH FICTIONAL DATA'}
                </span>
                {portal === 'family' ? (
                  <>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void signIn({
                          portal: 'family',
                          nationalId: '0000000001',
                          password: 'YousefDemo2026',
                        })
                      }
                    >
                      {ar ? 'تجربة عائلة بطفلين' : 'Explore a family with two children'}
                      <ArrowLeft size={16} />
                    </button>
                    <small>
                      {ar ? 'يوسف وعمر · حساب العائلة نفسه' : 'Yousef & Omar · One family account'}
                    </small>
                  </>
                ) : (
                  <div className="staff-demo-actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void signIn({
                          portal: 'staff',
                          email: 'emma@schoolsync.demo',
                          password: 'SchoolSync!2026',
                        })
                      }
                    >
                      {ar ? 'تجربة المعلم' : 'Teacher demo'}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void signIn({
                          portal: 'staff',
                          email: 'rami@schoolsync.demo',
                          password: 'SchoolSync!2026',
                        })
                      }
                    >
                      {ar ? 'تجربة الإدارة' : 'Administrator demo'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <p className="entry-foot">
              <ShieldCheck size={12} />
              {ar
                ? 'المدرسة تتحقق من الحسابات وروابط العائلة.'
                : 'Accounts and family relationships are verified by your school.'}
            </p>
          </>
        )}
      </Motion>
    </div>
  );
}
