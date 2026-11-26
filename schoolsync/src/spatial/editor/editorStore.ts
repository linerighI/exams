/**
 * Stateful 3D School Model Editor store: immutable CampusLayout draft, 50-step Undo/Redo
 * command history, entity selection, floor/wing context, grid snapping, and starter presets.
 */
import { useCallback, useState } from 'react';
import type { Language } from '../../i18n';
import type {
  CampusLayout,
  CampusProp,
  CampusRoom,
  SchoolClass,
  SpatialAssignment3D,
  WallOpening,
} from '../../types';
import {
  createBlankCampusLayout,
  type EditorTool,
  type SelectedEditorEntity,
} from '../engine/campusSchema';
import { snapRoomTranslationToNeighbors } from '../engine/roomAdjacency';
import { createStarterSchoolLayout } from '../engine/starterLayouts';
import {
  applyOpeningToLayout,
  buildNewAssignment,
  buildNewProp,
  buildNewRoom,
  buildNewWing,
  buildNextFloor,
  editorUid,
  removeOpeningFromLayout,
  removeSelectedFromLayout,
  snapCoord,
  updateOpeningInLayout,
} from './editorOperations';

export { snapCoord };

/** React hook owning the editable 3D school draft, Undo/Redo stack, and tool palette. */
export function useCampusEditor(initialLayout: CampusLayout | null, lang: Language) {
  const [draft, setDraft] = useState<CampusLayout>(() => initialLayout || createBlankCampusLayout(lang));
  const [past, setPast] = useState<CampusLayout[]>([]);
  const [future, setFuture] = useState<CampusLayout[]>([]);
  const [tool, setTool] = useState<EditorTool>('select');
  const [selected, setSelected] = useState<SelectedEditorEntity>(null);
  const [activeFloorId, setActiveFloorId] = useState<string>(() => draft.floors[0]?.id || 'floor-1');
  const [activeWingId, setActiveWingId] = useState<string>(() => draft.wings[0]?.id || 'main');
  const [activePropId, setActivePropId] = useState<string>('desk_cluster');
  const [propRotation, setPropRotation] = useState<number>(0);
  const [gridSnap, setGridSnap] = useState<number>(0.5);
  const [onionSkin, setOnionSkin] = useState<boolean>(true);
  const [geoCalibratorOpen, setGeoCalibratorOpen] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  const commit = useCallback((updater: (prev: CampusLayout) => CampusLayout) => {
    setDraft((prev) => {
      const next = updater(prev);
      setPast((p) => [...p.slice(-49), prev]);
      setFuture([]);
      setDirty(true);
      return next;
    });
  }, []);

  const syncLayoutFromServer = useCallback((serverLayout: CampusLayout | null) => {
    const next = serverLayout || createBlankCampusLayout(lang);
    setDraft(next);
    setPast([]);
    setFuture([]);
    setSelected(null);
    setActiveFloorId(next.floors[0]?.id || 'floor-1');
    setActiveWingId(next.wings[0]?.id || 'main');
    setDirty(false);
  }, [lang]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setDraft((cur) => { setFuture((f) => [cur, ...f.slice(0, 49)]); return previous; });
      setSelected(null);
      setDirty(true);
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setDraft((cur) => { setPast((p) => [...p.slice(-49), cur]); return next; });
      setSelected(null);
      setDirty(true);
      return f.slice(1);
    });
  }, []);

  const addRoom = useCallback(
    (rect: { x: number; z: number; width: number; depth: number }) => {
      const base = buildNewRoom(draft, rect, activeFloorId, activeWingId, gridSnap, lang);
      const snapped = snapRoomTranslationToNeighbors(base, draft.rooms);
      const room = { ...base, ...snapped };
      commit((prev) => ({ ...prev, rooms: [...prev.rooms, room] }));
      setSelected({ type: 'room', id: room.id });
      setTool('select');
      return room;
    },
    [activeFloorId, activeWingId, commit, draft, gridSnap, lang],
  );

  const toggleSharedWallMerge = useCallback(
    (roomId: string, edgeIndex: number, neighborId: string, neighborEdgeIndex: number) => {
      commit((prev) => {
        const curRoom = prev.rooms.find((r) => r.id === roomId);
        const nbRoom = prev.rooms.find((r) => r.id === neighborId);
        if (!curRoom) return prev;
        const alreadyMerged =
          Boolean(curRoom.openEdges?.includes(edgeIndex)) ||
          Boolean(nbRoom?.openEdges?.includes(neighborEdgeIndex));
        return {
          ...prev,
          rooms: prev.rooms.map((r) => {
            if (r.id === roomId) {
              const cur = new Set(r.openEdges || []);
              if (alreadyMerged) cur.delete(edgeIndex);
              else cur.add(edgeIndex);
              const arr = [...cur];
              return { ...r, openEdges: arr.length ? arr : undefined };
            }
            if (r.id === neighborId && alreadyMerged && r.openEdges?.includes(neighborEdgeIndex)) {
              const arr = r.openEdges.filter((idx) => idx !== neighborEdgeIndex);
              return { ...r, openEdges: arr.length ? arr : undefined };
            }
            return r;
          }),
        };
      });
    },
    [commit],
  );

  const updateRoom = useCallback(
    (roomId: string, patch: Partial<CampusRoom>) => {
      commit((prev) => ({ ...prev, rooms: prev.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r)) }));
    },
    [commit],
  );

  const addOpening = useCallback(
    (roomId: string, wall: WallOpening['wall'], offset: number, type: WallOpening['type'], wallIndex?: number) => {
      commit((prev) => applyOpeningToLayout(prev, roomId, wall, offset, type, wallIndex));
    },
    [commit],
  );

  const updateOpening = useCallback(
    (roomId: string, openingId: string, patch: Partial<WallOpening>) => {
      commit((prev) => updateOpeningInLayout(prev, roomId, openingId, patch));
    },
    [commit],
  );

  const removeOpening = useCallback(
    (roomId: string, openingId: string) => {
      commit((prev) => removeOpeningFromLayout(prev, roomId, openingId));
    },
    [commit],
  );

  const addProp = useCallback(
    (prefabId: string, x: number, z: number) => {
      const prop = buildNewProp(draft, prefabId, activeFloorId, x, z, propRotation, gridSnap);
      commit((prev) => ({ ...prev, props: [...prev.props, prop] }));
      setSelected({ type: 'prop', id: prop.id });
    },
    [activeFloorId, commit, draft, gridSnap, propRotation],
  );

  const updateProp = useCallback(
    (propId: string, patch: Partial<CampusProp>) => {
      commit((prev) => ({ ...prev, props: prev.props.map((p) => (p.id === propId ? { ...p, ...patch } : p)) }));
    },
    [commit],
  );

  const addAssignment = useCallback(
    (roomId: string, offsetX: number, offsetZ: number) => {
      const item = buildNewAssignment(offsetX, offsetZ, lang);
      commit((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) => (r.id === roomId ? { ...r, assignments3D: [...r.assignments3D, item] } : r)),
      }));
      setSelected({ type: 'assignment', roomId, id: item.id });
      setTool('select');
    },
    [commit, lang],
  );

  const updateAssignment = useCallback(
    (roomId: string, assignId: string, patch: Partial<SpatialAssignment3D>) => {
      commit((prev) => ({
        ...prev,
        rooms: prev.rooms.map((r) =>
          r.id === roomId
            ? { ...r, assignments3D: r.assignments3D.map((a) => (a.id === assignId ? { ...a, ...patch } : a)) }
            : r,
        ),
      }));
    },
    [commit],
  );

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    commit((prev) => removeSelectedFromLayout(prev, selected));
    setSelected(null);
  }, [commit, selected]);

  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    if (selected.type === 'room') {
      const orig = draft.rooms.find((r) => r.id === selected.id);
      if (!orig) return;
      const copy: CampusRoom = { ...orig, id: editorUid('room'), x: orig.x + 1, z: orig.z + 1, className: '', assignments3D: [] };
      commit((prev) => ({ ...prev, rooms: [...prev.rooms, copy] }));
      setSelected({ type: 'room', id: copy.id });
    } else if (selected.type === 'prop') {
      const orig = draft.props.find((p) => p.id === selected.id);
      if (!orig) return;
      const copy: CampusProp = { ...orig, id: editorUid('prop'), x: orig.x + 1, z: orig.z + 1 };
      commit((prev) => ({ ...prev, props: [...prev.props, copy] }));
      setSelected({ type: 'prop', id: copy.id });
    }
  }, [commit, draft.props, draft.rooms, selected]);

  const addFloor = useCallback(() => {
    const fl = buildNextFloor(draft, lang);
    commit((prev) => ({ ...prev, floors: [...prev.floors, fl] }));
    setActiveFloorId(fl.id);
    return fl.id;
  }, [commit, draft, lang]);

  const addWing = useCallback((label: string) => {
    const wing = buildNewWing(draft, label);
    commit((prev) => ({ ...prev, wings: [...prev.wings, wing] }));
    setActiveWingId(wing.id);
    return wing.id;
  }, [commit, draft]);

  const loadStarter = useCallback((classes: SchoolClass[]) => {
    const starter = createStarterSchoolLayout(classes);
    commit(() => starter);
    setActiveFloorId(starter.floors[0].id);
    setActiveWingId(starter.wings[0].id);
    setSelected(null);
  }, [commit]);

  const clearBlank = useCallback(() => {
    const blank = createBlankCampusLayout(lang);
    commit(() => blank);
    setActiveFloorId(blank.floors[0].id);
    setActiveWingId(blank.wings[0].id);
    setSelected(null);
  }, [commit, lang]);

  const applyLayout = useCallback((next: CampusLayout) => {
    commit(() => next);
    setActiveFloorId(next.floors[0]?.id || 'floor-1');
    setActiveWingId(next.wings[0]?.id || 'main');
    setSelected(null);
  }, [commit]);

  return {
    draft, tool, setTool, selected, setSelected, activeFloorId, setActiveFloorId,
    activeWingId, setActiveWingId, activePropId, setActivePropId, propRotation, setPropRotation,
    gridSnap, setGridSnap, onionSkin, setOnionSkin, geoCalibratorOpen, setGeoCalibratorOpen,
    dirty, setDirty, canUndo: past.length > 0, canRedo: future.length > 0,
    syncLayoutFromServer, undo, redo, addRoom, updateRoom, toggleSharedWallMerge, addOpening, updateOpening, removeOpening, addProp, updateProp,
    addAssignment, updateAssignment, deleteSelected, duplicateSelected, addFloor, addWing,
    loadStarter, clearBlank, applyLayout,
  };
}
