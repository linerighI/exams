/**
 * State, WebSocket live-sync, theme/language persistence, and auth mutation hook
 * for SchoolSync.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, getServerBase, hasCustomServerBase, isStandaloneClient, usesRemoteBearerAuth, wsUrl } from '../api';
import { discoverAndSwitchServer, getAutoDiscoverEnabled, SERVER_UPDATED_EVENT } from '../registry';
import { homeFor } from '../experience';
import { type Language } from '../i18n';
import type { LoginRequest } from '../Login';
import { resetNativeAlertsMemory, syncNativeAlerts } from '../nativeNotify';
import { setLanguage, tr } from '../translations';
import type { LayoutMode, State } from '../types';

/** Ensure array fields from `/api/state` always exist even across partial/stale responses. */
export function normalizeState(raw: State): State {
  return {
    ...raw,
    students: raw.students ?? [],
    classes: raw.classes ?? [],
    subjects: raw.subjects ?? [],
    teachers: raw.teachers ?? [],
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

export function useSchoolSync() {
  const [data, setDataRaw] = useState<State | null>(null);
  const pendingAttRef = useRef<Map<string, string>>(new Map());
  const quickQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const applyPendingAttendance = useCallback((state: State): State => {
    const pending = pendingAttRef.current;
    if (!pending.size) return state;
    const patchStatus = <T extends { id: string; today_status?: string | null }>(item: T): T =>
      pending.has(item.id) ? { ...item, today_status: pending.get(item.id) } : item;
    return {
      ...state,
      students: state.students.map(patchStatus),
      student: state.student ? patchStatus(state.student) : null,
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
  const [tab, setTab] = useState('today');
  const [child, setChild] = useState('');
  const [lang, setLang] = useState<Language>(() =>
    localStorage.getItem('schoolsync-language') === 'en' ? 'en' : 'ar',
  );
  const [dark, setDark] = useState(() => localStorage.getItem('schoolsync-dark') === 'true');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem('schoolsync-layout-mode');
    return saved === 'phone' || saved === 'tablet' || saved === 'desktop' ? saved : 'auto';
  });
  const [offline, setOffline] = useState(!navigator.onLine);
  const [demo, setDemo] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [schoolName, setSchoolName] = useState('مدرسة محمد الشريقي الثانوية للبنين');
  const [familyWelcome, setFamilyWelcome] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [serverVersion, setServerVersion] = useState(0);

  const requestNumber = useRef(0);
  setLanguage(lang);

  useEffect(() => {
    const onServerUpdated = () => setServerVersion((v) => v + 1);
    window.addEventListener(SERVER_UPDATED_EVENT, onServerUpdated);
    return () => window.removeEventListener(SERVER_UPDATED_EVENT, onServerUpdated);
  }, []);

  const refresh = useCallback(async () => {
    const req = ++requestNumber.current;
    try {
      const state = await api<State>(`/state${child ? `?student=${encodeURIComponent(child)}` : ''}`);
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
  }, [child]);

  /** Re-fetch server metadata (`/api/config`) and state after server/tunnel switch. */
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
    } catch {}
    await refresh();
  }, [refresh]);

  useEffect(() => {
    void reloadConfig();
  }, [reloadConfig]);

  useEffect(() => {
    if (!auth) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 8000);
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
    let consecutiveFailures = 0;
    const connect = () => {
      socket = new WebSocket(wsUrl('/live'));
      socket.onopen = () => {
        consecutiveFailures = 0;
      };
      socket.onmessage = () => void refresh();
      socket.onclose = () => {
        if (closed) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2 && usesRemoteBearerAuth() && getAutoDiscoverEnabled()) {
          void discoverAndSwitchServer({
            forceBypassCdn: true,
            currentUrl: getServerBase(),
          });
        }
        reconnect = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(reconnect);
      socket?.close();
    };
  }, [auth, refresh, serverVersion]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('schoolsync-language', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('schoolsync-dark', String(dark));
  }, [dark]);

  useEffect(() => {
    document.documentElement.dataset.layoutMode = layoutMode;
    localStorage.setItem('schoolsync-layout-mode', layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const mutate = async (url: string, body: unknown, success = 'تم الحفظ بنجاح') => {
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
      setToast(tr(success));
      return true;
    } catch (e) {
      setError(tr((e as Error).message));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const signIn = async (input: LoginRequest) => {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ entryStudentId?: string }>(
        input.portal === 'family' ? '/family-login' : '/login',
        input,
      );
      setFamilyWelcome(true);
      ++requestNumber.current;
      const state = await api<State>(
        `/state${result.entryStudentId ? `?student=${encodeURIComponent(result.entryStudentId)}` : ''}`,
      );
      setChild(result.entryStudentId || '');
      setData(state, true);
      setTab(homeFor(state.user.role));
      setAuth(true);
      setOffline(false);
      setLoading(false);
    } catch (e) {
      setError(tr((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try {
      await api('/logout', {});
      pendingAttRef.current.clear();
      resetNativeAlertsMemory();
      ++requestNumber.current;
      setData(null);
      setAuth(false);
      setChild('');
      setTab('today');
    } catch (e) {
      setError(tr((e as Error).message));
    }
  };

  return {
    data, setData, auth, loading, error, setError, toast, busy, setBusy, tab, setTab,
    child, setChild, lang, setLang, dark, setDark, layoutMode, setLayoutMode, offline,
    demo, setupRequired, setSetupRequired, schoolName, familyWelcome, setFamilyWelcome,
    switching, setSwitching, requestNumber, refresh, reloadConfig, mutate, signIn, logout,
  };
}
