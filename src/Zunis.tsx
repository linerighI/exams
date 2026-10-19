import { BrandTrace, useBrandMotion } from './BrandMotion';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, LockKeyhole, KeyRound } from 'lucide-react';
import FocusWindow from './FocusWindow';
import { api } from './api';
import './workflow.css';
export function ZunisSplash() {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => !sessionStorage.getItem('zunis-welcome'));
  useBrandMotion(root, visible);
  const close = () => {
    sessionStorage.setItem('zunis-welcome', '1');
    setVisible(false);
  };
  useEffect(() => {
    const timer = setTimeout(close, 1800);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <motion.div
      ref={root}
      className="zunis-splash"
      role="dialog"
      aria-label="مرحبًا بك في Zunis"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <span className="zunis-emblem">
        <BrandTrace />
        <ShieldCheck size={48} />
      </span>
      <h1>Zunis</h1>
      <p>حماية مساحة المدرسة</p>
      <small>صلاحيات المعلّم · جلسات الطلاب · خصوصية البيانات</small>
      <button className="text-button" onClick={close}>
        الدخول إلى التطبيق ←
      </button>
      <span className="zunis-powered">Powered by Zunis</span>
    </motion.div>
  );
}
export function ZunisBrand() {
  const [open, setOpen] = useState(false),
    [status, setStatus] = useState<any>(),
    [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    setStatus(undefined);
    setError('');
    void api('/api/security/status')
      .then((v) => {
        if (live) setStatus(v);
      })
      .catch(() => {
        if (live) setError('تعذر الاتصال بخادم المدرسة للتحقق من الحالة.');
      });
    return () => {
      live = false;
    };
  }, [open]);
  return (
    <>
      <button className="zunis-brand" onClick={() => setOpen(true)}>
        <ShieldCheck size={13} />
        Powered by Zunis
      </button>
      {open && (
        <FocusWindow title="Zunis · حالة الحماية" onClose={() => setOpen(false)}>
          <div className="zunis-details">
            <ShieldCheck size={36} />
            <h3>حماية مبنية داخل التطبيق</h3>
            <p>تُطبق الصلاحيات في الخادم، وتبقى قوائم الطلاب خارج سياق الذكاء الاصطناعي.</p>
            {status ? (
              <>
                <ul>
                  <li>
                    <LockKeyhole size={17} /> اتصال المدرسة:{' '}
                    {status.transport === 'https'
                      ? 'HTTPS'
                      : 'HTTP محلي للتطوير — استخدم تطبيق Windows للاتصال المشفر'}
                  </li>
                  <li>
                    <KeyRound size={17} /> كلمات المرور: {status.passwordHashing}
                  </li>
                  <li>إجراءات المعلم: تحقق من صلاحية الحساب في الخادم</li>
                  <li>خروج الطالب: كلمة مرور المعلم مطلوبة</li>
                </ul>
                <small>آخر قراءة: {new Date(status.checkedAt).toLocaleTimeString('ar-JO')}</small>
              </>
            ) : (
              <p role="status">{error || 'جارٍ قراءة حالة الخادم…'}</p>
            )}
            <p className="zunis-note">
              Zunis اسم طبقة الحماية في هذا التطبيق، وليس شهادة تدقيق خارجي أو ضمانًا مطلقًا.
            </p>
          </div>
        </FocusWindow>
      )}
    </>
  );
}
