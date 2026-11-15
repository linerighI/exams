/**
 * Collapsible updates panel for the Family Today screen housing teacher notes,
 * school notices, and pending homework items without cluttering the initial view.
 */
import { ArrowUpRight, BookOpen, Sparkles, Volume2 } from 'lucide-react';
import type { Language } from '../i18n';
import { WinExpander } from '../schoolsync-ui';
import { tr } from '../translations';
import type { Homework, State } from '../types';

interface TodayUpdatesProps {
  data: State;
  lang: Language;
  preview: boolean;
  pending: Homework[];
  go: (tab: string) => void;
  openNotice: () => void;
  openWork: (work: Homework) => void;
}

export function TodayUpdatesExpander({
  data,
  lang,
  preview,
  pending,
  go,
  openNotice,
  openWork,
}: TodayUpdatesProps) {
  const ar = lang === 'ar';
  const note = data.notes[0];
  const announcement = data.announcements[0];
  const visibleWork = preview ? [] : pending.slice(0, 2);
  const count = (note ? 1 : 0) + (announcement ? 1 : 0) + visibleWork.length;

  if (!count) return null;

  return (
    <WinExpander
      title={ar ? 'آخر التحديثات والواجبات' : 'Updates, Notes & Homework'}
      subtitle={ar ? 'افتح للاطلاع أو تصفّح الكل من القائمة الجانبية' : 'Open summary or browse from sidebar'}
      badge={count}
      icon={<Sparkles size={16} />}
      defaultOpen={false}
    >
      <div className="form-stack">
        {note && (
          <button className="teacher-note t-surface" onClick={() => go('notes')}>
            <span className="note-star">
              <Sparkles size={20} />
            </span>
            <span>
              <small>
                {note.category === 'behavior'
                  ? ar ? 'ملاحظة سلوكية' : 'Behavior note'
                  : ar ? 'ملاحظة المعلم' : 'Teacher note'}
              </small>
              <p>{note.content}</p>
              <strong>{note.author}</strong>
            </span>
          </button>
        )}

        {announcement && (
          <button className="announcement t-surface" onClick={openNotice}>
            <span className="announcement-art">
              <Volume2 size={24} />
            </span>
            <span className="row-copy">
              <small>{ar ? 'تعميم المدرسة' : 'SCHOOL NOTICE'}</small>
              <strong>{announcement.title}</strong>
            </span>
            <ArrowUpRight size={18} />
          </button>
        )}

        {visibleWork.map((h) => (
          <button key={h.id} className="homework-row t-stagger-row" onClick={() => openWork(h)}>
            <span className={`task-check ${h.color}`}>
              <BookOpen size={17} />
            </span>
            <span className="row-copy">
              <small className="subject-label">{tr(h.subject)}</small>
              <strong>{h.title}</strong>
            </span>
            <ArrowUpRight size={18} />
          </button>
        ))}
      </div>
    </WinExpander>
  );
}
