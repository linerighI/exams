/**
 * Floating Blue Orb dock (`DayPulse`), Day Companion window, and Server Connection Orb
 * window host rendered cleanly over the 3D viewport.
 */
import { useMemo, useState } from 'react';
import type { Language } from '../i18n';
import { liveDayPulse, weekdayOfDate } from '../jordanTime';
import { DayPulse, type OrbTone } from '../Orb';
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

  const dayPulse = useMemo(() => {
    if (!data) return null;
    const wd = weekdayOfDate(data.date);
    const list = (data.schoolWorkspace?.lessons || data.lessons || []).filter((l) => l.weekday === wd);
    return liveDayPulse(data, list);
  }, [data]);

  return (
    <>
      {auth && data && (
        <div className="sp-orb-dock">
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
