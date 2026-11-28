/**
 * Principal's Office floating command center: modular KPI header and 4 spacious tabs
 * covering Classes/Lead Teachers/3D Rooms, Teachers & Wings, Student Enrollment & Directory,
 * and School Subjects & Bell Timings.
 */
import { useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Language } from '../i18n';
import { useGsapStagger } from '../spatial/editor/editorMotion';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import type { CampusLayout, State } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { SegmentedTabs } from './SegmentedTabs';
import { PrincipalClassesTab } from './principal/PrincipalClassesTab';
import { PrincipalSchoolTab } from './principal/PrincipalSchoolTab';
import { PrincipalStudentsTab } from './principal/PrincipalStudentsTab';
import { PrincipalTeachersTab } from './principal/PrincipalTeachersTab';

interface PrincipalOfficeWindowProps {
  room: ResolvedSpatialRoom;
  rooms: ResolvedSpatialRoom[];
  layout: CampusLayout;
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  onEditRoom: (room: ResolvedSpatialRoom) => void;
  onOpenStudentProfile: (studentId: string) => void;
  onOpenSchedule?: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

type PrincipalTab = 'classes' | 'teachers' | 'students' | 'school';

/** Clean, spacious Apple-grade Principal Command Center over the 3D campus. */
export function PrincipalOfficeWindow({
  room,
  rooms,
  layout,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  onFlyToRoom,
  onEditRoom,
  onOpenStudentProfile,
  onOpenSchedule,
  mutate,
}: PrincipalOfficeWindowProps) {
  const ar = lang === 'ar';
  const [tab, setTab] = useState<PrincipalTab>('classes');
  const paneRef = useRef<HTMLDivElement>(null);

  useGsapStagger(paneRef, '.sp-info-row, .sp-inline-box, .sp-po-teacher-card', [tab], {
    y: 8,
    stagger: 0.02,
    duration: 0.22,
  });

  const kpis: { id: PrincipalTab; count: number; label: string }[] = [
    { id: 'classes', count: data.classes.length, label: ar ? 'الشعب' : 'Classes' },
    { id: 'teachers', count: data.teachers.length, label: ar ? 'المعلمون' : 'Teachers' },
    { id: 'students', count: data.students.length, label: ar ? 'الطلبة' : 'Students' },
    { id: 'school', count: data.subjects.length, label: ar ? 'المواد' : 'Subjects' },
  ];

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={ar ? 'مكتب المدير — القيادة المدرسية' : `${room.label} — Command Center`}
      subtitle={data.school.name}
      dock="right"
      width={590}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
      headerActions={
        onOpenSchedule ? (
          <button
            type="button"
            className="sp-btn-soft"
            onClick={onOpenSchedule}
            title={ar ? 'فتح الجدول الرئيسي للمدرسة' : 'Open Master Schedule'}
          >
            <CalendarDays size={14} />
            <span>{ar ? 'الجدول الرئيسي' : 'Schedule'}</span>
          </button>
        ) : undefined
      }
    >
      <div className="sp-po-kpi-strip">
        {kpis.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`sp-po-kpi-btn ${tab === k.id ? 'is-active' : ''}`}
            onClick={() => setTab(k.id)}
          >
            <strong>{k.count}</strong>
            <small>{k.label}</small>
          </button>
        ))}
      </div>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'classes', label: ar ? 'الشعب والغرف' : 'Classes & 3D' },
          { id: 'teachers', label: ar ? 'المعلمون' : 'Teachers' },
          { id: 'students', label: ar ? 'الطلبة' : 'Students' },
          { id: 'school', label: ar ? 'المواد والدوام' : 'School & Bell' },
        ]}
      />

      <div ref={paneRef} className="sp-tab-pane">
        {tab === 'classes' && (
          <PrincipalClassesTab
            rooms={rooms}
            data={data}
            lang={lang}
            busy={busy}
            onFlyToRoom={onFlyToRoom}
            onEditRoom={onEditRoom}
            mutate={mutate}
          />
        )}
        {tab === 'teachers' && (
          <PrincipalTeachersTab layout={layout} data={data} lang={lang} busy={busy} mutate={mutate} />
        )}
        {tab === 'students' && (
          <PrincipalStudentsTab
            rooms={rooms}
            data={data}
            lang={lang}
            busy={busy}
            onFlyToRoom={onFlyToRoom}
            onOpenStudentProfile={onOpenStudentProfile}
            mutate={mutate}
          />
        )}
        {tab === 'school' && (
          <PrincipalSchoolTab data={data} lang={lang} busy={busy} mutate={mutate} />
        )}
      </div>
    </FloatingWindow>
  );
}
