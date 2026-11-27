/**
 * Shared TypeScript contracts for parametric 3D Campus blueprints, floors, wings,
 * openings, spatial assignments, hardware beacons, geo-anchors, and live teacher tracking.
 */

export type WingId = string;
export type RoomKind =
  | 'classroom'
  | 'principal'
  | 'teachers'
  | 'reception'
  | 'counselor'
  | 'auditorium'
  | 'library'
  | 'lab'
  | 'courtyard'
  | 'corridor'
  | 'stairs'
  | 'restroom'
  | 'assignment_zone'
  | 'custom';

export interface SpatialRoomRecord {
  slot_id: string;
  label: string;
  kind: RoomKind;
  class_name: string;
  wing: WingId;
}

export interface CampusFloor {
  id: string;
  index: number;
  labelAr: string;
  labelEn: string;
  elevationY: number;
  ceilingHeight: number;
}

export interface CampusWing {
  id: string;
  labelAr: string;
  labelEn: string;
  color: string;
  floorIds: string[];
}

export interface RoomPoint {
  x: number;
  z: number;
}

export interface WallOpening {
  id: string;
  wall: 'N' | 'S' | 'E' | 'W';
  wallIndex?: number;
  offset: number;
  width: number;
  height: number;
  type: 'door' | 'double_door' | 'window' | 'arch';
}

export type RoomStateKind = 'normal' | 'highlight' | 'note' | 'alert' | 'maintenance';

export interface SpatialAssignment3D {
  id: string;
  title: string;
  type: 'duty' | 'exam' | 'homework_zone' | 'event';
  assigneeId: string;
  dueAt: string;
  offsetX: number;
  offsetZ: number;
}

export interface CampusRoom {
  id: string;
  floorId: string;
  wingId: string;
  kind: RoomKind;
  label: string;
  className: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  points?: RoomPoint[];
  rotationY: number;
  wallHeight: number;
  wallThickness: number;
  wallColor?: string;
  floorColor?: string;
  roomState?: RoomStateKind;
  stateNote?: string;
  openEdges?: number[];
  openings: WallOpening[];
  assignments3D: SpatialAssignment3D[];
}

export interface CampusProp {
  id: string;
  floorId: string;
  roomId?: string;
  prefabId: string;
  category: 'furniture' | 'nature' | 'facilities' | 'shapes' | 'external' | 'pins';
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  colorTint?: string;
  modelUrl?: string;
}

export interface CampusLayout {
  meta: {
    version: number;
    gridSize: number;
    unit: string;
    theme: string;
    publishedAt?: string;
  };
  floors: CampusFloor[];
  wings: CampusWing[];
  rooms: CampusRoom[];
  props: CampusProp[];
}

export interface CampusGeoAnchor {
  origin_lat: number;
  origin_lng: number;
  bearing_deg: number;
  scale: number;
  geofence_radius_m: number;
}

export interface CampusBeacon {
  id: string;
  room_id: string;
  floor_id: string;
  beacon_type: 'qr' | 'nfc' | 'wifi' | 'ble';
  identifier: string;
  rssi_ref: number;
  x: number;
  y: number;
  z: number;
}

export interface TeacherPresenceRecord {
  teacher_id: string;
  teacher_name?: string;
  room_id: string | null;
  floor_id: string | null;
  x: number;
  y: number;
  z: number;
  accuracy_m: number | null;
  source: 'qr' | 'nfc' | 'wifi' | 'ble' | 'gps' | 'activity' | 'manual' | 'schedule';
  confidence: number;
  status: 'in_class' | 'on_campus' | 'mismatch' | 'offline';
  mismatch?: boolean;
  scheduled_room_id?: string | null;
  scheduled_section?: string | null;
  updated_at: string | null;
}
