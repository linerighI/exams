/**
 * Floating First-Run School Setup window rendered over the 3D campus when the
 * server database has no provisioned school/principal yet.
 */
import { useState, type FormEvent } from 'react';
import { Building2 } from 'lucide-react';
import { api } from '../api';
import type { Language } from '../i18n';
import { tr } from '../translations';
import { FloatingWindow } from './FloatingWindow';

interface SetupWindowProps {
  busy: boolean;
  error: string;
  lang: Language;
  onSetupComplete: () => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onErrorChange: (err: string) => void;
}

/** Initial school provisioning form floating over the 3D campus canvas. */
export function SetupWindow({
  busy,
  error,
  lang,
  onSetupComplete,
  onBusyChange,
  onErrorChange,
}: SetupWindowProps) {
  const [form, setForm] = useState({
    schoolName: 'مدرسة محمد الشريقي الثانوية للبنين',
    adminName: 'عمر عياصرة',
    email: '',
    password: '',
    timezone: 'Asia/Amman',
    start: '07:45',
    end: '13:30',
  });

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    onBusyChange(true);
    onErrorChange('');
    try {
      await api('/setup', form);
      await onSetupComplete();
    } catch (err) {
      onErrorChange(tr((err as Error).message));
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <FloatingWindow
      id="setup"
      title={lang === 'ar' ? 'إعداد المدرسة لأول مرة' : 'First-Run School Setup'}
      subtitle={lang === 'ar' ? 'أنشئ حساب المدير والمبنى الدراسي' : 'Provision school & principal'}
      dock="center"
      width={430}
      zIndex={40}
      onFocus={() => {}}
    >
      <form className="sp-form" onSubmit={(e) => void handleSetup(e)}>
        {error && <p className="sp-alert">{error}</p>}
        <label className="sp-field">
          <span>{lang === 'ar' ? 'اسم المدرسة' : 'School Name'}</span>
          <input required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} />
        </label>
        <div className="sp-row-2">
          <label className="sp-field">
            <span>{lang === 'ar' ? 'اسم المدير' : 'Principal Name'}</span>
            <input required value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
          </label>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'المنطقة الزمنية' : 'Timezone'}</span>
            <input required value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </label>
        </div>
        <label className="sp-field">
          <span>{lang === 'ar' ? 'البريد الإلكتروني للمدير' : 'Principal Email'}</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="sp-field">
          <span>{lang === 'ar' ? 'كلمة المرور (١٢ حرفاً على الأقل)' : 'Password (min 12 chars)'}</span>
          <input type="password" required minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <div className="sp-row-2">
          <label className="sp-field">
            <span>{lang === 'ar' ? 'بداية الدوام' : 'Start'}</span>
            <input type="time" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          </label>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'نهاية الدوام' : 'End'}</span>
            <input type="time" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="sp-btn-primary" disabled={busy}>
          <Building2 size={16} />
          <span>{busy ? (lang === 'ar' ? 'جارٍ الإعداد…' : 'Creating…') : (lang === 'ar' ? 'بدء تشغيل المدرسة' : 'Launch School')}</span>
        </button>
      </form>
    </FloatingWindow>
  );
}
