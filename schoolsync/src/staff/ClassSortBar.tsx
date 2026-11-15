/**
 * Reusable Admin class-order controller (`ترتيب الشعب والصفوف`) shared between
 * the Master Timetable drawer and School Structure board.
 */
import { ArrowDown, ArrowUp, ArrowUpDown, Sparkles } from 'lucide-react';
import type { Language } from '../i18n';
import type { SchoolClass } from '../types';

export function ClassSortBar({
  classes,
  lang,
  busy,
  mutate,
}: {
  classes: SchoolClass[];
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}) {
  const ar = lang === 'ar';
  if (classes.length < 2) return null;

  const move = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= classes.length) return;
    const copy = [...classes];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    void mutate(
      '/classes/reorder',
      { mode: 'manual', classIds: copy.map((c) => c.id) },
      ar ? 'تم حفظ ترتيب الشعب في الجدول' : 'Class order saved',
    );
  };

  return (
    <div className="class-sort-box">
      <div className="row-between">
        <span className="wui-drawer-section-title">
          <ArrowUpDown size={13} />
          {ar ? 'ترتيب الشعب في الجدول' : 'Class Order in Timetable'}
        </span>
        <button
          type="button"
          className="chip-pill"
          disabled={busy}
          onClick={() =>
            void mutate(
              '/classes/reorder',
              { mode: 'auto' },
              ar ? 'تم ترتيب الصفوف تلقائياً' : 'Classes sorted by grade',
            )
          }
        >
          <Sparkles size={12} />
          {ar ? 'ترتيب تلقائي حسب الصف' : 'Auto-sort by grade'}
        </button>
      </div>
      <div className="class-sort-list">
        {classes.map((cls, idx) => (
          <div className="class-sort-row" key={cls.id}>
            <span className="class-sort-num">{idx + 1}</span>
            <strong>{cls.name}</strong>
            <div className="class-sort-arrows">
              <button
                type="button"
                className="mini-icon-btn"
                aria-label={ar ? `رفع ${cls.name}` : `Move ${cls.name} up`}
                disabled={busy || idx === 0}
                onClick={() => move(idx, -1)}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                className="mini-icon-btn"
                aria-label={ar ? `خفض ${cls.name}` : `Move ${cls.name} down`}
                disabled={busy || idx === classes.length - 1}
                onClick={() => move(idx, 1)}
              >
                <ArrowDown size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
