import { useSyncExternalStore } from 'react';
export type LiveRoomStatus = { online: number; active: number; open: boolean };
const empty: LiveRoomStatus = { online: 0, active: 0, open: false };
let value = empty;
const listeners = new Set<() => void>();
export function publishLiveRoom(next: LiveRoomStatus) {
  if (value.online === next.online && value.active === next.active && value.open === next.open)
    return;
  value = next;
  listeners.forEach((fn) => fn());
}
export function useLiveRoomStatus() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => value,
    () => empty,
  );
}
