import { useCallback, useEffect, useRef, useState } from 'react';
import type { TeacherConnection } from './types';

export function useTeacherConnection() {
  const [connection, setConnection] = useState<TeacherConnection>({ connected: !window.desktop, local: false });
  const [tone, setTone] = useState<'red' | 'green' | 'blue'>(window.desktop ? 'red' : 'blue');
  const previous = useRef(!window.desktop);
  const generation = useRef(0);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const apply = useCallback((info: TeacherConnection) => {
    if (!mounted.current) return;
    setConnection(info);
    if (info.connected && !previous.current) {
      clearTimeout(timer.current);
      setTone('green');
      timer.current = setTimeout(() => { if (mounted.current) setTone('blue'); }, 1800);
    } else if (!info.connected) { clearTimeout(timer.current); setTone('red'); }
    previous.current = info.connected;
  }, []);
  const accept = useCallback((info: TeacherConnection) => { generation.current++; apply(info); }, [apply]);
  const refresh = useCallback(async () => {
    if (!window.desktop) return;
    const attempt = ++generation.current;
    try {
      const info = await window.desktop.connectionState();
      if (attempt === generation.current) apply(info);
    } catch { if (attempt === generation.current) apply({ connected: false, local: false }); }
  }, [apply]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 10000);
    const focus = () => { void refresh(); };
    window.addEventListener('focus', focus);
    return () => { mounted.current = false; generation.current++; clearTimeout(timer.current); clearInterval(interval); window.removeEventListener('focus', focus); };
  }, [refresh]);
  return { connection, tone, accept, refresh };
}
