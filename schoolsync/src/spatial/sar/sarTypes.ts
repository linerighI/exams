/**
 * AST, diagnostic, compiler output, and template contracts for SAR
 * (Spatial Architectural Representation) in the SARE 3D School Engine.
 */
import type {
  CampusLayout,
  RoomKind,
  RoomPoint,
  RoomStateKind,
  SpatialAssignment3D,
  WallOpening,
} from '../../types';

export type SarSeverity = 'error' | 'warning';

export interface SarDiagnostic {
  line: number;
  message: string;
  severity: SarSeverity;
}

export type SarRelativeDir = 'east_of' | 'west_of' | 'north_of' | 'south_of';
export type SarAlign = 'start' | 'center' | 'end';

export interface SarOpeningAst {
  line: number;
  type: WallOpening['type'];
  wall: WallOpening['wall'];
  wallIndex?: number;
  offset: number;
  width?: number;
  height?: number;
}

export interface SarFloorAst {
  line: number;
  id: string;
  label: string;
  elevationY?: number;
  ceilingHeight?: number;
}

export interface SarWingAst {
  line: number;
  id: string;
  label: string;
  color: string;
}

export interface SarRoomAst {
  line: number;
  id: string;
  label: string;
  kind: RoomKind;
  className: string;
  floorId: string;
  wingId: string;
  width: number;
  depth: number;
  height?: number;
  thickness?: number;
  rotationDeg: number;
  at?: { x: number; z: number };
  relative?: { dir: SarRelativeDir; targetId: string; gap: number; align: SarAlign };
  points?: RoomPoint[];
  openings: SarOpeningAst[];
  merges: { line: number; targetId: string }[];
  openEdges: { line: number; wall?: WallOpening['wall']; wallIndex?: number }[];
  wallColor?: string;
  floorColor?: string;
  roomState?: RoomStateKind;
  stateNote?: string;
  assignments3D: SpatialAssignment3D[];
}

export interface SarRowAst {
  line: number;
  count: number;
  kind: RoomKind;
  labelPrefix: string;
  idPrefix: string;
  floorId: string;
  wingId: string;
  start: { x: number; z: number };
  step: { dx: number; dz: number };
  width: number;
  depth: number;
  height?: number;
  doorWall?: WallOpening['wall'];
  doubleDoorWall?: WallOpening['wall'];
  windowWall?: WallOpening['wall'];
  wallColor?: string;
  floorColor?: string;
}

export interface SarPropAst {
  line: number;
  prefabId: string;
  floorId: string;
  at?: { x: number; z: number };
  inRoomId?: string;
  offset: { dx: number; dz: number };
  rotationDeg: number;
  scale?: number;
  colorTint?: string;
}

export interface SarProgramAst {
  campusName: string;
  gridSize: number;
  theme: string;
  floors: SarFloorAst[];
  wings: SarWingAst[];
  rooms: SarRoomAst[];
  rows: SarRowAst[];
  props: SarPropAst[];
  diagnostics: SarDiagnostic[];
}

export interface SarCompileResult {
  layout: CampusLayout;
  diagnostics: SarDiagnostic[];
  stats: {
    floors: number;
    wings: number;
    rooms: number;
    props: number;
    openings: number;
  };
}

export interface SarTemplate {
  id: string;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  source: string;
}
