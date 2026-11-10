/**
 * SchoolSync First-Run Setup Component
 *
 * Renders the Arabic first-run school initialization screen for a clean,
 * empty SQLite operational database. Guides the school administrator to configure
 * school details and credentials without any seed or demo data.
 */

import { useRef, useState } from 'react';
import { ArrowLeft, Building2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Brand } from './ui';
import { usePressFeedback, useReveal } from './animation';

export function Setup({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (values: Record<string, FormDataEntryValue>) => Promise<void>;
}) {
  const [visible, setVisible] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, 'setup');
  usePressFeedback(root);
  return (
    <div className="entry-screen school-setup" ref={root}>
      <header className="entry-header">
        <Brand />
        <span className="entry-badge">
          <ShieldCheck size={17} />
        </span>
      </header>
      <div className="entry-intro" data-reveal>
        <span className="entry-portal-pill">
          <Building2 size={15} />
          إعداد المدرسة لأول مرة
        </span>
        <h1>
          مدرستك الحقيقية.
          <br />
          بداية جديدة<span>.</span>
        </h1>
        <p>
          قاعدة البيانات جاهزة وفارغة. أضف بيانات المدرسة وحساب المدير للبدء، ثم سجّل الطلاب
          والمعلمين وأولياء الأمور الفعليين.
        </p>
      </div>
      <form
        className="entry-form form-stack"
        data-reveal
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <label>
          اسم المدرسة
          <input name="schoolName" required maxLength={200} autoComplete="organization" />
        </label>
        <label>
          اسم مدير المدرسة
          <input name="adminName" required maxLength={200} autoComplete="name" />
        </label>
        <label>
          البريد الإلكتروني للمدير
          <input name="email" type="email" required autoComplete="username" dir="ltr" />
        </label>
        <label>
          كلمة مرور المدير
          <span className="password-input">
            <input
              name="password"
              type={visible ? 'text' : 'password'}
              minLength={12}
              maxLength={200}
              required
              autoComplete="new-password"
              dir="ltr"
            />
            <button
              type="button"
              className="password-visibility"
              aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <p className="form-help">
          استخدم كلمة مرور خاصة بك من ١٢ حرفاً على الأقل. لا توجد حسابات افتراضية.
        </p>
        <label>
          المنطقة الزمنية
          <input name="timezone" required defaultValue="Asia/Amman" dir="ltr" />
        </label>
        <div className="form-pair">
          <label>
            بداية الدوام
            <input name="start" type="time" required defaultValue="08:00" />
          </label>
          <label>
            نهاية الدوام
            <input name="end" type="time" required defaultValue="14:00" />
          </label>
        </div>
        {error && (
          <div className="entry-error" role="alert">
            {error}
          </div>
        )}
        <button className="primary entry-continue" disabled={busy}>
          {busy ? 'جارٍ إنشاء مدرستك…' : 'إنشاء المدرسة وحساب المدير'}
          <ArrowLeft size={18} />
        </button>
      </form>
      <p className="entry-foot">
        <LockKeyhole size={13} />
        لا توجد بيانات تجريبية. كل ما تضيفه سيُحفظ في قاعدة البيانات الفعلية.
      </p>
    </div>
  );
}
