import { useEffect, useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  School,
  Sparkles,
  ShieldCheck,
  Wifi,
  Monitor,
  Search,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { api, setToken } from './api';
import Orb from './BlueOrb';
import MinistryBrand from './MinistryBrand';
import { motion } from 'motion/react';
import './exchange.css';
import './welcome.css';
import { findSnapshot, type Snapshot } from './offline';
import type { Session } from './types';
export const scope = () =>
  `${localStorage.getItem('school-scope') || 'development'}:${localStorage.getItem('school-account-scope') || 'master'}`;
export default function Welcome({
  onLogin,
  onHost,
  notify,
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
  const [host, setHost] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pin, setPin] = useState('');
  const [found, setFound] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
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
    setBusy(true);
    try {
      const info = await window.desktop.host();
      onHost(info);
      localStorage.setItem('school-scope', info.fingerprint);
      await status();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const scan = async () => {
    setBusy(true);
    try {
      const results = await window.desktop!.discover();
      setFound(results);
      if (results.length) setHost(results[0].host);
      else notify('لم نجد خادمًا. أدخل عنوان المعلم يدويًا');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pair = async () => {
    setBusy(true);
    try {
      await window.desktop!.pair(
        host,
        JSON.stringify({ code: pairCode.trim().toUpperCase(), fingerprint: pin.trim() }),
      );
      localStorage.setItem('school-scope', pin.trim());
      await status();
      setSetup(false);
    } catch (e) {
      setError((e as Error).message);
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
        code: mode === 'student' ? studentCode : undefined,
      });
      setToken(value.token);
      localStorage.setItem('school-account-scope', value.teacherId || 'master');
      if (value.student)
        localStorage.setItem(
          `student:${scope()}`,
          JSON.stringify({
            student: { ...value.student, code: undefined },
            teacherId: value.teacherId,
            codeHash: await digest(studentCode),
          }),
        );
      onLogin(value);
    } catch (e) {
      if (mode === 'student') {
        try {
          const hash = await digest(studentCode);
          const prefix = `student:${localStorage.getItem('school-scope') || 'development'}`;
          for (const key of Object.keys(localStorage).filter((k) => k.startsWith(prefix))) {
            const cached = JSON.parse(localStorage.getItem(key) || 'null');
            if (cached?.codeHash !== hash) continue;
            const cachedScope = key.slice('student:'.length);
            const snapshot = await findSnapshot(cached.student.id, cachedScope);
            if (snapshot) {
              localStorage.setItem('school-account-scope', cached.teacherId || 'master');
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
    } finally {
      setBusy(false);
    }
  };
  return (
    <motion.div
      className="login-page welcome-studio prism-login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="welcome-frame">
        <div className="login-layout">
          <section className="login-story">
            <span className="prism-wordmark" dir="rtl">
              امتحانات
            </span>
            <div className="prism-orb" aria-hidden="true">
              <Orb size={3.1} animationSpeedBase={0.35} />
            </div>
            <div className="prism-glass" aria-hidden="true" />
            <div className="prism-caption">
              <h1>مساحتك التعليمية</h1>
              <p>{school}</p>
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
                  disabled={busy}
                  onClick={() => void activate('teacher', true)}
                >
                  <Monitor size={18} /> تشغيل الجهاز الرئيسي
                </button>
              </>
            )}
            {window.desktop && mode === 'student' && !ready ? (
              <div className="pair-form">
                <button className="secondary wide" disabled={busy} onClick={() => void scan()}>
                  <Search size={17} /> البحث عن جهاز المعلم
                </button>
                {found.map((h) => (
                  <button className="found-host" key={h.host} onClick={() => setHost(h.host)}>
                    <Wifi size={17} />
                    {h.school}
                    <span dir="ltr">{h.host}</span>
                  </button>
                ))}
                <label className="field">
                  عنوان جهاز المعلم
                  <input
                    dir="ltr"
                    placeholder="192.168.1.10"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </label>
                <label className="field">
                  رمز الاقتران
                  <input dir="ltr" value={pairCode} onChange={(e) => setPairCode(e.target.value)} />
                </label>
                <label className="field">
                  بصمة الأمان المعروضة لدى المعلم
                  <textarea
                    rows={2}
                    dir="ltr"
                    placeholder="SHA-256"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </label>
                <button
                  className="primary wide"
                  disabled={busy || !host || !pairCode || !pin}
                  onClick={() => void pair()}
                >
                  ربط هذا الجهاز <ArrowLeft size={17} />
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setReady(true);
                    setSetup(false);
                  }}
                >
                  استخدام الاتصال المحفوظ / استعادة محاولة
                </button>
              </div>
            ) : (
              ready && (
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
                      رمز الطالب الخاص بك
                      <input
                        dir="ltr"
                        required
                        value={studentCode}
                        onChange={(e) => setStudentCode(e.target.value)}
                        placeholder="الرمز الذي أعطاك إياه المعلم"
                      />
                    </label>
                  )}
                  <button className="primary wide" disabled={busy}>
                    {busy ? <Loader2 className="spin" size={18} /> : <ArrowLeft size={18} />}{' '}
                    {setup && mode === 'teacher' ? 'إعداد حساب المدرسة' : 'دخول إلى مساحتي'}
                  </button>
                </form>
              )
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
    </motion.div>
  );
}
