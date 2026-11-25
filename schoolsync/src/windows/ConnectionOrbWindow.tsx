/**
 * Floating Orb Connection Window triggered from the Login Blue Orb or Day Companion:
 * probes server/cloud tunnel health, syncs tunnel URLs from GitHub, or connects to a custom link.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, GitBranch, Globe, RefreshCw, Server, WifiOff } from 'lucide-react';
import {
  getCustomServerBase,
  getServerBase,
  probeServer,
  setServerBase,
  type ServerProbeResult,
} from '../api';
import type { Language } from '../i18n';
import { Orb, type OrbTone } from '../Orb';
import {
  discoverAndSwitchServer,
  getAutoDiscoverEnabled,
  getLastSyncAt,
  getRegistryLabel,
  setAutoDiscoverEnabled,
} from '../registry';
import { FloatingWindow } from './FloatingWindow';

interface ConnectionOrbWindowProps {
  lang: Language;
  tone: OrbTone;
  schoolName: string;
  zIndex: number;
  onFocus: () => void;
  onConnected: (info: ServerProbeResult) => Promise<void> | void;
  onResetLocal: () => Promise<void> | void;
  onClose: () => void;
}

/** Floating frosted-glass server & cloud-tunnel connection inspector powered by the Blue Orb. */
export function ConnectionOrbWindow({
  lang,
  tone,
  schoolName,
  zIndex,
  onFocus,
  onConnected,
  onResetLocal,
  onClose,
}: ConnectionOrbWindowProps) {
  const [urlInput, setUrlInput] = useState(() => getCustomServerBase() || getServerBase());
  const [autoDiscover, setAutoDiscover] = useState(() => getAutoDiscoverEnabled());
  const [checking, setChecking] = useState(false);
  const [dialogTone, setDialogTone] = useState<OrbTone>(tone);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const ar = lang === 'ar';

  useEffect(() => {
    setDialogTone(tone);
  }, [tone]);

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
        setError(ar ? 'أدخل رابطاً صحيحاً يبدأ بـ http:// أو https://' : 'Enter a valid http:// or https:// URL');
        setDialogTone('red');
        return;
      }
      const probe = await probeServer(clean);
      setServerBase(clean);
      setDialogTone('green');
      setFeedback(ar ? `تم الاتصال بنجاح: ${probe.schoolName}` : `Connected to ${probe.schoolName}`);
      await onConnected(probe);
    } catch {
      setDialogTone('red');
      setError(
        ar
          ? 'تعذر الوصول إلى هذا الرابط. تأكد من تشغيل خادم المدرسة.'
          : 'Server unreachable. Ensure SchoolSync server is running.',
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
          ar
            ? 'تعذر جلب أو فحص رابط النفق من GitHub حالياً.'
            : 'Could not discover an active tunnel URL from GitHub.',
        );
        return;
      }
      setUrlInput(outcome.url);
      setDialogTone('green');
      setFeedback(
        ar ? `تم التحديث من GitHub: ${outcome.probe.schoolName}` : `Synced: ${outcome.probe.schoolName}`,
      );
      await onConnected(outcome.probe);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void verifyAndSave(urlInput);
  };

  const lastSync = getLastSyncAt();

  return (
    <FloatingWindow
      id="connection-orb"
      title={ar ? 'اتصال الخادم والنفق السحابي' : 'Server & Cloud Link'}
      subtitle={schoolName}
      dock="center"
      width={420}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-orb-dialog-stage">
        <Orb size={86} tone={dialogTone} speed={checking ? 1.4 : 0.6} />
        <span className={`sp-orb-status is-${dialogTone}`}>
          {dialogTone === 'red' ? <WifiOff size={13} /> : <CheckCircle2 size={13} />}
          <span>
            {dialogTone === 'red'
              ? ar ? 'غير متصل بالخادم' : 'Offline'
              : ar ? 'متصل بنجاح' : 'Connected'}
          </span>
        </span>
      </div>

      {error && <p className="sp-alert">{error}</p>}
      {feedback && <p className="sp-success-note">{feedback}</p>}

      <div className="sp-inline-box">
        <div className="sp-note-head">
          <GitBranch size={14} className="is-blue" />
          <strong className="sp-ellipsis">{getRegistryLabel()}</strong>
        </div>
        {lastSync && (
          <small className="sp-small-copy">
            {ar ? 'آخر مزامنة:' : 'Last sync:'} {new Date(lastSync).toLocaleTimeString()}
          </small>
        )}
        <label className="sp-toggle-row">
          <input
            type="checkbox"
            checked={autoDiscover}
            onChange={(e) => {
              setAutoDiscover(e.target.checked);
              setAutoDiscoverEnabled(e.target.checked);
            }}
          />
          <span>{ar ? 'تحديث الرابط تلقائياً عند تشغيل المدرسة' : 'Auto-sync tunnel URL'}</span>
        </label>
        <button type="button" className="sp-btn-soft" disabled={checking} onClick={() => void syncFromGitHub()}>
          <RefreshCw size={14} className={checking ? 'sp-spin' : ''} />
          <span>{ar ? 'مزامنة من GitHub الآن' : 'Sync from GitHub'}</span>
        </button>
      </div>

      <form className="sp-form" onSubmit={handleSubmit}>
        <label className="sp-field">
          <span>{ar ? 'رابط خادم المدرسة (LAN أو سحابي)' : 'School Server URL'}</span>
          <input
            dir="ltr"
            placeholder="http://127.0.0.1:4320"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
        </label>
        <div className="sp-row-2">
          <button type="submit" className="sp-btn-primary" disabled={checking}>
            <Globe size={14} />
            <span>{ar ? 'اتصال وحفظ' : 'Connect'}</span>
          </button>
          <button type="button" className="sp-btn-soft" disabled={checking} onClick={() => void verifyAndSave('', true)}>
            <Server size={14} />
            <span>{ar ? 'الخادم المحلي' : 'Local Server'}</span>
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
}
