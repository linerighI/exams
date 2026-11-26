/**
 * Silent server-side SAR (Spatial Architectural Representation) compiler and encoder:
 * compiles compact `.sar` blueprints sent from SARE into validated CampusLayout objects
 * and encodes legacy JSON layouts into `.sar` for lightweight SQLite storage and delivery.
 */
const CARDINALS = new Set(['N', 'E', 'S', 'W']);
const CARD_IDX = { N: 0, E: 1, S: 2, W: 3 };
const IDX_CARD = ['N', 'E', 'S', 'W'];
const REL_DIRS = new Set(['east_of', 'west_of', 'north_of', 'south_of']);
const NATURE_PROPS = new Set(['tree_round', 'tree_cypress', 'planter', 'bench', 'fountain']);
const FAC_PROPS = new Set(['stairs', 'flagpole', 'basketball_hoop', 'pergola', 'gate']);
const r2 = (n) => Number((n || 0).toFixed(2));
const q = (s) => `"${String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function stripComment(raw) {
  let inQ = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"' && raw[i - 1] !== '\\') { inQ = !inQ; continue; }
    if (inQ) continue;
    if (ch === '/' && raw[i + 1] === '/') return raw.slice(0, i);
    if (ch === '#' && (i === 0 || (/\s/.test(raw[i - 1]) && !/^#[0-9a-fA-F]{3,8}\b/.test(raw.slice(i))))) return raw.slice(0, i);
  }
  return raw;
}

function tokenize(raw) {
  const out = [];
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && /[\s,]/.test(raw[i])) i++;
    if (i >= raw.length) break;
    if (raw[i] === '"') {
      let v = ''; i++;
      while (i < raw.length && raw[i] !== '"') { if (raw[i] === '\\' && i + 1 < raw.length) i++; v += raw[i++]; }
      if (raw[i] === '"') i++;
      out.push(v);
    } else if (raw[i] === '(' || raw[i] === '[') {
      let d = 1, v = raw[i++];
      while (i < raw.length && d > 0) { if (raw[i] === '(' || raw[i] === '[') d++; else if (raw[i] === ')' || raw[i] === ']') d--; v += raw[i++]; }
      out.push(v);
    } else {
      let v = '';
      while (i < raw.length && !/[\s,]/.test(raw[i])) v += raw[i++];
      out.push(v);
    }
  }
  return out;
}

const pair = (t) => { const m = t && t.match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/); return m ? { x: +m[1], z: +m[2] } : null; };
const sizeOf = (t) => { const m = t && t.match(/^(\d+(?:\.\d+)?)[xX×](\d+(?:\.\d+)?)$/); return m ? { w: Math.max(1.2, +m[1]), d: Math.max(1.2, +m[2]) } : null; };

function recenterPoly(x, z, rotY, pts, assigns) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const width = Math.max(1.5, r2(maxX - minX)), depth = Math.max(1.5, r2(maxZ - minZ));
  const cx = r2((minX + maxX) / 2), cz = r2((minZ + maxZ) / 2), cos = Math.cos(rotY), sin = Math.sin(rotY);
  return {
    x: r2(x + cx * cos + cz * sin), z: r2(z - cx * sin + cz * cos), width, depth,
    points: pts.map((p) => ({ x: r2(p.x - cx), z: r2(p.z - cz) })),
    assignments3D: assigns.map((a) => ({ ...a, offsetX: r2((a.offsetX || 0) - cx), offsetZ: r2((a.offsetZ || 0) - cz) })),
  };
}

/** Compile compact `.sar` text on the backend into a validated CampusLayout object. */
function sarToLayout(source) {
  const floors = [], wings = [], rawRooms = [], props = [];
  let gridSize = 0.5, theme = 'apple-clay', curFloor = 'floor-1', curRoom = null;
  for (const rawLine of String(source || '').split(/\r?\n/)) {
    const tk = tokenize(stripComment(rawLine).trim());
    if (!tk.length) continue;
    const cmd = tk[0];
    if (cmd === 'campus') {
      for (let i = 2; i < tk.length; i++) { if (tk[i] === 'grid') gridSize = Number(tk[++i]) || 0.5; else if (tk[i] === 'theme' && tk[i + 1]) theme = tk[++i]; }
      curRoom = null;
    } else if (cmd === 'floor') {
      curFloor = tk[1] || `floor-${floors.length + 1}`; curRoom = null;
      const hasL = Boolean(tk[2] && !['y', 'height'].includes(tk[2])), label = hasL ? tk[2] : curFloor;
      let y, h;
      for (let i = hasL ? 3 : 2; i < tk.length; i++) { if (tk[i] === 'y') y = Number(tk[++i]); else if (tk[i] === 'height') h = Number(tk[++i]); }
      floors.push({ id: curFloor, index: floors.length + 1, labelAr: label, labelEn: label, elevationY: y, ceilingHeight: h || 3.4 });
    } else if (cmd === 'wing') {
      curRoom = null;
      const id = tk[1] || `wing-${wings.length + 1}`, hasL = Boolean(tk[2] && tk[2] !== 'color'), label = hasL ? tk[2] : id;
      let color = '#007aff';
      for (let i = hasL ? 3 : 2; i < tk.length; i++) if (tk[i] === 'color' && tk[i + 1]) color = tk[++i];
      wings.push({ id, labelAr: label, labelEn: label, color, floorIds: [] });
    } else if (cmd === 'room') {
      const id = tk[1] || `room-${rawRooms.length + 1}`;
      const kws = ['kind', 'class', 'wing', 'floor', 'size', 'at', 'height', 'thickness', 'rot'];
      const hasL = Boolean(tk[2] && !kws.includes(tk[2]) && !REL_DIRS.has(tk[2]));
      const rm = { id, label: hasL ? tk[2] : id, kind: 'classroom', className: '', floorId: curFloor, wingId: 'main', width: 6, depth: 5.5, rotDeg: 0, openings: [], openEdges: [], assignments3D: [] };
      for (let i = hasL ? 3 : 2; i < tk.length; i++) {
        const k = tk[i];
        if (k === 'kind' && tk[i + 1]) rm.kind = tk[++i];
        else if (k === 'class' && tk[i + 1]) rm.className = tk[++i];
        else if (k === 'wing' && tk[i + 1]) rm.wingId = tk[++i];
        else if (k === 'floor' && tk[i + 1]) rm.floorId = tk[++i];
        else if (k === 'size') { const s = sizeOf(tk[++i]); if (s) { rm.width = s.w; rm.depth = s.d; } }
        else if (k === 'height') rm.height = Number(tk[++i]);
        else if (k === 'thickness') rm.thickness = Number(tk[++i]);
        else if (k === 'rot') rm.rotDeg = Number(tk[++i]) || 0;
        else if (k === 'at') { const p = pair(tk[++i]); if (p) rm.at = p; }
        else if (REL_DIRS.has(k) && tk[i + 1]) {
          const dir = k, targetId = tk[++i]; let gap = 0, align = 'center';
          while (tk[i + 1] === 'gap' || tk[i + 1] === 'align') {
            if (tk[i + 1] === 'gap') { i++; gap = Number(tk[++i]) || 0; } else { i++; align = tk[++i] || 'center'; }
          }
          rm.rel = { dir, targetId, gap, align };
        }
      }
      rawRooms.push(rm); curRoom = rm;
    } else if (curRoom && ['door', 'double_door', 'window', 'arch'].includes(cmd)) {
      const tgt = (tk[1] || 'E').toUpperCase(), isIdx = /^\d+$/.test(tgt);
      let off = 0, w, h;
      for (let i = 2; i < tk.length; i++) {
        if (tk[i] === 'offset') off = Number(tk[++i]) || 0;
        else if (tk[i] === 'width') w = Number(tk[++i]);
        else if (tk[i] === 'height') h = Number(tk[++i]);
        else if (i === 2 && !isNaN(Number(tk[i]))) off = Number(tk[i]);
      }
      curRoom.openings.push({ type: cmd, wall: CARDINALS.has(tgt) ? tgt : 'N', ...(isIdx ? { wallIndex: +tgt } : {}), offset: r2(off), width: r2(w ?? (cmd === 'double_door' ? 2.1 : cmd === 'window' ? 1.8 : 1.15)), height: r2(h ?? (cmd === 'double_door' ? 2.35 : cmd === 'window' ? 1.3 : 2.25)) });
    } else if (curRoom && cmd === 'shape' && tk[1]) {
      const pts = [], re = /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
      for (let m; (m = re.exec(tk[1])) !== null;) pts.push({ x: +m[1], z: +m[2] });
      if (pts.length >= 3) curRoom.points = pts;
    } else if (curRoom && cmd === 'open' && tk[1]) {
      const t = tk[1].toUpperCase(); curRoom.openEdges.push(/^\d+$/.test(t) ? +t : CARD_IDX[t] ?? 1);
    } else if (curRoom && cmd === 'color') {
      for (let i = 1; i < tk.length; i++) { if (tk[i] === 'wall' && tk[i + 1]) curRoom.wallColor = tk[++i]; else if (tk[i] === 'floor' && tk[i + 1]) curRoom.floorColor = tk[++i]; }
    } else if (curRoom && cmd === 'state' && tk[1]) {
      curRoom.roomState = tk[1]; if (tk[2]) curRoom.stateNote = tk[2];
    } else if (curRoom && cmd === 'assign' && tk[1]) {
      const a = { id: `${curRoom.id}-asg-${curRoom.assignments3D.length + 1}`, title: tk[1], type: 'duty', assigneeId: '', dueAt: '10:30', offsetX: 0, offsetZ: 0 };
      for (let i = 2; i < tk.length; i++) { if (tk[i] === 'type' && tk[i + 1]) a.type = tk[++i]; else if (tk[i] === 'due' && tk[i + 1]) a.dueAt = tk[++i]; else if (tk[i] === 'by' && tk[i + 1]) a.assigneeId = tk[++i]; else if (tk[i] === 'at') { const p = pair(tk[++i]); if (p) { a.offsetX = p.x; a.offsetZ = p.z; } } }
      curRoom.assignments3D.push(a);
    } else if (cmd === 'prop' && tk[1]) {
      curRoom = null;
      const p = { prefabId: tk[1], floorId: curFloor, offset: { dx: 0, dz: 0 }, rotDeg: 0 };
      for (let i = 2; i < tk.length; i++) {
        if (tk[i] === 'at') p.at = pair(tk[++i]); else if (tk[i] === 'in') p.inRoomId = tk[++i]; else if (tk[i] === 'offset') { const o = pair(tk[++i]); if (o) p.offset = { dx: o.x, dz: o.z }; }
        else if (tk[i] === 'floor') p.floorId = tk[++i]; else if (tk[i] === 'rot') p.rotDeg = Number(tk[++i]) || 0; else if (tk[i] === 'scale') p.scale = Number(tk[++i]); else if (tk[i] === 'tint') p.tint = tk[++i];
      }
      props.push(p);
    }
  }

  let elev = 0;
  if (!floors.length) floors.push({ id: 'floor-1', index: 1, labelAr: 'الطابق الأول', labelEn: 'Floor 1', elevationY: 0, ceilingHeight: 3.4 });
  for (const fl of floors) { fl.elevationY = r2(fl.elevationY ?? elev); elev = fl.elevationY + fl.ceilingHeight; }
  const fMap = new Map(floors.map((f) => [f.id, f]));

  const dims = new Map();
  for (const r of rawRooms) if (!r.rel) dims.set(r.id, { x: r.at?.x ?? 0, z: r.at?.z ?? 0, w: r.width, d: r.depth });
  for (let pass = 0; pass <= rawRooms.length; pass++) {
    let moved = false;
    for (const r of rawRooms) {
      if (dims.has(r.id) || !r.rel) continue;
      const t = dims.get(r.rel.targetId);
      if (!t) continue;
      const a = r.rel.align, g = r.rel.gap;
      const az = a === 'start' ? t.z - t.d / 2 + r.depth / 2 : a === 'end' ? t.z + t.d / 2 - r.depth / 2 : t.z;
      const ax = a === 'start' ? t.x - t.w / 2 + r.width / 2 : a === 'end' ? t.x + t.w / 2 - r.width / 2 : t.x;
      const pos = r.rel.dir === 'east_of' ? { x: r2(t.x + t.w / 2 + r.width / 2 + g), z: r2(az) }
        : r.rel.dir === 'west_of' ? { x: r2(t.x - t.w / 2 - r.width / 2 - g), z: r2(az) }
        : r.rel.dir === 'south_of' ? { x: r2(ax), z: r2(t.z + t.d / 2 + r.depth / 2 + g) } : { x: r2(ax), z: r2(t.z - t.d / 2 - r.depth / 2 - g) };
      dims.set(r.id, { x: pos.x, z: pos.z, w: r.width, d: r.depth }); moved = true;
    }
    if (!moved) break;
  }

  const rooms = rawRooms.map((r) => {
    const fl = fMap.get(r.floorId) || floors[0], d = dims.get(r.id) || { x: 0, z: 0 }, rotY = Number(((r.rotDeg * Math.PI) / 180).toFixed(4));
    let x = d.x, z = d.z, width = r.width, depth = r.depth, points = r.points, assignments3D = r.assignments3D;
    if (points?.length >= 3) { ({ x, z, width, depth, points, assignments3D } = recenterPoly(x, z, rotY, points, assignments3D)); }
    const openings = r.openings.map((op, oi) => ({ id: `${r.id}-op-${oi + 1}`, ...op }));
    return {
      id: r.id, floorId: fl.id, wingId: r.wingId, kind: r.kind, label: r.label, className: r.className,
      x, z, width, depth, ...(points ? { points } : {}), rotationY: rotY,
      wallHeight: r2(r.height ?? (r.kind === 'courtyard' ? 0.35 : fl.ceilingHeight - 0.2)), wallThickness: r2(r.thickness ?? 0.2),
      ...(r.wallColor ? { wallColor: r.wallColor } : {}), ...(r.floorColor ? { floorColor: r.floorColor } : {}),
      ...(r.roomState ? { roomState: r.roomState } : {}), ...(r.stateNote ? { stateNote: r.stateNote } : {}),
      ...(r.openEdges.length ? { openEdges: [...new Set(r.openEdges)] } : {}), openings, assignments3D,
    };
  });

  const wMap = new Map(wings.map((w) => [w.id, w]));
  for (const r of rooms) {
    if (!wMap.has(r.wingId)) wMap.set(r.wingId, { id: r.wingId, labelAr: r.wingId, labelEn: r.wingId, color: '#007aff', floorIds: [] });
    if (!wMap.get(r.wingId).floorIds.includes(r.floorId)) wMap.get(r.wingId).floorIds.push(r.floorId);
  }
  const finalWings = [...wMap.values()];
  if (!finalWings.length) finalWings.push({ id: 'main', labelAr: 'الجناح الرئيسي', labelEn: 'Main Wing', color: '#007aff', floorIds: floors.map((f) => f.id) });

  const rMap = new Map(rooms.map((r) => [r.id, r]));
  const finalProps = props.map((p, idx) => {
    const tgt = p.inRoomId ? rMap.get(p.inRoomId) : null, fl = fMap.get(tgt ? tgt.floorId : p.floorId) || floors[0];
    return {
      id: `sar-prop-${idx + 1}`, floorId: fl.id, ...(tgt ? { roomId: tgt.id } : {}), prefabId: p.prefabId,
      category: NATURE_PROPS.has(p.prefabId) ? 'nature' : FAC_PROPS.has(p.prefabId) ? 'facilities' : 'furniture',
      x: r2(tgt ? tgt.x + p.offset.dx : (p.at?.x ?? 0)), y: fl.elevationY, z: r2(tgt ? tgt.z + p.offset.dz : (p.at?.z ?? 0)),
      rotationY: Number(((p.rotDeg * Math.PI) / 180).toFixed(4)), scale: r2(p.scale ?? 1), ...(p.tint ? { colorTint: p.tint } : {}),
    };
  });

  return { meta: { version: 1, gridSize, unit: 'm', theme }, floors, wings: finalWings, rooms, props: finalProps };
}

/** Encode a structured CampusLayout object into compact SAR source text for DB storage. */
function layoutToSar(layout) {
  const deg = (rad) => Math.round(((rad || 0) * 180) / Math.PI);
  const out = [`campus ${q('SchoolSync Campus')} grid ${r2(layout.meta?.gridSize || 0.5)} theme ${layout.meta?.theme || 'apple-clay'}`];
  for (const w of layout.wings || []) out.push(`wing ${w.id} ${q(w.labelAr || w.labelEn || w.id)} color ${w.color || '#007aff'}`);
  for (const fl of layout.floors || []) {
    out.push(`floor ${fl.id} ${q(fl.labelAr || fl.labelEn || fl.id)} y ${r2(fl.elevationY)} height ${r2(fl.ceilingHeight)}`);
    const flRooms = (layout.rooms || []).filter((r) => r.floorId === fl.id);
    for (const r of flRooms) {
      out.push([`  room ${r.id} ${q(r.label || r.id)}`, `kind ${r.kind}`, ...(r.className ? [`class ${q(r.className)}`] : []), `wing ${r.wingId}`, `size ${r2(r.width)}x${r2(r.depth)}`, `height ${r2(r.wallHeight)}`, ...(Math.abs((r.wallThickness || 0.2) - 0.2) > 0.01 ? [`thickness ${r2(r.wallThickness)}`] : []), `at (${r2(r.x)}, ${r2(r.z)})`, ...(deg(r.rotationY) ? [`rot ${deg(r.rotationY)}`] : [])].join(' '));
      if (r.points?.length >= 3) out.push(`    shape [${r.points.map((p) => `(${r2(p.x)},${r2(p.z)})`).join(', ')}]`);
      for (const op of r.openings || []) out.push(`    ${op.type} ${typeof op.wallIndex === 'number' ? op.wallIndex : op.wall} ${r2(op.offset)} width ${r2(op.width)} height ${r2(op.height)}`);
      for (const oe of r.openEdges || []) out.push(`    open ${oe < 4 ? IDX_CARD[oe] : oe}`);
      if (r.wallColor || r.floorColor) out.push(`    color${r.wallColor ? ` wall ${r.wallColor}` : ''}${r.floorColor ? ` floor ${r.floorColor}` : ''}`);
      if (r.roomState && r.roomState !== 'normal') out.push(`    state ${r.roomState}${r.stateNote ? ` ${q(r.stateNote)}` : ''}`);
      for (const a of r.assignments3D || []) out.push(`    assign ${q(a.title)} type ${a.type} at (${r2(a.offsetX)}, ${r2(a.offsetZ)})${a.dueAt ? ` due ${q(a.dueAt)}` : ''}${a.assigneeId ? ` by ${q(a.assigneeId)}` : ''}`);
    }
    const rMap = new Map(flRooms.map((r) => [r.id, r]));
    for (const p of (layout.props || []).filter((pr) => pr.floorId === fl.id)) {
      const h = p.roomId ? rMap.get(p.roomId) : null;
      out.push(`  prop ${p.prefabId} ${h ? `in ${h.id} offset (${r2(p.x - h.x)}, ${r2(p.z - h.z)})` : `at (${r2(p.x)}, ${r2(p.z)})`}${deg(p.rotationY) ? ` rot ${deg(p.rotationY)}` : ''}${Math.abs((p.scale ?? 1) - 1) > 0.01 ? ` scale ${r2(p.scale)}` : ''}${p.colorTint ? ` tint ${p.colorTint}` : ''}`);
    }
  }
  return `${out.join('\n')}\n`;
}

module.exports = { sarToLayout, layoutToSar };
