import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { CheckCheck, Folder, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import FocusWindow from './FocusWindow';
import { api } from './api';
import './bankOrganization.css';

type BankFolder = { id: string; name: string; color: string };
type Organization = { folders: BankFolder[]; questionFolders: Record<string, string> };
const colors = [
  ['blue', 'أزرق'],
  ['mint', 'أخضر'],
  ['violet', 'بنفسجي'],
  ['amber', 'ذهبي'],
  ['rose', 'وردي'],
];
export const chapterLabel = (name: string) =>
  name.includes('\uFFFD') ? 'اسم فصل يحتاج تصحيحًا' : name;
export function ChapterRename({
  bookId,
  name,
  onChanged,
  notify,
}: {
  bookId: string;
  name: string;
  onChanged: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="bank-chapter-edit"
        aria-label={`تعديل اسم الفصل: ${chapterLabel(name)}`}
        onClick={() => {
          setValue(name.includes('\uFFFD') ? '' : name);
          setOpen(true);
        }}
      >
        <Pencil size={13} />
      </button>
      {open && (
        <FocusWindow title="تعديل اسم الفصل" onClose={() => !busy && setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(`/api/books/${bookId}/chapter`, 'PUT', { previous: name, name: value });
                await onChanged();
                setOpen(false);
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {name.includes('\uFFFD') && (
              <p>تلفت بعض أحرف الاسم في المصدر. اكتب الاسم الصحيح لتحديثه في جميع أسئلة الفصل.</p>
            )}
            <label className="field">
              اسم الفصل
              <input
                autoFocus
                value={value}
                required
                maxLength={2000}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy || !value.trim()}>
              حفظ اسم الفصل
            </button>
          </form>
        </FocusWindow>
      )}
    </>
  );
}
export default function BankQuestionCollection({
  bookId,
  questions,
  allQuestions,
  renderQuestion,
  onChanged,
  notify,
}: {
  bookId: string;
  questions: any[];
  allQuestions: any[];
  renderQuestion: (q: any) => ReactNode;
  onChanged: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [organization, setOrganization] = useState<Organization>({
    folders: [],
    questionFolders: {},
  });
  const [activeFolder, setActiveFolder] = useState('all'),
    [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [dropTarget, setDropTarget] = useState('');
  const [editor, setEditor] = useState<BankFolder | null>(null),
    [name, setName] = useState(''),
    [color, setColor] = useState('blue');
  const [confirm, setConfirm] = useState<'questions' | BankFolder | null>(null),
    [moveOpen, setMoveOpen] = useState(false),
    [destination, setDestination] = useState('');
  const [marquee, setMarquee] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const grid = useRef<HTMLDivElement>(null),
    last = useRef('');
  const gesture = useRef<{
    x: number;
    y: number;
    base: Set<string>;
    add: boolean;
    moved: boolean;
  } | null>(null);
  const load = async () => setOrganization(await api(`/api/books/${bookId}/organization`));
  useEffect(() => {
    let live = true;
    api(`/api/books/${bookId}/organization`)
      .then((s) => live && setOrganization(s))
      .catch((e) => notify(e.message));
    return () => {
      live = false;
    };
  }, [bookId]);
  const visible = questions.filter(
    (q) =>
      activeFolder === 'all' ||
      (activeFolder === 'unfiled'
        ? !organization.questionFolders[q.id]
        : organization.questionFolders[q.id] === activeFolder),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 12)),
    current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * 12, current * 12);
  const filterKey = questions.map((q) => q.id).join(',');
  useEffect(() => setPage(1), [filterKey, activeFolder]);
  useEffect(
    () =>
      setSelected((old) => new Set([...old].filter((id) => allQuestions.some((q) => q.id === id)))),
    [allQuestions],
  );
  const act = async (action: string, ids = [...selected], folderId?: string | null) => {
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const result = await api(`/api/books/${bookId}/questions/bulk`, 'POST', {
        action,
        ids,
        folderId,
      });
      await load();
      await onChanged();
      setSelected(new Set());
      setConfirm(null);
      setMoveOpen(false);
      notify(
        action === 'approve'
          ? `تم اعتماد ${result.count} سؤال`
          : action === 'delete'
            ? `تم حذف ${result.count} سؤال`
            : action === 'move'
              ? `تم نقل ${result.count} سؤال`
              : `أُعيد ${result.count} سؤال للمراجعة`,
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string, shift = false) => {
    setSelected((old) => {
      const next = new Set(old);
      const a = shown.findIndex((q) => q.id === last.current),
        b = shown.findIndex((q) => q.id === id);
      if (shift && a >= 0)
        for (const q of shown.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(q.id);
      else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    last.current = id;
  };
  const start = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button,input,[data-question-id]'))
      return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = {
      x: e.clientX,
      y: e.clientY,
      base: new Set(selected),
      add: e.ctrlKey || e.metaKey || e.shiftKey,
      moved: false,
    };
  };
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 4 && !g.moved) return;
    g.moved = true;
    const rect = {
      left: Math.min(g.x, e.clientX),
      top: Math.min(g.y, e.clientY),
      width: Math.abs(e.clientX - g.x),
      height: Math.abs(e.clientY - g.y),
    };
    setMarquee(rect);
    const next = g.add ? new Set(g.base) : new Set<string>();
    grid.current?.querySelectorAll<HTMLElement>('[data-question-id]').forEach((node) => {
      const r = node.getBoundingClientRect();
      if (
        r.left < rect.left + rect.width &&
        r.right > rect.left &&
        r.top < rect.top + rect.height &&
        r.bottom > rect.top
      )
        next.add(node.dataset.questionId!);
    });
    setSelected(next);
  };
  const finish = () => {
    if (gesture.current && !gesture.current.moved && !gesture.current.add) setSelected(new Set());
    gesture.current = null;
    setMarquee(null);
  };
  const drop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDropTarget('');
    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/x-school-questions'));
      if (payload.bookId === bookId && Array.isArray(payload.ids))
        await act('move', payload.ids, folderId);
    } catch {
      notify('اسحب أسئلة من البنك نفسه إلى المجلد.');
    }
  };
  const dropProps = (id: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes('application/x-school-questions')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(id || 'unfiled');
      }
    },
    onDragLeave: () => setDropTarget(''),
    onDrop: (e: React.DragEvent) => void drop(e, id),
  });
  return (
    <div className="bank-question-collection">
      <div className="bank-folder-heading">
        <h3>مجلدات الأسئلة</h3>
        <button
          onClick={() => {
            setName('');
            setColor('blue');
            setEditor({ id: '', name: '', color: 'blue' });
          }}
        >
          <FolderPlus size={16} />
          مجلد جديد
        </button>
      </div>
      <div className="bank-question-folders">
        <button
          className={`bank-folder-shortcut ${activeFolder === 'all' ? 'is-active' : ''}`}
          onClick={() => {
            setActiveFolder('all');
            setSelected(new Set());
          }}
        >
          كل الأسئلة <b>{allQuestions.length}</b>
        </button>
        <button
          {...dropProps(null)}
          className={`bank-folder-shortcut ${activeFolder === 'unfiled' ? 'is-active' : ''} ${dropTarget === 'unfiled' ? 'is-drop-target' : ''}`}
          onClick={() => {
            setActiveFolder('unfiled');
            setSelected(new Set());
          }}
        >
          غير مصنف <b>{allQuestions.filter((q) => !organization.questionFolders[q.id]).length}</b>
        </button>
        {organization.folders.map((f) => (
          <div
            key={f.id}
            {...dropProps(f.id)}
            className={`bank-question-folder color-${f.color} ${activeFolder === f.id ? 'is-active' : ''} ${dropTarget === f.id ? 'is-drop-target' : ''}`}
          >
            <button
              className="bank-question-folder-open"
              onClick={() => {
                setActiveFolder(f.id);
                setSelected(new Set());
              }}
            >
              <Folder size={29} fill="currentColor" />
              <span>
                {f.name}
                <small>
                  {allQuestions.filter((q) => organization.questionFolders[q.id] === f.id).length}{' '}
                  سؤال
                </small>
              </span>
            </button>
            <button
              aria-label={`إدارة مجلد الأسئلة ${f.name}`}
              className="bank-folder-edit"
              onClick={() => {
                setEditor(f);
                setName(f.name);
                setColor(f.color);
              }}
            >
              <Pencil size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="bank-selection-toolbar" aria-label="إجراءات الأسئلة المحددة">
        {selected.size ? (
          <>
            <strong>{selected.size} محدد</strong>
            <button
              disabled={busy}
              className="bank-approve-selection"
              onClick={() => void act('approve')}
            >
              <CheckCheck size={16} />
              اعتماد المحدد
            </button>
            <button disabled={busy} onClick={() => setMoveOpen(true)}>
              <Folder size={15} />
              نقل
            </button>
            <button disabled={busy} onClick={() => void act('draft')}>
              إعادة للمراجعة
            </button>
            <button disabled={busy} onClick={() => setConfirm('questions')}>
              <Trash2 size={15} />
              حذف
            </button>
            <button aria-label="إلغاء تحديد الأسئلة" onClick={() => setSelected(new Set())}>
              <X size={15} />
            </button>
          </>
        ) : (
          <span>اسحب في المساحة بين البطاقات لتحديد عدة أسئلة</span>
        )}
        <button
          className="bank-select-page"
          onClick={() => setSelected(new Set(shown.map((q) => q.id)))}
          disabled={!shown.length}
        >
          تحديد هذه الصفحة
        </button>
        {visible.length > shown.length && visible.length <= 500 && (
          <button disabled={busy} onClick={() => setSelected(new Set(visible.map((q) => q.id)))}>
            تحديد الكل ({visible.length})
          </button>
        )}
      </div>
      <div
        ref={grid}
        className="bank-grid bank-select-grid"
        tabIndex={0}
        aria-label="بطاقات أسئلة البنك"
        onPointerDown={start}
        onPointerMove={drag}
        onPointerUp={finish}
        onPointerCancel={() => {
          gesture.current = null;
          setMarquee(null);
        }}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).matches('input')) return;
          if (e.key === 'Escape') setSelected(new Set());
          if (e.key === 'Delete' && selected.size && !busy) {
            e.preventDefault();
            setConfirm('questions');
          }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            setSelected(new Set(shown.map((q) => q.id)));
          }
        }}
      >
        {shown.map((q) => (
          <div
            key={q.id}
            data-question-id={q.id}
            className={`bank-select-card ${selected.has(q.id) ? 'is-selected' : ''}`}
            draggable={!busy}
            onDragStart={(e) => {
              const ids = selected.has(q.id) ? [...selected] : [q.id];
              e.dataTransfer.setData(
                'application/x-school-questions',
                JSON.stringify({ bookId, ids }),
              );
              e.dataTransfer.effectAllowed = 'move';
            }}
            onClickCapture={(e) => {
              if (
                (e.ctrlKey || e.metaKey || e.shiftKey) &&
                !(e.target as HTMLElement).closest('input')
              ) {
                e.preventDefault();
                e.stopPropagation();
                toggle(q.id, e.shiftKey);
              }
            }}
          >
            <label className="bank-question-check">
              <input
                type="checkbox"
                aria-label={`تحديد السؤال: ${q.text}`}
                checked={selected.has(q.id)}
                onChange={(e) => toggle(q.id, (e.nativeEvent as MouseEvent).shiftKey)}
              />
            </label>
            {renderQuestion(q)}
          </div>
        ))}
      </div>
      {marquee &&
        createPortal(
          <div className="bank-selection-rectangle" style={marquee} aria-hidden="true" />,
          document.body,
        )}
      {!shown.length && (
        <div className="bank-question-empty">
          <Folder size={30} />
          <p>لا توجد أسئلة في هذا العرض.</p>
        </div>
      )}
      {pages > 1 && (
        <nav className="bank-pagination" aria-label="صفحات أسئلة البنك">
          <button
            aria-label="الصفحة السابقة للأسئلة"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            ←
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            aria-label="الصفحة التالية للأسئلة"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            →
          </button>
        </nav>
      )}
      {editor && (
        <FocusWindow
          title={editor.id ? 'إدارة مجلد الأسئلة' : 'مجلد أسئلة جديد'}
          onClose={() => !busy && setEditor(null)}
        >
          <form
            className="bank-folder-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(
                  `/api/books/${bookId}/folders${editor.id ? `/${editor.id}` : ''}`,
                  editor.id ? 'PUT' : 'POST',
                  { name, color },
                );
                await load();
                setEditor(null);
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              اسم مجلد الأسئلة
              <input
                required
                autoFocus
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>لون المجلد</legend>
              {colors.map(([value, label]) => (
                <label key={value} className={`bank-color-choice color-${value}`}>
                  <input
                    type="radio"
                    name="bank-folder-color"
                    value={value}
                    checked={color === value}
                    onChange={() => setColor(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <div className="button-row">
              <button className="primary" disabled={busy || !name.trim()}>
                حفظ مجلد الأسئلة
              </button>
              {editor.id && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirm(editor);
                    setEditor(null);
                  }}
                >
                  حذف المجلد
                </button>
              )}
            </div>
          </form>
        </FocusWindow>
      )}
      {moveOpen && (
        <FocusWindow title="نقل الأسئلة المحددة" onClose={() => !busy && setMoveOpen(false)}>
          <label className="field">
            المجلد الوجهة
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="">غير مصنف</option>
              {organization.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void act('move', [...selected], destination || null)}
          >
            نقل الأسئلة
          </button>
        </FocusWindow>
      )}
      {confirm && (
        <FocusWindow
          title={confirm === 'questions' ? 'حذف الأسئلة المحددة' : 'حذف مجلد الأسئلة'}
          onClose={() => !busy && setConfirm(null)}
        >
          <p>
            {confirm === 'questions'
              ? `سيُحذف ${selected.size} سؤال من البنك. هل تريد المتابعة؟`
              : 'ستبقى الأسئلة محفوظة وتعود إلى غير مصنف.'}
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (confirm === 'questions') await act('delete');
              else {
                setBusy(true);
                try {
                  await api(`/api/books/${bookId}/folders/${confirm.id}`, 'DELETE');
                  await load();
                  if (activeFolder === confirm.id) setActiveFolder('all');
                  setConfirm(null);
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }
            }}
          >
            تأكيد الحذف
          </button>
        </FocusWindow>
      )}
    </div>
  );
}
