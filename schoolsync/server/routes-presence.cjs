/**
 * Teacher live location pings, QR/NFC room check-ins, sensor fusion persistence,
 * schedule mismatch detection, and manager-only teacher radar + movement trail endpoints.
 */
const { z } = require('zod');
const { id, fail } = require('./db.cjs');
const { getPublishedLayoutPayload } = require('./routes-campus-layout.cjs');
const {
  STALE_PING_MS,
  findScheduledRoom,
  gpsToCampusXZ,
  isWithinSchoolHours,
  resolveTeacherLocation,
} = require('./location-fusion.cjs');

function getSchoolClock(school, now) {
  const tz = school?.timezone || 'Asia/Amman';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      weekday: dayMap[map.weekday] ?? now.getDay(),
      nowMin: Number(map.hour) * 60 + Number(map.minute),
    };
  } catch {
    return { weekday: now.getDay(), nowMin: now.getHours() * 60 + now.getMinutes() };
  }
}

function parseTimestampMs(raw) {
  if (!raw) return 0;
  const iso = String(raw).includes('T') ? String(raw) : `${String(raw).replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/** Build manager-only fused live location snapshot across all school teachers. */
function buildTeacherPresenceList(ctx, school, now) {
  const { one, all } = ctx;
  const teachers = all(
    "SELECT id,name,email FROM users WHERE school_id=? AND role='teacher' ORDER BY name",
    school.id,
  );
  const rows = all('SELECT * FROM teacher_presence WHERE school_id=?', school.id);
  const byId = new Map(rows.map((r) => [r.teacher_id, r]));
  const layout = getPublishedLayoutPayload(one, school.id);
  const lessons = all('SELECT l.*,u.name teacher FROM lessons l JOIN users u ON u.id=l.teacher_id WHERE l.school_id=?', school.id);
  const { weekday, nowMin } = getSchoolClock(school, now);
  const floorElev = new Map((layout?.floors || []).map((f) => [f.id, Number(f.elevationY || 0)]));
  const nowMs = now.getTime();

  return teachers.map((t) => {
    const live = byId.get(t.id);
    const scheduled = findScheduledRoom(layout, school, lessons, t.id, weekday, nowMin);
    const ageMs = live ? Math.max(0, nowMs - parseTimestampMs(live.updated_at)) : Infinity;
    const isFresh = Boolean(live && ageMs <= STALE_PING_MS);

    if (isFresh) {
      const mismatch = Boolean(scheduled.room && live.room_id && scheduled.room.id !== live.room_id);
      const status = mismatch
        ? 'mismatch'
        : scheduled.room && live.room_id === scheduled.room.id
          ? 'in_class'
          : 'on_campus';
      return {
        teacher_id: t.id,
        teacher_name: t.name,
        room_id: live.room_id,
        floor_id: live.floor_id,
        x: live.x,
        y: live.y,
        z: live.z,
        accuracy_m: live.accuracy_m,
        source: live.source,
        confidence: live.confidence,
        status,
        mismatch,
        scheduled_room_id: scheduled.room?.id || null,
        scheduled_section: scheduled.lesson?.section || null,
        updated_at: live.updated_at,
      };
    }

    const fallbackRoom = scheduled.room;
    return {
      teacher_id: t.id,
      teacher_name: t.name,
      room_id: fallbackRoom?.id || null,
      floor_id: fallbackRoom?.floorId || null,
      x: fallbackRoom?.x ?? 0,
      y: fallbackRoom ? floorElev.get(fallbackRoom.floorId) ?? 0 : 0,
      z: fallbackRoom?.z ?? 0,
      accuracy_m: null,
      source: 'schedule',
      confidence: fallbackRoom ? 0.35 : 0,
      status: 'offline',
      mismatch: false,
      scheduled_room_id: fallbackRoom?.id || null,
      scheduled_section: scheduled.lesson?.section || null,
      updated_at: live?.updated_at || null,
    };
  });
}

/** Read single teacher's own presence state (privacy-scoped). */
function getOwnPresence(ctx, u) {
  return ctx.one('SELECT * FROM teacher_presence WHERE teacher_id=? AND school_id=?', u.id, u.school_id) || null;
}

const pingSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(5000).optional(),
  beacons: z
    .array(z.object({ identifier: z.string().trim().min(1).max(160), rssi: z.number().min(-120).max(0) }))
    .max(25)
    .optional(),
  roomId: z.string().trim().max(64).optional(),
  floorId: z.string().trim().max(64).optional(),
  x: z.number().min(-200).max(200).optional(),
  z: z.number().min(-200).max(200).optional(),
  source: z.enum(['qr', 'nfc', 'wifi', 'ble', 'gps', 'activity', 'manual']).optional(),
  forceDemo: z.boolean().optional(),
});

/** Register `/api/presence/*` endpoints for teacher tracking & manager live radar. */
function registerPresenceRoutes(app, ctx, { demo = false } = {}) {
  const { one, all, run, staff, schoolManager, clock } = ctx;

  function processPing(u, ping) {
    const now = clock();
    const nowIso = now.toISOString();
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    const activeSources = new Set(['qr', 'nfc', 'manual', 'activity']);
    const passiveGps = !activeSources.has(ping.source || '') && !ping.beacons?.length;

    if (passiveGps && !ping.forceDemo && !isWithinSchoolHours(school, now)) {
      return { ok: true, paused: 'outside_hours' };
    }

    const anchor = one('SELECT * FROM campus_geo_anchors WHERE school_id=?', u.school_id);
    if (ping.lat != null && ping.lng != null && anchor && !ping.forceDemo) {
      const mapped = gpsToCampusXZ(ping.lat, ping.lng, anchor);
      if (mapped && !mapped.insideGeofence) {
        return { ok: true, paused: 'outside_geofence', distanceM: Math.round(mapped.distanceM) };
      }
    }

    const layout = getPublishedLayoutPayload(one, u.school_id);
    const beacons = all('SELECT * FROM campus_beacons WHERE school_id=?', u.school_id);
    const prev = one('SELECT * FROM teacher_presence WHERE teacher_id=?', u.id);
    const lessons = all('SELECT * FROM lessons WHERE school_id=?', u.school_id);
    const { weekday, nowMin } = getSchoolClock(school, now);

    const resolved = resolveTeacherLocation({
      ping,
      prev,
      layout,
      beacons,
      anchor,
      school,
      lessons,
      teacherId: u.id,
      weekday,
      nowMin,
    });
    if (!resolved) return { ok: true, updated: false };

    const cutoffIso = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
    ctx.db.transaction(() => {
      run(
        `INSERT INTO teacher_presence(teacher_id,school_id,room_id,floor_id,x,y,z,lat,lng,accuracy_m,source,confidence,status,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(teacher_id) DO UPDATE SET
           room_id=excluded.room_id, floor_id=excluded.floor_id,
           x=excluded.x, y=excluded.y, z=excluded.z,
           lat=excluded.lat, lng=excluded.lng, accuracy_m=excluded.accuracy_m,
           source=excluded.source, confidence=excluded.confidence,
           status=excluded.status, updated_at=excluded.updated_at`,
        u.id,
        u.school_id,
        resolved.roomId,
        resolved.floorId,
        resolved.x,
        resolved.y,
        resolved.z,
        ping.lat ?? null,
        ping.lng ?? null,
        ping.accuracy ?? null,
        resolved.source,
        resolved.confidence,
        resolved.status,
        nowIso,
      );
      run(
        'INSERT INTO teacher_location_history(id,school_id,teacher_id,room_id,floor_id,x,z,source,confidence,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        id(),
        u.school_id,
        u.id,
        resolved.roomId,
        resolved.floorId,
        resolved.x,
        resolved.z,
        resolved.source,
        resolved.confidence,
        nowIso,
      );
      run('DELETE FROM teacher_location_history WHERE school_id=? AND recorded_at<?', u.school_id, cutoffIso);
    })();

    const delta = {
      teacher_id: u.id,
      teacher_name: u.name,
      room_id: resolved.roomId,
      floor_id: resolved.floorId,
      x: resolved.x,
      y: resolved.y,
      z: resolved.z,
      accuracy_m: ping.accuracy ?? null,
      source: resolved.source,
      confidence: resolved.confidence,
      status: resolved.status,
      mismatch: resolved.mismatch,
      scheduled_room_id: resolved.scheduledRoomId,
      scheduled_section: resolved.scheduledSection,
      updated_at: nowIso,
    };
    ctx.wsHub?.broadcastTeacherLocation(u.school_id, delta);
    return { ok: true, presence: delta };
  }

  app.post('/api/presence/ping', async (req) => {
    const u = req.user;
    staff(u);
    return processPing(u, pingSchema.parse(req.body || {}));
  });

  app.post('/api/presence/checkin', async (req) => {
    const u = req.user;
    staff(u);
    const v = z
      .object({
        roomId: z.string().trim().min(1).max(64),
        source: z.enum(['qr', 'nfc', 'manual', 'activity']).default('manual'),
      })
      .parse(req.body);
    return processPing(u, v);
  });

  app.get('/api/presence/teachers', async (req) => {
    const u = req.user;
    schoolManager(u);
    const school = one('SELECT * FROM schools WHERE id=?', u.school_id);
    return { teachers: buildTeacherPresenceList(ctx, school, clock()) };
  });

  app.get('/api/presence/teachers/:id/trail', async (req) => {
    const u = req.user;
    schoolManager(u);
    const points = all(
      'SELECT id,room_id,floor_id,x,z,source,confidence,recorded_at FROM teacher_location_history WHERE school_id=? AND teacher_id=? ORDER BY recorded_at ASC LIMIT 300',
      u.school_id,
      req.params.id,
    );
    return { points };
  });
}

module.exports = { registerPresenceRoutes, buildTeacherPresenceList, getOwnPresence };
