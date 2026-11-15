/**
 * Filterable student record timeline panel showing classroom notes, grades,
 * and a low-profile empty state with crisp card typography separation.
 */
import { useRef, useState } from 'react';
import { Sprout } from 'lucide-react';
import type { Language } from '../i18n';
import { useStaggerGrid } from '../schoolsync-ui';
import type { Grade, Note } from '../types';

export function StudentTimelinePanel({
  studentId,
  notes,
  grades,
  lang,
  busy,
  onPublishGrade,
}: {
  studentId: string;
  notes: Note[];
  grades: Grade[];
  lang: Language;
  busy: boolean;
  onPublishGrade: (gradeId: string) => Promise<void>;
}) {
  const ar = lang === 'ar';
  const [filter, setFilter] = useState<'all' | 'notes' | 'grades'>('all');
  const timelineRef = useRef<HTMLDivElement>(null);
  useStaggerGrid(timelineRef, '.timeline-cards > article', [studentId, notes.length, grades.length, filter]);

  const showNotes = filter === 'all' || filter === 'notes';
  const showGrades = filter === 'all' || filter === 'grades';
  const visibleNotes = showNotes ? notes.slice(0, 5) : [];
  const visibleGrades = showGrades ? grades.slice(0, 6) : [];
  const hasVisible = visibleNotes.length > 0 || visibleGrades.length > 0;

  return (
    <section className="sp-timeline-panel" data-reveal>
      <div className="sp-timeline-head">
        <h2>{ar ? 'آخر الملاحظات والعلامات' : 'Recent notes & grades'}</h2>
        <div className="sp-filter-pills" role="tablist" aria-label={ar ? 'تصفية السجل' : 'Filter records'}>
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            {ar ? `الكل (${notes.length + grades.length})` : `All (${notes.length + grades.length})`}
          </button>
          <button type="button" className={filter === 'notes' ? 'active' : ''} onClick={() => setFilter('notes')}>
            {ar ? `الملاحظات (${notes.length})` : `Notes (${notes.length})`}
          </button>
          <button type="button" className={filter === 'grades' ? 'active' : ''} onClick={() => setFilter('grades')}>
            {ar ? `العلامات (${grades.length})` : `Grades (${grades.length})`}
          </button>
        </div>
      </div>

      <div ref={timelineRef} className="timeline-cards">
        {visibleNotes.map((n) => (
          <article className="sp-record-card t-stagger-row" key={n.id}>
            <div className="sp-meta-row">
              <span className="sp-category-badge">
                {n.category === 'behavior'
                  ? ar ? 'سلوكية' : 'Behavior'
                  : n.category === 'academic'
                    ? ar ? 'تعليمية' : 'Academic'
                    : ar ? 'عامة' : 'General'}
              </span>
              <small className="sp-record-date">{n.created.slice(0, 10)}</small>
            </div>
            <p className="sp-note-body">{n.content}</p>
            <small className="sp-record-author">{n.author}</small>
          </article>
        ))}

        {visibleGrades.map((g) => (
          <article className="sp-record-card sp-grade-row t-stagger-row" key={g.id}>
            <div className="sp-grade-copy">
              <strong className="sp-grade-title">
                {g.subject} · {g.title}
              </strong>
              <span className="sp-grade-sub">
                <span className="sp-score-chip">
                  {g.score} / {g.max}
                </span>
                <span>{g.date}</span>
              </span>
            </div>
            {!g.published ? (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => void onPublishGrade(g.id)}
              >
                {ar ? 'نشر العلامة' : 'Publish'}
              </button>
            ) : (
              <span className="pill-ok">{ar ? 'منشورة' : 'Published'}</span>
            )}
          </article>
        ))}

        {!hasVisible && (
          <div className="sp-empty-compact">
            <span className="sp-empty-icon">
              <Sprout size={18} />
            </span>
            <div className="sp-empty-copy">
              <strong>{ar ? 'سجل الطالب فارغ حالياً' : 'No records yet'}</strong>
              <span>{ar ? 'أضف أول ملاحظة أو علامة من لوحة الإجراءات.' : 'Add the first note or mark from Quick Actions.'}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
