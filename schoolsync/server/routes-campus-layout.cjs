/**
 * 3D Spatial Campus parametric layout CRUD, starter templates, geo-anchor calibration,
 * and room Wi-Fi/BLE/QR beacon persistence routes (Manager writes; Staff reads).
 */
const { z } = require('zod');
const { id, fail } = require('./db.cjs');

const openingSchema = z.object({
  id: z.string().trim().min(1).max(64),
  wall: z.enum(['N', 'S', 'E', 'W']),
  wallIndex: z.number().int().min(0).max(15).optional(),
  offset: z.number().min(-40).max(40),
  width: z.number().min(0.6).max(12),
  height: z.number().min(0.6).max(5),
  type: z.enum(['door', 'double_door', 'window', 'arch']),
});

const assignmentSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  type: z.enum(['duty', 'exam', 'homework_zone', 'event']).default('duty'),
  assigneeId: z.string().trim().max(80).default(''),
  dueAt: z.string().trim().max(40).default(''),
  offsetX: z.number().min(-25).max(25).default(0),
  offsetZ: z.number().min(-25).max(25).default(0),
});

const roomSchema = z.object({
  id: z.string().trim().min(1).max(64),
  floorId: z.string().trim().min(1).max(64),
  wingId: z.string().trim().min(1).max(64),
  kind: z.enum([
    'classroom', 'principal', 'teachers', 'reception', 'counselor',
    'auditorium', 'library', 'lab', 'courtyard', 'corridor',
    'stairs', 'restroom', 'assignment_zone', 'custom',
  ]),
  label: z.string().trim().max(120).default(''),
  className: z.string().trim().max(80).default(''),
  x: z.number().min(-200).max(200),
  z: z.number().min(-200).max(200),
  width: z.number().min(1.5).max(100),
  depth: z.number().min(1.5).max(100),
  points: z
    .array(z.object({ x: z.number().min(-60).max(60), z: z.number().min(-60).max(60) }))
    .min(3)
    .max(16)
    .optional(),
  rotationY: z.number().min(-Math.PI * 2).max(Math.PI * 2).default(0),
  wallHeight: z.number().min(0.1).max(8).default(3.2),
  wallThickness: z.number().min(0.08).max(0.8).default(0.2),
  wallColor: z.string().trim().max(24).optional(),
  floorColor: z.string().trim().max(24).optional(),
  roomState: z.enum(['normal', 'highlight', 'note', 'alert', 'maintenance']).optional(),
  stateNote: z.string().trim().max(180).optional(),
  openEdges: z.array(z.number().int().min(0).max(15)).max(16).optional(),
  openings: z.array(openingSchema).max(24).default([]),
  assignments3D: z.array(assignmentSchema).max(24).default([]),
});

const floorSchema = z.object({
  id: z.string().trim().min(1).max(64),
  index: z.number().int().min(-3).max(12),
  labelAr: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().min(1).max(60),
  elevationY: z.number().min(-20).max(60),
  ceilingHeight: z.number().min(2).max(8).default(3.4),
});

const wingSchema = z.object({
  id: z.string().trim().min(1).max(64),
  labelAr: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().min(1).max(60),
  color: z.string().trim().max(24).default('#007aff'),
  floorIds: z.array(z.string()).max(12).default([]),
});

const propSchema = z.object({
  id: z.string().trim().min(1).max(64),
  floorId: z.string().trim().min(1).max(64),
  roomId: z.string().trim().max(64).optional(),
  prefabId: z.string().trim().min(1).max(64),
  category: z.enum(['furniture', 'nature', 'facilities', 'pins']).default('furniture'),
  x: z.number().min(-200).max(200),
  y: z.number().min(-20).max(60).default(0),
  z: z.number().min(-200).max(200),
  rotationY: z.number().min(-Math.PI * 2).max(Math.PI * 2).default(0),
  scale: z.number().min(0.2).max(5).default(1),
  colorTint: z.string().trim().max(24).optional(),
});

const layoutPayloadSchema = z.object({
  meta: z.object({
    version: z.number().int().min(1).default(1),
    gridSize: z.number().min(0.1).max(5).default(0.5),
    unit: z.string().default('m'),
    theme: z.string().default('apple-clay'),
    publishedAt: z.string().optional(),
  }),
  floors: z.array(floorSchema).min(1).max(10),
  wings: z.array(wingSchema).min(1).max(24),
  rooms: z.array(roomSchema).max(160),
  props: z.array(propSchema).max(800),
});

