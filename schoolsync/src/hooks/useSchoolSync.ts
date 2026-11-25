/**
 * Core SchoolSync state, WebSocket live-sync, optimistic 1-tap attendance queue,
 * student state switching, and auth mutation hook.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getServerBase, hasCustomServerBase, isStandaloneClient, usesRemoteBearerAuth, wsUrl } from '../api';
import { type Language } from '../i18n';
import { resetNativeAlertsMemory, syncNativeAlerts } from '../nativeNotify';
import { discoverAndSwitchServer, getAutoDiscoverEnabled, SERVER_UPDATED_EVENT } from '../registry';
import { setLanguage, tr } from '../translations';
import { handleLiveSocketMessage } from '../tracking/teacherTracker';
import type { LoginRequest, State } from '../types';

/** Normalize optional arrays from `/api/state` so downstream spatial modules never crash. */
export function normalizeState(raw: State): State {
  return {
    ...raw,
    students: raw.students ?? [],
    classes: raw.classes ?? [],
    subjects: raw.subjects ?? [],
    teachers: raw.teachers ?? [],
    teacherWings: raw.teacherWings ?? [],
    spatialRooms: raw.spatialRooms ?? [],
    lessons: raw.lessons ?? [],
    homework: raw.homework ?? [],
    grades: raw.grades ?? [],
    attendance: raw.attendance ?? [],
    incidents: raw.incidents ?? [],
    notes: raw.notes ?? [],
    announcements: raw.announcements ?? [],
    notifications: raw.notifications ?? [],
    messages: raw.messages ?? [],
    contacts: raw.contacts ?? [],
    accounts: raw.accounts ?? [],
    rosterAttendance: raw.rosterAttendance ?? [],
    familyAccess: raw.familyAccess ?? [],
  };
}

