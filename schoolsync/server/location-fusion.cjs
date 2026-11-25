/**
 * Multi-signal teacher indoor/outdoor localization engine: fuses QR/NFC locks,
 * Wi-Fi/BLE beacon k-NN RSSI matching, georeferenced GPS + EMA smoothing,
 * app activity check-ins, and Jordanian timetable fallback with privacy gates.
 */

const EARTH_RADIUS_M = 6371000;
const STALE_PING_MS = 5 * 60 * 1000;

/** Convert HH:MM clock string into minutes since midnight. */
function hhmmToMinutes(str) {
  const [h, m] = String(str || '00:00').split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Check if current school local time falls within operating hours + grace window. */
function isWithinSchoolHours(school, now = new Date(), graceMinutes = 20) {
  const tz = school?.timezone || 'Asia/Amman';
  const workdays = new Set(
    String(school?.workdays || '0,1,2,3,4')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n)),
  );
  let weekdayIdx = now.getDay();
  let nowMin = now.getHours() * 60 + now.getMinutes();
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
    weekdayIdx = dayMap[map.weekday] ?? weekdayIdx;
    nowMin = Number(map.hour) * 60 + Number(map.minute);
  } catch {
    /* keep system clock fallback */
  }
  if (!workdays.has(weekdayIdx)) return false;
  const startMin = hhmmToMinutes(school?.start_time || '07:45') - graceMinutes;
  const endMin = hhmmToMinutes(school?.end_time || '14:30') + graceMinutes;
  return nowMin >= startMin && nowMin <= endMin;
}

/** Great-circle Earth surface distance in meters between two WGS84 coordinates. */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convert WGS84 GPS coordinates into 3D campus XZ coordinates + geofence check. */
function gpsToCampusXZ(lat, lng, anchor) {
  if (!anchor) return null;
  const latRad = (anchor.origin_lat * Math.PI) / 180;
  const dNorth = ((lat - anchor.origin_lat) * Math.PI) / 180 * EARTH_RADIUS_M;
  const dEast = ((lng - anchor.origin_lng) * Math.PI) / 180 * EARTH_RADIUS_M * Math.cos(latRad);
  const theta = ((anchor.bearing_deg || 0) * Math.PI) / 180;
  const scale = Math.max(0.1, Number(anchor.scale || 1));
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const x = (dEast * cos - dNorth * sin) / scale;
  const z = (-dNorth * cos - dEast * sin) / scale;
  const distanceM = haversineMeters(lat, lng, anchor.origin_lat, anchor.origin_lng);
  const radiusM = Number(anchor.geofence_radius_m || 250);
  return { x, z, distanceM, insideGeofence: distanceM <= radiusM };
}

/** Match live Wi-Fi/BLE scan RSSI signals against calibrated room beacons. */
function matchBeaconRoom(signals, beacons) {
  if (!Array.isArray(signals) || !signals.length || !Array.isArray(beacons) || !beacons.length) {
    return null;
  }
  const byId = new Map();
  for (const b of beacons) {
    byId.set(String(b.identifier || '').trim().toLowerCase(), b);
  }
  const roomScores = new Map();
  for (const sig of signals) {
    const key = String(sig.identifier || '').trim().toLowerCase();
    const b = byId.get(key);
    if (!b) continue;
    const rssi = Number(sig.rssi ?? -85);
    const ref = Number(b.rssi_ref ?? -60);
    const weight = Math.max(0.05, (100 + rssi) / (1 + Math.abs(rssi - ref)));
    const cur = roomScores.get(b.room_id) || { score: 0, beacon: b };
    cur.score += weight;
    roomScores.set(b.room_id, cur);
  }
  let best = null;
  for (const entry of roomScores.values()) {
    if (!best || entry.score > best.score) best = entry;
  }
  if (!best) return null;
  const { beacon } = best;
  return {
    roomId: beacon.room_id,
    floorId: beacon.floor_id,
    x: Number(beacon.x || 0),
    y: Number(beacon.y || 0),
    z: Number(beacon.z || 0),
    confidence: 0.9,
  };
}

/** Hit-test campus room polygons (with rotation) at floor XZ point. */
function findRoomAtPoint(layout, floorId, x, z, margin = 0.25) {
  const rooms = layout?.rooms || [];
  for (const r of rooms) {
    if (floorId && r.floorId !== floorId) continue;
    const dx = x - r.x;
    const dz = z - r.z;
    const rad = -(r.rotationY || 0);
    const lx = dx * Math.cos(rad) - dz * Math.sin(rad);
    const lz = dx * Math.sin(rad) + dz * Math.cos(rad);
    if (Math.abs(lx) <= r.width / 2 + margin && Math.abs(lz) <= r.depth / 2 + margin) {
      return r;
    }
  }
  return null;
}

/** Apply Exponential Moving Average (EMA) smoothing to dampen indoor GPS jitter. */
function smoothPosition(prev, next, alpha = 0.45) {
  if (!prev || (prev.floor_id && next.floorId && prev.floor_id !== next.floorId)) return next;
  return {
    ...next,
    x: prev.x * (1 - alpha) + next.x * alpha,
    z: prev.z * (1 - alpha) + next.z * alpha,
  };
}

