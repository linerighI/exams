/**
 * Sandbox-only interactive 3D campus blueprint, wing assignments, and daily attendance seeder.
 * Loaded strictly when `--sandbox` is enabled so tests and live school databases remain untouched.
 */
const { layoutPayloadSchema } = require('./campus-layout-schema.cjs');
const { day, id } = require('./db.cjs');
const { layoutToSar } = require('./sar-codec.cjs');

/** Populate an isolated sandbox school with a ready-to-explore 2-wing 3D campus and live stats. */
function seedSandboxCampus(db) {
  const existing = db
    .prepare("SELECT 1 FROM campus_layouts WHERE school_id='school-demo' AND status='published'")
    .get();
  if (existing) return;

  const layout = layoutPayloadSchema.parse({
    meta: { version: 1, gridSize: 0.5, unit: 'm', theme: 'apple-clay' },
    floors: [
      { id: 'floor-1', index: 1, labelAr: 'الطابق الأرضي', labelEn: 'Ground Floor', elevationY: 0, ceilingHeight: 3.4 },
    ],
    wings: [
      { id: 'west-main', labelAr: 'الجناح الغربي', labelEn: 'West Wing', color: '#007aff', floorIds: ['floor-1'] },
      { id: 'east', labelAr: 'الجناح الشرقي', labelEn: 'East Wing', color: '#10b981', floorIds: ['floor-1'] },
      { id: 'courtyard', labelAr: 'الساحة الرئيسية', labelEn: 'Courtyard', color: '#f59e0b', floorIds: ['floor-1'] },
    ],
    rooms: [
      { id: 'sb-principal', floorId: 'floor-1', wingId: 'west-main', kind: 'principal', label: 'مكتب المدير', className: '', x: -12, z: -6, width: 7, depth: 6, rotationY: 0, wallHeight: 3.2, wallThickness: 0.2, openings: [], assignments3D: [] },
      { id: 'sb-reception', floorId: 'floor-1', wingId: 'west-main', kind: 'reception', label: 'الاستقبال وشؤون الطلبة', className: '', x: -12, z: 2, width: 7, depth: 6, rotationY: 0, wallHeight: 3.2, wallThickness: 0.2, openings: [], assignments3D: [] },
      { id: 'sb-8a', floorId: 'floor-1', wingId: 'west-main', kind: 'classroom', label: 'الثامن أ (8A)', className: '8A', x: -3.5, z: -6, width: 8, depth: 7, rotationY: 0, wallHeight: 3.2, wallThickness: 0.2, openings: [], assignments3D: [] },
      { id: 'sb-west-hall', floorId: 'floor-1', wingId: 'west-main', kind: 'corridor', label: 'ممر الغرب', className: '', x: -3.5, z: 0, width: 8, depth: 3.5, rotationY: 0, wallHeight: 3.2, wallThickness: 0.16, openings: [], assignments3D: [] },
      { id: 'sb-courtyard', floorId: 'floor-1', wingId: 'courtyard', kind: 'courtyard', label: 'الساحة الرئيسية', className: '', x: 3.5, z: 4, width: 9, depth: 7, rotationY: 0, wallHeight: 0.4, wallThickness: 0.2, openings: [], assignments3D: [] },
      { id: 'sb-teachers', floorId: 'floor-1', wingId: 'east', kind: 'teachers', label: 'غرفة المعلمين', className: '', x: 11.5, z: -6, width: 7, depth: 6, rotationY: 0, wallHeight: 3.2, wallThickness: 0.2, openings: [], assignments3D: [] },
      { id: 'sb-6b', floorId: 'floor-1', wingId: 'east', kind: 'classroom', label: 'السادس ب (6B)', className: '6B', x: 11.5, z: 2, width: 8, depth: 7, rotationY: 0, wallHeight: 3.2, wallThickness: 0.2, openings: [], assignments3D: [] },
    ],
    props: [
      { id: 'sb-desk-1', floorId: 'floor-1', roomId: 'sb-8a', prefabId: 'desk_student', category: 'furniture', x: -4.5, y: 0, z: -6.5, rotationY: 0, scale: 1 },
      { id: 'sb-desk-2', floorId: 'floor-1', roomId: 'sb-8a', prefabId: 'desk_student', category: 'furniture', x: -2.5, y: 0, z: -6.5, rotationY: 0, scale: 1 },
      { id: 'sb-tree-1', floorId: 'floor-1', roomId: 'sb-courtyard', prefabId: 'tree', category: 'nature', x: 3.5, y: 0, z: 4, rotationY: 0, scale: 1.1 },
    ],
  });

  const sarSource = layoutToSar(layout);
  const today = day('Asia/Amman', new Date());

  db.transaction(() => {
    db.prepare(
      "INSERT OR REPLACE INTO campus_layouts(school_id,status,version,payload_json,sar_source,updated_by) VALUES('school-demo','published',1,?,?,'admin-demo')",
    ).run(JSON.stringify(layout), sarSource);

    db.prepare("INSERT OR IGNORE INTO teacher_wings(school_id,teacher_id,wing) VALUES('school-demo','teacher-demo','west-main')").run();
    db.prepare("INSERT OR IGNORE INTO teacher_wings(school_id,teacher_id,wing) VALUES('school-demo','teacher-sibling','east')").run();
    db.prepare("UPDATE classes SET lead_teacher_id='teacher-demo' WHERE school_id='school-demo' AND name='8A'").run();
    db.prepare("UPDATE classes SET lead_teacher_id='teacher-sibling' WHERE school_id='school-demo' AND name='6B'").run();

    for (const [sid, status] of [
      ['alex', 'present'],
      ['demo-student-1', 'present'],
      ['demo-student-2', 'present'],
      ['demo-student-3', 'absent'],
      ['jamie', 'present'],
      ['demo-student-5', 'late'],
    ]) {
      db.prepare(
        "INSERT OR IGNORE INTO daily_attendance(id,school_id,student_id,date,status,label,recorded_by) VALUES(?,'school-demo',?,?,?,'حضور يومي','admin-demo')",
      ).run(id(), sid, today, status);
    }
  })();
}

module.exports = { seedSandboxCampus };