/** Root React hook managing live SchoolSync session, WebSocket updates, and mutations. */
export function useSchoolSync() {
  const [data, setDataRaw] = useState<State | null>(null);
  const pendingAttRef = useRef<Map<string, string>>(new Map());
  const quickQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const applyPendingAttendance = useCallback((state: State): State => {
    const pending = pendingAttRef.current;
    if (!pending.size) return state;
    const patch = <T extends { id: string; today_status?: string | null }>(item: T): T =>
      pending.has(item.id) ? { ...item, today_status: pending.get(item.id) as T['today_status'] } : item;
    return {
      ...state,
      students: state.students.map(patch),
      student: state.student ? patch(state.student) : null,
    };
  }, []);

  const setData = useCallback(
    (next: State | null, askPermission = false) => {
      if (next) syncNativeAlerts(next.notifications ?? [], askPermission);
      setDataRaw(next ? applyPendingAttendance(normalizeState(next)) : null);
    },
    [applyPendingAttendance],
  );

  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [child, setChild] = useState('');
  const [lang, setLang] = useState<Language>(() =>
    localStorage.getItem('schoolsync-language') === 'en' ? 'en' : 'ar',
  );
  const [offline, setOffline] = useState(!navigator.onLine);
  const [demo, setDemo] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [schoolName, setSchoolName] = useState('مدرسة محمد الشريقي الثانوية للبنين');
  const [switching, setSwitching] = useState(false);
  const [serverVersion, setServerVersion] = useState(0);
  const requestNumber = useRef(0);
  const childRef = useRef(child);
  childRef.current = child;
  setLanguage(lang);

  useEffect(() => {
    const onServerUpdated = () => setServerVersion((v) => v + 1);
    window.addEventListener(SERVER_UPDATED_EVENT, onServerUpdated);
    return () => window.removeEventListener(SERVER_UPDATED_EVENT, onServerUpdated);
  }, []);

  const refresh = useCallback(async () => {
    const req = ++requestNumber.current;
    const currentChild = childRef.current;
    try {
      const state = await api<State>(`/state${currentChild ? `?student=${encodeURIComponent(currentChild)}` : ''}`);
      if (req !== requestNumber.current) return;
      setData(state);
      setAuth(true);
      setOffline(false);
      setError('');
    } catch (e) {
      if (req !== requestNumber.current) return;
      const err = e as Error & { status?: number };
      if (err.status === 401) {
        setAuth(false);
        setData(null);
      } else {
        setError(tr(err.message));
        setOffline(!navigator.onLine);
      }
    } finally {
      if (req === requestNumber.current) {
        setLoading(false);
        setSwitching(false);
      }
    }
  }, [setData]);

  const reloadConfig = useCallback(async () => {
    if (isStandaloneClient() && !hasCustomServerBase() && getAutoDiscoverEnabled()) {
      await discoverAndSwitchServer({ currentUrl: getServerBase() });
    }
    try {
      const c = await api<{ demo: boolean; setupRequired: boolean; schoolName?: string }>('/config');
      setDemo(c.demo);
      setSetupRequired(c.setupRequired);
      if (c.schoolName) setSchoolName(c.schoolName);
      setError('');
    } catch { /* handled by refresh */ }
    await refresh();
  }, [refresh]);

  useEffect(() => { void reloadConfig(); }, [reloadConfig]);

  useEffect(() => {
    if (!auth) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 8000);
    const sync = () => void refresh();
    const off = () => setOffline(true);
    window.addEventListener('online', sync);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [auth, refresh]);

  useEffect(() => {
    if (!auth) return;
    let socket: WebSocket;
    let reconnect: ReturnType<typeof setTimeout>;
    let closed = false;
    let fails = 0;
    const connect = () => {
      socket = new WebSocket(wsUrl('/live'));
      socket.onopen = () => { fails = 0; };
      socket.onmessage = (ev) => handleLiveSocketMessage(ev.data, setDataRaw, refresh);
      socket.onclose = () => {
        if (closed) return;
        if (++fails >= 2 && usesRemoteBearerAuth() && getAutoDiscoverEnabled()) {
          void discoverAndSwitchServer({ forceBypassCdn: true, currentUrl: getServerBase() });
        }
        reconnect = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => { closed = true; clearTimeout(reconnect); socket?.close(); };
  }, [auth, refresh, serverVersion]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('schoolsync-language', lang);
  }, [lang]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const mutate = useCallback(
    async (url: string, body: unknown, success = 'Saved successfully') => {
      if (url === '/attendance/quick' && body && typeof body === 'object' && 'studentId' in body && 'status' in body) {
        const { studentId, status } = body as { studentId: string; status: string };
        pendingAttRef.current.set(studentId, status);
        setDataRaw((prev) => (prev ? applyPendingAttendance(prev) : prev));
        setError('');
        const task = quickQueueRef.current.then(async () => {
          try {
            await api(url, body);
            if (pendingAttRef.current.get(studentId) === status) pendingAttRef.current.delete(studentId);
            setToast(tr(success));
            if (!pendingAttRef.current.size) await refresh();
            return true;
          } catch (e) {
            if (pendingAttRef.current.get(studentId) === status) pendingAttRef.current.delete(studentId);
            await refresh();
            setError(tr((e as Error).message));
            return false;
          }
        });
        quickQueueRef.current = task.catch(() => false);
        return task;
      }

      if (busy) return false;
      setBusy(true);
      setError('');
      try {
        await api(url, body);
        await refresh();
        if (success) setToast(tr(success));
        return true;
      } catch (e) {
        setError(tr((e as Error).message));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyPendingAttendance, busy, refresh],
  );

  const loadStudentState = useCallback(
    async (studentId: string): Promise<State | null> => {
      setSwitching(true);
      setError('');
      try {
        ++requestNumber.current;
        const next = await api<State>(`/state?student=${encodeURIComponent(studentId)}`);
        setChild(studentId);
        setData(next);
        return normalizeState(next);
      } catch (e) {
        setError(tr((e as Error).message));
        return null;
      } finally {
        setSwitching(false);
      }
    },
    [setData],
  );

  const signIn = useCallback(
    async (input: LoginRequest) => {
      setBusy(true);
      setError('');
      try {
        const result = await api<{ entryStudentId?: string }>(
          input.portal === 'family' ? '/family-login' : '/login',
          input,
        );
        ++requestNumber.current;
        const state = await api<State>(
          `/state${result.entryStudentId ? `?student=${encodeURIComponent(result.entryStudentId)}` : ''}`,
        );
        setChild(result.entryStudentId || '');
        setData(state, true);
        setAuth(true);
        setOffline(false);
        setLoading(false);
      } catch (e) {
        setError(tr((e as Error).message));
      } finally {
        setBusy(false);
      }
    },
    [setData],
  );

  const logout = useCallback(async () => {
    try {
      await api('/logout', {});
      pendingAttRef.current.clear();
      resetNativeAlertsMemory();
      ++requestNumber.current;
      setData(null);
      setAuth(false);
      setChild('');
    } catch (e) {
      setError(tr((e as Error).message));
    }
  }, [setData]);

  return {
    data, setData, auth, loading, error, setError, toast, setToast, busy, setBusy,
    child, setChild, lang, setLang, offline, demo, setupRequired, setSetupRequired,
    schoolName, switching, refresh, reloadConfig, mutate, loadStudentState, signIn, logout,
  };
}
