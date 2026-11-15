/**
 * Family & Student Homework (`الواجبات`) screen with pending/submitted filter.
 */
import { useRef, useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { words, type Language } from '../i18n';
import { useSlidingPill, useStaggerGrid } from '../schoolsync-ui';
import { tr } from '../translations';
import type { Homework, State } from '../types';
import { Empty } from '../ui';

export function HomeworkScreen({
  data,
  lang,
  openWork,
  preview = false,
}: {
  data: State;
  lang: Language;
  openWork: (work: Homework) => void;
  preview?: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const tabRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const ar = lang === 'ar';
  const t = words[lang];
  const family = data.user.role === 'parent' || preview;
  const items = data.homework.filter((h) =>
    filter === 'all' ? true : filter === 'pending' ? !h.submission : Boolean(h.submission),
  );
  useSlidingPill(tabRef, 'button.selected', [filter, ar]);
  useStaggerGrid(listRef, '.homework-card', [filter, items.length]);

  return (
    <>
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{tr('STEP BY STEP')}</div>
        <h1>
          {t.homework}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {family
            ? ar
              ? `واجبات ${data.student?.name.split(' ')[0] || 'الطالب'} ومواعيد تسليمها.`
              : 'Track assignments and submissions.'
            : t.tasks}
        </p>
      </div>
      <div ref={tabRef} className="segmented t-pill-track" data-reveal>
        {(['all', 'pending', 'done'] as const).map((f) => (
          <button className={filter === f ? 'selected' : ''} key={f} onClick={() => setFilter(f)}>
            {t[f]}
          </button>
        ))}
      </div>
      <div ref={listRef} className="homework-list" data-reveal>
        {items.map((h) => (
          <button key={h.id} className={`homework-card t-surface ${h.color}`} onClick={() => openWork(h)}>
            <div className="card-top">
              <span className="eyebrow dark">{tr(h.subject)}</span>
              <span className="small-pill">{h.submission ? t.done : h.due}</span>
            </div>
            <h3>{h.title}</h3>
            <p>{h.description}</p>
            <span className="card-cta">
              <BookOpen size={15} />
              {h.submission ? (ar ? 'عرض الحل المسلم' : 'View submission') : ar ? 'عرض التفاصيل' : 'Open details'}
              <ArrowUpRight size={15} />
            </span>
          </button>
        ))}
      </div>
      {!items.length && (
        <Empty
          title={tr('All caught up')}
          detail={ar ? 'لا توجد واجبات في هذا التصنيف حالياً.' : 'No homework items match this filter.'}
        />
      )}
    </>
  );
}
