/**
 * Root SchoolSync 3D Spatial Campus OS shell: mounts ONE permanent procedural Three.js
 * canvas (`SpatialViewport`), interactive 3D School Editor Studio, student silhouettes,
 * live teacher radar tracking, and Apple HIG floating glass windows.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useCampusShellState } from './hooks/useCampusShellState';
import { useSchoolSync } from './hooks/useSchoolSync';
import { FloorPill } from './hud/FloorPill';
import { ActiveTeachersBar } from './hud/ActiveTeachersBar';
import { SpatialHud } from './hud/SpatialHud';
import { SchoolScheduleWindow } from './windows/SchoolScheduleWindow';
import type { OrbTone } from './Orb';
import { CampusEditorHost } from './spatial/editor/CampusEditorHost';
import { useCampusEditor } from './spatial/editor/editorStore';
import type { TrailPoint } from './spatial/figures/TeacherLiveWindow';
import { computeTeacherAccess, createBlankCampusLayout, resolveSpatialRooms, type FloorFilter, type ResolvedSpatialRoom } from './spatial/roomCatalog';
import { SpatialViewport, type SpatialSceneHandle } from './spatial/SpatialViewport';
import { useTeacherTracker } from './tracking/teacherTracker';
import { tr } from './translations';
import { isManagerRole, isSchoolRole } from './types';
import { CampusOverlayLayer } from './windows/CampusOverlayLayer';
import type { FamilyPanelSection } from './windows/FamilyDetailWindow';
import { WindowManager } from './windows/WindowManager';

/** Single-canvas Spatial OS root coordinating 3D Campus, Editor Studio, and Tracking. */
export default function App() {
  const s = useSchoolSync();

  const [floor, setFloor] = useState<FloorFilter>('floor-1');
  const [showRoofs, setShowRoofs] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState<ResolvedSpatialRoom | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [openRoomSlotId, setOpenRoomSlotId] = useState<string | null>(null);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [openTeacherId, setOpenTeacherId] = useState<string | null>(null);
  const [teacherTrail, setTeacherTrail] = useState<TrailPoint[]>([]);
  const [editLabelsMode, setEditLabelsMode] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const [measureDims, setMeasureDims] = useState<{ width: number; depth: number } | null>(null);
  const [focusOrder, setFocusOrder] = useState<string[]>(['room', 'student', 'teacher', 'editor']);
  const [familySection, setFamilySection] = useState<FamilyPanelSection | null>(null);
  const [connectionOrbOpen, setConnectionOrbOpen] = useState(false);
  const [orbTone, setOrbTone] = useState<OrbTone>('blue');

  const sceneHandleRef = useRef<SpatialSceneHandle | null>(null);
  const staff = s.data ? isSchoolRole(s.data.user.role) : true;
  const manager = s.data ? isManagerRole(s.data.user.role) : false;

  const editor = useCampusEditor(s.data?.campusLayout || null, s.lang);
  const activeLayout = useMemo(
    () => (editorMode ? editor.draft : s.data?.campusLayout || createBlankCampusLayout(s.lang)),
    [editorMode, editor.draft, s.data?.campusLayout, s.lang],
  );
  const rooms = useMemo(
    () => resolveSpatialRooms(activeLayout, s.data?.classes || [], s.lang),
    [activeLayout, s.data?.classes, s.lang],
  );
  const access = useMemo(
    () => computeTeacherAccess(s.data, rooms, activeLayout),
    [s.data, rooms, activeLayout],
  );
  const tracker = useTeacherTracker({ data: s.data, activeRoomId: openRoomSlotId });

  const shell = useCampusShellState({
    auth: s.auth,
    staff,
    data: s.data,
    editor,
    editorMode,
    activeLayout,
    rooms,
    access,
    mutate: s.mutate,
    setFloor,
    setMeasureDims,
    flyToFloor: (fl) => sceneHandleRef.current?.flyToFloor(fl),
    onResetWindows: () => {
      setOpenRoomSlotId(null);
      setOpenStudentId(null);
      setEditingSlotId(null);
      setOpenTeacherId(null);
      setTeacherTrail([]);
      setEditLabelsMode(false);
      setEditorMode(false);
      setFamilySection(null);
    },
  });

  useEffect(() => {
    if (!s.auth || !s.data || editorMode) return;
    sceneHandleRef.current?.flyToFloor(floor);
  }, [s.auth, s.data?.user.id, s.data?.campusLayout?.meta.version]);

  const focusWindow = (key: string) => {
    setFocusOrder((prev) => [...prev.filter((k) => k !== key), key]);
  };

  const handleSelectRoom = (room: ResolvedSpatialRoom) => {
    if (access.restricted && !access.allowedSlots.has(room.slotId)) return;
    if (floor !== 'all' && floor !== room.floorId) setFloor(room.floorId);
    sceneHandleRef.current?.flyToRoom(room, true);
    if (editLabelsMode) {
      setEditingSlotId(room.slotId);
      focusWindow('editor');
      return;
    }
    setOpenRoomSlotId(room.slotId);
    focusWindow('room');
  };

  const handleToggleEditor = () => {
    setOpenRoomSlotId(null);
    setOpenStudentId(null);
    setEditingSlotId(null);
    setOpenTeacherId(null);
    setEditLabelsMode(false);
    setEditorMode((v) => !v);
  };

  if (s.loading) {
    return (
      <div className="sp-loading-splash">
        <div className="sp-loading-card">
          <strong>SchoolSync</strong>
          <LoaderCircle size={22} className="sp-spin" />
          <p>{tr('A calmer school day is on its way.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-shell">
      <SpatialViewport
        autoOrbit={!s.auth}
        layout={activeLayout}
        beacons={shell.beacons}
        rooms={rooms}
        floor={editorMode ? editor.activeFloorId : floor}
        showRoofs={showRoofs}
        access={access}
        selectedSlotId={openRoomSlotId || editingSlotId}
        hoveredRoom={hoveredRoom}
        editLabelsMode={editLabelsMode}
        editorMode={editorMode}
        editorTool={editor.tool}
        editorSelected={editor.selected}
        editorFloorId={editor.activeFloorId}
        editorGridSnap={editor.gridSnap}
        editorOnionSkin={editor.onionSkin}
        editorTransformMode={editor.transformMode}
        editorCallbacks={shell.editorCallbacks}
        teacherPresence={s.data?.teacherPresence || []}
        teacherTrail={teacherTrail}
        data={s.data}
        lang={s.lang}
        sceneHandleRef={sceneHandleRef}
        onHoverRoom={setHoveredRoom}
        onSelectRoom={handleSelectRoom}
        onEditRoom={(r) => { setEditingSlotId(r.slotId); focusWindow('editor'); }}
        onSelectTeacher={(tid) => { setOpenTeacherId(tid); focusWindow('teacher'); }}
      />

      <SpatialHud
        data={s.data}
        schoolName={s.schoolName}
        rooms={rooms}
        access={access}
        lang={s.lang}
        offline={s.offline}
        editLabelsMode={editLabelsMode}
        editorMode={editorMode}
        trackingStatus={tracker.trackingStatus}
        setLang={s.setLang}
        setEditLabelsMode={setEditLabelsMode}
        onToggleEditor={handleToggleEditor}
        onSelectRoom={handleSelectRoom}
        onSelectStudent={(sid, room) => {
          if (room) handleSelectRoom(room);
          setOpenStudentId(sid);
          focusWindow('student');
          void s.loadStudentState(sid);
        }}
        onMarkNotificationsRead={() => void s.mutate('/notifications/read', {}, tr('Updates marked as read'))}
        onLogout={() => void s.logout()}
      />

      {s.auth && s.data && staff && editorMode && (
        <CampusEditorHost
          editor={editor}
          data={s.data}
          lang={s.lang}
          busy={s.busy}
          measureDims={measureDims}
          geoAnchor={shell.geoAnchor}
          beacons={shell.beacons}
          mutate={s.mutate}
          onRefreshLayoutExtras={shell.refreshLayoutExtras}
          onExit={() => setEditorMode(false)}
        />
      )}

      {s.auth && s.data && staff && !editorMode && (
        <>
          <FloorPill
            floor={floor}
            layout={activeLayout}
            rooms={rooms}
            showRoofs={showRoofs}
            scheduleOpen={scheduleOpen}
            access={access}
            lang={s.lang}
            onChangeFloor={(next) => { setFloor(next); sceneHandleRef.current?.flyToFloor(next); }}
            onToggleRoofs={() => setShowRoofs((v) => !v)}
            onResetCamera={() => sceneHandleRef.current?.flyToFloor(floor)}
            onToggleSchedule={() => setScheduleOpen((v) => !v)}
          />
          {scheduleOpen && (
            <SchoolScheduleWindow data={s.data} rooms={rooms} lang={s.lang} busy={s.busy} onClose={() => setScheduleOpen(false)} onSelectRoom={handleSelectRoom} mutate={s.mutate} />
          )}
          {isManagerRole(s.data.user.role) && (
            <ActiveTeachersBar
              presence={s.data.teacherPresence || []}
              rooms={rooms}
              lang={s.lang}
              onSelectTeacher={(tid) => { setOpenTeacherId(tid); focusWindow('teacher'); }}
              onFlyToRoom={(room) => sceneHandleRef.current?.flyToRoom(room, true)}
            />
          )}
          <WindowManager
            data={s.data}
            layout={activeLayout}
            rooms={rooms}
            lang={s.lang}
            busy={s.busy}
            offline={s.offline}
            switching={s.switching}
            openRoomSlotId={openRoomSlotId}
            openStudentId={openStudentId}
            editingSlotId={editingSlotId}
            openTeacherId={openTeacherId}
            focusOrder={focusOrder}
            onFocusWindow={focusWindow}
            onCloseRoom={() => setOpenRoomSlotId(null)}
            onCloseStudent={() => setOpenStudentId(null)}
            onCloseEditor={() => setEditingSlotId(null)}
            onCloseTeacher={() => { setOpenTeacherId(null); setTeacherTrail([]); }}
            onSelectRoom={handleSelectRoom}
            onOpenStudentProfile={(id) => { setOpenStudentId(id); focusWindow('student'); void s.loadStudentState(id); }}
            onEditRoom={(r) => { setEditingSlotId(r.slotId); focusWindow('editor'); }}
            onShowTeacherTrail={setTeacherTrail}
            mutate={s.mutate}
            onRefresh={s.refresh}
          />
        </>
      )}

      <CampusOverlayLayer
        auth={s.auth}
        setupRequired={s.setupRequired}
        demo={s.demo}
        busy={s.busy}
        error={s.error}
        toast={s.toast}
        offline={s.offline}
        schoolName={s.schoolName}
        lang={s.lang}
        staff={staff}
        manager={manager}
        editorMode={editorMode}
        activeLayout={activeLayout}
        data={s.data}
        orbTone={orbTone}
        connectionOpen={connectionOrbOpen}
        familySection={familySection}
        setOrbTone={setOrbTone}
        setConnectionOpen={setConnectionOrbOpen}
        setEditorMode={setEditorMode}
        setFamilySection={setFamilySection}
        setSetupRequired={s.setSetupRequired}
        setBusy={s.setBusy}
        setError={s.setError}
        reloadConfig={s.reloadConfig}
        refresh={s.refresh}
        signIn={s.signIn}
        loadStudentState={s.loadStudentState}
        mutate={s.mutate}
      />
    </div>
  );
}
