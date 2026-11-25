/**
 * Wi-Fi BSSID / BLE beacon scan bridge (native Capacitor Android APK adapter with
 * graceful Web fallback) plus Room Check-In QR URL parser.
 */

export interface ScannedBeaconSignal {
  identifier: string;
  rssi: number;
}

interface NativeBeaconPlugin {
  scan?: () => Promise<{ signals?: ScannedBeaconSignal[] }>;
}

interface CapacitorGlobal {
  Plugins?: {
    CampusBeaconScanner?: NativeBeaconPlugin;
  };
}

/** Extract room ID from a printed classroom QR URL or deep link (`?checkin=roomId`). */
export function parseRoomCheckinParam(input: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (raw.startsWith('schoolsync://room/')) {
    return raw.slice('schoolsync://room/'.length).split(/[?#]/)[0] || null;
  }
  try {
    const u = new URL(raw);
    return u.searchParams.get('checkin') || null;
  } catch {
    return null;
  }
}

/** Build printable check-in URL anchored to a custom 3D room ID. */
export function buildRoomQrPayload(roomId: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://schoolsync.local';
  return `${base}/?checkin=${encodeURIComponent(roomId)}`;
}

/** Scan nearby Wi-Fi/BLE beacons if native plugin is installed; returns [] on web. */
export async function scanNearbyBeacons(): Promise<ScannedBeaconSignal[]> {
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
    const scanner = cap?.Plugins?.CampusBeaconScanner;
    if (!scanner?.scan) return [];
    const res = await scanner.scan();
    return Array.isArray(res?.signals) ? res.signals : [];
  } catch {
    return [];
  }
}
