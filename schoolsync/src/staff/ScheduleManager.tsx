/**
 * Jordanian Period 1–8 Schedule Manager & Viewer (`الجدول`): provides a
 * master class×period matrix, period timeline cards, official printable view,
 * bell timing settings, and smart 3-tap lesson assignment.
 */
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Clock, FileSpreadsheet, LayoutGrid, Plus, Rows3, SlidersHorizontal } from 'lucide-react';
import { isManagerRole } from '../experience';
import type { Language } from '../i18n';
import { buildPeriodSlots, formatClock, JORDAN_WEEKDAYS, liveDayPulse, weekdayOfDate } from '../jordanTime';
import { WinButton, WinCommandBar, WinInfoBar, useSlidingPill } from '../schoolsync-ui';
import type { State } from '../types';
import { LessonAssignDrawer } from './ScheduleForms';
import { ScheduleToolsDrawer } from './ScheduleToolsDrawer';
import { ScheduleViews, type ScheduleViewMode } from './ScheduleViews';

export function ScheduleManager({
  data,
  lang,
  mutate,
  busy,
}: {
  data: State;
  lang: Language;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const ar = lang === 'ar';
  const manager = isManagerRole(data.user.role);
  const defaultDay = weekdayOfDate(data.date);
  const [weekday, setWeekday] = useState(defaultDay <= 4 ? defaultDay : 0);
  const [selectedSection, setSelectedSection] = useState('all');
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('grid');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBell, setShowBell] = useState(false);
  const [target, setTarget] = useState<{ section: string; periodNumber: number } | null>(null);
  const [pickedSubject, setPickedSubject] = useState('');
  const viewTabsRef = useRef<HTMLDivElement>(null);
  const dayStripRef = useRef<HTMLDivElement>(null);
  useSlidingPill(viewTabsRef, 'button.selected', [viewMode, ar]);
  useSlidingPill(dayStripRef, 'button.selected', [weekday, ar]);

  const slots = useMemo(() => buildPeriodSlots(data.school), [data.school]);
  const lessons = data.schoolWorkspace?.lessons || [];
  const allSections = useMemo(() => {
    const ordered = data.classes.map((c) => c.name);
    const seen = new Set(ordered);
    for (const st of data.students) {
      if (st.section && !seen.has(st.section)) {
        seen.add(st.section);
        ordered.push(st.section);
      }
    }
    return ordered;
  }, [data.classes, data.students]);
  const visibleSections = useMemo(
    () => (selectedSection === 'all' ? allSections : allSections.filter((s) => s === selectedSection)),
    [allSections, selectedSection],
  );

  const dayLessons = useMemo(
    () => lessons.filter((l) => l.weekday === weekday && (selectedSection === 'all' || l.section === selectedSection)),
    [lessons, weekday, selectedSection],
  );
  const pulse = liveDayPulse(data, dayLessons);
  const activePeriod = weekday === defaultDay && pulse.activeSlot ? pulse.activeSlot.periodNumber : null;

  const targetSection = target?.section || (selectedSection === 'all' ? allSections[0] || '' : selectedSection);
  const targetSlot = slots.find((s) => s.periodNumber === target?.periodNumber);
  const targetClassMeta = data.classes.find((c) => c.name === targetSection);

  const assignableTeachers = useMemo(() => {
    const matching = data.teachers.filter((t) => !targetSection || t.classes.includes(targetSection));
    return matching.length ? matching : data.teachers;
  }, [data.teachers, targetSection]);

  const subjectOptions = useMemo(() => {
    const names = new Set<string>(data.subjects.map((s) => s.name));
    for (const l of lessons) names.add(l.subject);
    if (!names.size) {
      for (const def of ['اللغة العربية', 'الرياضيات', 'اللغة الإنجليزية', 'العلوم', 'التربية الإسلامية']) {
        names.add(def);
      }
    }
    return [...names];
  }, [data.subjects, lessons]);

  const saveBell = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await mutate(
        '/school',
        {
          name: data.school.name,
          timezone: data.school.timezone,
          start: String(f.get('start')),
          end: String(f.get('end')),
          periodMinutes: Number(f.get('periodMinutes')),
          breakMinutes: Number(f.get('breakMinutes')),
          periodCount: Number(f.get('periodCount')),
          dutyNotes: String(f.get('dutyNotes') || ''),
        },
        ar ? 'تم حفظ توقيت الحصص المدرسي' : 'Bell schedule updated',
      )
    ) {
      setShowBell(false);
      setDrawerOpen(false);
    }
  };

  const addLesson = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!target || !targetSlot) return;
    const f = new FormData(e.currentTarget);
    const subjectVal = pickedSubject || String(f.get('subject') || '');
    if (
      await mutate(
        '/lessons',
        {
          section: String(f.get('section') || target.section),
          teacherId: String(f.get('teacherId')),
          subject: subjectVal,
          room: String(f.get('room') || targetClassMeta?.room || 'القاعة ١٠١'),
          weekday,
          periodNumber: target.periodNumber,
          start: targetSlot.start,
          end: targetSlot.end,
        },
        ar ? 'تمت إضافة الحصة للجدول' : 'Lesson added',
      )
    ) {
      setTarget(null);
      setPickedSubject('');
    }
  };

  const weekdayObj = JORDAN_WEEKDAYS.find((d) => d.id === weekday) || JORDAN_WEEKDAYS[0];

  return (
    <div className="schedule-manager">
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{ar ? 'النظام الأردني · الأحد – الخميس' : 'JORDANIAN BELL SCHEDULE'}</div>
        <h1>
          {ar ? 'الجدول الرئيسي' : 'Timetable'}
          <span className="greeting-dot">.</span>
        </h1>
      </div>

      <WinCommandBar
        title={selectedSection === 'all' ? (ar ? `كل الشعب (${allSections.length})` : `All Classes (${allSections.length})`) : selectedSection}
        subtitle={`${formatClock(data.school.start_time, lang)} – ${formatClock(pulse.endStr, lang)} · ${ar ? `${slots.length} حصص` : `${slots.length} periods`}`}
        actions={
          <>
            {manager && (
              <WinButton
                variant="accent"
                onClick={() => {
                  setPickedSubject(subjectOptions[0] || '');
                  setTarget({ section: allSections[0] || 'الصف التاسع - أ', periodNumber: slots[0]?.periodNumber || 1 });
                }}
              >
                <Plus size={15} />
                {ar ? 'تعيين حصة' : 'Assign'}
              </WinButton>
            )}
            <WinButton
              variant="standard"
              badge={selectedSection !== 'all' ? 1 : 0}
              onClick={() => setDrawerOpen(true)}
            >
              <SlidersHorizontal size={15} />
              {ar ? 'الفلاتر والإعدادات' : 'Tools & Filters'}
            </WinButton>
          </>
        }
      />

      <ScheduleToolsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={data}
        lang={lang}
        manager={manager}
        busy={busy}
        mutate={mutate}
        endStr={pulse.endStr}
        slots={slots}
        allSections={allSections}
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
        showBell={showBell}
        onSaveBell={saveBell}
        onQuickAddClass={(preset) =>
          void mutate('/classes', { name: preset, location: 'المبنى الرئيسي', room: 'قاعة ١٠١' }, ar ? 'تمت إضافة الشعبة' : 'Class added')
        }
      />

      <div className="schedule-control-bar" data-reveal>
        <div ref={viewTabsRef} className="segmented view-mode-tabs t-pill-track" role="tablist">
          <button className={viewMode === 'grid' ? 'selected' : ''} onClick={() => setViewMode('grid')}>
            <LayoutGrid size={14} />
            {ar ? 'الجدول العام' : 'Matrix'}
          </button>
          <button className={viewMode === 'cards' ? 'selected' : ''} onClick={() => setViewMode('cards')}>
            <Rows3 size={14} />
            {ar ? 'بطاقات الحصص' : 'Periods'}
          </button>
          <button className={viewMode === 'official' ? 'selected' : ''} onClick={() => setViewMode('official')}>
            <FileSpreadsheet size={14} />
            {ar ? 'النسخة الرسمية' : 'Official'}
          </button>
        </div>

        <div ref={dayStripRef} className="schedule-day-strip t-pill-track t-pill-track-primary">
          {JORDAN_WEEKDAYS.map((d) => {
            const count = lessons.filter((l) => l.weekday === d.id).length;
            return (
              <button
                key={d.id}
                className={`day-tab-btn ${weekday === d.id ? 'selected' : ''}`}
                onClick={() => setWeekday(d.id)}
              >
                <span>{ar ? d.ar : d.en}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </div>
      </div>

      {!allSections.length && manager && (
        <WinInfoBar
          tone="warn"
          title={ar ? 'لم تتم إضافة شعب بعد' : 'No classes configured yet'}
          message={ar ? 'افتح الفلاتر والإعدادات لإضافة شعب بضغطة واحدة أو من شاشة الإدارة.' : 'Open Tools & Filters to add starter classes.'}
          action={
            <WinButton variant="accent" onClick={() => setDrawerOpen(true)}>
              <Clock size={14} />
              {ar ? 'تهيئة سريعة' : 'Quick Setup'}
            </WinButton>
          }
        />
      )}

      {target && targetSlot && manager && (
        <LessonAssignDrawer
          lang={lang}
          busy={busy}
          weekdayLabel={ar ? weekdayObj.ar : weekdayObj.en}
          targetSection={target.section}
          targetSlot={targetSlot}
          targetClassMeta={targetClassMeta}
          allSections={allSections}
          assignableTeachers={assignableTeachers}
          subjectOptions={subjectOptions}
          pickedSubject={pickedSubject}
          setPickedSubject={setPickedSubject}
          dayLessons={dayLessons}
          onChangeSection={(sec) => setTarget({ ...target, section: sec })}
          onSubmit={addLesson}
          onClose={() => setTarget(null)}
        />
      )}

      <ScheduleViews
        mode={visibleSections.length ? viewMode : 'cards'}
        data={data}
        lang={lang}
        manager={manager}
        busy={busy}
        weekdayLabel={ar ? weekdayObj.ar : weekdayObj.en}
        sections={visibleSections}
        slots={slots}
        dayLessons={dayLessons}
        activePeriod={activePeriod}
        onPickSlot={(section, periodNumber) => {
          setPickedSubject(subjectOptions[0] || '');
          setTarget({ section: section || 'الصف التاسع - أ', periodNumber });
        }}
        onDeleteLesson={(id) => void mutate(`/lessons/${id}/delete`, {}, ar ? 'تم حذف الحصة' : 'Lesson deleted')}
      />
    </div>
  );
}
