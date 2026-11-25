/**
 * Core parametric 3D CampusLayout schema helpers: blank default canvas factory,
 * room bounds normalization, and dynamic resolution from published editor blueprints.
 */
import type { Language } from '../../i18n';
import type {
  CampusFloor,
  CampusLayout,
  CampusRoom,
  CampusWing,
  RoomKind,
  RoomStateKind,
  SchoolClass,
} from '../../types';
import { computePointsBounds, getRoomPoints } from './roomPolygon';

export type EditorTool =
  | 'select'
  | 'draw_room'
  | 'door'
  | 'double_door'
  | 'window'
  | 'prop'
  | 'assignment'
  | 'paint_wing'
  | 'beacon';

export type SelectedEditorEntity =
  | { type: 'room'; id: string }
  | { type: 'prop'; id: string }
  | { type: 'assignment'; roomId: string; id: string }
  | { type: 'beacon'; id: string }
  | null;

export interface ResolvedRoom {
  slotId: string;
  roomId: string;
  floorId: string;
  floor: number;
  elevationY: number;
  wing: string;
  wingId: string;
  kind: RoomKind;
  label: string;
  className: string;
  roomState: RoomStateKind;
  stateNote: string;
  center: [number, number, number];
  size: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
  rotationY: number;
  raw: CampusRoom;
}

export const DEFAULT_WING_COLORS = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#06b6d4'];

/** Create a clean blank architectural 3D grid studio ready for custom building. */
export function createBlankCampusLayout(lang: Language = 'ar'): CampusLayout {
  return {
    meta: { version: 1, gridSize: 0.5, unit: 'm', theme: 'apple-clay' },
    floors: [
      {
        id: 'floor-1',
        index: 1,
        labelAr: lang === 'ar' ? 'الطابق الأول' : 'Floor 1',
        labelEn: 'Floor 1',
        elevationY: 0,
        ceilingHeight: 3.4,
      },
    ],
    wings: [
      {
        id: 'main',
        labelAr: 'الجناح الرئيسي',
        labelEn: 'Main Wing',
        color: '#007aff',
        floorIds: ['floor-1'],
      },
    ],
    rooms: [],
    props: [],
  };
}

/** Resolve active CampusLayout rooms into spatial hit/focus metadata. */
export function resolveLayoutRooms(
  layout: CampusLayout | null | undefined,
  classes: SchoolClass[] = [],
  lang: Language = 'ar',
): ResolvedRoom[] {
  if (!layout || !layout.rooms.length) return [];
  const floorMap = new Map<string, CampusFloor>(layout.floors.map((f) => [f.id, f]));
  const claimed = new Set(layout.rooms.map((r) => r.className).filter(Boolean));
  const fallbackPool = [...classes]
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.name.localeCompare(b.name))
    .filter((c) => !claimed.has(c.name));

  return layout.rooms.map((room) => {
    const fl = floorMap.get(room.floorId) || layout.floors[0];
    const elev = Number(fl?.elevationY || 0);
    const height = Math.max(0.5, Number(room.wallHeight || fl?.ceilingHeight || 3.2));
    let clsName = room.className || '';
    if (room.kind === 'classroom' && !clsName && !room.label.trim() && fallbackPool.length > 0) {
      clsName = fallbackPool.shift()!.name;
    }
    const label = room.label?.trim() || clsName || (lang === 'ar' ? 'غرفة جديدة' : 'New Room');
    const bounds = computePointsBounds(getRoomPoints(room));
    const halfW = bounds.width / 2;
    const halfD = bounds.depth / 2;
    const cx = room.x + bounds.centerX;
    const cz = room.z + bounds.centerZ;

    return {
      slotId: room.id,
      roomId: room.id,
      floorId: room.floorId,
      floor: fl?.index || 1,
      elevationY: elev,
      wing: room.wingId,
      wingId: room.wingId,
      kind: room.kind,
      label,
      className: clsName,
      roomState: room.roomState || 'normal',
      stateNote: room.stateNote || '',
      center: [cx, elev + height / 2, cz],
      size: [bounds.width, height, bounds.depth],
      min: [cx - halfW, elev, cz - halfD],
      max: [cx + halfW, elev + height, cz + halfD],
      rotationY: room.rotationY || 0,
      raw: room,
    };
  });
}

/** Compute dynamic XZ+Y bounding box for one or more wings in a CampusLayout. */
export function computeDynamicWingBounds(
  layout: CampusLayout | null | undefined,
  wingIds: Set<string>,
): Record<string, { wing: CampusWing; min: [number, number, number]; max: [number, number, number]; center: [number, number, number] }> {
  const result: Record<string, { wing: CampusWing; min: [number, number, number]; max: [number, number, number]; center: [number, number, number] }> = {};
  if (!layout) return result;
  const floorMap = new Map(layout.floors.map((f) => [f.id, f]));

  for (const w of layout.wings) {
    if (wingIds.size > 0 && !wingIds.has(w.id)) continue;
    const wRooms = layout.rooms.filter((r) => r.wingId === w.id);
    if (!wRooms.length) continue;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of wRooms) {
      const fl = floorMap.get(r.floorId);
      const elev = Number(fl?.elevationY || 0);
      const b = computePointsBounds(getRoomPoints(r));
      minX = Math.min(minX, r.x + b.minX);
      maxX = Math.max(maxX, r.x + b.maxX);
      minY = Math.min(minY, elev);
      maxY = Math.max(maxY, elev + (r.wallHeight || 3.2));
      minZ = Math.min(minZ, r.z + b.minZ);
      maxZ = Math.max(maxZ, r.z + b.maxZ);
    }
    result[w.id] = {
      wing: w,
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    };
  }
  return result;
}
