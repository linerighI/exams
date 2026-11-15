/**
 * WinUI 3 Acrylic Side Drawer for Schedule Management: encapsulates active clock
 * overview, class/section filtering pills, collapsible bell settings, and quick presets.
 */
import type { FormEvent } from 'react';
import { Filter, Settings2 } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock, type PeriodSlot } from '../jordanTime';
import { WinExpander, WinInfoBar, WinSideDrawer } from '../schoolsync-ui';
import type { State } from '../types';
import { BellSettingsForm } from './ScheduleForms';
import { ClassSortBar } from './ClassSortBar';

export function ScheduleToolsDrawer({
  open,
  onClose,
  data,
  lang,
  manager,
  busy,
  mutate,
  endStr,
  slots,
  allSections,
  selectedSection,
  onSelectSection,
  showBell,
  onSaveBell,
  onQuickAddClass,
}: {
  open: boolean;
  onClose: () => void;
  data: State;
  lang: Language;
  manager: boolean;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  endStr: string;
  slots: PeriodSlot[];
  allSections: string[];
  selectedSection: string;
  onSelectSection: (section: string) => void;
  showBell: boolean;
  onSaveBell: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onQuickAddClass: (preset: string) => void;
}) {
  const ar = lang === 'ar';

  return (
    <WinSideDrawer
      open={open}
      onClose={onClose}
      title={ar ? 'أدوات الجدول والفلاتر' : 'Schedule Tools & Filters'}
      subtitle={ar ? 'صفّ الشعب واضبط التوقيت من القائمة الجانبية' : 'Filter sections and configure bell timing'}
    >
      <WinInfoBar
        tone="info"
        title={ar ? 'التوقيت النشط حالياً' : 'Active Schedule Hours'}
        message={`${formatClock(data.school.start_time, lang)} – ${formatClock(endStr, lang)} (${ar ? `${slots.length} حصص يومياً` : `${slots.length} periods`})`}
      />

      {allSections.length > 0 && (
        <div className="wui-drawer-section">
          <span className="wui-drawer-section-title">
            <Filter size={13} /> {ar ? 'تصفية حسب الشعبة' : 'Filter by class'}
          </span>
          <div className="chip-row">
            <button
              type="button"
              className={`chip-pill ${selectedSection === 'all' ? 'selected' : ''}`}
              onClick={() => onSelectSection('all')}
            >
              {ar ? `كل الشعب (${allSections.length})` : `All (${allSections.length})`}
            </button>
            {allSections.map((sec) => (
              <button
                type="button"
                key={sec}
                className={`chip-pill ${selectedSection === sec ? 'selected' : ''}`}
                onClick={() => onSelectSection(sec)}
              >
                {sec}
              </button>
            ))}
          </div>
        </div>
      )}

      {manager && (
        <>
          <ClassSortBar classes={data.classes} lang={lang} busy={busy} mutate={mutate} />
          <WinExpander
            title={ar ? 'إعدادات التوقيت والحصص' : 'Bell & Period Timing'}
            subtitle={ar ? 'بداية الدوام، مدة الحصة، الاستراحة' : 'Start hour, duration & breaks'}
            icon={<Settings2 size={16} />}
            defaultOpen={showBell}
          >
            <BellSettingsForm
              school={data.school}
              lang={lang}
              busy={busy}
              onSubmit={onSaveBell}
              onClose={onClose}
              embedded
            />
          </WinExpander>
        </>
      )}

      {!allSections.length && manager && (
        <div className="wui-drawer-section">
          <span className="wui-drawer-section-title">{ar ? 'إضافة شعبة سريعة:' : 'Quick-add section:'}</span>
          <div className="chip-row">
            {['الصف الثامن - أ', 'الصف التاسع - أ', 'الصف التاسع - ب', 'الصف العاشر - أ'].map((preset) => (
              <button
                key={preset}
                type="button"
                className="chip-pill"
                disabled={busy}
                onClick={() => onQuickAddClass(preset)}
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>
      )}
    </WinSideDrawer>
  );
}
