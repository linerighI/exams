import MorphMark from './MorphMark';
import SaveReceipt from './SaveReceipt';
import { useState, useRef, useEffect } from 'react';
import { fileBase64 } from './api';
import { FormulaEditor } from './MathText';
import type { Question } from './types';
import AudioAttachment from './AudioAttachment';
import { createQuestion, kindOf, questionProblem } from './questionFormats';
import QuestionKindSelector from './QuestionKindSelector';
import { AnswerKeyEditor } from './ExamQuestionStudio';

export default function QuestionComposer({
  onSave,
  bank = false,
  initial,
}: {
  onSave: (
    question: Question & { status: string; requiresImage: boolean; evidence: string },
  ) => Promise<void>;
  bank?: boolean;
  initial?: Question & { requiresImage?: boolean };
}) {
  const form = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState<Question>({
    ...createQuestion('single'),
    chapter: 'عام',
    difficulty: 'متوسط',
    image: undefined as string | undefined,
    audio: undefined as Question['audio'],
    ...initial,
  });
  const [approved, setApproved] = useState(false),
    [requiresImage, setRequiresImage] = useState(Boolean(initial?.requiresImage || initial?.image));
  const [receipt, setReceipt] = useState(0);
  useEffect(() => {
    if (!receipt) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        form.current
          ?.querySelector<HTMLTextAreaElement>('textarea[aria-label="نص السؤال اليدوي"]')
          ?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [receipt]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      ref={form}
      className="manual-question-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        const problem = questionProblem(q);
        if (problem) {
          setError(problem);
          return;
        }
        if (bank && !q.explanation.trim()) {
          setError('أضف تفسير الإجابة قبل حفظ سؤال البنك.');
          return;
        }
        if ((!bank || approved) && requiresImage && !q.image) {
          setError('أرفق الرسم المطلوب أولًا.');
          return;
        }
        setBusy(true);
        try {
          await onSave({
            ...q,
            text: q.text.trim(),
            options: q.options.map((o) => o.trim()),
            status: approved ? 'approved' : 'draft',
            requiresImage,
            evidence: 'سؤال أعدّه المعلم يدويًا',
          });
          setReceipt((n) => n + 1);
          setQ({
            ...createQuestion(kindOf(q)),
            chapter: q.chapter || 'عام',
            difficulty: q.difficulty || 'متوسط',
            page: q.page,
            image: undefined,
            audio: undefined,
          });
          setApproved(false);
          setRequiresImage(false);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>اكتب سؤالك بنفسك</h3>
      <SaveReceipt revision={receipt}>حُفظ السؤال. يمكنك كتابة السؤال التالي.</SaveReceipt>
      <QuestionKindSelector question={q} onChange={setQ} />
      <details className="qs-audio-editor">
        <summary>صوت لهذا السؤال</summary>
        <AudioAttachment
          value={q.audio}
          onChange={(audio) => setQ({ ...q, audio })}
          label="صوت لهذا السؤال"
        />
      </details>
      <label className="field">
        نص السؤال
        <FormulaEditor
          ariaLabel="نص السؤال اليدوي"
          value={q.text}
          onChange={(text) => setQ({ ...q, text })}
        />
      </label>
      <AnswerKeyEditor q={q} patch={(patch) => setQ({ ...q, ...patch })} />
      <label className="field">
        تفسير الإجابة
        <FormulaEditor
          ariaLabel="تفسير إجابة السؤال"
          tools={false}
          value={q.explanation}
          onChange={(explanation) => setQ({ ...q, explanation })}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          الموضوع
          <input
            value={q.chapter}
            onChange={(e) => setQ({ ...q, chapter: e.target.value })}
            required
          />
        </label>
        <label className="field">
          الصعوبة
          <select value={q.difficulty} onChange={(e) => setQ({ ...q, difficulty: e.target.value })}>
            {['سهل', 'متوسط', 'صعب'].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={requiresImage}
          onChange={(e) => setRequiresImage(e.target.checked)}
        />
        يعتمد السؤال على صورة أو رسم
      </label>
      <label className="field">
        إرفاق الرسم أو صورة السؤال
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 1500000) {
              setError('الصورة يجب أن تكون أصغر من 1.5 ميجابايت');
              return;
            }
            setQ({ ...q, image: await fileBase64(f) });
          }}
        />
      </label>
      {q.image && (
        <div>
          <img className="manual-image" src={q.image} alt="الرسم المرفق بالسؤال" />
          <button
            type="button"
            className="text-button"
            onClick={() => setQ({ ...q, image: undefined })}
          >
            إزالة الرسم
          </button>
        </div>
      )}
      {bank && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
          />
          راجعت السؤال والإجابة وأعتمده للاستخدام
        </label>
      )}
      {error && (
        <p role="alert" className="error-note">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy} aria-busy={busy}>
        <MorphMark shape={busy ? 'working' : initial ? 'edit' : 'plus'} />
        {busy
          ? 'جارٍ الحفظ…'
          : initial
            ? 'حفظ تعديل السؤال'
            : bank && !approved
              ? 'حفظ سؤال كمسودة'
              : 'إضافة السؤال'}
      </button>
    </form>
  );
}
