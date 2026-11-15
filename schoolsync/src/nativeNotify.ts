/**
 * TypeScript bridge to the Android native `SchoolSyncNotify` Capacitor plugin.
 * Safely no-ops on desktop browsers while delivering real Android notification-shade
 * alerts when running in the native APK.
 */
import { registerPlugin } from '@capacitor/core';
import { getServerBase, isCapacitorNative } from './api';

interface NativeNotifyPlugin {
  ensurePermission(): Promise<{ granted: boolean }>;
  configure(options: { serverUrl: string; token: string; seenIds: string[] }): Promise<void>;
  showNotification(options: { id: string; title: string; body: string; urgent?: boolean }): Promise<void>;
  clearSession(): Promise<void>;
}

const SchoolSyncNotify = registerPlugin<NativeNotifyPlugin>('SchoolSyncNotify');

/** Request Android 13+ notification permission when running inside the native APK. */
export async function ensureNativeNotificationPermission(): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    const res = await SchoolSyncNotify.ensurePermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

/** Sync server base URL, Bearer token, and initial notification IDs to Android service. */
export async function configureNativeNotifications(seenIds: string[]): Promise<void> {
  if (!isCapacitorNative()) return;
  const token = localStorage.getItem('schoolsync-native-token') || '';
  if (!token) return;
  try {
    await SchoolSyncNotify.configure({
      serverUrl: getServerBase(),
      token,
      seenIds,
    });
  } catch {
    // Non-fatal if plugin is unavailable in an older container.
  }
}

/** Post a live alert to the phone's native notification panel (status bar + lock screen). */
export async function showNativeNotification(item: {
  id: string;
  title: string;
  content: string;
}): Promise<void> {
  if (!isCapacitorNative()) return;
  const urgent =
    item.title.includes('غياب') || item.title.includes('تأخر') || item.title.includes('تحقق');
  try {
    await SchoolSyncNotify.showNotification({
      id: item.id,
      title: item.title,
      body: item.content,
      urgent,
    });
  } catch {
    // Non-fatal on browsers or restricted WebViews.
  }
}

/** Stop the native LAN background notification listener on sign out. */
export async function clearNativeNotificationsSession(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    await SchoolSyncNotify.clearSession();
  } catch {
    // Ignore when already stopped.
  }
}

const seenNotificationIds = new Set<string>();
let nativeBootstrapped = false;

/** Seed seen alerts on login/initial load and push only brand-new unread alerts natively. */
export function syncNativeAlerts(
  notifications: Array<{ id: string; title: string; content: string; read: number }>,
  requestPerm = false,
): void {
  if (!isCapacitorNative()) return;
  if (requestPerm) void ensureNativeNotificationPermission();
  if (!nativeBootstrapped) {
    nativeBootstrapped = true;
    for (const n of notifications) seenNotificationIds.add(n.id);
    void configureNativeNotifications(notifications.map((n) => n.id));
    return;
  }
  for (const n of notifications) {
    if (seenNotificationIds.has(n.id)) continue;
    seenNotificationIds.add(n.id);
    if (!n.read) void showNativeNotification(n);
  }
}

/** Reset local notification memory on sign-out so the next account starts fresh. */
export function resetNativeAlertsMemory(): void {
  seenNotificationIds.clear();
  nativeBootstrapped = false;
  void clearNativeNotificationsSession();
}
