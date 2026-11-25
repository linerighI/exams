/**
 * Library & Data Vault floating window: export live JSON school snapshots, download
 * import templates, and inject/restore JSON school datasets.
 */
import { useState, type ChangeEvent } from 'react';
import { Database, Download, FileJson, Upload } from 'lucide-react';
import { api, authHeaders, apiUrl, usesRemoteBearerAuth } from '../api';
import type { Language } from '../i18n';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { FloatingWindow } from './FloatingWindow';

interface LibraryVaultWindowProps {
  room: ResolvedSpatialRoom;
  lang: Language;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

/** Database backup, JSON snapshot export, and restore floating window. */
export function LibraryVaultWindow({
  room,
  lang,
  zIndex,
  onFocus,
  onClose,
  onRefresh,
}: LibraryVaultWindowProps) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const downloadJson = async (endpoint: string, filename: string) => {
    setBusy(true);
    setStatus('');
    try {
      const useBearer = usesRemoteBearerAuth();
      const res = await fetch(apiUrl(endpoint), {
        credentials: useBearer ? 'omit' : 'same-origin',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(lang === 'ar' ? `تم تنزيل ${filename}` : `Downloaded ${filename}`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus('');
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      await api('/admin/database/import', { ...parsed, mode: 'merge' });
      await onRefresh();
      setStatus(lang === 'ar' ? 'تم استيراد ودمج البيانات بنجاح' : 'Database imported successfully');
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={lang === 'ar' ? 'النسخ الاحتياطي وتصدير واستيراد قاعدة البيانات' : 'School Database Backup & Import'}
      dock="right"
      width={420}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-tab-pane">
        <div className="sp-inline-box">
          <div className="sp-note-head">
            <Database size={16} className="is-blue" />
            <strong>{lang === 'ar' ? 'لقطة قاعدة بيانات المدرسة (JSON)' : 'JSON School Snapshot'}</strong>
          </div>
          <p className="sp-small-copy">
            {lang === 'ar'
              ? 'احفظ نسخة احتياطية كاملة تضم الطلبة، المعلمين، الشعب، والجداول أو استورد ملفاً جديداً.'
              : 'Export a complete backup or merge a structured school database JSON.'}
          </p>
          <div className="sp-row-2">
            <button
              type="button"
              className="sp-btn-primary"
              disabled={busy}
              onClick={() => void downloadJson('/admin/database/export', 'schoolsync-backup.json')}
            >
              <Download size={14} />
              <span>{lang === 'ar' ? 'تصدير نسخة' : 'Export Backup'}</span>
            </button>
            <button
              type="button"
              className="sp-btn-soft"
              disabled={busy}
              onClick={() => void downloadJson('/admin/database/template', 'schoolsync-template.json')}
            >
              <FileJson size={14} />
              <span>{lang === 'ar' ? 'تنزيل قالب' : 'Template'}</span>
            </button>
          </div>
        </div>

        <label className="sp-upload-drop">
          <Upload size={18} />
          <span>{lang === 'ar' ? 'استيراد ودمج ملف JSON للبيانات…' : 'Import & Merge JSON snapshot…'}</span>
          <input type="file" accept=".json,application/json" hidden onChange={(e) => void handleImport(e)} />
        </label>

        {status && <p className="sp-status-note">{status}</p>}
      </div>
    </FloatingWindow>
  );
}
