import { useSceneMotion } from './appMotion';
import { useEffect, useRef, useState } from 'react';
import { GraduationCap, BookOpen, School, Wifi, Monitor, ArrowLeft, Loader2 } from 'lucide-react';
import { api, setToken } from './api';
import Orb from './BlueOrb';
import MinistryBrand from './MinistryBrand';
import { motion } from 'motion/react';
import './exchange.css';
import './welcome.css';
import { findSnapshot, type Snapshot } from './offline';
import { isConnectionError } from './api';
import type { Session } from './types';
import ConnectionDialog from './ConnectionDialog';
import { useTeacherConnection } from './useTeacherConnection';
import { cachedStudentHash, credentialSalt } from './studentCredential';
import { normalizeStudentCode } from './studentCode';
export const scope = () =>
  `${localStorage.getItem('school-scope') || 'development'}:${sessionStorage.getItem('school-account-scope') || localStorage.getItem('school-account-scope') || 'master'}`;
export default function Welcome({
  onLogin,
  onHost,
  onResume,
}: {
  onLogin: (s: Session) => void;
  onHost: (s: any) => void;
  notify: (s: string) => void;
  onResume: (s: Session, c: Snapshot) => void;
}) {
  const [mode, setMode] = useState<'teacher' | 'student'>('teacher');
  const [school, setSchool] = useState('مدرسة محمد الشريقي');
  const [setup, setSetup] = useState(false);
  const [ready, setReady] = useState(!window.desktop);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('admin');
  const [teacherName, setTeacherName] = useState('المعلم المسؤول');
  const [studentCode, setStudentCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [hostConflict, setHostConflict] = useState(false);
  const studentInput = useRef<HTMLInputElement>(null);
  const { connection, tone, accept, refresh: refreshConnection } = useTeacherConnection();
  const scene = useRef<HTMLDivElement>(null);
  useSceneMotion(
    scene,
    '.prism-story-brand, .prism-caption, .prism-guide > *, .login-card-icon, .login-card > form',
    ready,
  );
  useEffect(() => {
    if (connection.school) setSchool(connection.school);
  }, [connection.school]);
  useEffect(() => {
    if (!connectOpen && mode === 'student') studentInput.current?.focus();
  }, [connectOpen, mode]);
  const status = async () => {
    const data = await api('/api/status');
    setSetup(data.setup);
    setSchool(data.school);
    setReady(true);
  };
  useEffect(() => {
    if (!window.desktop) void status().catch((e) => setError(e.message));
  }, []);
  const activate = async (value: 'teacher' | 'student', launch = false) => {
    setMode(value);
    setError('');
    if (!window.desktop) return;
    if (value === 'teacher' && !launch) {
      setSetup(false);
      if (!connection.connected) {
        setReady(false);
        return;
      }
      setBusy(true);
      try {
        await status();
        setSetup(false);
      } catch {
        setReady(false);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (value === 'student') {
      setSetup(false);
      setReady(true);
      setBusy(true);
      try {
        await status();
        setSetup(false);
      } catch {
        setReady(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const info = await window.desktop.host();
      onHost(info);
      localStorage.setItem('school-scope', info.fingerprint);
      await status();
      await refreshConnection();
    } catch (e) {
      setError((e as Error).message);
      setHostConflict(true);
      setTimeout(() => setHostConflict(false), 2500);
    } finally {
      setBusy(false);
    }
  };
  const digest = async (value: string) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.trim().toUpperCase())),
      ),
    )
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  const login = async () => {
    setBusy(true);
    setError('');
    try {
      if (setup && mode === 'teacher') {
        await api('/api/setup', 'POST', { password, school, username, name: teacherName });
        setSetup(false);
      }
      const value: Session = await api('/api/login', 'POST', {
        role: mode,
        username: mode === 'teacher' ? username : undefined,
        password: mode === 'teacher' ? password : undefined,
        code: mode === 'student' ? normalizeStudentCode(studentCode) : undefined,
      });
      setToken(value.token);
      localStorage.setItem('school-account-scope', value.teacherId || 'master');
      sessionStorage.setItem('school-account-scope', value.teacherId || 'master');
      if (value.student) {
        const salt = credentialSalt();
        localStorage.setItem(
          `student:${scope()}`,
          JSON.stringify({
            student: { ...value.student, code: undefined },
            teacherId: value.teacherId,
            credentialVersion: 2,
            salt,
            codeHash: await cachedStudentHash(studentCode, salt),
          }),
        );
      }
      onLogin(value);
    } catch (e) {
      if (mode === 'student' && isConnectionError(e)) {
        try {
          const hash = await digest(studentCode);
          const prefix = `student:${localStorage.getItem('school-scope') || 'development'}`;
          for (const key of Object.keys(localStorage).filter((k) => k.startsWith(prefix))) {
            const cached = JSON.parse(localStorage.getItem(key) || 'null');
            if (
              !cached ||
              cached.codeHash !==
                (cached.credentialVersion === 2
                  ? await cachedStudentHash(studentCode, cached.salt)
                  : hash)
            )
              continue;
            const cachedScope = key.slice('student:'.length);
            const snapshot = await findSnapshot(cached.student.id, cachedScope);
            if (snapshot) {
              localStorage.setItem('school-account-scope', cached.teacherId || 'master');
              sessionStorage.setItem('school-account-scope', cached.teacherId || 'master');
              onResume(
                {
                  role: 'student',
                  token: '',
                  student: cached.student,
                  teacherId: cached.teacherId,
                },
                snapshot,
              );
              return;
            }
          }
        } catch {}
      }
      setError((e as Error).message);
      if (mode === 'student' && window.desktop && !connection.connected) setConnectOpen(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.div
      ref={scene}
      className="login-page welcome-studio prism-login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="welcome-frame">
        <div className="login-layout">
          <section className="login-story">
            <div className="prism-story-brand">
              <span className="prism-wordmark">امتحانات</span>
              <span className="prism-school">{school}</span>
            </div>
            <button
              type="button"
              className={`prism-orb connection-orb-button is-${tone} ${hostConflict ? 'host-conflict-glow' : ''}`}
              aria-label={
                connection.connected ? 'عرض حالة الاتصال بجهاز المعلم' : 'الاتصال بجهاز المعلم'
              }
              disabled={!window.desktop}
              onClick={() => setConnectOpen(true)}
            >
              <span aria-hidden="true">
                <Orb size={1.65} tone={tone} animationSpeedBase={0.35} />
              </span>
              <span className="orb-connection-label" aria-live="polite">
                <i />
                {tone === 'green'
                  ? 'تم الاتصال بأمان'
                  : connection.connected
                    ? connection.local
                      ? 'الجهاز الرئيسي جاهز'
                      : 'متصل بجهاز المعلم'
                    : 'اضغط للاتصال'}
              </span>
            </button>
            <div className="prism-caption">
              <span className="prism-story-label">
                {mode === 'teacher' ? 'من التحضير إلى النتائج' : 'خطوتك التالية واضحة'}
              </span>
              <h1>
                {mode === 'teacher' ? 'حضّر امتحانك.\nوتابع أثره.' : 'ابدأ بثقة.\nوتابع تقدمك.'}
              </h1>
              <p>
                {mode === 'teacher'
                  ? 'أسئلتك وطلابك ونتائجهم، في مساحة واحدة.'
                  : 'ادخل برمزك الخاص للوصول إلى امتحانات صفك.'}
              </p>
            </div>
            <ol
              className="prism-guide"
              aria-label={mode === 'teacher' ? 'خطوات المعلم' : 'خطوات الطالب'}
            >
              {(mode === 'teacher'
                ? [
                    ['جهّز أسئلتك', 'أنشئ امتحانًا يدويًا أو اختر من بنك الأسئلة.'],
                    ['أشرك طلابك', 'شارك رموز الدخول واتصل عبر شبكة المدرسة.'],
                    ['تابع النتائج', 'راجع الإجابات وتابع تقدم كل طالب.'],
                  ]
                : [
                    ['اتصل بجهاز المعلم', 'اضغط على الكرة واختر الجهاز، ثم أدخل رمز الاتصال.'],
                    ['أدخل بياناتك', 'استخدم رقمك الوطني المسجل أو الرمز الذي أعطاك إياه المعلم.'],
                    ['ابدأ امتحانك', 'اختر الامتحان المتاح وتابع الوقت أثناء الحل.'],
                  ]
              ).map(([title, description], index) => (
                <li key={title}>
                  <span className="prism-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="prism-network-note">
              <Wifi size={16} aria-hidden="true" />
              <span>اتصال محلي بين المعلم والطلاب عبر شبكة المدرسة</span>
            </div>
          </section>
          <section className="card login-card">
            <div className="login-card-icon">
              <School size={30} />
            </div>
            <h2>{setup && mode === 'teacher' ? 'أهلًا بمدرستك' : 'أهلًا بك من جديد'}</h2>
            <div className="mode-switch">
              <button
                className={mode === 'teacher' ? 'selected' : ''}
                onClick={() => void activate('teacher')}
              >
                <GraduationCap size={19} /> أنا معلم
              </button>
              <button
                className={mode === 'student' ? 'selected' : ''}
                onClick={() => void activate('student')}
              >
                <BookOpen size={19} /> أنا طالب
              </button>
            </div>
            {window.desktop && mode === 'teacher' && !ready && (
              <>
                <button
                  className="primary wide"
                  disabled={busy || (connection.connected && !connection.local)}
                  onClick={() => void activate('teacher', true)}
                >
                  <Monitor size={18} /> تشغيل الجهاز الرئيسي
                </button>
              </>
            )}
            {ready && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void login();
                }}
              >
                {mode === 'teacher' ? (
                  <>
                    <label className="field">
                      اسم المستخدم
                      <input
                        aria-label="اسم المستخدم"
                        autoComplete="username"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        minLength={3}
                        maxLength={40}
                      />
                    </label>
                    {setup && (
                      <label className="field">
                        اسم المعلم
                        <input
                          value={teacherName}
                          required
                          onChange={(e) => setTeacherName(e.target.value)}
                        />
                      </label>
                    )}
                    {setup && (
                      <label className="field">
                        اسم المدرسة
                        <input value={school} onChange={(e) => setSchool(e.target.value)} />
                      </label>
                    )}
                    <label className="field">
                      {setup ? 'إنشاء كلمة مرور للمعلم' : 'كلمة مرور المعلم'}
                      <span className="prism-password">
                        <input
                          aria-label={setup ? 'إنشاء كلمة مرور للمعلم' : 'كلمة مرور المعلم'}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={setup ? 'new-password' : 'current-password'}
                          minLength={setup ? 8 : 1}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={setup ? 'ثمانية أحرف على الأقل' : 'أدخل كلمة المرور'}
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? 'إخفاء' : 'إظهار'}
                        </button>
                      </span>
                    </label>
                  </>
                ) : (
                  <label className="field">
                    الرقم الوطني أو رمز الطالب
                    <input
                      ref={studentInput}
                      type="password"
                      autoComplete="off"
                      maxLength={40}
                      dir="ltr"
                      required
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      placeholder="رمز من 6 أرقام أو رقمك الوطني"
                      inputMode="numeric"
                    />
                  </label>
                )}
                <button className="primary wide" disabled={busy}>
                  {busy ? <Loader2 className="spin" size={18} /> : <ArrowLeft size={18} />}{' '}
                  {setup && mode === 'teacher' ? 'إعداد حساب المدرسة' : 'دخول إلى مساحتي'}
                </button>
              </form>
            )}
            {error && (
              <div className="error-note" role="alert">
                {error}
              </div>
            )}
            <div className="login-bottom">
              <MinistryBrand />
            </div>
          </section>
        </div>
      </div>
      {connectOpen && window.desktop && (
        <ConnectionDialog
          connection={connection}
          tone={tone}
          onClose={() => setConnectOpen(false)}
          onConnected={(info) => {
            accept(info);
            if (info.fingerprint) localStorage.setItem('school-scope', info.fingerprint);
            if (info.school) setSchool(info.school);
            setMode('student');
            setReady(true);
            setSetup(false);
            setError('');
          }}
        />
      )}
    </motion.div>
  );
}
