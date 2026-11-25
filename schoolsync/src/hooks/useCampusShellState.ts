/**
 * Manages spatial layout extras (geoAnchor, hardware beacons), active floor/editor mode
 * synchronization, and Canvas Editor callback wiring to keep root App.tsx compact.
 */
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { EditorControllerCallbacks } from '../spatial/editor/CampusEditorController';
import type { useCampusEditor } from '../spatial/editor/editorStore';
import { snapRoomTranslationToNeighbors } from '../spatial/engine/roomAdjacency';
import { createBlankCampusLayout, type FloorFilter, type ResolvedSpatialRoom, type TeacherAccess } from '../spatial/roomCatalog';
import type { CampusBeacon, CampusGeoAnchor, CampusLayout, State } from '../types';

/** Encapsulates campus geo-anchor/beacon fetching and interactive 3D Editor callbacks. */
export function useCampusShellState(options: {
  auth: boolean;
  staff: boolean;
  data: State | null;
  editor: ReturnType<typeof useCampusEditor>;
  editorMode: boolean;
  activeLayout: CampusLayout;
  rooms: ResolvedSpatialRoom[];
  access: TeacherAccess;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  setFloor: (f: FloorFilter) => void;
  setMeasureDims: (d: { width: number; depth: number } | null) => void;
  onResetWindows: () => void;
  flyToFloor: (f: FloorFilter) => void;
}) {
  const { auth, staff, data, editor, editorMode, activeLayout, rooms, access, mutate, setFloor, setMeasureDims, onResetWindows, flyToFloor } = options;
  const [geoAnchor, setGeoAnchor] = useState<CampusGeoAnchor | null>(null);
  const [beacons, setBeacons] = useState<CampusBeacon[]>([]);

  const refreshLayoutExtras = useCallback(async () => {
    if (!auth || !staff) return;
    try {
      const res = await api<{ geoAnchor: CampusGeoAnchor | null; beacons: CampusBeacon[] }>('/campus-layout');
      setGeoAnchor(res.geoAnchor || null);
      setBeacons(res.beacons || []);
    } catch { /* ignore when unauthenticated */ }
  }, [auth, staff]);

  useEffect(() => { void refreshLayoutExtras(); }, [refreshLayoutExtras]);

  useEffect(() => {
    if (!editorMode && !editor.dirty) editor.syncLayoutFromServer(data?.campusLayout || null);
  }, [data?.campusLayout, editorMode]);

  useEffect(() => {
    if (!auth || !data) {
      onResetWindows();
      return;
    }
    let targetFloor: FloorFilter = activeLayout.floors[0]?.id || 'floor-1';
    if (access.restricted && access.allowedWings.size > 0) {
      const allowedRoom = rooms.find((r) => access.allowedWings.has(r.wing));
      if (allowedRoom) targetFloor = allowedRoom.floorId;
    }
    setFloor(targetFloor);
    if (!editorMode) flyToFloor(targetFloor);
  }, [auth, data?.user.id]);

  const editorCallbacks: Omit<EditorControllerCallbacks, 'getState'> = {
    onSelectEntity: editor.setSelected,
    onCreateRoom: (r) => editor.addRoom(r),
    onTransformCommit: (ent, x, z, rot) => {
      if (ent?.type === 'room') {
        const orig = editor.draft.rooms.find((r) => r.id === ent.id);
        const snapped = orig ? snapRoomTranslationToNeighbors({ ...orig, x, z }, editor.draft.rooms) : { x, z };
        editor.updateRoom(ent.id, { x: snapped.x, z: snapped.z, rotationY: rot });
      } else if (ent?.type === 'prop') {
        editor.updateProp(ent.id, { x, z, rotationY: rot });
      }
    },
    onResizeCommit: (rid, patch) => editor.updateRoom(rid, patch),
    onAddOpening: (rid, wall, offset, type, wallIndex) => editor.addOpening(rid, wall, offset, type, wallIndex),
    onMoveOpening: (rid, oid, patch) => editor.updateOpening(rid, oid, patch),
    onAddProp: (x, z) => editor.addProp(editor.activePropId, x, z),
    onAddAssignment: (rid, ox, oz) => editor.addAssignment(rid, ox, oz),
    onPaintWing: (rid) => editor.updateRoom(rid, { wingId: editor.activeWingId }),
    onAddBeacon: (rid, x, z) => {
      const targetRoom = rid || activeLayout.rooms[0]?.id || 'campus';
      const elev = activeLayout.floors.find((f) => f.id === editor.activeFloorId)?.elevationY || 0;
      void mutate('/campus-beacons', {
        room_id: targetRoom, floor_id: editor.activeFloorId, beacon_type: 'wifi', identifier: `AP-${targetRoom}`, x, y: elev, z,
      }).then(() => refreshLayoutExtras());
    },
    onDrawMeasure: setMeasureDims,
  };

  return { geoAnchor, beacons, refreshLayoutExtras, editorCallbacks, createBlankCampusLayout };
}
