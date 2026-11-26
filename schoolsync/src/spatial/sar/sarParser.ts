/**
 * Tokenizer and resilient line-by-line parser for SAR (Spatial Architectural Representation).
 * Supports floors, wings, rooms, relative flush anchors, row wing generators, custom
 * polygon shapes, doors/windows, shared-wall merges, states, and 3D props without throwing.
 */
import type { RoomKind, RoomPoint, RoomStateKind, WallOpening } from '../../types';
import type { SarAlign, SarProgramAst, SarRelativeDir, SarRoomAst } from './sarTypes';

const CARDINALS = new Set(['N', 'E', 'S', 'W']);
const KINDS = new Set<string>([
  'classroom', 'principal', 'teachers', 'reception', 'counselor', 'auditorium',
  'library', 'lab', 'courtyard', 'corridor', 'stairs', 'restroom', 'assignment_zone', 'custom',
]);
const REL_DIRS = new Set<string>(['east_of', 'west_of', 'north_of', 'south_of']);

function stripComment(raw: string): string {
  let inQuote = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"' && raw[i - 1] !== '\\') { inQuote = !inQuote; continue; }
    if (inQuote) continue;
    if (ch === '/' && raw[i + 1] === '/') return raw.slice(0, i);
    if (ch === '#') {
      const rest = raw.slice(i);
      if (i === 0 || (/\s/.test(raw[i - 1]) && !/^#[0-9a-fA-F]{3,8}\b/.test(rest))) {
        return raw.slice(0, i);
      }
    }
  }
  return raw;
}

function tokenizeLine(raw: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && /[\s,]/.test(raw[i])) i++;
    if (i >= raw.length) break;
    if (raw[i] === '"') {
      let val = '';
      i++;
      while (i < raw.length && raw[i] !== '"') {
        if (raw[i] === '\\' && i + 1 < raw.length) i++;
        val += raw[i++];
      }
      if (raw[i] === '"') i++;
      tokens.push(val);
    } else if (raw[i] === '(' || raw[i] === '[') {
      const close = raw[i] === '(' ? ')' : ']';
      let depth = 1, val = raw[i++];
      while (i < raw.length && depth > 0) {
        if (raw[i] === '(' || raw[i] === '[') depth++;
        else if (raw[i] === ')' || raw[i] === ']') depth--;
        val += raw[i++];
      }
      tokens.push(val);
    } else {
      let val = '';
      while (i < raw.length && !/[\s,]/.test(raw[i])) val += raw[i++];
      tokens.push(val);
    }
  }
  return tokens;
}

function parsePair(tok: string | undefined): { x: number; z: number } | null {
  if (!tok) return null;
  const m = tok.match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/);
  return m ? { x: Number(m[1]), z: Number(m[2]) } : null;
}

function parseSize(tok: string | undefined): { w: number; d: number } | null {
  if (!tok) return null;
  const m = tok.match(/^(\d+(?:\.\d+)?)[xX×](\d+(?:\.\d+)?)$/);
  return m ? { w: Math.max(1.2, Number(m[1])), d: Math.max(1.2, Number(m[2])) } : null;
}

function parseNum(tok: string | undefined, fallback?: number): number | undefined {
  if (tok === undefined) return fallback;
  const n = Number(tok);
  return Number.isFinite(n) ? n : fallback;
}

function parsePoints(tok: string | undefined): RoomPoint[] | null {
  if (!tok || !tok.startsWith('[') || !tok.endsWith(']')) return null;
  const pts: RoomPoint[] = [];
  const re = /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tok)) !== null) pts.push({ x: Number(m[1]), z: Number(m[2]) });
  return pts.length >= 3 ? pts : null;
}

