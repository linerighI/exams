/**
 * Native-only Server URL selector shown on the entry screen inside Capacitor Android.
 * Lets staff/parents switch between USB (`http://127.0.0.1:4320`), Wi-Fi LAN IP,
 * or public HTTPS school domain without rebuilding the APK.
 */
import { useState } from 'react';
import { Server } from 'lucide-react';
import { getServerBase, isCapacitorNative, setServerBase } from '../api';
import type { Language } from '../i18n';

export function ServerUrlBar({
  lang,
  onSaved,
}: {
  lang: Language;
  onSaved: () => Promise<void>;
}) {
  const native = isCapacitorNative();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => getServerBase());
  if (!native) return null;
  const ar = lang === 'ar';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerBase(value);
    setOpen(false);
    await onSaved();
  };

  return (
    <div style={{ padding: '0 20px 24px', maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
      <button
        type="button"
        className="text-button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
      >
        <Server size={14} />
        {ar ? `خادم المدرسة: ${getServerBase()}` : `Server: ${getServerBase()}`}
      </button>
      {open ? (
        <form onSubmit={(e) => void save(e)} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <input
            dir="ltr"
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="http://127.0.0.1:4320"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {ar ? 'حفظ' : 'Save'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
