/**
 * Dynamic 3D spatial room resolution & wing-isolation access controller driven strictly by
 * the live CampusLayout blueprint (no hardcoded architectural bounds or slots).
 */
import type { Language } from '../i18n';
import type { CampusLayout, SchoolClass, State, WingId } from '../types';
import {
  computeDynamicWingBounds,
  createBlankCampusLayout,
  resolveLayoutRooms,
  type ResolvedRoom,
} from './engine/campusSchema';

export type FloorFilter = 'all' | string;
export type ResolvedSpatialRoom = ResolvedRoom;

export interface TeacherAccess {
  restricted: boolean;
  allowedWings: Set<WingId>;
  allowedSlots: Set<string>;
}

/** Resolve CampusLayout into pickable rooms, falling back to an empty blank layout. */
export function resolveSpatialRooms(
  layout: CampusLayout | null | undefined,
  classes: SchoolClass[],
  lang: Language = 'ar',
): ResolvedSpatialRoom[] {
  const active = layout || createBlankCampusLayout(lang);
  return resolveLayoutRooms(active, classes, lang);
}

/** Determine which dynamic wings and room IDs the signed-in staff user may view clearly. */
export function computeTeacherAccess(
  data: State | null,
  rooms: ResolvedSpatialRoom[],
  layout?: CampusLayout | null,
): TeacherAccess {
  const allWingIds = new Set((layout?.wings || []).map((w) => w.id));
  if (!data || data.user.role !== 'teacher') {
    return {
      restricted: false,
      allowedWings: allWingIds,
      allowedSlots: new Set(rooms.map((r) => r.slotId)),
    };
  }

  const me = data.teachers.find((t) => t.id === data.user.id);
  const myClasses = new Set([
    ...(me?.classes || []),
    ...(data.user.section ? [data.user.section] : []),
  ]);
  const explicitWings = new Set<WingId>(data.teacherWings || me?.wings || []);
  const allowedSlots = new Set<string>();
  const derivedWings = new Set<WingId>();

  for (const room of rooms) {
    if (room.className && myClasses.has(room.className)) {
      allowedSlots.add(room.slotId);
      derivedWings.add(room.wing);
    }
  }
  const allowedWings = explicitWings.size > 0 ? explicitWings : derivedWings;
  for (const room of rooms) {
    if (allowedWings.has(room.wing) && room.kind !== 'principal') {
      allowedSlots.add(room.slotId);
    }
  }
  return { restricted: true, allowedWings, allowedSlots };
}

export { computeDynamicWingBounds, createBlankCampusLayout };
