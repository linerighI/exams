/**
 * Client-side teacher tracking hook: coordinates high-accuracy GPS watching,
 * Wi-Fi/BLE beacon scanning, Room QR URL check-in, and automatic in-app activity pings.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { State, TeacherPresenceRecord } from '../types';
import { parseRoomCheckinParam, scanNearbyBeacons } from './beaconScanner';

/** Merge incoming `/api/live` WebSocket payloads without reloading full state on location pings. */
export function handleLiveSocketMessage(
  rawData: unknown,
  patchState: (updater: (prev: State | null) => State | null) => void,
  refresh: () => Promise<void>,
) {
  try {
    const msg = JSON.parse(String(rawData || '{}')) as { type?: string } & Partial<TeacherPresenceRecord>;
    if (msg.type === 'teacher_location' && msg.teacher_id) {
      patchState((prev) => {
        if (!prev) return prev;
        const list = [...(prev.teacherPresence || [])];
        const idx = list.findIndex((t) => t.teacher_id === msg.teacher_id);
        const merged = msg as TeacherPresenceRecord;
        if (idx >= 0) list[idx] = merged;
        else list.push(merged);
        return { ...prev, teacherPresence: list };
      });
      return;
    }
  } catch {
    /* fallback to full refresh */
  }
  void refresh();
}

export type TrackerStatus = 'active' | 'paused_hours' | 'outside_geofence' | 'off';

/** Manages background GPS/beacon location pings and manual/QR room check-ins. */
export function useTeacherTracker(options: {
  data: State | null;
  activeRoomId: string | null;
}) {
  const { data, activeRoomId } = options;
  const userRole = data?.user.role;
  const isTeacher = userRole === 'teacher';

  const [enabled, setEnabled] = useState<boolean>(() => localStorage.getItem('schoolsync-track-enabled') !== '0');
  const [status, setStatus] = useState<TrackerStatus>('off');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const lastPingAt = useRef<number>(0);
  const lastCoords = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const lastActivityRoom = useRef<string | null>(null);

  useEffect(() => {
    localStorage.setItem('schoolsync-track-enabled', enabled ? '1' : '0');
    if (!enabled) setStatus('off');
  }, [enabled]);

  const sendPing = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const res = await api<{
        ok: boolean;
        paused?: 'outside_hours' | 'outside_geofence';
        presence?: { room_id: string | null };
      }>('/presence/ping', payload);
      if (res.paused === 'outside_hours') setStatus('paused_hours');
      else if (res.paused === 'outside_geofence') setStatus('outside_geofence');
      else {
        setStatus('active');
        if (res.presence) setCurrentRoomId(res.presence.room_id);
      }
    } catch {
      /* silent offline tolerance */
    }
  }, []);

  const checkInRoom = useCallback(
    async (roomId: string, source: 'qr' | 'nfc' | 'manual' | 'activity' = 'manual') => {
      try {
        const res = await api<{ ok: boolean; presence?: { room_id: string | null } }>(
          '/presence/checkin',
          { roomId, source },
        );
        setStatus('active');
        setCurrentRoomId(res.presence?.room_id || roomId);
      } catch {
        /* ignore offline errors */
      }
    },
    [],
  );

  // Handle printed Room Check-In QR URL param (`?checkin=<roomId>`) after sign-in
  useEffect(() => {
    if (!data || !isTeacher) return;
    const qrRoom = parseRoomCheckinParam(window.location.href);
    if (qrRoom) {
      void checkInRoom(qrRoom, 'qr');
      const url = new URL(window.location.href);
      url.searchParams.delete('checkin');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [data?.user.id, isTeacher, checkInRoom]);

  // Automatic contextual ping when teacher opens a classroom window in the app
  useEffect(() => {
    if (!data || !isTeacher || !enabled || !activeRoomId) return;
    if (activeRoomId === lastActivityRoom.current) return;
    lastActivityRoom.current = activeRoomId;
    void sendPing({ roomId: activeRoomId, source: 'activity' });
  }, [data?.user.id, isTeacher, enabled, activeRoomId, sendPing]);

  // Continuous throttled GPS + BLE/Wi-Fi sensor watch for teachers during school hours
  useEffect(() => {
    if (!data || !isTeacher || !enabled) {
      if (!isTeacher || !enabled) setStatus('off');
      return;
    }

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          lastCoords.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          if (Date.now() - lastPingAt.current >= 9000) {
            lastPingAt.current = Date.now();
            void scanNearbyBeacons().then((beacons) =>
              sendPing({
                ...lastCoords.current,
                beacons: beacons.length ? beacons : undefined,
                source: beacons.length ? 'wifi' : 'gps',
              }),
            );
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      );
    }

    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastPingAt.current < 10000) return;
      lastPingAt.current = Date.now();
      const beacons = await scanNearbyBeacons();
      if (beacons.length || lastCoords.current) {
        await sendPing({
          ...(lastCoords.current || {}),
          beacons: beacons.length ? beacons : undefined,
          source: beacons.length ? 'wifi' : 'gps',
        });
      }
    }, 12000);

    return () => {
      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
    };
  }, [data?.user.id, isTeacher, enabled, sendPing]);

  return {
    isTeacher,
    trackingEnabled: enabled,
    setTrackingEnabled: setEnabled,
    trackingStatus: status,
    currentRoomId,
    checkInRoom,
  };
}
