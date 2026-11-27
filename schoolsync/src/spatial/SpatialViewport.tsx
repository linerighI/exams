/**
 * Permanent full-viewport Three.js spatial viewport hosting the procedural untextured
 * 3D campus, student/teacher presence silhouettes, and interactive 3D Editor studio.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Radio } from 'lucide-react';
import type { Language } from '../i18n';
import {
  isManagerRole,
  type CampusBeacon,
  type CampusLayout,
  type State,
  type TeacherPresenceRecord,
} from '../types';
import type { EditorControllerCallbacks } from './editor/CampusEditorController';
import type { EditorTool, SelectedEditorEntity } from './engine/campusSchema';
import type { TrailPoint } from './figures/TeacherLiveWindow';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from './roomCatalog';
import { RoomCalloutLayer } from './RoomCalloutLayer';
import {
  createSpatialRuntime,
  type SpatialRuntimeEngine,
  type SpatialRuntimeRefs,
} from './spatialSceneRuntime';

export interface SpatialSceneHandle {
  flyToRoom: (room: ResolvedSpatialRoom, leaveWindowSpace?: boolean) => void;
  flyToFloor: (floor: FloorFilter) => void;
}

interface SpatialViewportProps {
  autoOrbit: boolean;
  layout: CampusLayout;
  beacons: CampusBeacon[];
  rooms: ResolvedSpatialRoom[];
  floor: FloorFilter;
  showRoofs: boolean;
  access: TeacherAccess;
  selectedSlotId: string | null;
  hoveredRoom: ResolvedSpatialRoom | null;
  editLabelsMode: boolean;
  editorMode: boolean;
  editorTool: EditorTool;
  editorSelected: SelectedEditorEntity;
  editorFloorId: string;
  editorGridSnap: number;
  editorOnionSkin: boolean;
  editorTransformMode: 'translate' | 'rotate' | 'scale';
  editorCallbacks: Omit<EditorControllerCallbacks, 'getState'>;
  teacherPresence: TeacherPresenceRecord[];
  teacherTrail: TrailPoint[];
  data: State | null;
  lang: Language;
  sceneHandleRef: MutableRefObject<SpatialSceneHandle | null>;
  onHoverRoom: (room: ResolvedSpatialRoom | null) => void;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  onEditRoom: (room: ResolvedSpatialRoom) => void;
  onSelectTeacher: (teacherId: string) => void;
}

/** Permanent WebGL 3D canvas + DOM 3D-to-2D projection overlay. */
export function SpatialViewport({
  autoOrbit,
  layout,
  beacons,
  rooms,
  floor,
  showRoofs,
  access,
  selectedSlotId,
  hoveredRoom,
  editLabelsMode,
  editorMode,
  editorTool,
  editorSelected,
  editorFloorId,
  editorGridSnap,
  editorOnionSkin,
  editorTransformMode,
  editorCallbacks,
  teacherPresence,
  teacherTrail,
  data,
  lang,
  sceneHandleRef,
  onHoverRoom,
  onSelectRoom,
  onEditRoom,
  onSelectTeacher,
}: SpatialViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fogOverlayRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const teacherPillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const calloutRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SpatialRuntimeEngine | null>(null);
  const [graphReady, setGraphReady] = useState(0);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const propsRef = useRef<SpatialRuntimeRefs>({
    editorMode,
    rooms,
    floor,
    showRoofs,
    access,
    selectedSlotId,
    hoveredRoom,
    teacherPresence,
    onHoverRoom,
    onSelectRoom,
    onSelectTeacher,
  });
  propsRef.current = {
    editorMode,
    rooms,
    floor,
    showRoofs,
    access,
    selectedSlotId,
    hoveredRoom,
    teacherPresence,
    onHoverRoom,
    onSelectRoom,
    onSelectTeacher,
  };

  const edRef = useRef(editorCallbacks);
  edRef.current = editorCallbacks;
  const edStateRef = useRef({ editorMode, editorTool, editorFloorId, editorGridSnap, editorSelected });
  edStateRef.current = { editorMode, editorTool, editorFloorId, editorGridSnap, editorSelected };

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const eng = createSpatialRuntime({
      container,
      fogOverlay: fogOverlayRef.current,
      pillRefs,
      teacherPillRefs,
      calloutEl: () => calloutRef.current,
      propsRef,
      editorCallbacks: {
        getState: () => {
          const st = edStateRef.current;
          const elev = layoutRef.current.floors.find((f) => f.id === st.editorFloorId)?.elevationY ?? 0;
          const selRoom =
            st.editorSelected?.type === 'room'
              ? layoutRef.current.rooms.find((r) => r.id === st.editorSelected!.id) || null
              : null;
          return {
            active: st.editorMode,
            tool: st.editorTool,
            activeFloorId: st.editorFloorId,
            activeFloorY: elev,
            gridSnap: st.editorGridSnap,
            selected: st.editorSelected,
            selectedRoom: selRoom,
            getRoom: (id) => layoutRef.current.rooms.find((r) => r.id === id) || null,
            graph: eng.graph,
          };
        },
        onSelectEntity: (e) => edRef.current.onSelectEntity(e),
        onCreateRoom: (r) => edRef.current.onCreateRoom(r),
        onTransformCommit: (en, x, z, rot, sc) => edRef.current.onTransformCommit(en, x, z, rot, sc),
        onResizeCommit: (rid, patch) => edRef.current.onResizeCommit(rid, patch),
        onAddOpening: (rid, w, off, t, wi) => edRef.current.onAddOpening(rid, w, off, t, wi),
        onMoveOpening: (rid, oid, patch) => edRef.current.onMoveOpening(rid, oid, patch),
        onAddProp: (x, z) => edRef.current.onAddProp(x, z),
        onAddAssignment: (rid, ox, oz) => edRef.current.onAddAssignment(rid, ox, oz),
        onPaintWing: (rid) => edRef.current.onPaintWing(rid),
        onAddBeacon: (rid, x, z) => edRef.current.onAddBeacon(rid, x, z),
        onDrawMeasure: (d) => edRef.current.onDrawMeasure(d),
      },
    });
    engineRef.current = eng;

    sceneHandleRef.current = {
      flyToRoom: (room, leaveSpace = true) => eng.drone.flyToRoom(room, leaveSpace),
      flyToFloor: (fl) => eng.drone.flyToFloor(fl, layoutRef.current, propsRef.current.access),
    };

    return () => {
      eng.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.drone.setAutoOrbit(autoOrbit);
  }, [autoOrbit]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.rebuildCampus(layout, beacons, editorMode);
    setGraphReady((v) => v + 1);
  }, [layout, beacons, editorMode]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const manager = data ? isManagerRole(data.user.role) : false;
    eng.highlights.syncHitBoxes(rooms, floor, access);
    eng.effects.syncLiveBeacons(rooms, data, floor, access);
    eng.studentFigures.sync(rooms, data, floor, access);
    eng.teacherFigures.sync(teacherPresence, layout, floor, manager && !editorMode);
    eng.drone.setTeacherBounds(access, layout);
    eng.highlights.applySceneVisibility(eng.graph, layout, floor, showRoofs, access, editorMode && editorOnionSkin);
    const elev = layout.floors.find((f) => f.id === editorFloorId)?.elevationY ?? 0;
    const selRoom =
      editorSelected?.type === 'room'
        ? layout.rooms.find((r) => r.id === editorSelected.id) || null
        : null;
    eng.editor.sync(editorMode, editorTool, editorSelected, selRoom, elev, eng.graph, editorGridSnap, editorTransformMode);
  }, [graphReady, rooms, data, layout, floor, showRoofs, access, teacherPresence, editorMode, editorTool, editorSelected, editorFloorId, editorGridSnap, editorOnionSkin, editorTransformMode]);

  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const sel = rooms.find((r) => r.slotId === selectedSlotId) || null;
    eng.highlights.setSelectedRoom(sel);
    eng.effects.setSelectedRoom(sel);
  }, [selectedSlotId, rooms]);

  useEffect(() => {
    engineRef.current?.teacherFigures.setTrail(teacherTrail, layout);
  }, [teacherTrail, layout]);

  const showTeacherPills = Boolean(data && isManagerRole(data.user.role) && !editorMode);

  return (
    <div className="sp-viewport-wrap">
      <div ref={hostRef} className="sp-canvas-host" />
      <div ref={fogOverlayRef} className="sp-teacher-fog-veil" />
      {!editorMode && (
        <RoomCalloutLayer
          rooms={rooms}
          floor={floor}
          access={access}
          hoveredRoom={hoveredRoom}
          selectedSlotId={selectedSlotId}
          editLabelsMode={editLabelsMode}
          data={data}
          lang={lang}
          pillRefs={pillRefs}
          calloutRef={calloutRef}
          onHoverRoom={onHoverRoom}
          onSelectRoom={onSelectRoom}
          onEditRoom={onEditRoom}
        />
      )}
      {showTeacherPills && (
        <div className="sp-callout-layer">
          {teacherPresence
            .filter((t) => t.room_id || t.status !== 'offline')
            .filter((t) => floor === 'all' || !t.floor_id || t.floor_id === floor)
            .map((t) => {
              const roomLbl = t.room_id ? rooms.find((r) => r.roomId === t.room_id)?.label : null;
              return (
                <button
                  key={t.teacher_id}
                  type="button"
                  ref={(el) => {
                    if (el) teacherPillRefs.current.set(t.teacher_id, el);
                    else teacherPillRefs.current.delete(t.teacher_id);
                  }}
                  className={`sp-teacher-pill ${t.mismatch ? 'is-mismatch' : ''}`}
                  onClick={() => onSelectTeacher(t.teacher_id)}
                >
                  <span className={`sp-status-dot ${t.mismatch ? 'is-amber' : t.status === 'in_class' ? 'is-blue' : 'is-green'}`} />
                  <span>{t.teacher_name || t.teacher_id}</span>
                  {roomLbl && <em>{roomLbl}</em>}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