/** Read and parse published campus blueprint for a school (returns null if blank). */
function getPublishedLayoutPayload(one, schoolId) {
  const row = one(
    "SELECT payload_json, version, updated_at FROM campus_layouts WHERE school_id=? AND status='published'",
    schoolId,
  );
  if (!row?.payload_json) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

/** Register `/api/campus-layout`, `/api/campus-geo`, and `/api/campus-beacons` routes. */
function registerCampusLayoutRoutes(app, ctx) {
  const { one, all, run, audit, staff, schoolManager, clock } = ctx;

  app.get('/api/campus-layout', async (req) => {
    const u = req.user;
    staff(u);
    const published = getPublishedLayoutPayload(one, u.school_id);
    let draft = null;
    if (['admin', 'assistant'].includes(u.role)) {
      const dRow = one(
        "SELECT payload_json FROM campus_layouts WHERE school_id=? AND status='draft'",
        u.school_id,
      );
      if (dRow?.payload_json) {
        try {
          draft = JSON.parse(dRow.payload_json);
        } catch {
          draft = null;
        }
      }
    }
    const geoAnchor = one('SELECT * FROM campus_geo_anchors WHERE school_id=?', u.school_id) || null;
    const beacons = all('SELECT * FROM campus_beacons WHERE school_id=?', u.school_id);
    return { published, draft, geoAnchor, beacons };
  });

  app.post('/api/campus-layout', async (req) => {
    const u = req.user;
    schoolManager(u);
    const body = z
      .object({
        status: z.enum(['draft', 'published']).default('published'),
        layout: layoutPayloadSchema,
      })
      .parse(req.body);

    const existing = one(
      'SELECT version FROM campus_layouts WHERE school_id=? AND status=?',
      u.school_id,
      body.status,
    );
    const nextVersion = Number(existing?.version || 0) + 1;
    const nowIso = clock().toISOString();
    const payload = {
      ...body.layout,
      meta: {
        ...body.layout.meta,
        version: nextVersion,
        publishedAt: body.status === 'published' ? nowIso : body.layout.meta.publishedAt,
      },
    };

    ctx.db.transaction(() => {
      run(
        `INSERT INTO campus_layouts(school_id,status,version,payload_json,updated_by,updated_at)
         VALUES(?,?,?,?,?,?)
         ON CONFLICT(school_id,status) DO UPDATE SET
           version=excluded.version,
           payload_json=excluded.payload_json,
           updated_by=excluded.updated_by,
           updated_at=excluded.updated_at`,
        u.school_id,
        body.status,
        nextVersion,
        JSON.stringify(payload),
        u.id,
        nowIso,
      );
      audit(u, `Saved 3D campus ${body.status} layout v${nextVersion}`);
    })();

    if (body.status === 'published') ctx.wsHub?.broadcastCampusLayout(u.school_id);
    return { ok: true, status: body.status, version: nextVersion, layout: payload };
  });

  app.post('/api/campus-geo', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        origin_lat: z.number().min(-90).max(90),
        origin_lng: z.number().min(-180).max(180),
        bearing_deg: z.number().min(-360).max(360).default(0),
        scale: z.number().min(0.1).max(20).default(1),
        geofence_radius_m: z.number().min(20).max(5000).default(250),
      })
      .parse(req.body);
    const nowIso = clock().toISOString();
    run(
      `INSERT INTO campus_geo_anchors(school_id,origin_lat,origin_lng,bearing_deg,scale,geofence_radius_m,updated_at)
       VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(school_id) DO UPDATE SET
         origin_lat=excluded.origin_lat,
         origin_lng=excluded.origin_lng,
         bearing_deg=excluded.bearing_deg,
         scale=excluded.scale,
         geofence_radius_m=excluded.geofence_radius_m,
         updated_at=excluded.updated_at`,
      u.school_id,
      v.origin_lat,
      v.origin_lng,
      v.bearing_deg,
      v.scale,
      v.geofence_radius_m,
      nowIso,
    );
    audit(u, 'Updated campus GPS geo-anchor calibration');
    return { ok: true };
  });

  app.post('/api/campus-beacons', async (req) => {
    const u = req.user;
    schoolManager(u);
    const v = z
      .object({
        id: z.string().trim().max(64).optional(),
        room_id: z.string().trim().min(1).max(64),
        floor_id: z.string().trim().min(1).max(64),
        beacon_type: z.enum(['qr', 'nfc', 'wifi', 'ble']),
        identifier: z.string().trim().min(1).max(160),
        rssi_ref: z.number().min(-120).max(-10).default(-60),
        x: z.number().min(-200).max(200).default(0),
        y: z.number().min(-20).max(60).default(0),
        z: z.number().min(-200).max(200).default(0),
      })
      .parse(req.body);
    const bid = v.id || id();
    run(
      `INSERT INTO campus_beacons(id,school_id,room_id,floor_id,beacon_type,identifier,rssi_ref,x,y,z)
       VALUES(?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         room_id=excluded.room_id, floor_id=excluded.floor_id,
         beacon_type=excluded.beacon_type, identifier=excluded.identifier,
         rssi_ref=excluded.rssi_ref, x=excluded.x, y=excluded.y, z=excluded.z`,
      bid,
      u.school_id,
      v.room_id,
      v.floor_id,
      v.beacon_type,
      v.identifier,
      v.rssi_ref,
      v.x,
      v.y,
      v.z,
    );
    audit(u, `Configured ${v.beacon_type.toUpperCase()} beacon for room ${v.room_id}`);
    return { ok: true, id: bid };
  });

  app.post('/api/campus-beacons/:id/delete', async (req) => {
    const u = req.user;
    schoolManager(u);
    const res = run('DELETE FROM campus_beacons WHERE id=? AND school_id=?', req.params.id, u.school_id);
    if (!res.changes) fail('Beacon not found', 404);
    return { ok: true };
  });
}

module.exports = { registerCampusLayoutRoutes, getPublishedLayoutPayload };
