import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  BookOpen,
  UploadCloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Settings2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api, fileBase64 } from './api';
import MathText from './MathText';
import type { Exam } from './types';
import './workspace.css';
import { motion } from 'motion/react';
import BookQuestionReview from './BookQuestionReview';
import BankWizard from './BankWizard';
import BookLibrary from './BookLibrary';
import BankQuestionCollection, { ChapterRename, chapterLabel } from './BankQuestionCollection';
import FocusWindow from './FocusWindow';
import './exchange.css';
import './bankDashboard.css';
import QuestionComposer from './QuestionComposer';
import PDFExport from './PDFExport';
import DeleteRecord from './DeleteRecord';
import { kindLabel, kindOf, questionKinds } from './questionFormats';
type Props = {
  notify: (s: string) => void;
  openExam: (e: Exam) => void;
  navigate: (p: string) => void;
};
export { default as AssistantView } from './Assistant';
export function BooksView({ notify, openExam }: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [bankPanel, setBankPanel] = useState<'files' | 'exam' | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [questionType, setQuestionType] = useState('');
  const [destinationFolder, setDestinationFolder] = useState<string | null>(null);
  const [books, setBooks] = useState<any[]>([]),
    [book, setBook] = useState<any>(),
    [questions, setQuestions] = useState<any[]>([]),
    [jobs, setJobs] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [target, setTarget] = useState(200),
    [count, setCount] = useState(10),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [difficulty, setDifficulty] = useState(''),
    [chapter, setChapter] = useState(''),
    [question, setQuestion] = useState<any>(),
    [preview, setPreview] = useState(''),
    [page, setPage] = useState(1),
    [from, setFrom] = useState(1),
    [to, setTo] = useState(1);
  const filteredQuestions = questions.filter(
    (q) =>
      (!status || q.status === status) &&
      (!questionType || kindOf(q) === questionType) &&
      (!difficulty || q.difficulty === difficulty) &&
      (!chapter || q.chapter === chapter) &&
      `${q.text} ${q.chapter}`.includes(query),
  );
  const approvedCount = questions.filter((q) => q.status === 'approved').length;
  const chapters = [...new Set(questions.map((q) => q.chapter).filter(Boolean))];
  const [meta, setMeta] = useState({ title: '', subject: '', grade: '', term: 'الأول' });
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    setBooks(await api('/api/books'));
    setJobs(await api('/api/book-jobs'));
  };
  useEffect(() => {
    void refresh().catch((e) => notify(e.message));
    const timer = setInterval(() => void refresh().catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, []);
  async function open(b: any) {
    const loaded = await api(`/api/books/${b.id}`);
    if (b.id !== book?.id) {
      setQuery('');
      setStatus('');
      setDifficulty('');
      setChapter('');
      setQuestionType('');
      setFiltersOpen(false);
      setBankPanel(null);
    }
    setBook(loaded);
    setQuestions(await api(`/api/books/${b.id}/questions`));
    setQuestion(undefined);
    setPreview('');
    setPage(1);
    setTo(loaded.pageCount);
  }
  const job = jobs.find((j) => j.bookId === book?.id);
  async function showPage(n: number) {
    setPage(n);
    setPreview((await api(`/api/books/${book.id}/page/${n}`)).image);
  }
  async function range(included: boolean) {
    if (from < 1 || to < from || to > book.pageCount) throw Error('نطاق صفحات غير صالح');
    const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    setBook(await api(`/api/books/${book.id}/pages`, 'POST', { pages, included }));
  }
  return (
    <motion.div
      className="book-workspace"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="page-title" hidden={!!book}>
        <div>
          <h1>{book ? 'بنك الأسئلة' : 'الكتب وبنك الأسئلة'}</h1>
          {!book && <p>اختر كتابًا لمراجعة أسئلته أو أضف بنكًا جديدًا.</p>}
        </div>
        <div className="library-totals" hidden={!!book}>
          <span>
            <BookOpen size={20} />
            <strong>{books.length}</strong> كتب في مكتبتك
          </span>
          <span>
            <Sparkles size={20} />
            <strong>{books.reduce((n, b) => n + b.questions, 0)}</strong> سؤال محفوظ
          </span>
        </div>
      </div>
      <details className="bank-import-window">
        <summary>
          <UploadCloud size={19} /> إضافة بنك أسئلة <span>من كتاب أو ملف جاهز</span>
        </summary>
        <BankWizard
          books={books}
          notify={notify}
          onImported={async (id) => {
            if (destinationFolder)
              await api('/api/library/move', 'PUT', { bookIds: [id], folderId: destinationFolder });
            await refresh();
            await open({ id });
            document.querySelector('.bank-import-window')?.removeAttribute('open');
          }}
        />
      </details>
      <BookLibrary
        onDeleted={refresh}
        books={books}
        hidden={!!book}
        openBook={(value) => void run(() => open(value))}
        notify={notify}
        importBank={(folderId) => {
          setDestinationFolder(folderId);
          const panel = document.querySelector<HTMLDetailsElement>('.bank-import-window');
          if (panel) {
            panel.open = true;
            panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
          }
        }}
        uploadBook={(folderId) => {
          setDestinationFolder(folderId);
          setUploadError('');
          setUploadOpen(true);
        }}
      />
      {uploadOpen && (
        <FocusWindow
          title="رفع كتاب PDF"
          onClose={() => {
            if (!uploading) setUploadOpen(false);
          }}
        >
          <div className="library-source-form">
            {(['title', 'subject', 'grade'] as const).map((key, i) => (
              <label className="field" key={key}>
                {['عنوان الكتاب', 'المادة', 'الصف'][i]}
                <input
                  value={meta[key]}
                  onChange={(e) => setMeta({ ...meta, [key]: e.target.value })}
                />
              </label>
            ))}
            <select value={meta.term} onChange={(e) => setMeta({ ...meta, term: e.target.value })}>
              <option>الأول</option>
              <option>الثاني</option>
            </select>
            <label className="book-upload">
              {uploading ? <Loader2 className="spin" /> : <UploadCloud />}
              <span>
                {uploading ? 'جارٍ تجهيز الكتاب…' : 'اختر كتابًا بصيغة PDF'}
                <small>حتى 30 ميجابايت · محفوظ على جهاز المعلم</small>
              </span>
              <input
                type="file"
                accept="application/pdf"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      setUploadError('');
                      setUploading(true);
                      try {
                        if (file.size > 30 * 1024 * 1024)
                          throw Error('حجم الكتاب أكبر من 30 ميجابايت');
                        if (!meta.subject || !meta.grade)
                          throw Error('أدخل المادة والصف قبل رفع الكتاب');
                        const title = meta.title.trim() || file.name.replace(/\.pdf$/i, '');
                        setMeta({ ...meta, title });
                        const b = await api('/api/books', 'POST', {
                          ...meta,
                          title,
                          pdf: await fileBase64(file),
                        });
                        if (destinationFolder)
                          await api('/api/library/move', 'PUT', {
                            bookIds: [b.id],
                            folderId: destinationFolder,
                          });
                        await refresh();
                        await open(b);
                        setUploadOpen(false);
                      } catch (error) {
                        setUploadError((error as Error).message);
                        throw error;
                      } finally {
                        setUploading(false);
                        e.target.value = '';
                      }
                    });
                }}
              />
            </label>
            {uploadError && (
              <div className="upload-error" role="alert">
                <AlertCircle size={17} />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        </FocusWindow>
      )}
      {book && (
        <button
          className="library-back text-button"
          onClick={() => {
            setBook(undefined);
            setQuestion(undefined);
          }}
        >
          <ArrowRight size={18} />
          العودة إلى المكتبة
        </button>
      )}
      <div className="book-layout library-detail-layout" hidden={!book}>
        <section className="card book-content">
          {!book ? (
            <div className="empty">
              <BookOpen size={50} />
              <h2>{books.length ? 'اختر كتابًا من المكتبة' : 'أضف أول بنك أسئلة'}</h2>
              <p>
                {books.length
                  ? 'ستظهر أسئلته هنا للمراجعة والتعديل.'
                  : 'افتح «إضافة بنك أسئلة» للبدء.'}
              </p>
            </div>
          ) : (
            <>
              <header className="bank-dashboard-header">
                <div>
                  <span className="bank-eyebrow">
                    {book.subject} · الصف {book.grade}
                  </span>
                  <h2>{book.title}</h2>
                </div>
                <div className="bank-header-actions">
                  <button className="secondary" onClick={() => setManualOpen(true)}>
                    <Plus size={17} /> إضافة سؤال يدويًا
                  </button>
                  <button className="secondary" onClick={() => setBankPanel('files')}>
                    <Settings2 size={17} />
                    ملفات الكتاب وإعداداته
                  </button>
                  <button className="primary" onClick={() => setBankPanel('exam')}>
                    <Plus size={17} />
                    إنشاء امتحان
                  </button>
                </div>
              </header>
              {manualOpen && (
                <FocusWindow title="إضافة سؤال يدويًا" onClose={() => setManualOpen(false)}>
                  <QuestionComposer
                    bank
                    onSave={async (q) => {
                      await api(`/api/books/${book.id}/questions`, 'POST', q);
                      await open(book);
                      notify('حُفظ السؤال في البنك');
                    }}
                  />
                </FocusWindow>
              )}
              <div className="bank-dashboard-metrics" aria-label="ملخص بنك الأسئلة">
                {[
                  ['', questions.length, 'جميع الأسئلة', BookOpen],
                  ['approved', approvedCount, 'جاهزة للامتحان', CheckCircle2],
                  ['draft', questions.length - approvedCount, 'بانتظار المراجعة', AlertCircle],
                ].map(([value, total, label, Icon]: any) => (
                  <button
                    key={label}
                    className={`bank-metric metric-${value || 'all'}`}
                    aria-pressed={status === value}
                    onClick={() => setStatus(value)}
                  >
                    <span className="bank-metric-icon">
                      <Icon size={21} />
                    </span>
                    <span>
                      {label}
                      <strong>{total}</strong>
                    </span>
                    <ChevronLeft size={17} />
                  </button>
                ))}
              </div>
              {bankPanel === 'files' && (
                <FocusWindow title="ملفات الكتاب وإعداداته" wide onClose={() => setBankPanel(null)}>
                  <div className="bank-book-actions">
                    <div className="workspace-toolbar">
                      {book.hasCompanion && (
                        <button
                          className="secondary"
                          onClick={() =>
                            void run(async () => {
                              const { pdf } = await api(`/api/books/${book.id}/companion`);
                              const bytes = Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0));
                              const url = URL.createObjectURL(
                                new Blob([bytes], { type: 'application/pdf' }),
                              );
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = 'bank-companion.pdf';
                              link.click();
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                            })
                          }
                        >
                          تنزيل PDF المرافق
                        </button>
                      )}
                      <PDFExport
                        bank={{ id: book.id, title: book.title, chapters }}
                        notify={notify}
                      />
                      <DeleteRecord
                        kind="books"
                        id={book.id}
                        title={book.title}
                        onDeleted={async () => {
                          setBook(undefined);
                          setQuestions([]);
                          setBankPanel(null);
                          await refresh();
                        }}
                      />
                      {!book.hasPdf && (
                        <label className="secondary file-button">
                          <UploadCloud size={16} /> إرفاق الكتاب الأصلي للقص
                          <input
                            aria-label="الكتاب الأصلي للقص"
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                void run(async () => {
                                  await api(`/api/books/${book.id}/source`, 'POST', {
                                    pdf: await fileBase64(file),
                                  });
                                  await open(book);
                                  await refresh();
                                  notify('تم ربط المصدر وقص الصور المتاحة محليًا');
                                });
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <details className="advanced-api">
                      <summary>خيارات التوليد المتقدمة</summary>
                      <div className="workspace-toolbar">
                        <label>
                          هدف البنك{' '}
                          <input
                            type="number"
                            min={50}
                            max={500}
                            value={target}
                            onChange={(e) => setTarget(+e.target.value)}
                          />
                        </label>
                        <button
                          className="primary"
                          disabled={busy || job?.status === 'running'}
                          onClick={() =>
                            void run(async () => {
                              await api(`/api/books/${book.id}/process`, 'POST', { target });
                              await refresh();
                            })
                          }
                        >
                          {job?.status === 'paused'
                            ? 'متابعة المعالجة'
                            : 'تحليل الكتاب وبناء البنك'}
                        </button>
                        {job?.status === 'running' && (
                          <button
                            onClick={() =>
                              void run(() => api(`/api/book-jobs/${job.id}/pause`, 'POST'))
                            }
                          >
                            إيقاف مؤقت
                          </button>
                        )}
                        <button onClick={() => void run(() => open(book))}>تحديث الأسئلة</button>
                      </div>
                      {job && (
                        <div className="book-progress" role="status">
                          <strong>{job.message}</strong>
                          <progress max={book.pageCount} value={job.nextPage - 1} />
                          <small>
                            {job.nextPage - 1} / {book.pageCount} صفحة · {job.completed || 0} سؤال ·{' '}
                            {job.tokens || 0} رمز مستخدم
                            {job.cropWarnings > 0 && ` · ${job.cropWarnings} صور تحتاج مراجعة`}
                          </small>
                        </div>
                      )}
                    </details>
                    <details>
                      <summary>صفحات الكتاب والاستثناءات</summary>
                      <div className="workspace-toolbar">
                        من
                        <input
                          aria-label="من صفحة"
                          type="number"
                          value={from}
                          onChange={(e) => setFrom(+e.target.value)}
                        />
                        إلى
                        <input
                          aria-label="إلى صفحة"
                          type="number"
                          value={to}
                          onChange={(e) => setTo(+e.target.value)}
                        />
                        <button onClick={() => void run(() => range(false))}>استبعاد النطاق</button>
                        <button onClick={() => void run(() => range(true))}>تضمين النطاق</button>
                      </div>
                      <div className="book-pages">
                        {book.pages.map((p: any) => (
                          <button
                            title={p.reason}
                            className={(p.override ?? p.included) ? '' : 'excluded'}
                            key={p.page}
                            onClick={() => void run(() => showPage(p.page))}
                          >
                            صفحة {p.page}
                            <small>{p.chapter || p.reason}</small>
                          </button>
                        ))}
                      </div>
                      {preview && (
                        <img className="page-preview" src={preview} alt={`صفحة ${page}`} />
                      )}
                    </details>
                  </div>
                </FocusWindow>
              )}
              <div className="bank-dashboard-body">
                <section className="bank-question-board" aria-label="أسئلة البنك">
                  <div className="bank-section-heading">
                    <h3>الأسئلة</h3>
                    <span>{filteredQuestions.length} سؤال</span>
                  </div>
                  <div className="bank-search-row">
                    <input
                      aria-label="البحث في أسئلة البنك"
                      placeholder="ابحث عن سؤال…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                      className="secondary"
                      aria-expanded={filtersOpen}
                      onClick={() => setFiltersOpen(!filtersOpen)}
                    >
                      <SlidersHorizontal size={16} />
                      تصفية{status || difficulty || chapter || questionType ? ' •' : ''}
                    </button>
                  </div>
                  {(status || difficulty || chapter || query || questionType) && (
                    <div className="bank-active-filters">
                      <span>
                        {[
                          status === 'approved' ? 'معتمد' : status === 'draft' ? 'للمراجعة' : '',
                          difficulty,
                          chapter,
                          questionKinds.find((k) => k[0] === questionType)?.[1] || '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'نتائج البحث'}
                      </span>
                      <button
                        onClick={() => {
                          setStatus('');
                          setDifficulty('');
                          setChapter('');
                          setQuery('');
                          setQuestionType('');
                        }}
                      >
                        مسح التصفية
                      </button>
                    </div>
                  )}
                  <div className="workspace-toolbar bank-question-filters" hidden={!filtersOpen}>
                    <select
                      aria-label="نوع أسئلة البنك"
                      value={questionType}
                      onChange={(e) => setQuestionType(e.target.value)}
                    >
                      <option value="">كل أنواع الأسئلة</option>
                      {questionKinds.map(([kind, label]) => (
                        <option key={kind} value={kind}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="حالة أسئلة البنك"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">كل الحالات</option>
                      <option value="draft">للمراجعة</option>
                      <option value="approved">معتمد</option>
                    </select>
                    <select
                      aria-label="صعوبة أسئلة البنك"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="">كل مستويات الصعوبة</option>
                      {['سهل', 'متوسط', 'صعب'].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      aria-label="فصل أسئلة البنك"
                      value={chapter}
                      onChange={(e) => setChapter(e.target.value)}
                    >
                      <option value="">جميع الفصول</option>
                      {[...new Set(questions.map((q) => q.chapter))].map((c) => (
                        <option key={c} value={c}>
                          {chapterLabel(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <BankQuestionCollection
                    key={book.id}
                    bookId={book.id}
                    questions={filteredQuestions}
                    allQuestions={questions}
                    notify={notify}
                    onChanged={async () => {
                      await open(book);
                      await refresh();
                    }}
                    renderQuestion={(q) => (
                      <motion.button
                        className="bank-question"
                        key={q.id}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        layout
                        onClick={() => {
                          setQuestion({ ...q });
                          setPreview('');
                        }}
                      >
                        <span className="bank-question-top">
                          <span
                            className={`pill ${q.status === 'approved' ? 'is-approved' : 'is-draft'}`}
                          >
                            {q.status === 'approved' ? 'معتمد' : 'للمراجعة'}
                          </span>
                          <small>
                            {kindLabel(q)} · ص {q.page}
                          </small>
                        </span>
                        <MathText text={q.text} />
                        {q.cropWarning && (
                          <small className="bank-crop-warning">
                            <AlertCircle size={13} />
                            {q.image ? 'راجع قص الرسم' : 'الصورة تحتاج تحديدًا'}
                          </small>
                        )}
                        {q.image && <img src={q.image} alt="رسم السؤال" />}
                        <small>
                          {chapterLabel(q.chapter)} · {q.difficulty}
                        </small>
                      </motion.button>
                    )}
                  />
                </section>
                <aside className="bank-insights">
                  <section className="bank-chapters">
                    <h3>
                      الفصول <span>{chapters.length}</span>
                    </h3>
                    <button aria-pressed={!chapter} onClick={() => setChapter('')}>
                      <span>جميع الفصول</span>
                      <b>{questions.length}</b>
                    </button>
                    {chapters.map((name) => (
                      <div className="bank-chapter-row" key={name}>
                        <button aria-pressed={chapter === name} onClick={() => setChapter(name)}>
                          <span>{chapterLabel(name)}</span>
                          <b>{questions.filter((q) => q.chapter === name).length}</b>
                        </button>
                        <ChapterRename
                          bookId={book.id}
                          name={name}
                          onChanged={async () => {
                            setChapter('');
                            await open(book);
                          }}
                          notify={notify}
                        />
                      </div>
                    ))}
                  </section>
                  <section className="bank-difficulty">
                    <h3>مستويات الصعوبة</h3>
                    {['سهل', 'متوسط', 'صعب'].map((name) => {
                      const total = questions.filter((q) => q.difficulty === name).length;
                      return (
                        <button
                          key={name}
                          aria-pressed={difficulty === name}
                          onClick={() => setDifficulty(difficulty === name ? '' : name)}
                        >
                          <span>
                            {name}
                            <b>{total}</b>
                          </span>
                          <progress
                            aria-label={`عدد الأسئلة: ${name}`}
                            value={total}
                            max={Math.max(1, questions.length)}
                          />
                        </button>
                      );
                    })}
                  </section>
                </aside>
              </div>
              {bankPanel === 'exam' && (
                <FocusWindow title="إنشاء امتحان من هذا البنك" onClose={() => setBankPanel(null)}>
                  <p className="muted">اختر عدد الأسئلة. تُستخدم تصفية الفصل والصعوبة الحالية.</p>
                  <div className="workspace-toolbar">
                    <label>
                      عدد أسئلة الامتحان
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={count}
                        onChange={(e) => setCount(+e.target.value)}
                      />
                    </label>
                    <button
                      className="primary"
                      onClick={() =>
                        void run(async () =>
                          openExam(
                            await api('/api/bank/exam', 'POST', {
                              bookId: book.id,
                              count,
                              chapter: chapter || undefined,
                              difficulty: difficulty || undefined,
                            }),
                          ),
                        )
                      }
                    >
                      إنشاء مسودة من البنك
                    </button>
                  </div>
                </FocusWindow>
              )}
            </>
          )}
        </section>
      </div>
      {question && (
        <BookQuestionReview
          key={question.id}
          question={question}
          bookId={book.id}
          onClose={() => setQuestion(undefined)}
          onSaved={() => open(book)}
          notify={notify}
        />
      )}
    </motion.div>
  );
}
