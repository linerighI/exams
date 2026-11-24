/**
 * App #1 Frontend: SchoolSync Server Console (`127.0.0.1:4325`).
 * Provides live server & Cloudflare tunnel power controls, automatic GitHub
 * tunnel-URL publishing, QR sharing, Al-Shereqi database injection/backups, and logs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Cloud,
  Copy,
  Database,
  Download,
  ExternalLink,
  GitBranch,
  Globe,
  Languages,
  Loader2,
  Moon,
  Play,
  RefreshCw,
  RotateCw,
  Save,
  Server,
  ShieldCheck,
  Square,
  Sun,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ConsoleLogEntry, ConsoleStatus } from './types';

async function consoleApi<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/console${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ServerConsoleApp() {
  const [status, setStatus] = useState<ConsoleStatus | null>(null);
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [lang, setLang] = useState<'ar' | 'en'>(() =>
    localStorage.getItem('schoolsync-console-lang') === 'en' ? 'en' : 'ar',
  );
  const [dark, setDark] = useState(() => localStorage.getItem('schoolsync-console-dark') === 'true');
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Editable GitHub & server configuration form state
  const [owner, setOwner] = useState('linerighI');
  const [repo, setRepo] = useState('exams');
  const [branch, setBranch] = useState('master');
  const [filePath, setFilePath] = useState('schoolsync/tunnel-url.txt');
  const [tokenInput, setTokenInput] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [localGitFallback, setLocalGitFallback] = useState(true);
  const [autoStartServer, setAutoStartServer] = useState(true);
  const [autoStartTunnel, setAutoStartTunnel] = useState(true);
  const [driftSeconds, setDriftSeconds] = useState(60);
  const [provider, setProvider] = useState<'cloudflared' | 'ngrok'>('cloudflared');
  const [serverPort, setServerPort] = useState(4320);

  const hydratedConfig = useRef(false);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const ar = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    localStorage.setItem('schoolsync-console-lang', lang);
  }, [lang, ar]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('schoolsync-console-dark', String(dark));
  }, [dark]);

  const applyStatus = useCallback((next: ConsoleStatus) => {
    setStatus(next);
    setLogs(next.logs || []);
    if (!hydratedConfig.current) {
      hydratedConfig.current = true;
      setOwner(next.config.githubOwner);
      setRepo(next.config.githubRepo);
      setBranch(next.config.githubBranch);
      setFilePath(next.config.githubFilePath);
      setAutoSync(next.config.autoSyncToGitHub);
      setLocalGitFallback(next.config.useLocalGitFallback);
      setAutoStartServer(next.config.autoStartServer);
      setAutoStartTunnel(next.config.autoStartTunnel);
      setDriftSeconds(next.config.driftCheckSeconds);
      setProvider(next.config.tunnelProvider);
      setServerPort(next.config.serverPort);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await consoleApi<ConsoleStatus>('/status');
      applyStatus(next);
    } catch (err) {
      setNotice({ kind: 'err', text: (err as Error).message });
    }
  }, [applyStatus]);

  useEffect(() => {
    void refreshStatus();
    const es = new EventSource('/api/console/events');
    es.addEventListener('status', (ev) => {
      try {
        applyStatus(JSON.parse((ev as MessageEvent).data) as ConsoleStatus);
      } catch {}
    });
    es.addEventListener('log', (ev) => {
      try {
        const entry = JSON.parse((ev as MessageEvent).data) as ConsoleLogEntry;
        setLogs((prev) => [...prev.slice(-249), entry]);
      } catch {}
    });
    const poll = setInterval(() => {
      void refreshStatus();
    }, 10000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [applyStatus, refreshStatus]);

  const liveCloudUrl = status?.tunnel.url || '';
  useEffect(() => {
    const target = liveCloudUrl || status?.server.localUrl || '';
    if (!target) {
      setQrUrl('');
      return;
    }
    QRCode.toDataURL(target, { width: 220, margin: 1 })
      .then(setQrUrl)
      .catch(() => setQrUrl(''));
  }, [liveCloudUrl, status?.server.localUrl]);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs.length, logFilter]);

  const runAction = async (key: string, fn: () => Promise<string | void>) => {
    setBusyAction(key);
    setNotice(null);
    try {
      const msg = await fn();
      await refreshStatus();
      if (msg) setNotice({ kind: 'ok', text: msg });
    } catch (err) {
      setNotice({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusyAction('');
    }
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 1800);
    } catch {}
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((item) => item.source === logFilter);
  }, [logs, logFilter]);

  const saveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    void runAction('save-config', async () => {
      await consoleApi('/config', {
        githubOwner: owner,
        githubRepo: repo,
        githubBranch: branch,
        githubFilePath: filePath,
        ...(tokenInput.trim() ? { githubToken: tokenInput.trim() } : {}),
        autoSyncToGitHub: autoSync,
        useLocalGitFallback: localGitFallback,
        autoStartServer,
        autoStartTunnel,
        driftCheckSeconds: Number(driftSeconds),
        tunnelProvider: provider,
        serverPort: Number(serverPort),
      });
      setTokenInput('');
      return ar ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved';
    });
  };

  const clearToken = () => {
    void runAction('clear-token', async () => {
      await consoleApi('/config', { clearGithubToken: true });
      return ar ? 'تم مسح رمز GitHub المحفوظ' : 'Saved GitHub token cleared';
    });
  };

  const serverRunning = Boolean(status?.server.running);
  const tunnelRunning = Boolean(status?.tunnel.running);
  const inSync = Boolean(status?.gitSync.inSync);

  return (
    <div className="sc-page">
      <header className="sc-topbar">
        <div className="sc-brand">
          <div className="sc-logo" aria-hidden="true">
            <Server size={22} />
          </div>
          <div>
            <h1>{ar ? 'لوحة تحكم خادم سكول سينك' : 'SchoolSync Server Console'}</h1>
            <p>
              {status?.db.schoolName ||
                (ar ? 'مدرسة محمد الشريقي · إدارة الخادم والنفق والمزامنة' : 'Server, Tunnel & GitHub Registry Manager')}
            </p>
          </div>
        </div>
        <div className="sc-top-actions">
          {status?.server.localUrl ? (
            <button
              type="button"
              className="sc-btn"
              onClick={() => window.open(status.server.localUrl, '_blank', 'noopener')}
            >
              <ExternalLink size={15} />
              {ar ? 'فتح البوابة محلياً' : 'Open Local'}
            </button>
          ) : null}
          {liveCloudUrl ? (
            <button
              type="button"
              className="sc-btn primary"
              onClick={() => window.open(liveCloudUrl, '_blank', 'noopener')}
            >
              <Globe size={15} />
              {ar ? 'فتح البوابة سحابياً' : 'Open Cloud'}
            </button>
          ) : null}
          <button type="button" className="sc-btn" onClick={() => setDark((v) => !v)}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button type="button" className="sc-btn" onClick={() => setLang(ar ? 'en' : 'ar')}>
            <Languages size={15} />
            {ar ? 'EN' : 'عربي'}
          </button>
        </div>
      </header>

      {notice ? (
        <div className={`sc-banner ${notice.kind}`} role="status">
          <span>{notice.text}</span>
          <button type="button" className="sc-btn" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      ) : null}

      <div className="sc-grid-2">
        {/* Power Controls */}
        <section className="sc-card">
          <div className="sc-card-head">
            <h2 className="sc-card-title">
              <Server size={18} />
              {ar ? 'تشغيل الخادم والنفق السحابي' : 'Server & Cloud Tunnel'}
            </h2>
            <span className={`sc-pill ${serverRunning && tunnelRunning ? 'green' : serverRunning ? 'amber' : 'red'}`}>
              {serverRunning && tunnelRunning
                ? ar
                  ? 'يعمل بالكامل'
                  : 'Fully Online'
                : serverRunning
                  ? ar
                    ? 'الخادم يعمل محلياً'
                    : 'Local Only'
                  : ar
                    ? 'متوقف'
                    : 'Stopped'}
            </span>
          </div>

          <div className="sc-power-grid">
            <div className="sc-unit">
              <div className="sc-card-head">
                <strong>{ar ? 'خادم المدرسة (Fastify)' : 'School Server'}</strong>
                <span className={`sc-pill ${serverRunning ? 'green' : 'red'}`}>
                  {serverRunning ? (ar ? 'نشط' : 'Running') : ar ? 'متوقف' : 'Stopped'}
                </span>
              </div>
              <div className="sc-unit-meta">
                {ar
                  ? `المنفذ: ${status?.server.port ?? serverPort} ${status?.server.pid ? `· PID ${status.server.pid}` : ''}`
                  : `Port ${status?.server.port ?? serverPort} ${status?.server.pid ? `· PID ${status.server.pid}` : ''}`}
              </div>
              <div className="sc-row">
                {!serverRunning ? (
                  <button
                    type="button"
                    className="sc-btn success"
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      void runAction('srv-start', async () => {
                        await consoleApi('/server/start', {});
                        return ar ? 'تم تشغيل الخادم' : 'Server started';
                      })
                    }
                  >
                    {busyAction === 'srv-start' ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                    {ar ? 'تشغيل' : 'Start'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sc-btn danger"
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      void runAction('srv-stop', async () => {
                        await consoleApi('/server/stop', {});
                        return ar ? 'تم إيقاف الخادم' : 'Server stopped';
                      })
                    }
                  >
                    <Square size={15} />
                    {ar ? 'إيقاف' : 'Stop'}
                  </button>
                )}
                <button
                  type="button"
                  className="sc-btn"
                  disabled={Boolean(busyAction)}
                  onClick={() =>
                    void runAction('srv-restart', async () => {
                      await consoleApi('/server/restart', {});
                      return ar ? 'تمت إعادة تشغيل الخادم' : 'Server restarted';
                    })
                  }
                >
                  <RotateCw size={15} />
                  {ar ? 'إعادة تشغيل' : 'Restart'}
                </button>
              </div>
            </div>

            <div className="sc-unit">
              <div className="sc-card-head">
                <strong>{ar ? 'النفق السحابي (Cloudflare)' : 'Cloud Tunnel'}</strong>
                <span className={`sc-pill ${tunnelRunning && liveCloudUrl ? 'green' : tunnelRunning ? 'amber' : 'red'}`}>
                  {tunnelRunning && liveCloudUrl
                    ? ar
                      ? 'متصل'
                      : 'Connected'
                    : tunnelRunning
                      ? ar
                        ? 'يتصل…'
                        : 'Connecting…'
                      : ar
                        ? 'متوقف'
                        : 'Stopped'}
                </span>
              </div>
              <div className="sc-unit-meta">
                {status?.tunnel.binaryFound
                  ? `${status.tunnel.provider} ✓`
                  : ar
                    ? `الأداة ${status?.tunnel.provider || 'cloudflared'} غير مثبتة`
                    : `${status?.tunnel.provider || 'cloudflared'} not found`}
              </div>
              <div className="sc-row">
                {!tunnelRunning ? (
                  <button
                    type="button"
                    className="sc-btn primary"
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      void runAction('tun-start', async () => {
                        await consoleApi('/tunnel/start', {});
                        return ar ? 'بدأ تشغيل النفق السحابي' : 'Tunnel starting';
                      })
                    }
                  >
                    <Cloud size={15} />
                    {ar ? 'تشغيل النفق' : 'Start Tunnel'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sc-btn danger"
                    disabled={Boolean(busyAction)}
                    onClick={() =>
                      void runAction('tun-stop', async () => {
                        await consoleApi('/tunnel/stop', {});
                        return ar ? 'تم إيقاف النفق' : 'Tunnel stopped';
                      })
                    }
                  >
                    <Square size={15} />
                    {ar ? 'إيقاف' : 'Stop'}
                  </button>
                )}
                <button
                  type="button"
                  className="sc-btn"
                  disabled={Boolean(busyAction)}
                  onClick={() =>
                    void runAction('tun-restart', async () => {
                      await consoleApi('/tunnel/restart', {});
                      return ar ? 'جارٍ إنشاء رابط نفق جديد ومزامنته…' : 'Rotating tunnel URL…';
                    })
                  }
                >
                  <RefreshCw size={15} className={busyAction === 'tun-restart' ? 'spin' : ''} />
                  {ar ? 'رابط جديد' : 'New URL'}
                </button>
              </div>
            </div>
          </div>

          <p className="sc-hint">
            {ar
              ? 'عند إعادة التشغيل وتوليد رابط Cloudflare جديد، يقوم الخادم بتحديث الملف النصي في GitHub تلقائياً لتصل إليه تطبيقات سطح المكتب والأندرويد بدون أي تدخل.'
              : 'Whenever Cloudflare generates a new URL on restart, this console publishes it to GitHub automatically so Desktop and Android clients reconnect automatically.'}
          </p>
        </section>

        {/* Live URLs, GitHub Sync & QR */}
        <section className="sc-card">
          <div className="sc-card-head">
            <h2 className="sc-card-title">
              <GitBranch size={18} />
              {ar ? 'الروابط المباشرة ومزامنة GitHub' : 'Live Links & GitHub Sync'}
            </h2>
            <span className={`sc-pill ${inSync ? 'green' : status?.gitSync.syncing ? 'amber' : 'red'}`}>
              {status?.gitSync.syncing
                ? ar
                  ? 'جارٍ النشر…'
                  : 'Syncing…'
                : inSync
                  ? ar
                    ? 'متطابق مع GitHub'
                    : 'Synced on GitHub'
                  : ar
                    ? 'بحاجة للمزامنة'
                    : 'Needs Sync'}
            </span>
          </div>

          <div className="sc-qr-wrap">
            {qrUrl ? (
              <img className="sc-qr-img" src={qrUrl} alt={ar ? 'رمز QR للاتصال' : 'Connection QR code'} />
            ) : (
              <div className="sc-qr-img" />
            )}
            <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
              <div className="sc-url-box">
                <span className="sc-url-code">{liveCloudUrl || (ar ? 'بانتظار رابط Cloudflare…' : 'Waiting for tunnel URL…')}</span>
                {liveCloudUrl ? (
                  <button type="button" className="sc-btn" onClick={() => void copyText('cloud', liveCloudUrl)}>
                    {copiedKey === 'cloud' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                ) : null}
              </div>

              <div className="sc-url-box">
                <span className="sc-url-code">
                  {status?.gitSync.remoteUrl || (ar ? 'رابط GitHub الحالي غير مفحوص بعد' : 'GitHub remote URL not checked')}
                </span>
                {status?.gitSync.remoteUrl ? (
                  <button
                    type="button"
                    className="sc-btn"
                    onClick={() => void copyText('remote', status.gitSync.remoteUrl || '')}
                  >
                    {copiedKey === 'remote' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                ) : null}
              </div>

              <div className="sc-row">
                <button
                  type="button"
                  className="sc-btn primary"
                  disabled={!liveCloudUrl || Boolean(busyAction)}
                  onClick={() =>
                    void runAction('git-sync', async () => {
                      const res = await consoleApi<{ ok: boolean; error?: string; method?: string }>('/git/sync', {});
                      if (!res.ok) throw new Error(res.error || 'Sync failed');
                      return ar ? `تم نشر الرابط على GitHub (${res.method})` : `Published to GitHub (${res.method})`;
                    })
                  }
                >
                  <Upload size={15} />
                  {ar ? 'نشر الرابط الآن' : 'Publish Now'}
                </button>
                <button
                  type="button"
                  className="sc-btn"
                  disabled={Boolean(busyAction)}
                  onClick={() =>
                    void runAction('git-check', async () => {
                      const res = await consoleApi<{ ok: boolean; url?: string; error?: string }>('/git/check', {});
                      if (!res.ok) throw new Error(res.error || 'Check failed');
                      return res.url
                        ? ar
                          ? `الرابط في GitHub: ${res.url}`
                          : `GitHub URL: ${res.url}`
                        : ar
                          ? 'لم يُكتب رابط في GitHub بعد'
                          : 'No URL published on GitHub yet';
                    })
                  }
                >
                  <RefreshCw size={15} />
                  {ar ? 'فحص GitHub' : 'Check GitHub'}
                </button>
              </div>
            </div>
          </div>

          {status?.server.lanUrls.length ? (
            <div className="sc-row">
              {status.server.lanUrls.map((lan) => (
                <button key={lan} type="button" className="sc-btn" onClick={() => void copyText(lan, lan)}>
                  {copiedKey === lan ? <Check size={13} /> : <Copy size={13} />}
                  <span dir="ltr">{lan}</span>
                </button>
              ))}
            </div>
          ) : null}

          {status?.gitSync.error ? (
            <div className="sc-banner err">{status.gitSync.error}</div>
          ) : null}
        </section>

        {/* GitHub & Console Settings */}
        <section className="sc-card">
          <div className="sc-card-head">
            <h2 className="sc-card-title">
              <ShieldCheck size={18} />
              {ar ? 'إعدادات مستودع GitHub والمزامنة' : 'GitHub Repository & Sync Settings'}
            </h2>
            <span className={`sc-pill ${status?.config.hasGithubToken ? 'green' : 'amber'}`}>
              {status?.config.hasGithubToken
                ? `${ar ? 'رمز PAT محفوظ' : 'PAT set'} (${status.config.githubTokenPreview})`
                : ar
                  ? 'بدون رمز PAT'
                  : 'No PAT saved'}
            </span>
          </div>

          <form className="sc-form-grid" onSubmit={saveConfig}>
            <div className="sc-field">
              <label>{ar ? 'صاحب المستودع (Owner)' : 'GitHub Owner'}</label>
              <input dir="ltr" value={owner} onChange={(e) => setOwner(e.target.value)} required />
            </div>
            <div className="sc-field">
              <label>{ar ? 'اسم المستودع (Repo)' : 'Repository'}</label>
              <input dir="ltr" value={repo} onChange={(e) => setRepo(e.target.value)} required />
            </div>
            <div className="sc-field">
              <label>{ar ? 'الفرع (Branch)' : 'Branch'}</label>
              <input dir="ltr" value={branch} onChange={(e) => setBranch(e.target.value)} required />
            </div>
            <div className="sc-field">
              <label>{ar ? 'مسار الملف النصي' : 'Plain-text File Path'}</label>
              <input dir="ltr" value={filePath} onChange={(e) => setFilePath(e.target.value)} required />
            </div>
            <div className="sc-field full">
              <label>
                {ar
                  ? 'رمز GitHub Personal Access Token (يسمح بالتحديث الفوري عبر API بدون git push)'
                  : 'GitHub Personal Access Token (PAT with repo Contents write scope)'}
              </label>
              <div className="sc-row" style={{ flexWrap: 'nowrap' }}>
                <input
                  dir="ltr"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder={status?.config.hasGithubToken ? '•••••••• (اتركه فارغاً للإبقاء على الرمز الحالي)' : 'github_pat_... / ghp_...'}
                />
                {status?.config.hasGithubToken ? (
                  <button type="button" className="sc-btn danger" onClick={clearToken}>
                    {ar ? 'مسح' : 'Clear'}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="sc-field">
              <label>{ar ? 'منفذ الخادم' : 'Server Port'}</label>
              <input
                dir="ltr"
                type="number"
                min={1024}
                max={65535}
                value={serverPort}
                onChange={(e) => setServerPort(Number(e.target.value))}
              />
            </div>
            <div className="sc-field">
              <label>{ar ? 'فحص التطابق (ثانية)' : 'Drift Check (sec)'}</label>
              <input
                dir="ltr"
                type="number"
                min={10}
                max={3600}
                value={driftSeconds}
                onChange={(e) => setDriftSeconds(Number(e.target.value))}
              />
            </div>
            <div className="sc-field">
              <label>{ar ? 'مزود النفق' : 'Tunnel Provider'}</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as 'cloudflared' | 'ngrok')}>
                <option value="cloudflared">Cloudflare Quick Tunnel (cloudflared)</option>
                <option value="ngrok">ngrok</option>
              </select>
            </div>

            <div className="sc-field full">
              <div className="sc-toggles">
                <label className="sc-toggle">
                  <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
                  <span>{ar ? 'نشر تلقائي إلى GitHub' : 'Auto-publish to GitHub'}</span>
                </label>
                <label className="sc-toggle">
                  <input
                    type="checkbox"
                    checked={localGitFallback}
                    onChange={(e) => setLocalGitFallback(e.target.checked)}
                  />
                  <span>{ar ? 'استخدام git push كبديل' : 'Local git push fallback'}</span>
                </label>
                <label className="sc-toggle">
                  <input
                    type="checkbox"
                    checked={autoStartServer}
                    onChange={(e) => setAutoStartServer(e.target.checked)}
                  />
                  <span>{ar ? 'تشغيل الخادم تلقائياً' : 'Auto-start server'}</span>
                </label>
                <label className="sc-toggle">
                  <input
                    type="checkbox"
                    checked={autoStartTunnel}
                    onChange={(e) => setAutoStartTunnel(e.target.checked)}
                  />
                  <span>{ar ? 'تشغيل النفق تلقائياً' : 'Auto-start tunnel'}</span>
                </label>
              </div>
            </div>

            <div className="sc-field full">
              <button type="submit" className="sc-btn primary" disabled={Boolean(busyAction)}>
                <Save size={15} />
                {ar ? 'حفظ الإعدادات' : 'Save Settings'}
              </button>
            </div>
          </form>
        </section>

        {/* Database & Al-Shereqi Tools */}
        <section className="sc-card">
          <div className="sc-card-head">
            <h2 className="sc-card-title">
              <Database size={18} />
              {ar ? 'قاعدة بيانات المدرسة والنسخ الاحتياطي' : 'School Database & Backups'}
            </h2>
            <span className="sc-pill">
              {status?.db.exists ? formatBytes(status.db.sizeBytes) : ar ? 'غير مهيأة' : 'Not created'}
            </span>
          </div>

          <div className="sc-stats">
            <div className="sc-stat">
              <strong>{status?.db.counts.students ?? 0}</strong>
              <span>{ar ? 'الطلاب' : 'Students'}</span>
            </div>
            <div className="sc-stat">
              <strong>{status?.db.counts.teachers ?? 0}</strong>
              <span>{ar ? 'المعلمون' : 'Teachers'}</span>
            </div>
            <div className="sc-stat">
              <strong>{status?.db.counts.classes ?? 0}</strong>
              <span>{ar ? 'الصفوف والشعب' : 'Classes'}</span>
            </div>
            <div className="sc-stat">
              <strong>{status?.db.counts.sessions ?? 0}</strong>
              <span>{ar ? 'جلسات نشطة' : 'Active Sessions'}</span>
            </div>
          </div>

          <div className="sc-row">
            <button
              type="button"
              className="sc-btn primary"
              disabled={Boolean(busyAction)}
              onClick={() =>
                void runAction('db-merge', async () => {
                  await consoleApi('/db/inject', { mode: 'merge' });
                  return ar ? 'تم حقن ودمج بيانات مدرسة محمد الشريقي بنجاح' : 'Al-Shereqi database merged';
                })
              }
            >
              <Database size={15} />
              {ar ? 'حقن بيانات الشريقي (دمج)' : 'Inject Al-Shereqi (Merge)'}
            </button>

            {!confirmReplace ? (
              <button
                type="button"
                className="sc-btn warn"
                disabled={Boolean(busyAction)}
                onClick={() => setConfirmReplace(true)}
              >
                {ar ? 'استبدال كامل للبيانات' : 'Replace Database'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="sc-btn danger"
                  disabled={Boolean(busyAction)}
                  onClick={() => {
                    setConfirmReplace(false);
                    void runAction('db-replace', async () => {
                      await consoleApi('/db/inject', { mode: 'replace' });
                      return ar ? 'تم استبدال قاعدة البيانات بالكامل' : 'Database replaced';
                    });
                  }}
                >
                  {ar ? 'تأكيد الاستبدال' : 'Confirm Replace'}
                </button>
                <button type="button" className="sc-btn" onClick={() => setConfirmReplace(false)}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
              </>
            )}

            <button
              type="button"
              className="sc-btn"
              disabled={Boolean(busyAction)}
              onClick={() =>
                void runAction('db-backup', async () => {
                  const res = await consoleApi<{ sqliteFile: string }>('/db/backup', {});
                  return ar ? `تم حفظ نسخة احتياطية: ${res.sqliteFile}` : `Backup saved: ${res.sqliteFile}`;
                })
              }
            >
              <Save size={15} />
              {ar ? 'نسخة احتياطية الآن' : 'Backup Now'}
            </button>

            <button
              type="button"
              className="sc-btn"
              onClick={() => window.open('/api/console/db/export', '_blank', 'noopener')}
            >
              <Download size={15} />
              {ar ? 'تصدير JSON' : 'Export JSON'}
            </button>
          </div>

          <p className="sc-hint">
            {ar
              ? 'حساب المدير الافتراضي بعد الحقن: admin@alshereqi.edu.jo · كلمة المرور: Alshereqi!2026'
              : 'Default principal account after inject: admin@alshereqi.edu.jo · Password: Alshereqi!2026'}
          </p>

          {status?.db.backups.length ? (
            <div className="sc-row">
              {status.db.backups.slice(0, 4).map((b) => (
                <span key={b.name} className="sc-pill">
                  {b.name} ({formatBytes(b.sizeBytes)})
                </span>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {/* Live Logs */}
      <section className="sc-card">
        <div className="sc-card-head">
          <h2 className="sc-card-title">
            <Terminal size={18} />
            {ar ? 'السجل المباشر للخادم والنفق' : 'Live Server & Tunnel Logs'}
          </h2>
          <div className="sc-row">
            {[
              ['all', ar ? 'الكل' : 'All'],
              ['server', ar ? 'الخادم' : 'Server'],
              ['tunnel', ar ? 'النفق' : 'Tunnel'],
              ['git', 'GitHub'],
              ['db', ar ? 'البيانات' : 'DB'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`sc-btn ${logFilter === key ? 'primary' : ''}`}
                onClick={() => setLogFilter(key)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="sc-btn"
              onClick={() =>
                void copyText(
                  'logs',
                  filteredLogs.map((l) => `[${l.ts}] [${l.source}] ${l.message}`).join('\n'),
                )
              }
            >
              {copiedKey === 'logs' ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              type="button"
              className="sc-btn danger"
              onClick={() =>
                void runAction('clear-logs', async () => {
                  await consoleApi('/logs/clear', {});
                })
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="sc-logs" ref={logBoxRef}>
          {filteredLogs.length === 0 ? (
            <div className="sc-log-line">
              <span className="sc-log-msg">No log entries yet…</span>
            </div>
          ) : (
            filteredLogs.map((entry, idx) => (
              <div key={`${entry.ts}-${idx}`} className={`sc-log-line ${entry.level}`}>
                <span style={{ opacity: 0.55 }}>{entry.ts.slice(11, 19)}</span>
                <span className="sc-log-src">[{entry.source}]</span>
                <span className="sc-log-msg">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
