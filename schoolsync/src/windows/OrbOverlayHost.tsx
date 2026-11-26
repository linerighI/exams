/**
 * Floating Blue Orb dock (`DayPulse`), Day Companion window, and Server Connection Orb
 * window host rendered cleanly over the 3D viewport.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import type { Language } from '../i18n';
import { liveDayPulse, weekdayOfDate } from '../jordanTime';
import { DayPulse, type OrbTone } from '../Orb';
import { gsapPop, useGsapEntrance } from '../spatial/editor/editorMotion';
import type { State } from '../types';
import { ConnectionOrbWindow } from './ConnectionOrbWindow';
import { DayCompanionWindow } from './DayCompanionWindow';

interface OrbOverlayHostProps {
  auth: boolean;
  data: State | null;
  schoolName: string;
  lang: Language;
  offline: boolean;
  orbTone: OrbTone;
  connectionOpen: boolean;
  onOrbToneChange: (tone: OrbTone) => void;
  onCloseConnection: () => void;
  onOpenConnection: () => void;
  onReloadConfig: () => Promise<void>;
}

/** Manages floating bottom-left DayPulse Blue Orb and Connection/Companion windows. */
export function OrbOverlayHost({
  auth,
  data,
  schoolName,
  lang,
  offline,
  orbTone,
  connectionOpen,
  onOrbToneChange,
  onCloseConnection,
  onOpenConnection,
  onReloadConfig,
}: OrbOverlayHostProps) {
  const [dayCompanionOpen, setDayCompanionOpen] = useState(false);
  const orbRef = useRef<HTMLDivElement>(null);

  useGsapEntrance(
    orbRef,
    { opacity: 0, scale: 0.65, y: 18 },
    { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.7)' },
    [Boolean(auth && data)],
  );

  useEffect(() => {
    const el = orbRef.current;
    if (!el || !auth || !data) return;
    const host = el.querySelector('.orb-host');
    const ring = el.querySelector('.day-pulse-svg');
    const ctx = gsap.context(() => {
      if (host) gsap.to(host, { y: -3, scale: 1.04, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      if (ring) gsap.to(ring, { rotation: 360, duration: 26, repeat: -1, ease: 'none' });
    }, el);
    return () => ctx.revert();
  }, [auth, data]);

  const dayPulse = useMemo(() => {
    if (!data) return null;
    const wd = weekdayOfDate(data.date);
    const list = (data.schoolWorkspace?.lessons || data.lessons || []).filter((l) => l.weekday === wd);
    return liveDayPulse(data, list);
  }, [data]);

  return (
    <>
      {auth && data && (
        <div
          ref={orbRef}
          className="sp-orb-dock"
          onMouseEnter={() => gsap.to(orbRef.current, { scale: 1.09, duration: 0.24, ease: 'back.out(2)' })}
          onMouseLeave={() => gsap.to(orbRef.current, { scale: 1, duration: 0.24, ease: 'power2.out' })}
          onPointerDown={() => gsap.to(orbRef.current, { scale: 0.92, duration: 0.12 })}
          onPointerUp={() => gsapPop(orbRef.current)}
        >
          <DayPulse
            progress={dayPulse?.progress || 0}
            tone={offline ? 'red' : dayPulse?.status === 'active' ? 'green' : 'blue'}
            size={54}
            lang={lang}
            compact
            onClick={() => setDayCompanionOpen((v) => !v)}
          />
        </div>
      )}

      {dayCompanionOpen && auth && data && (
        <DayCompanionWindow
          data={data}
          lang={lang}
          offline={offline}
          zIndex={50}
          onFocus={() => {}}
          onClose={() => setDayCompanionOpen(false)}
          onOpenConnection={onOpenConnection}
        />
      )}

      {connectionOpen && (
        <ConnectionOrbWindow
          lang={lang}
          tone={offline ? 'red' : orbTone}
          schoolName={data?.school.name || schoolName}
          zIndex={56}
          onFocus={() => {}}
          onConnected={async () => {
            onOrbToneChange('green');
            await onReloadConfig();
          }}
          onResetLocal={async () => {
            await onReloadConfig();
          }}
          onClose={onCloseConnection}
        />
      )}
    </>
  );
}