/** Find a teacher's currently active Jordanian timetable lesson + mapped 3D room. */
function findScheduledRoom(layout, school, lessons, teacherId, weekday, nowMin) {
  const active = (lessons || []).find(
    (l) =>
      l.teacher_id === teacherId &&
      Number(l.weekday) === Number(weekday) &&
      hhmmToMinutes(l.start) <= nowMin &&
      hhmmToMinutes(l.end) > nowMin,
  );
  if (!active || !layout?.rooms) return { lesson: active || null, room: null };
  const room = layout.rooms.find((r) => r.className && r.className === active.section) || null;
  return { lesson: active, room };
}

/** Resolve fused teacher 3D position from multi-signal ping and schedule context. */
function resolveTeacherLocation({ ping, prev, layout, beacons, anchor, school, lessons, teacherId, weekday, nowMin }) {
  const floors = layout?.floors || [];
  const floorElev = new Map(floors.map((f) => [f.id, Number(f.elevationY || 0)]));
  const findRoom = (id) => (layout?.rooms || []).find((r) => r.id === id) || null;
  const scheduled = findScheduledRoom(layout, school, lessons, teacherId, weekday, nowMin);

  let resolved = null;
  const src = ping?.source || (ping?.beacons?.length ? 'wifi' : ping?.lat != null ? 'gps' : 'activity');

  if ((src === 'qr' || src === 'nfc') && ping.roomId) {
    const rm = findRoom(ping.roomId);
    if (rm) {
      resolved = {
        roomId: rm.id,
        floorId: rm.floorId,
        x: rm.x,
        y: floorElev.get(rm.floorId) ?? 0,
        z: rm.z,
        source: src,
        confidence: 1.0,
      };
    }
  } else if (ping.beacons?.length) {
    const match = matchBeaconRoom(ping.beacons, beacons);
    if (match) resolved = { ...match, source: src === 'ble' ? 'ble' : 'wifi' };
  }

  if (!resolved && (src === 'manual' || src === 'activity') && ping.roomId) {
    const rm = findRoom(ping.roomId);
    if (rm) {
      resolved = {
        roomId: rm.id,
        floorId: rm.floorId,
        x: rm.x,
        y: floorElev.get(rm.floorId) ?? 0,
        z: rm.z,
        source: src,
        confidence: 0.85,
      };
    }
  }

  if (!resolved && ping.lat != null && ping.lng != null && anchor) {
    const mapped = gpsToCampusXZ(Number(ping.lat), Number(ping.lng), anchor);
    if (mapped) {
      const fid = ping.floorId || floors[0]?.id || 'floor-1';
      const sm = smoothPosition(prev, { x: mapped.x, z: mapped.z, floorId: fid });
      const rm = findRoomAtPoint(layout, fid, sm.x, sm.z);
      const acc = Number(ping.accuracy ?? 12);
      resolved = {
        roomId: rm?.id || null,
        floorId: fid,
        x: sm.x,
        y: floorElev.get(fid) ?? 0,
        z: sm.z,
        source: 'gps',
        confidence: acc <= 6 ? 0.84 : acc <= 15 ? 0.72 : 0.62,
      };
    }
  }

  if (!resolved && Number.isFinite(ping.x) && Number.isFinite(ping.z)) {
    const fid = ping.floorId || floors[0]?.id || 'floor-1';
    const sm = smoothPosition(prev, { x: Number(ping.x), z: Number(ping.z), floorId: fid });
    const rm = findRoomAtPoint(layout, fid, sm.x, sm.z);
    resolved = {
      roomId: rm?.id || null,
      floorId: fid,
      x: sm.x,
      y: floorElev.get(fid) ?? 0,
      z: sm.z,
      source: src,
      confidence: 0.82,
    };
  }

  if (!resolved && scheduled.room) {
    resolved = {
      roomId: scheduled.room.id,
      floorId: scheduled.room.floorId,
      x: scheduled.room.x,
      y: floorElev.get(scheduled.room.floorId) ?? 0,
      z: scheduled.room.z,
      source: 'schedule',
      confidence: 0.35,
    };
  }

  if (!resolved) return null;
  const mismatch = Boolean(scheduled.room && resolved.roomId && scheduled.room.id !== resolved.roomId && resolved.source !== 'schedule');
  const status = resolved.source === 'schedule'
    ? 'offline'
    : mismatch
      ? 'mismatch'
      : scheduled.room && resolved.roomId === scheduled.room.id
        ? 'in_class'
        : 'on_campus';

  return {
    ...resolved,
    status,
    mismatch,
    scheduledRoomId: scheduled.room?.id || null,
    scheduledSection: scheduled.lesson?.section || null,
  };
}

module.exports = {
  STALE_PING_MS,
  hhmmToMinutes,
  isWithinSchoolHours,
  haversineMeters,
  gpsToCampusXZ,
  matchBeaconRoom,
  findRoomAtPoint,
  smoothPosition,
  findScheduledRoom,
  resolveTeacherLocation,
};
