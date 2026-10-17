import { useEffect, useState } from 'react';
import { BookOpen, Check, Search, Layers, Loader2 } from 'lucide-react';
import { api } from './api';
import MathText from './MathText';
import type { Question } from './types';
import BookQuestionReview from './BookQuestionReview';
export default function ExamBankPicker({
  onAdd,
  notify,
  existing,
}: {
  onAdd: (questions: Question[], book: any) => void;
  notify: (s: string) => void;
  existing: Question[];
}) {
  const [books, setBooks] = useState<any[]>([]),
    [bookId, setBookId] = useState(''),
    [questions, setQuestions] = useState<any[]>([]),
    [query, setQuery] = useState(''),
    [level, setLevel] = useState(''),
    [chapter, setChapter] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [count, setCount] = useState(10),
    [busy, setBusy] = useState(false);
  const [review, setReview] = useState<any>();
  useEffect(() => {
    void api('/api/books')
      .then(setBooks)
      .catch((e) => notify(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setQuestions([]);
    setSelected([]);
    setChapter('');
    if (!bookId) return;
    setBusy(true);
    void api(`/api/books/${bookId}/questions`)
      .then((q) => {
        if (active) setQuestions(q);
      })
      .catch((e) => notify(e.message))
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [bookId]);
  const bank = books.find((b) => b.id === bookId);
  const used = new Set(existing.map((q) => q.bankId));
  const visible = questions.filter(
    (q) =>
      !used.has(q.id) &&
      (!level || q.difficulty === level) &&
      (!chapter || q.chapter === chapter) &&
      `${q.text} ${q.chapter} ${q.lesson || ''}`.includes(query),
  );
  const available = visible.filter((q) => q.status === 'approved' && (!q.requiresImage || q.image));
  const add = async () => {
    setBusy(true);
    try {
      const result = await api('/api/bank/selection', 'POST', { ids: selected });
      onAdd(result.questions, bank);
      setSelected([]);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="exam-bank-picker">
      <div className="bank-picker-intro">
        <div className="bank-picker-emblem">
          <BookOpen size={27} />
        </div>
        <div>
          <h2>معرفتك جاهزة. اختر منها امتحانك.</h2>
          <p>اختر الأسئلة المعتمدة بمعادلاتها ورسومها، ثم راجع امتحانك.</p>
        </div>
      </div>
      <label className="field">
        بنك الأسئلة
        <select
          aria-label="بنك أسئلة الامتحان"
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
        >
          <option value="">اختر بنكًا محفوظًا…</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title} · {b.subject} · {b.grade}
            </option>
          ))}
        </select>
      </label>
      {!books.length && (
        <div className="empty">
          <Layers size={38} />
          <h3>ابدأ باستيراد بنك أسئلة</h3>
          <p>
            افتح «الكتب وبنك الأسئلة»، واستورد JSON، ثم راجع الأسئلة واعتمدها. تبقى إضافة السؤال
            يدويًا متاحة في المراجعة.
          </p>
        </div>
      )}
      {bank && (
        <>
          <div className="workspace-toolbar">
            <label className="search-box">
              <Search size={16} />
              <input
                aria-label="بحث أسئلة الامتحان"
                placeholder="درس، فكرة، أو جزء من السؤال"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected([]);
                }}
              />
            </label>
            <select
              aria-label="صعوبة أسئلة الاختيار"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">كل الصعوبات</option>
              {['سهل', 'متوسط', 'صعب'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              aria-label="فصل أسئلة الاختيار"
              value={chapter}
              onChange={(e) => {
                setChapter(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">كل الفصول</option>
              {[...new Set(questions.map((q) => q.chapter))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="bank-selection-bar">
            <button
              className="secondary"
              disabled={busy || !available.length || existing.length + available.length > 500}
              onClick={() => setSelected(available.map((q) => q.id))}
            >
              تحديد المجموعة المعتمدة للسحب العشوائي
            </button>
            <span>
              {available.length} معتمد · {visible.filter((q) => q.status !== 'approved').length}{' '}
              للمراجعة · {selected.length} محدد
            </span>
            <label>
              عدد الأسئلة
              <input
                aria-label="عدد أسئلة التجميع"
                type="number"
                min={1}
                max={500 - existing.length}
                value={count}
                onChange={(e) => setCount(+e.target.value)}
              />
            </label>
            <button
              className="secondary"
              disabled={
                busy ||
                count < 1 ||
                !Number.isInteger(count) ||
                count > 500 - existing.length ||
                available.length < count
              }
              onClick={() => setSelected(available.slice(0, count).map((q) => q.id))}
            >
              اختيار العدد من النتائج
            </button>
            <button
              className="primary"
              disabled={busy || !selected.length || selected.length + existing.length > 500}
              onClick={() => void add()}
            >
              {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}إضافة{' '}
              {selected.length} إلى الامتحان
            </button>
          </div>
          <div className="bank-picker-grid">
            {visible.map((q) => (
              <button
                key={q.id}
                className={selected.includes(q.id) ? 'selected' : ''}
                aria-pressed={selected.includes(q.id)}
                onClick={() => {
                  if (q.status !== 'approved' || (q.requiresImage && !q.image)) {
                    setReview(q);
                    return;
                  }
                  setSelected((s) =>
                    s.includes(q.id) ? s.filter((id) => id !== q.id) : [...s, q.id],
                  );
                }}
              >
                <small>
                  {q.status === 'approved' ? 'معتمد' : 'للمراجعة'} · {q.chapter} · صفحة {q.page} ·{' '}
                  {q.difficulty}
                </small>
                <MathText text={q.text} />
                {q.image && <img src={q.image} alt="رسم السؤال" />}
                <span className="bank-pick-check">
                  {q.status !== 'approved' || (q.requiresImage && !q.image) ? (
                    'مراجعة واعتماد'
                  ) : selected.includes(q.id) ? (
                    <Check size={14} />
                  ) : (
                    '+'
                  )}
                </span>
              </button>
            ))}
          </div>
          {!busy && !visible.length && (
            <p className="muted">لا توجد أسئلة تطابق المرشحات، أو أضيفت بالفعل.</p>
          )}
        </>
      )}
      {review && (
        <BookQuestionReview
          question={review}
          bookId={bookId}
          notify={notify}
          onClose={() => setReview(undefined)}
          onSaved={async () => {
            setQuestions(await api(`/api/books/${bookId}/questions`));
          }}
        />
      )}
    </div>
  );
}
