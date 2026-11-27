/**
 * Pure layout mutation helpers for the 3D School Model Editor: entity factories,
 * grid snapping, wall opening insertion, floor/wing creation, and entity deletion.
 */
import type { Language } from '../../i18n';
import type {
  CampusFloor,
  CampusLayout,
  CampusProp,
  CampusRoom,
  SpatialAssignment3D,
  WallOpening,
} from '../../types';
import { DEFAULT_WING_COLORS, type SelectedEditorEntity } from '../engine/campusSchema';
import { PROP_CATALOG } from '../engine/propLibrary';

export const editorUid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export function snapCoord(val: number, step: number): number {
  return Math.round(val / step) * step;
}

export function buildNewRoom(
  draft: CampusLayout,
  rect: { x: number; z: number; width: number; depth: number },
  floorId: string,
  wingId: string,
  gridSnap: number,
  lang: Language,
): CampusRoom {
  const id = editorUid('room');
  const count = draft.rooms.length + 1;
  return {
    id,
    floorId,
    wingId,
    kind: 'classroom',
    label: lang === 'ar' ? `قاعة ${count}` : `Room ${count}`,
    className: '',
    x: snapCoord(rect.x, gridSnap),
    z: snapCoord(rect.z, gridSnap),
    width: Math.max(2, snapCoord(rect.width, gridSnap)),
    depth: Math.max(2, snapCoord(rect.depth, gridSnap)),
    rotationY: 0,
    wallHeight: 3.2,
    wallThickness: 0.2,
    openings: [],
    assignments3D: [],
  };
}

export function applyOpeningToLayout(
  layout: CampusLayout,
  roomId: string,
  wall: WallOpening['wall'],
  offset: number,
  type: WallOpening['type'],
  wallIndex?: number,
): CampusLayout {
  const op: WallOpening = {
    id: editorUid('op'),
    wall,
    ...(typeof wallIndex === 'number' ? { wallIndex } : {}),
    offset: Number(offset.toFixed(2)),
    width: type === 'double_door' ? 2.1 : type === 'window' ? 1.8 : 1.15,
    height: type === 'double_door' ? 2.35 : type === 'window' ? 1.3 : 2.25,
    type,
  };
  return {
    ...layout,
    rooms: layout.rooms.map((r) =>
      r.id === roomId
        ? {
            ...r,
            openings: [
              ...r.openings.filter((o) => !(o.type === type && (typeof wallIndex === 'number' ? o.wallIndex === wallIndex : o.wall === wall) && Math.abs(o.offset - offset) < 0.3)),
              op,
            ],
          }
        : r,
    ),
  };
}

export function updateOpeningInLayout(
  layout: CampusLayout,
  roomId: string,
  openingId: string,
  patch: Partial<WallOpening>,
): CampusLayout {
  return {
    ...layout,
    rooms: layout.rooms.map((r) =>
      r.id === roomId ? { ...r, openings: r.openings.map((o) => (o.id === openingId ? { ...o, ...patch } : o)) } : r,
    ),
  };
}

export function removeOpeningFromLayout(layout: CampusLayout, roomId: string, openingId: string): CampusLayout {
  return {
    ...layout,
    rooms: layout.rooms.map((r) =>
      r.id === roomId ? { ...r, openings: r.openings.filter((o) => o.id !== openingId) } : r,
    ),
  };
}

export function buildNewProp(
  draft: CampusLayout,
  prefabId: string,
  floorId: string,
  x: number,
  z: number,
  rotationY: number,
  gridSnap: number,
  modelUrl?: string,
): CampusProp {
  const catItem = PROP_CATALOG.find((c) => c.id === prefabId);
  const fl = draft.floors.find((f) => f.id === floorId);
  return {
    id: editorUid('prop'),
    floorId,
    prefabId,
    category: modelUrl ? 'external' : catItem?.category || 'furniture',
    x: snapCoord(x, gridSnap * 0.5),
    y: fl?.elevationY || 0,
    z: snapCoord(z, gridSnap * 0.5),
    rotationY,
    scale: catItem?.defaultScale || 1,
    ...(modelUrl ? { modelUrl } : {}),
  };
}

export function buildNewAssignment(offsetX: number, offsetZ: number, lang: Language): SpatialAssignment3D {
  return {
    id: editorUid('asg'),
    title: lang === 'ar' ? 'مهمة مكانية جديدة' : 'New 3D Assignment',
    type: 'duty',
    assigneeId: '',
    dueAt: '10:30',
    offsetX: Number(offsetX.toFixed(2)),
    offsetZ: Number(offsetZ.toFixed(2)),
  };
}

export function removeSelectedFromLayout(layout: CampusLayout, selected: SelectedEditorEntity): CampusLayout {
  if (!selected) return layout;
  if (selected.type === 'room') {
    return {
      ...layout,
      rooms: layout.rooms.filter((r) => r.id !== selected.id),
      props: layout.props.filter((p) => p.roomId !== selected.id),
    };
  }
  if (selected.type === 'prop') {
    return { ...layout, props: layout.props.filter((p) => p.id !== selected.id) };
  }
  if (selected.type === 'assignment') {
    return {
      ...layout,
      rooms: layout.rooms.map((r) =>
        r.id === selected.roomId
          ? { ...r, assignments3D: r.assignments3D.filter((a) => a.id !== selected.id) }
          : r,
      ),
    };
  }
  return layout;
}

export function buildNextFloor(draft: CampusLayout, lang: Language): CampusFloor {
  const nextIdx = Math.max(0, ...draft.floors.map((f) => f.index)) + 1;
  const prevTop = draft.floors.reduce((max, f) => Math.max(max, f.elevationY + f.ceilingHeight), 0);
  return {
    id: editorUid('floor'),
    index: nextIdx,
    labelAr: lang === 'ar' ? `الطابق ${nextIdx}` : `Floor ${nextIdx}`,
    labelEn: `Floor ${nextIdx}`,
    elevationY: prevTop,
    ceilingHeight: 3.4,
  };
}

export function buildNewWing(draft: CampusLayout, label: string) {
  return {
    id: editorUid('wing'),
    labelAr: label,
    labelEn: label,
    color: DEFAULT_WING_COLORS[draft.wings.length % DEFAULT_WING_COLORS.length],
    floorIds: [],
  };
}
