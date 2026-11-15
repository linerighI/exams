/**
 * Quick classroom action panels on Student Profile: immediate behavior/academic
 * note dispatch, grade recording, and manager family-access provisioning.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Award, MessageSquarePlus, Sparkles } from 'lucide-react';
import type { Language } from '../i18n';
import { Motion, useSlidingPill } from '../schoolsync-ui';
import type { Student } from '../types';

export function StudentActions({
  student,
  subjectChoices,
  manager,
  lang,
  busy,
  mutate,
}: {
  student: Student;
  subjectChoices: string[];
  manager: boolean;
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}) {
  const ar = lang === 'ar';
  const [panel, setPanel] = useState<'note' | 'grade' | 'family'>('note');
  const [noteCategory, setNoteCategory] = useState<'behavior' | 'academic' | 'general'>('behavior');
  const [noteText, setNoteText] = useState('');
  const [published, setPublished] = useState(true);
  const tabRef = useRef<HTMLDivElement>(null);
  useSlidingPill(tabRef, 'button.selected', [panel, manager, ar]);

  const submitNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    if (
      await mutate(
        '/notes',
        { studentId: student.id, category: noteCategory, content: noteText.trim() },
        ar ? 'تم حفظ الملاحظة وإرسال إشعار لولي الأمر' : 'Note saved & parent notified',
      )
    ) {
      setNoteText('');
    }
  };

  const submitGrade = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (
      await mutate(
        '/grades',
        {
          studentId: student.id,
          subject: String(f.get('subject') || ''),
          title: String(f.get('title') || ''),
          score: Number(f.get('score')),
          max: Number(f.get('max') || 100),
          published,
        },
        published
          ? ar
            ? 'تم حفظ العلامة ونشرها لولي الأمر'
            : 'Grade saved & published'
          : ar
            ? 'تم حفظ المسودة'
            : 'Draft saved',
      )
    ) {
      form.reset();
    }
  };

  return (
    <>
      <div ref={tabRef} className="segmented t-pill-track" data-reveal>
        <button type="button" className={panel === 'note' ? 'selected' : ''} onClick={() => setPanel('note')}>
          <MessageSquarePlus size={15} />
          {ar ? 'إضافة ملاحظة' : 'Add note'}
        </button>
        <button type="button" className={panel === 'grade' ? 'selected' : ''} onClick={() => setPanel('grade')}>
          <Award size={15} />
          {ar ? 'إضافة علامة' : 'Add mark'}
        </button>
        {manager && (
          <button type="button" className={panel === 'family' ? 'selected' : ''} onClick={() => setPanel('family')}>
            {ar ? 'حساب الطالب' : 'Student Login'}
          </button>
        )}
      </div>

      <Motion identity={`student-act-${panel}`}>
      {panel === 'note' && (
        <form className="form-stack" onSubmit={submitNote} data-reveal>
          <div className="chip-row">
            {(
              [
                ['behavior', ar ? 'ملاحظة سلوكية' : 'Behavior'],
                ['academic', ar ? 'ملاحظة تعليمية' : 'Academic'],
                ['general', ar ? 'عامة' : 'General'],
              ] as const
            ).map(([cat, label]) => (
              <button
                type="button"
                key={cat}
                className={`chip-pill ${noteCategory === cat ? 'selected' : ''}`}
                onClick={() => setNoteCategory(cat)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            {ar ? 'نص الملاحظة (يصل لولي الأمر فوراً)' : 'Note content (sent immediately to parent)'}
            <textarea
              rows={2}
              required
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={ar ? 'اكتب ملاحظة سلوكية أو صفية أثناء الحصة...' : 'Write a class or behavior note...'}
            />
          </label>
          <button className="primary" disabled={busy}>
            <Sparkles size={16} />
            {ar ? 'حفظ وإرسال التنبيه لولي الأمر' : 'Save & notify parent'}
          </button>
        </form>
      )}

      {panel === 'grade' && (
        <form className="form-stack" onSubmit={submitGrade} data-reveal>
          <label>
            {ar ? 'المادة الدراسية' : 'Subject'}
            <select name="subject" required defaultValue={subjectChoices[0] || ''}>
              {!subjectChoices.length && (
                <option value="" disabled>
                  {ar ? 'أضف مادة للمعلم أو المدرسة أولاً' : 'Assign a subject first'}
                </option>
              )}
              {subjectChoices.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ar ? 'عنوان التقييم أو الامتحان' : 'Title'}
            <input name="title" required placeholder={ar ? 'مثال: اختبار الشهر الأول' : 'e.g. Monthly Quiz'} />
          </label>
          <div className="split-fields">
            <label>
              {ar ? 'العلامة' : 'Score'}
              <input name="score" type="number" min={0} step="0.5" required />
            </label>
            <label>
              {ar ? 'من أصل' : 'Out of'}
              <input name="max" type="number" min={1} defaultValue={100} required />
            </label>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span>{ar ? 'نشر العلامة لولي الأمر والطالب فوراً' : 'Publish to parent immediately'}</span>
          </label>
          <button className="primary" disabled={busy || !subjectChoices.length}>
            {ar ? 'حفظ العلامة' : 'Save grade'}
          </button>
        </form>
      )}

      {panel === 'family' && manager && (
        <form
          className="surface-card form-stack"
          data-reveal
          onSubmit={async (e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            if (
              await mutate(
                `/students/${student.id}/national-id`,
                { nationalId: v.nationalId },
                ar ? 'تم حفظ الرقم الوطني وإنشاء حساب الطالب تلقائياً' : 'National ID saved & login created',
              )
            )
              e.currentTarget.reset();
          }}
        >
          <small>
            {ar
              ? 'اسم المستخدم: الرقم الوطني · كلمة المرور التلقائية: أول ٥ أرقام من الرقم الوطني + @Alshereqi.Edu'
              : 'Username: National ID · Auto password: first 5 digits + @Alshereqi.Edu'}
          </small>
          <label>
            {ar ? 'الرقم الوطني للطالب' : 'Student National ID'}
            <input
              name="nationalId"
              inputMode="numeric"
              minLength={5}
              maxLength={20}
              defaultValue={student.national_id || ''}
              placeholder="200XXXXXXX"
              required
              dir="ltr"
            />
          </label>
          <button className="primary" disabled={busy}>
            {ar ? 'حفظ وإنشاء الحساب تلقائياً' : 'Save & auto-create login'}
          </button>
        </form>
      )}
      </Motion>
    </>
  );
}