function parseOpeningLine(tokens: string[], line: number, ast: SarProgramAst, room: SarRoomAst | null) {
  const type = tokens[0] as WallOpening['type'];
  if (!room) {
    ast.diagnostics.push({ line, severity: 'warning', message: `'${type}' must appear after a room declaration` });
    return;
  }
  const target = (tokens[1] || 'E').toUpperCase();
  const isIdx = /^\d+$/.test(target);
  const wallIndex = isIdx ? Number(target) : undefined;
  const wall = (CARDINALS.has(target) ? target : 'N') as WallOpening['wall'];
  let offset = 0, width: number | undefined, height: number | undefined;
  for (let i = 2; i < tokens.length; i++) {
    const k = tokens[i];
    if (k === 'offset' && tokens[i + 1]) offset = parseNum(tokens[++i], 0) ?? 0;
    else if (k === 'width' && tokens[i + 1]) width = parseNum(tokens[++i]);
    else if (k === 'height' && tokens[i + 1]) height = parseNum(tokens[++i]);
    else if (i === 2 && !isNaN(Number(k))) offset = Number(k);
  }
  room.openings.push({ line, type, wall, ...(wallIndex !== undefined ? { wallIndex } : {}), offset, width, height });
}

/** Parse SAR source text into an AST with non-fatal line diagnostics. */
export function parseSar(source: string): SarProgramAst {
  const ast: SarProgramAst = {
    campusName: 'SchoolSync Campus',
    gridSize: 0.5,
    theme: 'apple-clay',
    floors: [],
    wings: [],
    rooms: [],
    rows: [],
    props: [],
    diagnostics: [],
  };
  let curFloor = 'floor-1';
  let curRoom: SarRoomAst | null = null;
  const lines = source.split(/\r?\n/);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = idx + 1;
    const clean = stripComment(lines[idx]).trim();
    if (!clean) continue;
    const tk = tokenizeLine(clean);
    if (!tk.length) continue;
    const cmd = tk[0];

    if (cmd === 'campus') {
      ast.campusName = tk[1] || ast.campusName;
      for (let i = 2; i < tk.length; i++) {
        if (tk[i] === 'grid') ast.gridSize = parseNum(tk[++i], 0.5) ?? 0.5;
        else if (tk[i] === 'theme' && tk[i + 1]) ast.theme = tk[++i];
      }
      curRoom = null;
    } else if (cmd === 'floor') {
      const id = tk[1] || `floor-${ast.floors.length + 1}`;
      curFloor = id;
      curRoom = null;
      const hasLabel = Boolean(tk[2] && !['y', 'height'].includes(tk[2]));
      const label = hasLabel ? tk[2] : id;
      let elevationY: number | undefined, ceilingHeight: number | undefined;
      for (let i = hasLabel ? 3 : 2; i < tk.length; i++) {
        if (tk[i] === 'y') elevationY = parseNum(tk[++i]);
        else if (tk[i] === 'height') ceilingHeight = parseNum(tk[++i]);
      }
      ast.floors.push({ line, id, label, elevationY, ceilingHeight });
    } else if (cmd === 'wing') {
      const id = tk[1] || `wing-${ast.wings.length + 1}`;
      curRoom = null;
      const hasLbl = Boolean(tk[2] && tk[2] !== 'color');
      const label = hasLbl ? tk[2] : id;
      let color = '#007aff';
      for (let i = hasLbl ? 3 : 2; i < tk.length; i++) {
        if (tk[i] === 'color' && tk[i + 1]) color = tk[++i];
      }
      ast.wings.push({ line, id, label, color });
    } else if (cmd === 'room') {
      const id = tk[1] || `room-${ast.rooms.length + 1}`;
      const kws = ['kind', 'class', 'wing', 'floor', 'size', 'at', 'height', 'thickness', 'rot'];
      const hasLbl = Boolean(tk[2] && !kws.includes(tk[2]) && !REL_DIRS.has(tk[2]));
      const r: SarRoomAst = {
        line, id, label: hasLbl ? tk[2] : id, kind: 'classroom', className: '',
        floorId: curFloor, wingId: 'main', width: 6, depth: 5.5, rotationDeg: 0,
        openings: [], merges: [], openEdges: [], assignments3D: [],
      };
      for (let i = hasLbl ? 3 : 2; i < tk.length; i++) {
        const k = tk[i];
        if (k === 'kind' && tk[i + 1] && KINDS.has(tk[i + 1])) r.kind = tk[++i] as RoomKind;
        else if (k === 'class' && tk[i + 1]) r.className = tk[++i];
        else if (k === 'wing' && tk[i + 1]) r.wingId = tk[++i];
        else if (k === 'floor' && tk[i + 1]) r.floorId = tk[++i];
        else if (k === 'size') { const s = parseSize(tk[++i]); if (s) { r.width = s.w; r.depth = s.d; } else ast.diagnostics.push({ line, severity: 'error', message: 'Invalid size, expected WxD (e.g. 6x5.5)' }); }
        else if (k === 'height') r.height = parseNum(tk[++i]);
        else if (k === 'thickness') r.thickness = parseNum(tk[++i]);
        else if (k === 'rot') r.rotationDeg = parseNum(tk[++i], 0) ?? 0;
        else if (k === 'at') { const p = parsePair(tk[++i]); if (p) r.at = p; else ast.diagnostics.push({ line, severity: 'error', message: 'Invalid coordinates, expected (x,z)' }); }
        else if (REL_DIRS.has(k) && tk[i + 1]) {
          const dir = k as SarRelativeDir;
          const targetId = tk[++i];
          let gap = 0, align: SarAlign = 'center';
          while (tk[i + 1] === 'gap' || tk[i + 1] === 'align') {
            if (tk[i + 1] === 'gap') { i++; gap = parseNum(tk[++i], 0) ?? 0; }
            else if (tk[i + 1] === 'align') { i++; const a = tk[++i]; if (a === 'start' || a === 'center' || a === 'end') align = a; }
          }
          r.relative = { dir, targetId, gap, align };
        }
      }
      ast.rooms.push(r);
      curRoom = r;
    } else if (cmd === 'door' || cmd === 'double_door' || cmd === 'window' || cmd === 'arch') {
      parseOpeningLine(tk, line, ast, curRoom);
    } else if (cmd === 'shape') {
      const pts = parsePoints(tk[1]);
      if (!curRoom) ast.diagnostics.push({ line, severity: 'warning', message: "'shape' must follow a room" });
      else if (!pts) ast.diagnostics.push({ line, severity: 'error', message: 'shape requires >=3 points: [(x1,z1), (x2,z2), (x3,z3)]' });
      else curRoom.points = pts;
    } else if (cmd === 'merge' && tk[1]) {
      if (!curRoom) ast.diagnostics.push({ line, severity: 'warning', message: "'merge' must follow a room" });
      else curRoom.merges.push({ line, targetId: tk[1] });
    } else if (cmd === 'open' && tk[1]) {
      if (!curRoom) ast.diagnostics.push({ line, severity: 'warning', message: "'open' must follow a room" });
      else {
        const t = tk[1].toUpperCase();
        curRoom.openEdges.push(/^\d+$/.test(t) ? { line, wallIndex: Number(t) } : { line, wall: (CARDINALS.has(t) ? t : 'E') as WallOpening['wall'] });
      }
    } else if (cmd === 'color') {
      if (!curRoom) ast.diagnostics.push({ line, severity: 'warning', message: "'color' must follow a room" });
      else for (let i = 1; i < tk.length; i++) {
        if (tk[i] === 'wall' && tk[i + 1]) curRoom.wallColor = tk[++i];
        else if (tk[i] === 'floor' && tk[i + 1]) curRoom.floorColor = tk[++i];
      }
    } else if (cmd === 'state' && tk[1]) {
      if (!curRoom) ast.diagnostics.push({ line, severity: 'warning', message: "'state' must follow a room" });
      else { curRoom.roomState = tk[1] as RoomStateKind; if (tk[2]) curRoom.stateNote = tk[2]; }
    } else if (cmd === 'row') {
      curRoom = null;
      const count = Math.max(1, Math.min(24, Math.round(parseNum(tk[1], 1) ?? 1)));
      const kind = (KINDS.has(tk[2]) ? tk[2] : 'classroom') as RoomKind;
      const labelPrefix = tk[3] || 'قاعة';
      let idPrefix = `row${line}_`, floorId = curFloor, wingId = 'main';
      let start = { x: 0, z: 0 }, step = { dx: 6, dz: 0 }, width = 6, depth = 5.5, height: number | undefined;
      let doorWall: WallOpening['wall'] | undefined, doubleDoorWall: WallOpening['wall'] | undefined, windowWall: WallOpening['wall'] | undefined;
      let wallColor: string | undefined, floorColor: string | undefined;
      for (let i = 4; i < tk.length; i++) {
        const k = tk[i];
        if (k === 'prefix' && tk[i + 1]) idPrefix = tk[++i];
        else if (k === 'wing' && tk[i + 1]) wingId = tk[++i];
        else if (k === 'floor' && tk[i + 1]) floorId = tk[++i];
        else if (k === 'start') { const p = parsePair(tk[++i]); if (p) start = p; }
        else if (k === 'step') { const p = parsePair(tk[++i]); if (p) step = { dx: p.x, dz: p.z }; }
        else if (k === 'size') { const s = parseSize(tk[++i]); if (s) { width = s.w; depth = s.d; } }
        else if (k === 'height') height = parseNum(tk[++i]);
        else if (k === 'door' && tk[i + 1]) doorWall = tk[++i].toUpperCase() as WallOpening['wall'];
        else if (k === 'double_door' && tk[i + 1]) doubleDoorWall = tk[++i].toUpperCase() as WallOpening['wall'];
        else if (k === 'window' && tk[i + 1]) windowWall = tk[++i].toUpperCase() as WallOpening['wall'];
        else if (k === 'color' && tk[i + 1] === 'wall' && tk[i + 2]) { i++; wallColor = tk[++i]; }
        else if (k === 'color' && tk[i + 1] === 'floor' && tk[i + 2]) { i++; floorColor = tk[++i]; }
      }
      ast.rows.push({ line, count, kind, labelPrefix, idPrefix, floorId, wingId, start, step, width, depth, height, doorWall, doubleDoorWall, windowWall, wallColor, floorColor });
    } else if (cmd === 'prop' && tk[1]) {
      curRoom = null;
      const prefabId = tk[1];
      let floorId = curFloor, at: { x: number; z: number } | undefined, inRoomId: string | undefined;
      let offset = { dx: 0, dz: 0 }, rotationDeg = 0, scale: number | undefined, colorTint: string | undefined;
      for (let i = 2; i < tk.length; i++) {
        const k = tk[i];
        if (k === 'at') { const p = parsePair(tk[++i]); if (p) at = p; else ast.diagnostics.push({ line, severity: 'error', message: 'prop at requires (x,z)' }); }
        else if (k === 'in' && tk[i + 1]) inRoomId = tk[++i];
        else if (k === 'offset') { const p = parsePair(tk[++i]); if (p) offset = { dx: p.x, dz: p.z }; }
        else if (k === 'floor' && tk[i + 1]) floorId = tk[++i];
        else if (k === 'rot') rotationDeg = parseNum(tk[++i], 0) ?? 0;
        else if (k === 'scale') scale = parseNum(tk[++i]);
        else if (k === 'tint' && tk[i + 1]) colorTint = tk[++i];
      }
      ast.props.push({ line, prefabId, floorId, at, inRoomId, offset, rotationDeg, scale, colorTint });
    } else {
      ast.diagnostics.push({ line, severity: 'error', message: `Unknown SAR statement '${cmd}'` });
    }
  }
  return ast;
}
