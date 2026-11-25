/**
 * Computer Lab floating window: displays lab-booked periods and live WebSocket / LAN
 * synchronization status.
 */
import { Monitor, Wifi, WifiOff } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock } from '../jordanTime';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import type { State } from '../types';
import { FloatingWindow } from './FloatingWindow';

interface ComputerLabWindowProps {
  room: ResolvedSpatialRoom;
  data: State;
  lang: Language;
  offline: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
}

/** Computer Lab schedule and live server connection monitor window. */
export function ComputerLabWindow({
  room,
  data,
  lang,
  offline,
  zIndex,
  onFocus,
  onClose,
}: ComputerLabWindowProps) {
  const allLessons = data.schoolWorkspace?.lessons || data.lessons || [];
  const labLessons = allLessons.filter(
    (l) => l.room.includes('حاسوب') || l.room.toLowerCase().includes('lab') || l.subject.includes('تكنولوجيا'),
  );

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={lang === 'ar' ? 'حجوزات المختبر وحالة الربط الشبكي' : 'Lab Schedule & Sync'}
      dock="right"
      width={400}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-tab-pane">
        <div className={`sp-live-banner ${offline ? '' : 'is-live'}`}>
          {offline ? <WifiOff size={16} /> : <Wifi size={16} />}
          <div className="sp-live-banner-text">
            <strong>
              {offline
                ? lang === 'ar'
                  ? 'وضع غير متصل بالخادم'
                  : 'Offline Mode'
                : lang === 'ar'
                  ? 'المزامنة الفورية نشطة (WebSocket)'
                  : 'Live Sync Active'}
            </strong>
            <small>{data.school.name}</small>
          </div>
        </div>

        <h4 className="sp-subhead">{lang === 'ar' ? 'حصص المختبر والتكنولوجيا' : 'Lab & Tech Lessons'}</h4>
        <div className="sp-list-stack">
          {labLessons.length === 0 ? (
            <p className="sp-empty-note">
              {lang === 'ar' ? 'لا توجد حجوزات للمختبر حالياً' : 'No lab bookings right now'}
            </p>
          ) : (
            labLessons.map((l) => (
              <div key={l.id} className="sp-info-row">
                <Monitor size={15} className="is-blue" />
                <div>
                  <strong>{l.section} · {l.subject}</strong>
                  <small>{l.teacher} · {formatClock(l.start, lang)}</small>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </FloatingWindow>
  );
}
