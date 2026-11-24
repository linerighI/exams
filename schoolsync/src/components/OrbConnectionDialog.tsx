/**
 * Interactive Orb Connection Dialog: lets WebView2 Desktop, Capacitor Android, and Web
 * clients auto-discover the active tunnel URL from GitHub or enter a custom link.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, GitBranch, Globe, Loader2, RefreshCw, Server, WifiOff, X } from 'lucide-react';
import {
  getCustomServerBase,
  getServerBase,
  probeServer,
  setServerBase,
  type ServerProbeResult,
} from '../api';
import type { Language } from '../i18n';
import { Orb } from '../Orb';
import {
  discoverAndSwitchServer,
  getAutoDiscoverEnabled,
  getLastSyncAt,
  getRegistryLabel,
  setAutoDiscoverEnabled,
} from '../registry';

export interface OrbConnectionDialogProps {
  open: boolean;
  lang: Language;
  tone: 'blue' | 'green' | 'red';
  schoolName: string;
  onConnected: (info: ServerProbeResult) => Promise<void> | void;
  onResetLocal: () => Promise<void> | void;
  onClose: () => void;
}

/** Modal dialog triggered by tapping the Login Orb to inspect, sync, or switch server links. */
export function OrbConnectionDialog({
  open,
  lang,
  tone,
  schoolName,
  onConnected,
  onResetLocal,
  onClose,
}: OrbConnectionDialogProps) {
  const [urlInput, setUrlInput] = useState(() => getCustomServerBase() || getServerBase());
  const [autoDiscover, setAutoDiscover] = useState(() => getAutoDiscoverEnabled());
  const [checking, setChecking] = useState(false);
  const [dialogTone, setDialogTone] = useState<'blue' | 'green' | 'red'>(tone);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ar = lang === 'ar';

  useEffect(() => {
    setDialogTone(tone);
  }, [tone]);

  useEffect(() => {
    if (!open) return;
    setUrlInput(getCustomServerBase() || getServerBase());
    setAutoDiscover(getAutoDiscoverEnabled());
    setError('');
    setFeedback('');
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  const verifyAndSave = async (targetUrl: string, resetLocal = false) => {
    setChecking(true);
    setError('');
    setFeedback('');
    try {
      const clean = targetUrl.trim().replace(/\/+$/, '');
      if (resetLocal) {
        setServerBase('');
        const probe = await probeServer('');
        setDialogTone('green');
        setFeedback(ar ? 'تمت العودة إلى الخادم المحلي بنجاح' : 'Switched back to local server');
        await onResetLocal();
        await onConnected(probe);
        return;
      }
      if (!/^https?:\/\/.+/i.test(clean)) {
        setError(ar ? 'أدخل رابطاً صحيحاً يبدأ بـ https:// أو http://' : 'Enter a valid http:// or https:// link');
        setDialogTone('red');
        return;
      }
      const probe = await probeServer(clean);
      setServerBase(clean);
      setDialogTone('green');
      setFeedback(
        ar
          ? `تم الاتصال بنجاح: ${probe.schoolName}`
          : `Connected safely to ${probe.schoolName}`,
      );
      await onConnected(probe);
    } catch {
      setDialogTone('red');
      setError(
        ar
          ? 'تعذر الوصول إلى هذا الرابط. تأكد من تشغيل تطبيق لوحة الخادم والنفق السحابي.'
          : 'Server unreachable. Make sure the SchoolSync Server Console & tunnel are running.',
      );
    } finally {
      setChecking(false);
    }
  };

  const syncFromGitHub = async () => {
    setChecking(true);
    setError('');
    setFeedback('');
    try {
      const outcome = await discoverAndSwitchServer({
        force: true,
        forceBypassCdn: true,
        currentUrl: getCustomServerBase() || getServerBase(),
      });
      if (!outcome.ok || !outcome.probe || !outcome.url) {
        setDialogTone('red');
        setError(
          outcome.reason === 'no-url'
            ? ar
              ? 'لم ينشر الخادم رابطاً نشطاً في GitHub بعد.'
              : 'No active tunnel URL is published on GitHub yet.'
            : ar
              ? 'تم جلب الرابط من GitHub لكن الخادم لا يستجيب حالياً.'
              : 'Fetched tunnel URL from GitHub, but the school server did not respond.',
        );
        return;
      }
      setUrlInput(outcome.url);
      setDialogTone('green');
      setFeedback(
        ar
          ? `تم التحديث التلقائي من GitHub: ${outcome.probe.schoolName}`
          : `Synced from GitHub: ${outcome.probe.schoolName}`,
      );
      await onConnected(outcome.probe);
    } finally {
      setChecking(false);
    }
  };

  const lastSync = getLastSyncAt();

  return createPortal(
    <div
      className="orb-dialog-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !checking) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !checking) onClose();
      }}
    >
      <div
        className="orb-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="orb-conn-title"
        dir={ar ? 'rtl' : 'ltr'}
      >
        <header className="orb-dialog-head">
          <div className="orb-dialog-title">
            <Globe size={18} />
            <h2 id="orb-conn-title">{ar ? 'اتصال الخادم والمزامنة التلقائية' : 'Server & Auto-Sync Link'}</h2>
          </div>
          <button
            type="button"
            className="orb-dialog-close"
            aria-label={ar ? 'إغلاق لوحة الاتصال' : 'Close server dialog'}
            onClick={onClose}
            disabled={checking}
          >
            <X size={18} />
          </button>
        </header>

        <div className="orb-dialog-stage">
          <Orb size={86} tone={dialogTone} speed={checking ? 1.25 : 0.45} />
          <div className={`orb-dialog-badge is-${dialogTone}`}>
            {dialogTone === 'green' ? <CheckCircle2 size={14} /> : dialogTone === 'red' ? <WifiOff size={14} /> : <Server size={14} />}
            <span>
              {checking
                ? ar
                  ? 'جارٍ فحص الخادم…'
                  : 'Checking server…'
                : dialogTone === 'green'
                  ? ar
                    ? 'متصل بأمان الآن'
                    : 'Connected safely'
                  : dialogTone === 'red'
                    ? ar
                      ? 'الخادم غير متصل حالياً'
                      : 'Server disconnected'
                    : schoolName}
            </span>
          </div>
        </div>

        <div className="orb-dialog-registry">
          <div className="orb-dialog-registry-row">
            <GitBranch size={14} />
            <span dir="ltr">{getRegistryLabel()}</span>
          </div>
          <label className="orb-dialog-toggle">
            <input
              type="checkbox"
              checked={autoDiscover}
              onChange={(e) => {
                setAutoDiscover(e.target.checked);
                setAutoDiscoverEnabled(e.target.checked);
              }}
            />
            <span>
              {ar
                ? 'استبدال الرابط تلقائياً عند تغيير رابط الخادم في GitHub'
                : 'Auto-replace URL from GitHub when server restarts'}
            </span>
          </label>
          {lastSync ? (
            <p className="orb-dialog-hint">
              {ar ? `آخر مزامنة ناجحة: ${lastSync.slice(0, 19).replace('T', ' ')}` : `Last sync: ${lastSync.slice(0, 19).replace('T', ' ')}`}
            </p>
          ) : null}
          <button type="button" className="secondary" disabled={checking} onClick={() => void syncFromGitHub()}>
            {checking ? <Loader2 size={15} className="spin" /> : <GitBranch size={15} />}
            {ar ? 'تحديث تلقائي من GitHub الآن' : 'Sync from GitHub Now'}
          </button>
        </div>

        <form
          className="orb-dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            void verifyAndSave(urlInput);
          }}
        >
          <label htmlFor="orb-server-url-input">
            {ar ? 'رابط الخادم أو النفق السحابي (يدوياً)' : 'School Server or Cloud Tunnel URL'}
          </label>
          <input
            id="orb-server-url-input"
            ref={inputRef}
            dir="ltr"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://xxxx.trycloudflare.com"
          />
          <p className="orb-dialog-hint">
            {ar
              ? 'يقوم التطبيق بجلب أحدث رابط سحابي تلقائياً من مستودع المدرسة عند انقطاع الاتصال أو إعادة التشغيل.'
              : 'The app automatically fetches the latest cloud link from GitHub whenever the host restarts.'}
          </p>

          {error && (
            <div className="orb-dialog-error" role="alert">
              {error}
            </div>
          )}
          {feedback && (
            <div className="orb-dialog-success" role="status">
              {feedback}
            </div>
          )}

          <div className="orb-dialog-actions">
            <button type="submit" className="primary" disabled={checking}>
              {checking ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
              {ar ? 'فحص وحفظ الرابط' : 'Connect & Save'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={checking}
              onClick={() => void verifyAndSave('', true)}
            >
              {ar ? 'الوضع المحلي التلقائي' : 'Use Local Default'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
