import { useEffect, useState } from 'react';
import {
  Cloud,
  HardDrive,
  Clock3,
  Download,
  FolderOpen,
  RotateCcw,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from './api';
import { useRef } from 'react';
import { useSceneMotion } from './appMotion';
import './snapshotBackups.css';
export default function SnapshotBackupSettings({
  notify,
  admin,
}: {
  notify: (s: string) => void;
  admin: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useSceneMotion(root, '.snapshot-heading,.snapshot-config,.snapshot-history');
  const [data, setData] = useState<any>(),
    [config, setConfig] = useState<any>({
      enabled: false,
      mode: 'changes',
      time: '16:00',
      folder: '',
    }),
    [phrase, setPhrase] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(''),
    [adminPassword, setAdminPassword] = useState(''),
    [restorePhrase, setRestorePhrase] = useState(''),
    [pending, setPending] = useState(false);
  const load = async () => {
    const value = await api('/api/backups');
    setData(value);
    setConfig(value.config);
  };
  useEffect(() => {
    if (admin) void load().catch((e) => notify(e.message));
  }, [admin]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!admin)
    return (
      <div className="snapshot-panel">
        <ShieldCheck />
        <h2>سجل نسخ المدرسة</h2>
        <p>مدير الحسابات يدير النسخ الكاملة لكل المعلمين. نسخة حسابك متاحة أدناه.</p>
      </div>
    );
  return (
    <div className="snapshot-panel" ref={root}>
      <header className="snapshot-heading">
        <span className="snapshot-symbol">
          <Cloud size={27} />
        </span>
        <div>
          <h2>نسخة على جهازك. ونسخة في مجلد السحابة.</h2>
          <p>لقطات كاملة لبيانات المدرسة وحسابات المعلمين. اختر تاريخًا للعودة إليه.</p>
        </div>
      </header>
      <div className="snapshot-storage">
        <div>
          <HardDrive size={21} />
          <strong>على الجهاز</strong>
          <span>
            {data?.config.lastSuccess
              ? new Date(data.config.lastSuccess).toLocaleString('ar-JO')
              : 'لم تُنشأ نسخة بعد'}
          </span>
        </div>
        <div>
          <Cloud size={21} />
          <strong>مجلد المزامنة</strong>
          <span>
            {data?.config.lastCloudCopy
              ? `آخر نسخ للمجلد: ${new Date(data.config.lastCloudCopy).toLocaleString('ar-JO')}`
              : 'اختر مجلد OneDrive أو Google Drive'}
          </span>
        </div>
      </div>
      <div className="snapshot-config">
        <label className="check">
          <input
            type="checkbox"
            checked={config.enabled}
            disabled={pending}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          نسخ احتياطي تلقائي أثناء تشغيل الجهاز الرئيسي
        </label>
        <div className="snapshot-fields">
          <label className="field">
            متى نحفظ؟
            <select
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value })}
            >
              <option value="changes">بعد التغييرات بخمس دقائق</option>
              <option value="daily">كل يوم في موعد محدد</option>
            </select>
          </label>
          {config.mode === 'daily' && (
            <label className="field">
              موعد النسخ المحلي
              <input
                type="time"
                value={config.time}
                onChange={(e) => setConfig({ ...config, time: e.target.value })}
              />
            </label>
          )}
          <label className="field">
            عبارة حماية النسخ{config.hasPassword ? ' (اتركها فارغة للإبقاء عليها)' : ''}
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="12 حرفًا على الأقل؛ احتفظ بها للاستعادة"
            />
          </label>
        </div>
        <div className="snapshot-folder">
          <span>{config.folder || 'لم يُحدد مجلد المزامنة بعد'}</span>
          <button
            type="button"
            className="secondary"
            disabled={busy || !window.desktop?.chooseBackupFolder}
            onClick={() =>
              void run(async () => {
                const folder = await window.desktop!.chooseBackupFolder();
                if (folder) setConfig({ ...config, folder });
              })
            }
          >
            <FolderOpen size={17} />
            اختيار المجلد
          </button>
        </div>
        <p className="muted">
          اختر مجلدًا خاصًا داخل OneDrive أو Google Drive بعد تسجيل الدخول لبرنامج المزامنة. نؤكد
          كتابة الملف في المجلد؛ حالة رفعه الفعلية تظهر في برنامج المزامنة. تُؤجّل النسخ أثناء
          الامتحانات والمعالجة. إذا كان الجهاز مغلقًا وقت الموعد، نحاول عند فتحه.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="primary"
            disabled={busy || pending}
            onClick={() =>
              void run(async () => {
                await api('/api/backups/config', 'PUT', {
                  enabled: config.enabled,
                  mode: config.mode,
                  time: config.time,
                  folder: config.folder,
                  password: phrase || undefined,
                });
                setPhrase('');
                await load();
                notify('حُفظ إعداد النسخ الاحتياطي');
              })
            }
          >
            حفظ خطة النسخ
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || pending || !data?.config.hasPassword}
            onClick={() =>
              void run(async () => {
                await api('/api/backups/run', 'POST');
                await load();
                notify('حُفظت النسخة المحلية؛ راجع حالة مجلد المزامنة أدناه');
              })
            }
          >
            <Download size={17} />
            نسخة الآن
          </button>
          {data?.config.folder && <button type="button" className="secondary" disabled={busy || pending} onClick={() => void run(async () => { await api('/api/backups/sync', 'POST'); await load(); notify('اكتمل نسخ الملفات المتاحة إلى مجلد المزامنة'); })}><Cloud size={17} />إعادة النسخ للمجلد</button>}
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => void run(load)}
          >
            <RefreshCw size={16} />
            تحديث السجل
          </button>
        </div>
        {data?.config.lastError && (
          <p className="error-note" role="status">
            {data.config.lastError}
          </p>
        )}
      </div>
      <div className="snapshot-history">
        <h3>
          <Clock3 size={18} />
          سجل النسخ المؤرخة
        </h3>
        {!data?.snapshots?.length ? (
          <p>
            ستظهر النسخ هنا بعد حفظ أول لقطة. يمكنك اختيار مجلد مزامنة يحتوي نسخًا قديمة لاستعادتها.
          </p>
        ) : (
          <ul>
            {data.snapshots.map((snapshot: any) => (
              <li key={snapshot.id}>
                <div>
                  <strong>{new Date(snapshot.createdAt).toLocaleString('ar-JO')}</strong>
                  <small>{(snapshot.bytes / 1024 / 1024).toFixed(1)} MB · مشفرة</small>
                </div>
                <span className="snapshot-location">
                  {snapshot.local && (
                    <span>
                      <HardDrive size={14} />
                      الجهاز
                    </span>
                  )}
                  {snapshot.cloud && (
                    <span>
                      <Cloud size={14} />
                      مجلد المزامنة
                    </span>
                  )}
                </span>
                <button
                  className="secondary small"
                  type="button"
                  disabled={busy || pending}
                  onClick={() => {
                    setSelected(snapshot.id);
                    setAdminPassword('');
                    setRestorePhrase('');
                  }}
                >
                  <RotateCcw size={15} />
                  استعادة هذا التاريخ
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && !pending && (
        <form
          className="snapshot-restore"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`/api/backups/${selected}/restore`, 'POST', {
                currentPassword: adminPassword,
                backupPassword: restorePhrase,
              });
              setPending(true);
              setAdminPassword('');
              setRestorePhrase('');
              notify('جُهزت الاستعادة. سيُعاد تشغيل التطبيق لإكمالها');
              if (window.desktop?.restartApp) await window.desktop.restartApp();
            });
          }}
        >
          <h3>العودة إلى النسخة المحددة</h3>
          <p>
            تستبدل بيانات جميع الحسابات بتاريخ هذه النسخة بعد إعادة التشغيل. يحتفظ الجهاز بالملفات
            الحالية في مجلد استرجاع منفصل. أكمل عملك قبل المتابعة.
          </p>
          <div className="snapshot-fields">
            <label className="field">
              كلمة مرور مدير الحسابات
              <input
                type="password"
                autoComplete="current-password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </label>
            <label className="field">
              عبارة حماية هذه النسخة
              <input
                type="password"
                autoComplete="off"
                required
                minLength={12}
                value={restorePhrase}
                onChange={(e) => setRestorePhrase(e.target.value)}
              />
            </label>
          </div>
          <div className="button-row">
            <button className="primary" disabled={busy}>
              استعادة وإعادة تشغيل التطبيق
            </button>
            <button type="button" className="secondary" onClick={() => setSelected('')}>
              إلغاء
            </button>
          </div>
        </form>
      )}
      {pending && (
        <p role="status">
          الاستعادة جاهزة. أعد تشغيل الجهاز الرئيسي لإكمالها؛ أوقفت التعديلات حتى ذلك الحين.
        </p>
      )}
    </div>
  );
}
