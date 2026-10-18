import { useState } from 'react';
import { fileBase64 } from './api';
import { FormulaEditor } from './MathText';
import type { Question } from './types';
import AudioAttachment from './AudioAttachment';

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
  const [q, setQ] = useState({
    id: crypto.randomUUID(),
    text: '',
    options: ['', '', '', ''],
    correct: 0,
    explanation: '',
    page: 1,
    chapter: 'عام',
    difficulty: 'متوسط',
    image: undefined as string | undefined,
    audio: undefined as Question['audio'],
    ...initial,
  });
  const [approved, setApproved] = useState(false),
    [requiresImage, setRequiresImage] = useState(Boolean(initial?.requiresImage || initial?.image));
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="manual-question-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        if (
          q.text.trim().length < 3 ||
          q.options.some((o) => !o.trim()) ||
          new Set(q.options.map((o) => o.trim())).size !== 4
        ) {
          setError('اكتب السؤال وأربعة خيارات مختلفة وحدد الإجابة الصحيحة.');
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
          setQ({
            ...q,
            id: crypto.randomUUID(),
            text: '',
            options: ['', '', '', ''],
            explanation: '',
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
      {!bank && <AudioAttachment value={q.audio} onChange={audio=>setQ({...q,audio})} label="صوت لهذا السؤال"/>}
      <label className="field">
        نص السؤال
        <FormulaEditor
          ariaLabel="نص السؤال اليدوي"
          value={q.text}
          onChange={(text) => setQ({ ...q, text })}
        />
      </label>
      {q.options.map((option, i) => (
        <div className="manual-option" key={i}>
          <label>
            <input
              type="radio"
              name="manual-correct"
              checked={q.correct === i}
              onChange={() => setQ({ ...q, correct: i })}
              aria-label={`الإجابة الصحيحة: ${i + 1}`}
            />
            {['أ', 'ب', 'ج', 'د'][i]}
          </label>
          <FormulaEditor
            ariaLabel={`نص الخيار ${i + 1}`}
            value={option}
            tools={false}
            onChange={(text) =>
              setQ({ ...q, options: q.options.map((old, j) => (j === i ? text : old)) })
            }
          />
        </div>
      ))}
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
      <button className="primary" disabled={busy}>
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
