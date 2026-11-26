/**
 * 3D Spatial Campus parametric layout CRUD, silent SAR compilation & compact storage,
 * geo-anchor calibration, and hardware beacon persistence routes.
 */
const { z } = require('zod');
const { layoutPayloadSchema } = require('./campus-layout-schema.cjs');
const { id, fail } = require('./db.cjs');
const { layoutToSar, sarToLayout } = require('./sar-codec.cjs');

/** Resolve a DB layout row into compiled CampusLayout JSON + compact SAR string. */
function decodeLayoutRow(row) {
  if (!row) return { layout: null, sar: null };
  let layout = null;
  if (row.payload_json) {
    try {
      layout = JSON.parse(row.payload_json);
    } catch {
      layout = null;
    }
  }
  if (!layout && row.sar_source) {
    try {
      layout = sarToLayout(row.sar_source);
    } catch {
      layout = null;
    }
  }
  const sar = row.sar_source || (layout ? layoutToSar(layout) : null);
  return { layout, sar };
}

/** Read compiled published campus blueprint for a school (returns null if blank). */
function getPublishedLayoutPayload(one, schoolId) {
  const row = one(
    "SELECT payload_json, sar_source, version, updated_at FROM campus_layouts WHERE school_id=? AND status='published'",
    schoolId,
  );
  return decodeLayoutRow(row).layout;
}

/** Read raw compact SAR source for the school's published 3D blueprint. */
function getPublishedLayoutSar(one, schoolId) {
  const row = one(
    "SELECT payload_json, sar_source FROM campus_layouts WHERE school_id=? AND status='published'",
    schoolId,
  );
  return decodeLayoutRow(row).sar;
}

/** Register `/api/campus-layout`, `/api/campus-geo`, and `/api/campus-beacons` routes. */
function registerCampusLayoutRoutes(app, ctx) {
  const { one, all, run, audit, staff, schoolManager, clock } = ctx;

  app.get('/api/campus-layout', async (req) => {
    const u = req.user;
    staff(u);
    const pubRow = one(
      "SELECT payload_json, sar_source FROM campus_layouts WHERE school_id=? AND status='published'",
      u.school_id,
    );
    const pub = decodeLayoutRow(pubRow);
    let draft = null;
    let draftSar = null;
    if (['admin', 'assistant'].includes(u.role)) {
      const dRow = one(
        "SELECT payload_json, sar_source FROM campus_layouts WHERE school_id=? AND status='draft'",
        u.school_id,
      );
      const dec = decodeLayoutRow(dRow);
      draft = dec.layout;
      draftSar = dec.sar;
    }
    const geoAnchor = one('SELECT * FROM campus_geo_anchors WHERE school_id=?', u.school_id) || null;
    const beacons = all('SELECT * FROM campus_beacons WHERE school_id=?', u.school_id);
    return { published: pub.layout, publishedSar: pub.sar, draft, draftSar, geoAnchor, beacons };
  });

  app.post('/api/campus-layout', async (req) => {
    const u = req.user;
    schoolManager(u);
    const body = z
      .object({
        status: z.enum(['draft', 'published']).default('published'),
        sar: z.string().max(120000).optional(),
        layout: layoutPayloadSchema.optional(),
      })
      .refine((v) => Boolean(v.sar || v.layout), { message: 'Either sar or layout is required' })
      .parse(req.body);

    const compiled = body.sar ? layoutPayloadSchema.parse(sarToLayout(body.sar)) : body.layout;
    const sarSource = body.sar || layoutToSar(compiled);

    const existing = one(
      'SELECT version FROM campus_layouts WHERE school_id=? AND status=?',
      u.school_id,
      body.status,
    );
    const nextVersion = Number(existing?.version || 0) + 1;
    const nowIso = clock().toISOString();
    const payload = {
      ...compiled,
      meta: {
        ...compiled.meta,
        version: nextVersion,
        publishedAt: body.status === 'published' ? nowIso : compiled.meta.publishedAt,
      },
    };
    const jsonText = JSON.stringify(payload);

    ctx.db.transaction(() => {
      run(
        `INSERT INTO campus_layouts(school_id,status,version,payload_json,sar_source,updated_by,updated_at)
         VALUES(?,?,?,?,?,?,?)
         ON CONFLICT(school_id,status) DO UPDATE SET
           version=excluded.version,
           payload_json=excluded.payload_json,
           sar_source=excluded.sar_source,
           updated_by=excluded.updated_by,
           updated_at=excluded.updated_at`,
        u.school_id,
        body.status,
        nextVersion,
        jsonText,
        sarSource,
        u.id,
        nowIso,
      );
      audit(u, `Compiled & saved SAR campus ${body.status} layout v${nextVersion}`);
    })();

    if (body.status === 'published') ctx.wsHub?.broadcastCampusLayout(u.school_id);
    return {
      ok: true,
      status: body.status,
      version: nextVersion,
      sarBytes: Buffer.byteLength(sarSource, 'utf8'),
      jsonBytes: Buffer.byteLength(jsonText, 'utf8'),
      sar: sarSource,
      layout: payload,
    };
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
      u.school_id, v.origin_lat, v.origin_lng, v.bearing_deg, v.scale, v.geofence_radius_m, nowIso,
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
      bid, u.school_id, v.room_id, v.floor_id, v.beacon_type, v.identifier, v.rssi_ref, v.x, v.y, v.z,
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

module.exports = { registerCampusLayoutRoutes, getPublishedLayoutPayload, getPublishedLayoutSar };
