/**
 * Optional 1-click Jordanian starter school blueprint generator loaded explicitly from
 * the 3D School Editor (never forced over the default Blank Canvas).
 */
import type { CampusLayout, CampusProp, CampusRoom, SchoolClass } from '../../types';

function makeRoom(
  id: string,
  floorId: string,
  wingId: string,
  kind: CampusRoom['kind'],
  label: string,
  className: string,
  x: number,
  z: number,
  width: number,
  depth: number,
  doorWall: 'N' | 'S' | 'E' | 'W' = 'E',
): CampusRoom {
  return {
    id,
    floorId,
    wingId,
    kind,
    label,
    className,
    x,
    z,
    width,
    depth,
    rotationY: 0,
    wallHeight: kind === 'courtyard' ? 0.35 : 3.2,
    wallThickness: 0.2,
    openings:
      kind === 'courtyard'
        ? []
        : [
            { id: `${id}-d`, wall: doorWall, offset: 0, width: 1.15, height: 2.25, type: 'door' },
            {
              id: `${id}-w`,
              wall: doorWall === 'E' ? 'W' : doorWall === 'W' ? 'E' : 'S',
              offset: 0,
              width: Math.min(2.6, Math.max(1.2, (doorWall === 'E' || doorWall === 'W' ? depth : width) * 0.45)),
              height: 1.3,
              type: 'window',
            },
          ],
    assignments3D: [],
  };
}

