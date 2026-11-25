/**
 * Floating Apple HIG detail card opened when clicking a 3D teacher figure:
 * shows live fused location, schedule comparison, signal confidence, and today's movement trail.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Compass, Navigation, Radio, Route } from 'lucide-react';
import { api } from '../../api';
import type { Language } from '../../i18n';
import type { TeacherPresenceRecord } from '../../types';
import { FloatingWindow } from '../../windows/FloatingWindow';
import type { ResolvedSpatialRoom } from '../roomCatalog';

export interface TrailPoint {
  id: string;
  room_id: string | null;
  floor_id: string | null;
  x: number;
  z: number;
  source: string;
  recorded_at: string;
}

interface TeacherLiveWindowProps {
  record: TeacherPresenceRecord;
  rooms: ResolvedSpatialRoom[];
  lang: Language;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  onShowTrail: (points: TrailPoint[]) => void;
}

const SOURCE_LABELS: Record<TeacherPresenceRecord['source'], { ar: string; en: string }> = {
  qr: { ar: 'مسح QR الغرفة', en: 'Room QR Scan' },
  nfc: { ar: 'بطاقة NFC', en: 'NFC Tap' },
  wifi: { ar: 'نقطة Wi-Fi', en: 'Wi-Fi BSSID' },
  ble: { ar: 'مستشعر BLE', en: 'BLE Beacon' },
  gps: { ar: 'GPS معاير', en: 'GPS + Filter' },
  activity: { ar: 'نشاط داخل التطبيق', en: 'App Activity' },
  manual: { ar: 'تسجيل يدوي', en: 'Manual Check-in' },
  schedule: { ar: 'حسب الجدول', en: 'Timetable Fallback' },
};

/** Inspect live fused teacher position, mismatch state, and movement trail. */
export function TeacherLiveWindow({
  record,
  rooms,
  lang,
  zIndex,
  onFocus,
  onClose,
  onFlyToRoom,
  onShowTrail,
}: TeacherLiveWindowProps) {
  const [trailOpen, setTrailOpen] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);

  useEffect(() => {
    setTrailOpen(false);
    setTrail([]);
    onShowTrail([]);
  }, [record.teacher_id]);

  const currentRoom = record.room_id ? rooms.find((r) => r.roomId === record.room_id) : null;
  const scheduledRoom = record.scheduled_room_id
    ? rooms.find((r) => r.roomId === record.scheduled_room_id)
    : null;
  const srcInfo = SOURCE_LABELS[record.source] || SOURCE_LABELS.schedule;

  const statusText =
    record.status === 'mismatch'
      ? lang === 'ar'
        ? 'تنبيه تعارض الجدول'
        : 'Schedule Mismatch'
      : record.status === 'in_class'
        ? lang === 'ar'
          ? 'في القاعة المجدولة'
          : 'In Scheduled Class'
        : record.status === 'on_campus'
          ? lang === 'ar'
            ? 'متواجد داخل الحرم'
            : 'Verified On Campus'
          : lang === 'ar'
            ? 'آخر موقع / الجدول'
            : 'Offline (Schedule)';

  const toggleTrail = async () => {
    if (trailOpen) {
      setTrailOpen(false);
      onShowTrail([]);
      return;
    }
    try {
      const res = await api<{ points: TrailPoint[] }>(
        `/presence/teachers/${encodeURIComponent(record.teacher_id)}/trail`,
      );
      setTrail(res.points || []);
      setTrailOpen(true);
      onShowTrail(res.points || []);
    } catch {
      setTrail([]);
    }
  };

  return (
    <FloatingWindow
      id={`teacher-live-${record.teacher_id}`}
      title={record.teacher_name || record.teacher_id}
      subtitle={statusText}
      badge={`${Math.round((record.confidence || 0) * 100)}%`}
      dock="left"
      width={360}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={() => {
        onShowTrail([]);
        onClose();
      }}
    >
      <div className={`sp-live-banner ${record.status === 'in_class' ? 'is-live' : ''}`}>
        <div className="sp-live-banner-dot" />
        <div className="sp-live-banner-text">
          <strong>
            {currentRoom ? currentRoom.label : lang === 'ar' ? 'داخل الحرم المدرسي' : 'Campus Grounds'}
          </strong>
          <small>
            {lang === 'ar' ? `المصدر: ${srcInfo.ar}` : `Source: ${srcInfo.en}`}
            {record.accuracy_m ? ` · ±${Math.round(record.accuracy_m)}m` : ''}
          </small>
        </div>
      </div>

      {record.mismatch && (
        <div className="sp-alert">
          <AlertTriangle size={14} />{' '}
          {lang === 'ar'
            ? `الحصة الحالية مجدولة في ${scheduledRoom?.label || record.scheduled_section || 'قاعة أخرى'}`
            : `Scheduled now in ${scheduledRoom?.label || record.scheduled_section || 'another room'}`}
        </div>
      )}

      <div className="sp-list-stack">
        <div className="sp-info-row">
          <div>
            <strong>{lang === 'ar' ? 'الحصة المجدولة الآن' : 'Scheduled Class Now'}</strong>
            <small>
              {scheduledRoom
                ? `${scheduledRoom.label} (${record.scheduled_section || ''})`
                : lang === 'ar'
                  ? 'فترة تفرغ / مناوبة'
                  : 'Free period'}
            </small>
          </div>
          <Radio size={15} className="is-blue" />
        </div>
        <div className="sp-info-row">
          <div>
            <strong>{lang === 'ar' ? 'الإحداثيات المكانية' : '3D Coordinates'}</strong>
            <small>{`X: ${record.x.toFixed(1)}m · Z: ${record.z.toFixed(1)}m`}</small>
          </div>
          <Navigation size={15} />
        </div>
      </div>

      <div className="sp-row-actions">
        {currentRoom && (
          <button type="button" className="sp-btn-soft" onClick={() => onFlyToRoom(currentRoom)}>
            <Compass size={14} />
            <span>{lang === 'ar' ? 'انتقال للقاعة' : 'Fly to Room'}</span>
          </button>
        )}
        <button type="button" className="sp-btn-primary" onClick={() => void toggleTrail()}>
          <Route size={14} />
          <span>
            {trailOpen
              ? lang === 'ar'
                ? `إخفاء المسار (${trail.length})`
                : `Hide Trail (${trail.length})`
              : lang === 'ar'
                ? 'عرض مسار الحركة'
                : 'Show Movement Trail'}
          </span>
        </button>
      </div>
    </FloatingWindow>
  );
}
