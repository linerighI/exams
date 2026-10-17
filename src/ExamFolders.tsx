import { useEffect, useRef, useState } from 'react';
import { Folder, FolderPlus, Pencil, Trash2, LayoutGrid, MoreHorizontal } from 'lucide-react';
import { api } from './api';
import FocusWindow from './FocusWindow';
import type { Exam } from './types';
import './examFolders.css';
import './bookLibrary.css';
export type ExamFolder = { id: string; name: string; color: string; createdAt: number };
export type ExamOrganization = { folders: ExamFolder[]; examFolders: Record<string, string> };
const colors = [
  ['blue', 'أزرق'],
  ['mint', 'أخضر'],
  ['violet', 'بنفسجي'],
  ['amber', 'ذهبي'],
  ['rose', 'وردي'],
];
function FolderArt() {
  return (
    <span className="library-folder-art" aria-hidden="true">
      <i />
      <b />
    </span>
  );
}
export default function ExamFolders({
  exams,
  organization,
  onOrganization,
  folder,
  onFolder,
  moving,
  onMoving,
  notify,
}: {
  exams: Exam[];
  organization: ExamOrganization;
  onOrganization: (value: ExamOrganization) => void;
  folder: string;
  onFolder: (id: string) => void;
  moving: string[];
  onMoving: (ids: string[]) => void;
  notify: (text: string) => void;
}) {
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [editing, setEditing] = useState<ExamFolder | 'new' | null>(null),
    [name, setName] = useState(''),
    [color, setColor] = useState('blue'),
    [deleting, setDeleting] = useState<ExamFolder | null>(null),
    [destination, setDestination] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let live = true;
    void api('/api/exam-folders')
      .then((v) => {
        if (live) {
          onOrganization(v);
          onFolder(
            v.folders.some((f: ExamFolder) => f.id === folder) ||
              ['all', 'unfiled'].includes(folder)
              ? folder
              : 'all',
          );
          setReady(true);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
      mounted.current = false;
    };
  }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (!mounted.current) return;
      const value = await api('/api/exam-folders');
      if (mounted.current) onOrganization(value);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const edit = (value: ExamFolder | 'new') => {
    setEditing(value);
    setName(value === 'new' ? '' : value.name);
    setColor(value === 'new' ? 'blue' : value.color);
    setError('');
  };
  const move = (ids: string[], target: string | null) =>
    run(async () => {
      await api('/api/exams/move', 'PUT', { examIds: ids, folderId: target });
      if (!mounted.current) return;
      onMoving([]);
      notify('تم نقل الامتحان');
    });
  const drop = (e: React.DragEvent, target: string | null) => {
    e.preventDefault();
    if (!ready || busy) return;
    const examId = e.dataTransfer.getData('application/x-school-exam');
    if (exams.some((exam) => exam.id === examId)) void move([examId], target);
  };
  return (
    <section className="exam-folder-section" aria-label="مجلدات الامتحانات">
      <div className="exam-folder-heading">
        <nav>
          <button
            className={folder === 'all' ? 'active' : ''}
            onClick={() => onFolder('all')}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e, null)}
          >
            <LayoutGrid size={15} />
            كل الامتحانات <span>{exams.length}</span>
          </button>
        </nav>
        <button className="secondary small" disabled={!ready || busy} onClick={() => edit('new')}>
          <FolderPlus size={16} />
          مجلد جديد
        </button>
      </div>
      <div className="exam-folder-grid">
        <article
          className={`exam-folder-tile tone-blue ${folder === 'unfiled' ? 'is-active' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => drop(e, null)}
        >
          <button
            className="exam-folder-open"
            aria-label="غير مصنف"
            aria-pressed={folder === 'unfiled'}
            onClick={() => onFolder('unfiled')}
          >
            <FolderArt />
            <span>
              <strong>غير مصنف</strong>
              <small>{exams.filter((e) => !organization.examFolders[e.id]).length} امتحانات</small>
            </span>
          </button>
        </article>
        {organization.folders.map((f) => (
          <article
            key={f.id}
            className={`exam-folder-tile tone-${f.color} ${folder === f.id ? 'is-active' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(e, f.id)}
          >
            <button
              className="exam-folder-open"
              title={f.name}
              aria-label={`فتح مجلد الامتحانات: ${f.name}`}
              aria-pressed={folder === f.id}
              onClick={() => onFolder(f.id)}
            >
              <FolderArt />
              <span>
                <strong>{f.name}</strong>
                <small>
                  {exams.filter((e) => organization.examFolders[e.id] === f.id).length} امتحانات
                </small>
              </span>
            </button>
            <details className="exam-folder-menu">
              <summary aria-label={`إدارة المجلد ${f.name}`}>
                <MoreHorizontal size={19} />
              </summary>
              <div>
                <button
                  aria-label={`تعديل مجلد ${f.name}`}
                  disabled={busy}
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    edit(f);
                  }}
                >
                  <Pencil size={13} />
                  تعديل الاسم واللون
                </button>
                <button
                  aria-label={`حذف مجلد ${f.name}`}
                  disabled={busy}
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    setDeleting(f);
                    setError('');
                  }}
                >
                  <Trash2 size={13} />
                  حذف المجلد
                </button>
              </div>
            </details>
          </article>
        ))}
      </div>
      {error && !editing && !deleting && !moving.length && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {editing && (
        <FocusWindow
          title={editing === 'new' ? 'مجلد امتحانات جديد' : 'تعديل المجلد'}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(
                  editing === 'new' ? '/api/exam-folders' : `/api/exam-folders/${editing.id}`,
                  editing === 'new' ? 'POST' : 'PUT',
                  { name, color },
                );
                setEditing(null);
              });
            }}
          >
            <label className="field">
              اسم المجلد
              <input
                aria-label="اسم مجلد الامتحانات"
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder="مثال: رياضيات العاشر"
              />
            </label>
            <div className="exam-folder-colors" aria-label="لون المجلد">
              {colors.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`tone-${id}`}
                  aria-label={label}
                  aria-pressed={color === id}
                  onClick={() => setColor(id)}
                  disabled={busy}
                >
                  <Folder size={25} />
                </button>
              ))}
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy || !name.trim()}>
              حفظ المجلد
            </button>
          </form>
        </FocusWindow>
      )}
      {deleting && (
        <FocusWindow
          title="حذف المجلد"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>حذف «{deleting.name}»؟ ستبقى امتحاناته في «غير مصنف».</p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(`/api/exam-folders/${deleting.id}`, 'DELETE');
                  if (folder === deleting.id) onFolder('unfiled');
                  setDeleting(null);
                })
              }
            >
              حذف المجلد فقط
            </button>
            <button className="secondary" onClick={() => setDeleting(null)} disabled={busy}>
              إلغاء
            </button>
          </div>
        </FocusWindow>
      )}
      {moving.length > 0 && (
        <FocusWindow
          title="نقل الامتحان إلى مجلد"
          onClose={() => {
            if (!busy) onMoving([]);
          }}
        >
          <label className="field">
            اختر المجلد
            <select
              aria-label="مجلد الامتحان الوجهة"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            >
              <option value="">غير مصنف</option>
              {organization.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={!ready || busy}
            onClick={() => void move(moving, destination || null)}
          >
            نقل الامتحان
          </button>
        </FocusWindow>
      )}
    </section>
  );
}
