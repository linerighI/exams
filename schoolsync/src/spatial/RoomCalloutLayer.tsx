/**
 * Floating 3D-projected room pills and Apple-style hover callout card showing the
 * active period's live teacher, subject, and attendance ratio over the 3D campus.
 */
import type { MutableRefObject } from 'react';
import { Pencil, Sparkles } from 'lucide-react';
import type { Language } from '../i18n';
import { minutesOf, nowMinutesInZone, weekdayOfDate } from '../jordanTime';
import type { Lesson, State } from '../types';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from './roomCatalog';

export interface RoomLiveSnapshot {
  activeLesson: Lesson | null;
  nextLesson: Lesson | null;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
}

/** Compute who is teaching in a classroom right now and live daily attendance counts. */
export function getRoomLiveSnapshot(room: ResolvedSpatialRoom, data: State | null): RoomLiveSnapshot {
  if (!data || !room.className) {
    return { activeLesson: null, nextLesson: null, totalStudents: 0, presentCount: 0, absentCount: 0 };
  }
  const allLessons = data.schoolWorkspace?.lessons || data.lessons || [];
  const weekday = weekdayOfDate(data.date);
  const nowMin = nowMinutesInZone(data.school.timezone);
  const todays = allLessons
    .filter((l) => l.section === room.className && l.weekday === weekday)
    .sort((a, b) => a.start.localeCompare(b.start));

  const activeLesson =
    todays.find((l) => minutesOf(l.start) <= nowMin && minutesOf(l.end) > nowMin) || null;
  const nextLesson = todays.find((l) => minutesOf(l.start) > nowMin) || null;

  const roster = data.students.filter((s) => s.section === room.className);
  const presentCount = roster.filter((s) => s.today_status === 'present').length;
  const absentCount = roster.filter((s) => s.today_status === 'absent').length;

  return {
    activeLesson,
    nextLesson,
    totalStudents: roster.length,
    presentCount,
    absentCount,
  };
}

interface RoomCalloutLayerProps {
  rooms: ResolvedSpatialRoom[];
  floor: FloorFilter;
  access: TeacherAccess;
  hoveredRoom: ResolvedSpatialRoom | null;
  selectedSlotId: string | null;
  editLabelsMode: boolean;
  data: State | null;
  lang: Language;
  pillRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  calloutRef: MutableRefObject<HTMLDivElement | null>;
  onHoverRoom: (room: ResolvedSpatialRoom | null) => void;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  onEditRoom: (room: ResolvedSpatialRoom) => void;
}

const KIND_SUBTITLE_AR: Record<string, string> = {
  principal: 'الإدارة العامة والجدول',
  teachers: 'متابعة المعلمين الآن',
  reception: 'شؤون الطلبة والتسجيل',
  counselor: 'الحضور اليومي والحالات',
  auditorium: 'الإعلانات المدرسية',
  library: 'النسخ الاحتياطي والبيانات',
  lab: 'مختبر التقنية والشبكة',
  courtyard: 'نبض المدرسة المباشر',
};

const KIND_SUBTITLE_EN: Record<string, string> = {
  principal: 'School & Bell Settings',
  teachers: 'Live Teacher Radar',
  reception: 'Enrollment & Directory',
  counselor: 'Absences & Incidents',
  auditorium: 'School Announcements',
  library: 'Database & Backups',
  lab: 'Lab & Network Status',
  courtyard: 'Live School Pulse',
};

