/**
 * WinUI 3 Acrylic Filter Drawer for the Staff Student Roster screen.
 * Separates Class/Section and Present/Absent status filters off the main list.
 */
import { Filter } from 'lucide-react';
import type { Language } from '../i18n';
import { WinInfoBar, WinSideDrawer } from '../schoolsync-ui';

export function StudentsFilterDrawer({
  open,
  onClose,
  lang,
  totalCount,
  filteredCount,
  sections,
  section,
  onSelectSection,
  statusFilter,
  onSelectStatus,
}: {
  open: boolean;
  onClose: () => void;
  lang: Language;
  totalCount: number;
  filteredCount: number;
  sections: string[];
  section: string;
  onSelectSection: (sec: string) => void;
  statusFilter: 'all' | 'present' | 'absent';
  onSelectStatus: (status: 'all' | 'present' | 'absent') => void;
}) {
  const ar = lang === 'ar';

  return (
    <WinSideDrawer
      open={open}
      onClose={onClose}
      title={ar ? 'تصفية سجل الطلاب' : 'Filter Student Roster'}
      subtitle={ar ? 'اختر الشعبة وحالة الحضور المطلوبة' : 'Filter by section and today attendance status'}
    >
      <WinInfoBar
        tone="info"
        title={ar ? `النتائج الحالية: ${filteredCount} طالب` : `Showing ${filteredCount} students`}
      />
      <div className="wui-drawer-section">
        <span className="wui-drawer-section-title">
          <Filter size={13} /> {ar ? 'الشعبة / الصف' : 'Class / Section'}
        </span>
        <div className="chip-row">
          <button
            type="button"
            className={`chip-pill ${section === 'all' ? 'selected' : ''}`}
            onClick={() => onSelectSection('all')}
          >
            {ar ? `كل الشعب (${totalCount})` : `All (${totalCount})`}
          </button>
          {sections.map((sec) => (
            <button
              type="button"
              key={sec}
              className={`chip-pill ${section === sec ? 'selected' : ''}`}
              onClick={() => onSelectSection(sec)}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>
      <div className="wui-drawer-section">
        <span className="wui-drawer-section-title">{ar ? 'حالة الحضور اليوم' : 'Attendance status'}</span>
        <div className="chip-row">
          {(
            [
              ['all', ar ? 'الكل' : 'All'],
              ['present', ar ? 'الحاضرون' : 'Present'],
              ['absent', ar ? 'الغائبون فقط' : 'Absent only'],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={`chip-pill ${statusFilter === id ? 'selected' : ''}`}
              onClick={() => onSelectStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </WinSideDrawer>
  );
}
