import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import FocusWindow from './FocusWindow';
import { api } from './api';
import './personalization.css';
export default function DeleteRecord({
  kind,
  id,
  title,
  onDeleted,
  label = 'حذف',
}: {
  kind: 'students' | 'exams' | 'books' | 'sources' | 'assets';
  id: string;
  title: string;
  onDeleted: () => void | Promise<void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button
        type="button"
        className="text-button danger small"
        aria-label={`${label} ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 size={16} />
        {label}
      </button>
      {open && (
        <FocusWindow
          title="نقل إلى المحذوفات"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <div className="delete-record-confirm">
            <h3>{title}</h3>
            <p>
              سيختفي هذا العنصر من القوائم، وتُنقل سجلاته المرتبطة إلى المحذوفات. يمكنك استعادته من
              الإعدادات ← المحذوفات.
            </p>
            {kind === 'books' && (
              <p>
                تبقى نسخ الأسئلة الموجودة داخل الامتحانات محفوظة. لن يؤثر حذف البنك في نص تلك
                الأسئلة.
              </p>
            )}
            {kind === 'students' && (
              <p>
                يشمل ذلك محاولات الطالب وصوره وبيانات دخوله المحمية. يجب تسجيل خروجه وإنهاء محاولاته
                أولًا.
              </p>
            )}
            {error && (
              <p role="alert" className="error-note">
                {error}
              </p>
            )}
            <div className="button-row">
              <button className="secondary" disabled={busy} onClick={() => setOpen(false)}>
                إبقاء العنصر
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await api(`/api/records/${kind}/${encodeURIComponent(id)}`, 'DELETE', {
                        confirm: true,
                      });
                      setOpen(false);
                      await onDeleted();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                {busy ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}نقل إلى
                المحذوفات
              </button>
            </div>
          </div>
        </FocusWindow>
      )}
    </>
  );
}
