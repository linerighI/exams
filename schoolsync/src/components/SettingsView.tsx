/**
 * Account profile and application preferences screen (`you` view), including
 * responsive layout mode switcher and native phone notification testing.
 */
import { ArrowUpRight, BellRing, LogOut, Monitor, Moon, ShieldCheck, Smartphone, Tablet } from 'lucide-react';
import { words, type Language } from '../i18n';
import { ensureNativeNotificationPermission, showNativeNotification } from '../nativeNotify';
import { tr } from '../translations';
import type { LayoutMode, State } from '../types';
import { initials, Section } from '../ui';

export function SettingsView({
  data,
  lang,
  setLang,
  dark,
  setDark,
  layoutMode,
  setLayoutMode,
  busy,
  mutate,
  openSheet,
  onLogout,
}: {
  data: State;
  lang: Language;
  setLang: (l: Language) => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  layoutMode: LayoutMode;
  setLayoutMode: (m: LayoutMode) => void;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  openSheet: (name: string) => void;
  onLogout: () => Promise<void>;
}) {
  const t = words[lang];
  const ar = lang === 'ar';
  const roleLabel = ar
    ? data.user.role === 'admin'
      ? 'المدير'
      : data.user.role === 'assistant'
        ? 'مساعد المدير'
        : data.user.role === 'teacher'
          ? 'المعلم'
          : 'الطالب والعائلة'
    : data.user.role === 'student' || data.user.role === 'parent'
      ? 'Student & Family'
      : tr(data.user.role);

  const testPhoneNotification = async () => {
    await ensureNativeNotificationPermission();
    const ok = await mutate(
      '/notifications/test',
      {},
      ar ? 'تم إرسال إشعار تجريبي إلى هاتفك' : 'Test notification sent',
    );
    if (ok) {
      await showNativeNotification({
        id: `local-test-${Date.now()}`,
        title: ar ? 'إشعار تجريبي · مدرسة محمد الشريقي' : 'Test Alert · Alshereqi',
        content: ar ? 'هكذا تظهر تنبيهات المدرسة في شريط إشعارات الهاتف.' : 'Sample native shade alert.',
      });
    }
  };

  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{ar ? 'إعدادات الحساب والتطبيق' : 'ACCOUNT & PREFERENCES'}</div>
        <h1>
          {t.you}
          <span className="greeting-dot">.</span>
        </h1>
        <p>{t.profile}</p>
      </div>

      <div className="profile-card t-surface" data-reveal>
        <span className={`avatar big ${data.student?.color || 'mint'}`}>{initials(data.user.name)}</span>
        <div>
          <h2>{data.user.name}</h2>
          <p>
            {roleLabel} · {data.school.name}
          </p>
          <small dir="ltr">
            {data.student?.national_id ? `${ar ? 'الرقم الوطني: ' : 'National ID: '}${data.student.national_id}` : data.user.email}
          </small>
        </div>
      </div>

      <Section title={t.settings} />
      <div className="settings-list" data-reveal>
        <label>
          <span>
            <Moon size={18} />
            {t.dark}
          </span>
          <input type="checkbox" role="switch" checked={dark} onChange={(e) => setDark(e.target.checked)} />
        </label>
        <div className="layout-mode-card">
          <span>
            <Monitor size={18} />
            {ar ? 'وضع العرض (هاتف / تابلت / كمبيوتر)' : 'Display layout mode'}
          </span>
          <div className="chip-row">
            {(
              [
                ['auto', ar ? 'تلقائي' : 'Auto', Monitor],
                ['phone', ar ? 'هاتف عمودي' : 'Phone Portrait', Smartphone],
                ['tablet', ar ? 'تابلت' : 'Tablet', Tablet],
                ['desktop', ar ? 'كمبيوتر' : 'Desktop', Monitor],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                type="button"
                key={id}
                className={`chip-pill ${layoutMode === id ? 'selected' : ''}`}
                onClick={() => setLayoutMode(id)}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span>{t.language}</span>
          <select value={lang} onChange={(e) => setLang(e.target.value as Language)}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </label>
        <button className="t-stagger-row" disabled={busy} onClick={() => void testPhoneNotification()}>
          <BellRing size={18} />
          {ar ? 'اختبار إشعار الهاتف في شريط الإشعارات' : 'Test native phone notification'}
          <ArrowUpRight size={17} />
        </button>
        <button className="t-stagger-row" onClick={() => openSheet('privacy')}>
          <ShieldCheck size={18} />
          {tr('Your data & privacy')}
          <ArrowUpRight size={17} />
        </button>
        <button className="t-stagger-row" onClick={() => openSheet('password')}>
          <ShieldCheck size={18} />
          {tr('Change password')}
          <ArrowUpRight size={17} />
        </button>
        <button className="t-stagger-row" onClick={() => void onLogout()}>
          <LogOut size={18} />
          {t.logout}
        </button>
      </div>
    </>
  );
}
