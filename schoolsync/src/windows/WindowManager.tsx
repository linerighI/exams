/**
 * Manages stacked floating frosted-glass windows over the 3D campus without ever
 * changing routes or hiding the 3D viewport.
 */
import { useEffect } from 'react';
import type { Language } from '../i18n';
import { TeacherLiveWindow, type TrailPoint } from '../spatial/figures/TeacherLiveWindow';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import type { CampusLayout, State } from '../types';
import { AuditoriumWindow } from './AuditoriumWindow';
import { ClassroomWindow } from './ClassroomWindow';
import { ComputerLabWindow } from './ComputerLabWindow';
import { CounselorWindow } from './CounselorWindow';
import { CourtyardPulseWindow } from './CourtyardPulseWindow';
import { LibraryVaultWindow } from './LibraryVaultWindow';
import { PrincipalOfficeWindow } from './PrincipalOfficeWindow';
import { ReceptionWindow } from './ReceptionWindow';
import { RoomLabelEditor } from './RoomLabelEditor';
import { StudentProfileWindow } from './StudentProfileWindow';
import { TeachersRoomWindow } from './TeachersRoomWindow';

export interface WindowManagerProps {
  data: State;
  layout: CampusLayout;
  rooms: ResolvedSpatialRoom[];
  lang: Language;
  busy: boolean;
  offline: boolean;
  switching: boolean;
  openRoomSlotId: string | null;
  openStudentId: string | null;
  editingSlotId: string | null;
  openTeacherId: string | null;
  focusOrder: string[];
  onFocusWindow: (key: string) => void;
  onCloseRoom: () => void;
  onCloseStudent: () => void;
  onCloseEditor: () => void;
  onCloseTeacher: () => void;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  onOpenStudentProfile: (studentId: string) => void;
  onEditRoom: (room: ResolvedSpatialRoom) => void;
  onShowTeacherTrail: (points: TrailPoint[]) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}

/** Coordinates docked & draggable floating windows for rooms, teachers, students, and label editing. */
export function WindowManager({
  data,
  layout,
  rooms,
  lang,
  busy,
  offline,
  switching,
  openRoomSlotId,
  openStudentId,
  editingSlotId,
  openTeacherId,
  focusOrder,
  onFocusWindow,
  onCloseRoom,
  onCloseStudent,
  onCloseEditor,
  onCloseTeacher,
  onSelectRoom,
  onOpenStudentProfile,
  onEditRoom,
  onShowTeacherTrail,
  mutate,
  onRefresh,
}: WindowManagerProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editingSlotId) onCloseEditor();
      else if (openStudentId) onCloseStudent();
      else if (openTeacherId) onCloseTeacher();
      else if (openRoomSlotId) onCloseRoom();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingSlotId, openStudentId, openTeacherId, openRoomSlotId, onCloseEditor, onCloseStudent, onCloseTeacher, onCloseRoom]);

  const zFor = (key: string) => {
    const idx = focusOrder.indexOf(key);
    return 30 + (idx === -1 ? 0 : idx + 1);
  };

  const openRoom = openRoomSlotId ? rooms.find((r) => r.slotId === openRoomSlotId) || null : null;
  const editingRoom = editingSlotId ? rooms.find((r) => r.slotId === editingSlotId) || null : null;
  const liveTeacher = openTeacherId
    ? (data.teacherPresence || []).find((t) => t.teacher_id === openTeacherId) || null
    : null;

  const renderRoomWindow = (room: ResolvedSpatialRoom) => {
    const zIndex = zFor('room');
    const onFocus = () => onFocusWindow('room');
    switch (room.kind) {
      case 'teachers':
        return (
          <TeachersRoomWindow
            room={room}
            rooms={rooms}
            layout={layout}
            data={data}
            lang={lang}
            busy={busy}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            onFlyToRoom={onSelectRoom}
            mutate={mutate}
          />
        );
      case 'principal':
        return (
          <PrincipalOfficeWindow
            room={room}
            rooms={rooms}
            data={data}
            lang={lang}
            busy={busy}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            onFlyToRoom={onSelectRoom}
            onEditRoom={onEditRoom}
            mutate={mutate}
          />
        );
      case 'reception':
        return (
          <ReceptionWindow
            room={room}
            rooms={rooms}
            data={data}
            lang={lang}
            busy={busy}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            onFlyToRoom={onSelectRoom}
            onOpenStudentProfile={onOpenStudentProfile}
            mutate={mutate}
          />
        );
      case 'counselor':
        return (
          <CounselorWindow
            room={room}
            rooms={rooms}
            data={data}
            lang={lang}
            busy={busy}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            onFlyToRoom={onSelectRoom}
            onOpenStudentProfile={onOpenStudentProfile}
            mutate={mutate}
          />
        );
      case 'auditorium':
        return (
          <AuditoriumWindow
            room={room}
            data={data}
            lang={lang}
            busy={busy}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            mutate={mutate}
          />
        );
      case 'library':
        return (
          <LibraryVaultWindow
            room={room}
            lang={lang}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            onRefresh={onRefresh}
          />
        );
      case 'courtyard':
        return (
          <CourtyardPulseWindow
            room={room}
            rooms={rooms}
            data={data}
            lang={lang}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            onFlyToRoom={onSelectRoom}
          />
        );
      case 'lab':
        return (
          <ComputerLabWindow
            room={room}
            data={data}
            lang={lang}
            offline={offline}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
          />
        );
      default:
        return (
          <ClassroomWindow
            room={room}
            data={data}
            lang={lang}
            busy={busy}
            zIndex={zIndex}
            onFocus={onFocus}
            onClose={onCloseRoom}
            onEditLabel={() => onEditRoom(room)}
            onOpenStudentProfile={onOpenStudentProfile}
            mutate={mutate}
          />
        );
    }
  };

  return (
    <>
      {openRoom && renderRoomWindow(openRoom)}

      {openStudentId && (
        <StudentProfileWindow
          studentId={openStudentId}
          data={data}
          lang={lang}
          busy={busy}
          switching={switching}
          zIndex={zFor('student')}
          onFocus={() => onFocusWindow('student')}
          onClose={onCloseStudent}
          mutate={mutate}
        />
      )}

      {liveTeacher && (
        <TeacherLiveWindow
          record={liveTeacher}
          rooms={rooms}
          lang={lang}
          zIndex={zFor('teacher')}
          onFocus={() => onFocusWindow('teacher')}
          onClose={onCloseTeacher}
          onFlyToRoom={onSelectRoom}
          onShowTrail={onShowTeacherTrail}
        />
      )}

      {editingRoom && (
        <RoomLabelEditor
          room={editingRoom}
          layout={layout}
          data={data}
          lang={lang}
          busy={busy}
          zIndex={zFor('editor') + 10}
          onFocus={() => onFocusWindow('editor')}
          onClose={onCloseEditor}
          mutate={mutate}
        />
      )}
    </>
  );
}
