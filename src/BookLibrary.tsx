import { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  FolderPlus,
  LayoutGrid,
  List,
  MoreHorizontal,
  MoveRight,
  Plus,
  Search,
  UploadCloud,
} from 'lucide-react';
import { api } from './api';
import FocusWindow from './FocusWindow';
import './bookLibrary.css';

export type LibraryFolder = { id: string; name: string; color: string; createdAt: number };
type Organization = { folders: LibraryFolder[]; bookFolders: Record<string, string> };
const colors = [
  ['blue', 'أزرق'],
  ['mint', 'أخضر'],
  ['violet', 'بنفسجي'],
  ['amber', 'ذهبي'],
  ['rose', 'وردي'],
];
const palette = ['blue', 'mint', 'violet', 'amber', 'rose'];
function FolderArt() {
  return (
    <span className="library-folder-art" aria-hidden="true">
      <i />
      <b />
    </span>
  );
}

export default function BookLibrary({
  books,
  hidden,
  openBook,
  importBank,
  uploadBook,
  notify,
}: {
  books: any[];
  hidden: boolean;
  openBook: (book: any) => void;
  importBank: (folderId: string | null) => void;
  uploadBook: (folderId: string | null) => void;
  notify: (message: string) => void;
}) {
  const [organization, setOrganization] = useState<Organization>({ folders: [], bookFolders: {} });
  const [loaded, setLoaded] = useState(false),
    [failure, setFailure] = useState('');
  const [folder, setFolder] = useState('all'),
    [search, setSearch] = useState(''),
    [view, setView] = useState('grid'),
    [sort, setSort] = useState('recent');
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<LibraryFolder | 'new' | null>(null),
    [name, setName] = useState(''),
    [color, setColor] = useState('blue');
  const [deleting, setDeleting] = useState<LibraryFolder | null>(null),
    [moving, setMoving] = useState<string[]>([]),
    [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const refresh = async () => {
    try {
      setOrganization(await api('/api/library/folders'));
      setLoaded(true);
      setFailure('');
    } catch (error) {
      setFailure((error as Error).message);
    }
  };
  const bookIds = books.map((book) => book.id).join(',');
  useEffect(() => {
    if (!hidden) void refresh();
  }, [bookIds, hidden]);
  const current = organization.folders.find((item) => item.id === folder);
  const folderFor = (bookId: string) => organization.bookFolders[bookId] || '';
  const target = current?.id || null;
  const visible = books
    .filter(
      (book) =>
        (folder === 'all' ||
          (folder === 'unfiled' ? !folderFor(book.id) : folderFor(book.id) === folder)) &&
        `${book.title} ${book.subject} ${book.grade}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title, 'ar', { numeric: true })
        : sort === 'questions'
          ? b.questions - a.questions
          : (b.createdAt || 0) - (a.createdAt || 0),
    );
  const choose = (key: string) => {
    setFolder(key);
    setSearch('');
    setSelected([]);
  };
  const edit = (item: LibraryFolder | 'new') => {
    setEditing(item);
    setName(item === 'new' ? '' : item.name);
    setColor(item === 'new' ? palette[organization.folders.length % palette.length] : item.color);
    setError('');
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const move = (ids: string[]) => {
    setMoving(ids);
    setDestination(ids.length === 1 ? folderFor(ids[0]) : current?.id || '');
    setError('');
  };
  return (
    <section className="bank-library" hidden={hidden} aria-label="مكتبة بنك الأسئلة">
      <div className="library-action-bar">
        <button className="library-action-create" onClick={() => importBank(target)}>
          <Plus size={22} />
          <strong>إضافة بنك أسئلة</strong>
          <span>استيراد أو إعداد طلب</span>
        </button>
        <button onClick={() => uploadBook(target)}>
          <UploadCloud size={22} />
          <strong>رفع كتاب PDF</strong>
          <span>إضافة الكتاب الأصلي</span>
        </button>
        <button disabled={!loaded} onClick={() => edit('new')}>
          <FolderPlus size={22} />
          <strong>مجلد جديد</strong>
          <span>تنظيم المباحث والصفوف</span>
        </button>
      </div>
      {failure && (
        <div className="library-load-error" role="alert">
          تعذّر تحميل المجلدات: {failure}
          <button className="text-button" onClick={() => void refresh()}>
            إعادة المحاولة
          </button>
        </div>
      )}
      <div className="library-section-heading">
        <h2>المجلدات</h2>
        <button className="text-button" disabled={!loaded} onClick={() => edit('new')}>
          <Plus size={15} />
          مجلد جديد
        </button>
      </div>
      <div className="library-folder-grid">
        <article className="library-folder-card tone-blue">
          <button
            className="library-folder-open"
            aria-pressed={folder === 'unfiled'}
            onClick={() => choose('unfiled')}
          >
            <FolderArt />
            <strong>غير مصنف</strong>
            <small>{books.filter((book) => !folderFor(book.id)).length} كتاب</small>
          </button>
        </article>
        {organization.folders.map((item) => (
          <article key={item.id} className={`library-folder-card tone-${item.color}`}>
            <button
              className="library-folder-open"
              aria-pressed={folder === item.id}
              onClick={() => choose(item.id)}
            >
              <FolderArt />
              <strong>{item.name}</strong>
              <small>{books.filter((book) => folderFor(book.id) === item.id).length} كتاب</small>
            </button>
            <details className="library-card-menu">
              <summary aria-label={`إدارة المجلد ${item.name}`}>
                <MoreHorizontal size={18} />
              </summary>
              <div>
                <button
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    edit(item);
                  }}
                >
                  تعديل الاسم واللون
                </button>
                <button
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    setError('');
                    setDeleting(item);
                  }}
                >
                  حذف المجلد
                </button>
              </div>
            </details>
          </article>
        ))}
        {!organization.folders.length && (
          <button className="library-folder-new" disabled={!loaded} onClick={() => edit('new')}>
            <FolderPlus size={31} />
            <strong>مجلد لمبحث أو صف</strong>
            <span>ابدأ تنظيم مكتبتك</span>
          </button>
        )}
      </div>
      <div className="library-files-toolbar">
        <nav aria-label="مسار المكتبة">
          <button
            aria-current={folder === 'all' ? 'page' : undefined}
            onClick={() => choose('all')}
          >
            كل الكتب
          </button>
          {folder !== 'all' && (
            <>
              <span>/</span>
              <strong>{current?.name || 'غير مصنف'}</strong>
            </>
          )}
          <small>{visible.length} كتاب</small>
        </nav>
        <div className="library-file-controls">
          <label className="library-file-search">
            <Search size={16} />
            <input
              aria-label="البحث في الكتب"
              placeholder="ابحث في المكتبة…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            aria-label="ترتيب الكتب"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="recent">الأحدث أولًا</option>
            <option value="name">حسب الاسم</option>
            <option value="questions">عدد الأسئلة</option>
          </select>
          <div className="library-view-switch" aria-label="طريقة عرض الكتب">
            <button
              aria-label="عرض شبكي"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              aria-label="عرض قائمة"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="library-selection">
          <span>{selected.length} كتب محددة</span>
          <button disabled={!loaded || busy} onClick={() => move(selected)}>
            <MoveRight size={16} />
            نقل إلى مجلد
          </button>
          <button onClick={() => setSelected([])}>إلغاء التحديد</button>
        </div>
      )}
      {visible.length ? (
        <div className={`library-book-grid ${view === 'list' ? 'is-list' : ''}`}>
          {visible.map((book) => {
            const parent = organization.folders.find((item) => item.id === folderFor(book.id));
            const tone =
              parent?.color ||
              palette[
                [...String(book.subject || book.title)].reduce(
                  (sum, char) => sum + char.charCodeAt(0),
                  0,
                ) % palette.length
              ];
            return (
              <article
                key={book.id}
                className={`library-book-card tone-${tone} ${selected.includes(book.id) ? 'is-selected' : ''}`}
              >
                <label className="library-book-select">
                  <input
                    type="checkbox"
                    aria-label={`اختيار ${book.title}`}
                    checked={selected.includes(book.id)}
                    onChange={(event) =>
                      setSelected((list) =>
                        event.target.checked
                          ? [...list, book.id]
                          : list.filter((id) => id !== book.id),
                      )
                    }
                  />
                  <Check size={12} />
                </label>
                <button
                  className="library-book-open"
                  onClick={() => openBook(book)}
                  aria-label={`فتح ${book.title}`}
                >
                  <div className="library-book-preview" aria-hidden="true">
                    <div className="library-cover-paper">
                      <span>{book.subject}</span>
                      <strong>{book.title}</strong>
                      <small>
                        الصف {book.grade} · الفصل {book.term}
                      </small>
                      <i />
                      <i />
                      <i />
                      <i />
                      <b>{book.questions} سؤال</b>
                    </div>
                  </div>
                  <div className="library-book-caption">
                    <span className="library-file-icon">
                      <BookOpen size={17} />
                    </span>
                    <div>
                      <h3>{book.title}</h3>
                      <p>
                        {book.subject} · الصف {book.grade}
                      </p>
                      <small>
                        {book.questions} سؤال{parent ? ` · ${parent.name}` : ''}
                      </small>
                    </div>
                  </div>
                </button>
                <button
                  className="library-book-move"
                  aria-label={`نقل ${book.title} إلى مجلد`}
                  title="نقل إلى مجلد"
                  disabled={!loaded}
                  onClick={() => move([book.id])}
                >
                  <MoveRight size={17} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="library-empty">
          <BookOpen size={37} />
          <h3>{books.length ? 'لا توجد كتب هنا' : 'مكتبتك جاهزة لأول كتاب'}</h3>
          <button
            className="text-button"
            onClick={() => (books.length ? choose('all') : importBank(target))}
          >
            {books.length ? 'عرض كل الكتب' : 'إضافة بنك أسئلة'}
          </button>
        </div>
      )}
      {editing && (
        <FocusWindow
          title={editing === 'new' ? 'مجلد جديد' : 'تعديل المجلد'}
          onClose={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            className="library-folder-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await api(
                  editing === 'new' ? '/api/library/folders' : `/api/library/folders/${editing.id}`,
                  editing === 'new' ? 'POST' : 'PUT',
                  { name, color },
                );
                await refresh();
                setEditing(null);
                notify('تم حفظ المجلد');
              });
            }}
          >
            <label className="field">
              اسم المجلد
              <input
                autoFocus
                aria-label="اسم المجلد"
                maxLength={80}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="مثال: رياضيات الصف العاشر"
              />
            </label>
            <fieldset className="library-color-picker">
              <legend>لون المجلد</legend>
              {colors.map(([id, label]) => (
                <label key={id} className={`tone-${id}`}>
                  <input
                    type="radio"
                    name="folder-color"
                    value={id}
                    aria-label={label}
                    checked={color === id}
                    onChange={() => setColor(id)}
                  />
                  <span>{color === id && <Check size={17} />}</span>
                </label>
              ))}
            </fieldset>
            {error && (
              <p className="error-note" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy || !name.trim()}>
              {busy ? 'جارٍ الحفظ…' : 'حفظ المجلد'}
            </button>
          </form>
        </FocusWindow>
      )}
      {!!moving.length && (
        <FocusWindow
          title="نقل الكتب"
          onClose={() => {
            if (!busy) setMoving([]);
          }}
        >
          <form
            className="library-folder-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await api('/api/library/move', 'PUT', {
                  bookIds: moving,
                  folderId: destination || null,
                });
                await refresh();
                setMoving([]);
                setSelected([]);
                notify('تم نقل الكتب');
              });
            }}
          >
            <p>{moving.length} كتاب إلى</p>
            <label className="field">
              المجلد
              <select
                aria-label="المجلد الوجهة"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value="">غير مصنف</option>
                {organization.folders.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="error-note" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? 'جارٍ النقل…' : 'نقل الكتب'}
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
          <div className="library-folder-form">
            <p>حذف مجلد «{deleting.name}»؟ ستبقى جميع كتبه وأسئلته في «غير مصنف».</p>
            {error && (
              <p className="error-note" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(`/api/library/folders/${deleting.id}`, 'DELETE');
                  if (folder === deleting.id) choose('all');
                  await refresh();
                  setDeleting(null);
                  notify('حُذف المجلد وبقيت الكتب محفوظة');
                })
              }
            >
              حذف المجلد فقط
            </button>
          </div>
        </FocusWindow>
      )}
    </section>
  );
}