/** Renders floating 3D-tracked room pills and hover detail callout cards. */
export function RoomCalloutLayer({
  rooms,
  floor,
  access,
  hoveredRoom,
  selectedSlotId,
  editLabelsMode,
  data,
  lang,
  pillRefs,
  calloutRef,
  onHoverRoom,
  onSelectRoom,
  onEditRoom,
}: RoomCalloutLayerProps) {
  const visibleRooms = data
    ? rooms.filter((r) => {
        if (floor !== 'all' && r.floorId !== floor) return false;
        if (access.restricted && !access.allowedSlots.has(r.slotId)) return false;
        return r.kind !== 'corridor';
      })
    : [];

  const live = hoveredRoom ? getRoomLiveSnapshot(hoveredRoom, data) : null;
  const fallbackTeacher =
    hoveredRoom?.className && data
      ? data.teachers.find((t) => t.classes.includes(hoveredRoom.className))
      : null;

  return (
    <div className="sp-callout-layer" aria-hidden={!data}>
      {visibleRooms.map((room) => {
        const isSelected = room.slotId === selectedSlotId;
        const isHovered = hoveredRoom?.slotId === room.slotId;
        return (
          <button
            key={room.slotId}
            type="button"
            ref={(el) => {
              if (el) pillRefs.current.set(room.slotId, el);
              else pillRefs.current.delete(room.slotId);
            }}
            className={`sp-room-pill ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''} ${
              room.kind !== 'classroom' ? 'is-special' : ''
            } ${room.roomState && room.roomState !== 'normal' ? `has-state-${room.roomState}` : ''}`}
            onMouseEnter={() => onHoverRoom(room)}
            onMouseLeave={() => onHoverRoom(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (editLabelsMode) onEditRoom(room);
              else onSelectRoom(room);
            }}
          >
            {room.roomState && room.roomState !== 'normal' && (
              <i className={`sp-room-state-dot is-${room.roomState}`} />
            )}
            <span>{room.label}</span>
            {editLabelsMode && <Pencil size={11} className="sp-pill-edit" />}
          </button>
        );
      })}

      <div
        ref={calloutRef}
        className={`sp-hover-callout ${hoveredRoom ? 'is-visible' : ''}`}
      >
        {hoveredRoom && live && (
          <div className="sp-callout-card">
            <div className="sp-callout-stem" />
            <div className="sp-callout-head">
              <strong>{hoveredRoom.label}</strong>
              {live.activeLesson ? (
                <span className="sp-live-badge">
                  <i />
                  {lang === 'ar' ? 'الحصة الحالية' : 'Live'}
                </span>
              ) : hoveredRoom.kind === 'classroom' && hoveredRoom.className ? (
                <span className="sp-count-badge">
                  {live.totalStudents} {lang === 'ar' ? 'طالب' : 'students'}
                </span>
              ) : (
                <span className="sp-count-badge">
                  <Sparkles size={11} />
                </span>
              )}
            </div>

            {hoveredRoom.kind === 'classroom' ? (
              <div className="sp-callout-body">
                {live.activeLesson ? (
                  <p className="sp-callout-line is-primary">
                    {live.activeLesson.teacher} · {live.activeLesson.subject}
                  </p>
                ) : live.nextLesson ? (
                  <p className="sp-callout-line">
                    {lang === 'ar' ? 'الحصة القادمة: ' : 'Next: '}
                    {live.nextLesson.teacher} · {live.nextLesson.subject}
                  </p>
                ) : fallbackTeacher ? (
                  <p className="sp-callout-line">
                    {lang === 'ar' ? 'مربي الصف: ' : 'Homeroom: '}
                    {fallbackTeacher.name}
                  </p>
                ) : (
                  <p className="sp-callout-line">
                    {hoveredRoom.className
                      ? lang === 'ar'
                        ? 'اضغط لعرض الطلبة والجدول'
                        : 'Click for roster & schedule'
                      : lang === 'ar'
                        ? 'قاعة متاحة للتخصيص'
                        : 'Available room'}
                  </p>
                )}
                {live.totalStudents > 0 && (
                  <div className="sp-callout-stats">
                    <span className="is-green">
                      {lang === 'ar' ? `حاضر ${live.presentCount}` : `${live.presentCount} present`}
                    </span>
                    <span className="is-coral">
                      {lang === 'ar'
                        ? `غائب ${live.absentCount} (${Math.round((live.absentCount / live.totalStudents) * 100)}%)`
                        : `${live.absentCount} absent (${Math.round((live.absentCount / live.totalStudents) * 100)}%)`}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="sp-callout-line">
                {lang === 'ar'
                  ? KIND_SUBTITLE_AR[hoveredRoom.kind] || 'اضغط لفتح النافذة'
                  : KIND_SUBTITLE_EN[hoveredRoom.kind] || 'Click to open'}
              </p>
            )}
            {(hoveredRoom.stateNote || (hoveredRoom.roomState && hoveredRoom.roomState !== 'normal')) && (
              <p className="sp-callout-note">
                {hoveredRoom.stateNote ||
                  (lang === 'ar'
                    ? `الحالة: ${hoveredRoom.roomState}`
                    : `State: ${hoveredRoom.roomState}`)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
