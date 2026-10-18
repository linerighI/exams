import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { api } from './api';
import DeleteRecord from './DeleteRecord';
import { motion, AnimatePresence } from 'motion/react';
export default function RecycleBin({ notify }: { notify: (message: string) => void }) {
  const [rows, setRows] = useState<any[]>([]),
    [catalog, setCatalog] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const refresh = async () => {
    const [trash, records] = await Promise.all([api('/api/trash'), api('/api/records/catalog')]);
    setRows(trash);
    setCatalog(records);
  };
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
      notify('حُدّثت البيانات');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card settings-card">
      <h2>المحذوفات · فرصة للتراجع</h2>
      <p>تُنقل العناصر هنا قبل حذفها نهائيًا. استعدها إذا غيّرت رأيك.</p>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <div className="recycle-list">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              key={row.id}
              className="recycle-item"
            >
              <div>
                <strong>{row.title}</strong>
                <small>
                  {row.records} سجل مرتبط · {new Date(row.at).toLocaleDateString('ar-JO')}
                </small>
              </div>
              <div className="button-row">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void run(() => api(`/api/trash/${row.id}/restore`, 'POST', {}))}
                >
                  <RotateCcw size={16} />
                  استعادة
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('حذف نهائي؟ لن يمكن التراجع دون نسخة احتياطية.'))
                      void run(() => api(`/api/trash/${row.id}`, 'DELETE', { confirm: true }));
                  }}
                >
                  <Trash2 size={16} />
                  حذف نهائي
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {!rows.length && <p className="info-note">المحذوفات فارغة.</p>}
      <details className="settings-advanced">
        <summary>تنظيف مصادر وملفات إضافية</summary>
        <p>يمكن حذف الملفات غير المستخدمة. يمنع التطبيق حذف ملف مرتبط بامتحان محفوظ.</p>
        {catalog.map((row) => (
          <div className="recycle-item" key={row.id}>
            <span>{row.title}</span>
            <DeleteRecord kind={row.kind} id={row.id} title={row.title} onDeleted={refresh} />
          </div>
        ))}
      </details>
    </section>
  );
}