/** Generate an editable 2-floor Jordanian school starter campus bound to real classes. */
export function createStarterSchoolLayout(classes: SchoolClass[] = []): CampusLayout {
  const sorted = [...classes].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  const pickCls = (idx: number) => sorted[idx]?.name || '';

  const rooms: CampusRoom[] = [
    // Floor 1 West Wing (Lower Wing) — 4 Classrooms
    makeRoom('wl-1', 'floor-1', 'west-lower', 'classroom', pickCls(0) || 'قاعة ١٠١', pickCls(0), -13, -3, 6, 5.5, 'E'),
    makeRoom('wl-2', 'floor-1', 'west-lower', 'classroom', pickCls(1) || 'قاعة ١٠٢', pickCls(1), -13, 3, 6, 5.5, 'E'),
    makeRoom('wl-3', 'floor-1', 'west-lower', 'classroom', pickCls(2) || 'قاعة ١٠٣', pickCls(2), -13, 9, 6, 5.5, 'E'),
    makeRoom('wl-4', 'floor-1', 'west-lower', 'corridor', 'ممر الطابق الأول', '', -9.2, 3, 1.6, 17.5, 'E'),

    // Floor 1 East Wing — Lab + Reception + Library
    makeRoom('el-lab', 'floor-1', 'east', 'lab', 'مختبر الحاسوب', '', 13, -3, 6.5, 5.5, 'W'),
    makeRoom('el-rec', 'floor-1', 'north', 'reception', 'الاستقبال وشؤون الطلبة', '', 0, -9.5, 6.5, 5, 'S'),
    makeRoom('el-lib', 'floor-1', 'east', 'library', 'المكتبة والأرشيف', '', 13, 3, 6.5, 5.5, 'W'),
    makeRoom('el-aud', 'floor-1', 'north', 'auditorium', 'المسرح والأنشطة', '', -7.5, -9.5, 8, 5, 'S'),

    // Central Courtyard on Floor 1
    makeRoom('courtyard', 'floor-1', 'courtyard', 'courtyard', 'الساحة المدرسية', '', 0, 2.5, 16, 16.5, 'N'),

    // North Admin Wing (Principal, Teachers, Counselor) on Floor 1 East-North
    makeRoom('nm-teachers', 'floor-1', 'north', 'teachers', 'غرفة المعلمين', '', 7.2, -9.5, 7, 5, 'S'),
    makeRoom('nm-principal', 'floor-1', 'north', 'principal', 'مكتب المدير', '', 13.8, -9.5, 5.5, 5, 'S'),
    makeRoom('nm-counselor', 'floor-1', 'north', 'counselor', 'مكتب المساعد والمرشد', '', 13.8, 9, 6.5, 5.5, 'W'),

    // Floor 2 West Wing Main — Upper Classrooms
    makeRoom('wm-1', 'floor-2', 'west-main', 'classroom', pickCls(3) || 'قاعة ٢٠١', pickCls(3), -13, -3, 6, 5.5, 'E'),
    makeRoom('wm-2', 'floor-2', 'west-main', 'classroom', pickCls(4) || 'قاعة ٢٠٢', pickCls(4), -13, 3, 6, 5.5, 'E'),
    makeRoom('wm-3', 'floor-2', 'west-main', 'classroom', pickCls(5) || 'قاعة ٢٠٣', pickCls(5), -13, 9, 6, 5.5, 'E'),
  ];

  // Sample 3D spatial assignment pin in courtyard
  rooms[8].assignments3D.push({
    id: 'assign-duty-1',
    title: 'مناوبة الفسحة المدرسية',
    type: 'duty',
    assigneeId: '',
    dueAt: '10:30',
    offsetX: -3,
    offsetZ: -2,
  });

  const props: CampusProp[] = [
    { id: 'p-tree-1', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'tree_round', category: 'nature', x: -5.5, y: 0, z: -3, rotationY: 0, scale: 1 },
    { id: 'p-tree-2', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'tree_round', category: 'nature', x: 5.5, y: 0, z: -3, rotationY: 0.4, scale: 1 },
    { id: 'p-tree-3', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'tree_cypress', category: 'nature', x: -5.5, y: 0, z: 7.5, rotationY: 0, scale: 1 },
    { id: 'p-tree-4', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'tree_cypress', category: 'nature', x: 5.5, y: 0, z: 7.5, rotationY: 0.5, scale: 1 },
    { id: 'p-flag-1', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'flagpole', category: 'facilities', x: 0, y: 0, z: -3.2, rotationY: 0, scale: 1 },
    { id: 'p-hoop-1', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'basketball_hoop', category: 'facilities', x: 0, y: 0, z: 9.2, rotationY: Math.PI, scale: 1 },
    { id: 'p-bench-1', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'bench', category: 'nature', x: -3.2, y: 0, z: 2.5, rotationY: Math.PI / 2, scale: 1 },
    { id: 'p-bench-2', floorId: 'floor-1', roomId: 'courtyard', prefabId: 'bench', category: 'nature', x: 3.2, y: 0, z: 2.5, rotationY: -Math.PI / 2, scale: 1 },
    { id: 'p-stairs-1', floorId: 'floor-1', prefabId: 'stairs', category: 'facilities', x: -9.2, y: 0, z: -8.5, rotationY: 0, scale: 1 },
    { id: 'p-conf-1', floorId: 'floor-1', roomId: 'nm-teachers', prefabId: 'conference_table', category: 'furniture', x: 7.2, y: 0, z: -9.5, rotationY: 0, scale: 1 },
    { id: 'p-pdesk-1', floorId: 'floor-1', roomId: 'nm-principal', prefabId: 'teacher_desk', category: 'furniture', x: 13.8, y: 0, z: -10, rotationY: 0, scale: 1.15 },
    { id: 'p-lab-1', floorId: 'floor-1', roomId: 'el-lab', prefabId: 'lab_bench', category: 'furniture', x: 13, y: 0, z: -3, rotationY: 0, scale: 1 },
    { id: 'p-lib-1', floorId: 'floor-1', roomId: 'el-lib', prefabId: 'bookshelf', category: 'furniture', x: 14.5, y: 0, z: 2, rotationY: Math.PI / 2, scale: 1 },
  ];

  // Populate clean desk cluster & whiteboard in starter classrooms
  for (const r of rooms) {
    if (r.kind !== 'classroom') continue;
    const elev = r.floorId === 'floor-2' ? 3.5 : 0;
    props.push(
      { id: `p-dk-${r.id}`, floorId: r.floorId, roomId: r.id, prefabId: 'desk_cluster', category: 'furniture', x: r.x, y: elev, z: r.z + 0.5, rotationY: 0, scale: 0.95 },
      { id: `p-wb-${r.id}`, floorId: r.floorId, roomId: r.id, prefabId: 'whiteboard', category: 'furniture', x: r.x, y: elev, z: r.z - r.depth / 2 + 0.3, rotationY: 0, scale: 1 },
    );
  }

  return {
    meta: { version: 1, gridSize: 0.5, unit: 'm', theme: 'apple-clay' },
    floors: [
      { id: 'floor-1', index: 1, labelAr: 'الطابق الأول', labelEn: 'Floor 1', elevationY: 0, ceilingHeight: 3.5 },
      { id: 'floor-2', index: 2, labelAr: 'الطابق الثاني', labelEn: 'Floor 2', elevationY: 3.5, ceilingHeight: 3.5 },
    ],
    wings: [
      { id: 'west-lower', labelAr: 'الجناح الغربي (الأول)', labelEn: 'West Wing (F1)', color: '#007aff', floorIds: ['floor-1'] },
      { id: 'west-main', labelAr: 'الجناح الغربي (الثاني)', labelEn: 'West Wing (F2)', color: '#5856d6', floorIds: ['floor-2'] },
      { id: 'east', labelAr: 'الجناح الشرقي', labelEn: 'East Wing', color: '#34c759', floorIds: ['floor-1'] },
      { id: 'north', labelAr: 'الجناح الإداري', labelEn: 'Admin Wing', color: '#ff9500', floorIds: ['floor-1'] },
      { id: 'courtyard', labelAr: 'الساحة المدرسية', labelEn: 'Courtyard', color: '#06b6d4', floorIds: ['floor-1'] },
    ],
    rooms,
    props,
  };
}
