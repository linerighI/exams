/**
 * Bidirectional CampusLayout -> SAR serializer so visual edits in SARE 3D Studio
 * export into clean, readable, round-trip-safe SAR architectural code.
 */
import type { CampusLayout, WallOpening } from '../../types';

const IDX_TO_CARDINAL: WallOpening['wall'][] = ['N', 'E', 'S', 'W'];
const q = (s: string) => `"${String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const n = (v: number) => Number((v || 0).toFixed(2));
const deg = (rad: number) => Math.round(((rad || 0) * 180) / Math.PI);

/** Convert any live 3D CampusLayout into formatted, human-readable SAR source code. */
export function serializeLayoutToSar(layout: CampusLayout): string {
  const out: string[] = [
    '# SAR — Spatial Architectural Representation (SARE 3D Blueprint)',
    `campus ${q('SchoolSync Campus')} grid ${n(layout.meta.gridSize || 0.5)} theme ${layout.meta.theme || 'apple-clay'}`,
    '',
  ];

  for (const w of layout.wings) {
    out.push(`wing ${w.id} ${q(w.labelAr || w.labelEn || w.id)} color ${w.color || '#007aff'}`);
  }
  if (layout.wings.length) out.push('');

  for (const fl of layout.floors) {
    out.push(`floor ${fl.id} ${q(fl.labelAr || fl.labelEn || fl.id)} y ${n(fl.elevationY)} height ${n(fl.ceilingHeight)}`);
    const flRooms = layout.rooms.filter((r) => r.floorId === fl.id);
    for (const r of flRooms) {
      const parts = [
        `  room ${r.id} ${q(r.label || r.id)}`,
        `kind ${r.kind}`,
        ...(r.className ? [`class ${q(r.className)}`] : []),
        `wing ${r.wingId}`,
        `size ${n(r.width)}x${n(r.depth)}`,
        `height ${n(r.wallHeight)}`,
        ...(r.wallThickness && Math.abs(r.wallThickness - 0.2) > 0.01 ? [`thickness ${n(r.wallThickness)}`] : []),
        `at (${n(r.x)}, ${n(r.z)})`,
        ...(deg(r.rotationY) !== 0 ? [`rot ${deg(r.rotationY)}`] : []),
      ];
      out.push(parts.join(' '));

      if (r.points && r.points.length >= 3) {
        const pts = r.points.map((p) => `(${n(p.x)},${n(p.z)})`).join(', ');
        out.push(`    shape [${pts}]`);
      }

      for (const op of r.openings || []) {
        const target = typeof op.wallIndex === 'number' ? String(op.wallIndex) : op.wall;
        out.push(`    ${op.type} ${target} ${n(op.offset)} width ${n(op.width)} height ${n(op.height)}`);
      }

      for (const edgeIdx of r.openEdges || []) {
        const tok = edgeIdx < 4 ? IDX_TO_CARDINAL[edgeIdx] : String(edgeIdx);
        out.push(`    open ${tok}`);
      }

      if (r.wallColor || r.floorColor) {
        const cp = ['    color'];
        if (r.wallColor) cp.push(`wall ${r.wallColor}`);
        if (r.floorColor) cp.push(`floor ${r.floorColor}`);
        out.push(cp.join(' '));
      }

      if (r.roomState && r.roomState !== 'normal') {
        out.push(`    state ${r.roomState}${r.stateNote ? ` ${q(r.stateNote)}` : ''}`);
      }
    }

    const roomMap = new Map(flRooms.map((r) => [r.id, r]));
    const flProps = layout.props.filter((p) => p.floorId === fl.id);
    for (const p of flProps) {
      const host = p.roomId ? roomMap.get(p.roomId) : undefined;
      const anchor = host
        ? `in ${host.id} offset (${n(p.x - host.x)}, ${n(p.z - host.z)})`
        : `at (${n(p.x)}, ${n(p.z)})`;
      const rp = [`  prop ${p.prefabId} ${anchor}`];
      if (deg(p.rotationY) !== 0) rp.push(`rot ${deg(p.rotationY)}`);
      if (Math.abs((p.scale ?? 1) - 1) > 0.01) rp.push(`scale ${n(p.scale)}`);
      if (p.colorTint) rp.push(`tint ${p.colorTint}`);
      out.push(rp.join(' '));
    }
    out.push('');
  }

  return `${out.join('\n').trim()}\n`;
}
