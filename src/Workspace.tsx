import { useEffect, useState } from 'react';
import { Sparkles, BookOpen, UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { api, fileBase64 } from './api';
import MathText from './MathText';
import type { Exam } from './types';
import './workspace.css';
import { motion } from 'motion/react';
import BookQuestionReview from './BookQuestionReview';
import BankWizard from './BankWizard';
import './exchange.css';
type Props = {
  notify: (s: string) => void;
  openExam: (e: Exam) => void;
  navigate: (p: string) => void;
};
export { default as AssistantView } from './Assistant';
export function BooksView({ notify, openExam }: Props) {
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
    setBook(await api(`/api/books/${b.id}`));
    setQuestions(await api(`/api/books/${b.id}/questions`));
    setQuestion(undefined);
    setPreview('');
    setPage(1);
    setTo(b.pageCount);
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
      <div className="page-title">
        <div>
          <span className="eyebrow">معرفة محفوظة، لكل امتحان</span>
          <h1>الكتب وبنك الأسئلة</h1>
          <p>أسئلة منظمة حسب المنهج مع المعادلات ورسومات الكتاب الأصلية.</p>
        </div>
        <div className="library-totals">
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
      <BankWizard
        books={books}
        notify={notify}
        onImported={async (id) => {
          await refresh();
          await open({ id });
        }}
      />
      <div className="book-layout">
        <aside className="card book-list">
          <h3>مكتبتك المحفوظة</h3>
          <details>
            <summary>خيارات متقدمة: إضافة كتاب أصلي</summary>
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
                        await refresh();
                        await open(b);
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
          </details>
          {books.map((b) => (
            <button className="history" key={b.id} onClick={() => void run(() => open(b))}>
              <BookOpen />
              <span>
                {b.title}
                <small>
                  {b.grade} · {b.questions} سؤال
                </small>
              </span>
            </button>
          ))}
        </aside>
        <section className="card book-content">
          {!book ? (
            <div className="empty">
              <BookOpen size={50} />
              <h2>مكتبتك تبدأ بكتاب</h2>
              <p>جهّز طلبك في الأعلى، ثم استورد بنك الأسئلة من موقع المساعد.</p>
            </div>
          ) : (
            <>
              <h2>{book.title}</h2>
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
                <button
                  className="secondary"
                  onClick={() =>
                    void run(async () => {
                      if (window.desktop) {
                        await window.desktop.exportBankPDF(book.id);
                      } else {
                        const { html } = await api(`/api/books/${book.id}/document`);
                        const frame = document.createElement('iframe');
                        frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0';
                        frame.onload = async () => {
                          await frame.contentDocument?.fonts.ready;
                          frame.contentWindow?.print();
                          setTimeout(() => frame.remove(), 60000);
                        };
                        document.body.appendChild(frame);
                        frame.srcdoc = html;
                      }
                    })
                  }
                >
                  تصدير بنك PDF محليًا
                </button>
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
                    {job?.status === 'paused' ? 'متابعة المعالجة' : 'تحليل الكتاب وبناء البنك'}
                  </button>
                  {job?.status === 'running' && (
                    <button
                      onClick={() => void run(() => api(`/api/book-jobs/${job.id}/pause`, 'POST'))}
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
                {preview && <img className="page-preview" src={preview} alt={`صفحة ${page}`} />}
              </details>
              <div className="workspace-toolbar">
                <input
                  placeholder="بحث في الأسئلة والفصول"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
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
                    <option key={c}>{c}</option>
                  ))}
                </select>
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
              <div className="bank-grid">
                {questions
                  .filter(
                    (q) =>
                      (!status || q.status === status) &&
                      (!difficulty || q.difficulty === difficulty) &&
                      (!chapter || q.chapter === chapter) &&
                      `${q.text} ${q.chapter}`.includes(query),
                  )
                  .map((q) => (
                    <motion.button
                      className="bank-question"
                      key={q.id}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      layout
                      onClick={() => {
                        setQuestion({ ...q });
                        setPreview('');
                      }}
                    >
                      <span className="pill">
                        {q.status === 'approved' ? 'معتمد' : 'للمراجعة'} · صفحة {q.page}
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
                        {q.chapter} · {q.difficulty}
                      </small>
                    </motion.button>
                  ))}
              </div>
              {questions.length === 0 && (
                <p className="muted">استورد ملف البنك من الأعلى لبدء المراجعة.</p>
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
