/**
 * Clean minimal Apple frosted-glass view for parked Parent/Student accounts
 * (3D family avatar intentionally removed per user scope refocus on Admin & Teacher campus).
 */
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Award, BookOpen, Calendar, CheckCircle2, MessageSquare } from 'lucide-react';
import type { Language } from '../i18n';
import type { State } from '../types';
import { FamilyDetailWindow, type FamilyPanelSection } from './FamilyDetailWindow';
import { FloatingWindow } from './FloatingWindow';

interface FamilySummaryWindowProps {
  data: State;
  lang: Language;
  busy: boolean;
  activeSection: FamilyPanelSection | null;
  onSelectSection: Dispatch<SetStateAction<FamilyPanelSection | null>>;
  onSelectChild: (studentId: string) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Lightweight glass portal card for Parent/Student accounts until family redesign. */
export function FamilySummaryWindow({
  data,
  lang,
  busy,
  activeSection,
  onSelectSection,
  onSelectChild,
  mutate,
}: FamilySummaryWindowProps) {
  const st = data.student;
  const cards: { key: FamilyPanelSection; ar: string; en: string; icon: ReactNode }[] = [
    { key: 'attendance', ar: 'الحضور والغياب', en: 'Attendance', icon: <CheckCircle2 size={15} /> },
    { key: 'schedule', ar: 'الجدول المدرسي', en: 'Timetable', icon: <Calendar size={15} /> },
    { key: 'grades', ar: 'العلامات', en: 'Grades', icon: <Award size={15} /> },
    { key: 'homework', ar: 'الواجبات', en: 'Homework', icon: <BookOpen size={15} /> },
    { key: 'notes', ar: 'الملاحظات', en: 'Notes', icon: <MessageSquare size={15} /> },
  ];

  return (
    <>
      <FloatingWindow
        id="family-summary"
        title={st?.name || data.user.name}
        subtitle={st ? `${lang === 'ar' ? 'الشعبة' : 'Section'}: ${st.section}` : data.school.name}
        dock="left"
        width={390}
        zIndex={34}
        onFocus={() => {}}
      >
        {data.students.length > 1 && (
          <div className="sp-chip-grid">
            {data.students.map((child) => (
              <button
                key={child.id}
                type="button"
                className={`sp-toggle-chip ${child.id === st?.id ? 'is-active' : ''}`}
                onClick={() => onSelectChild(child.id)}
              >
                {child.name}
              </button>
            ))}
          </div>
        )}
        <div className="sp-list-stack">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              className="sp-info-row"
              onClick={() => onSelectSection(c.key)}
            >
              <span className="sp-student-name-btn">
                {c.icon}
                <span>{lang === 'ar' ? c.ar : c.en}</span>
              </span>
            </button>
          ))}
        </div>
      </FloatingWindow>

      {activeSection && (
        <FamilyDetailWindow
          section={activeSection}
          data={data}
          lang={lang}
          busy={busy}
          onClose={() => onSelectSection(null)}
          mutate={mutate}
        />
      )}
    </>
  );
}
