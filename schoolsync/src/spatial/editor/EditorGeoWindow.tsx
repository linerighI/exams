/**
 * Floating Apple HIG GPS Geo-Anchor calibration modal inside the 3D Editor:
 * binds campus blueprint origin to real-world coordinates, compass bearing, and geofence radius.
 */
import { useState, type FormEvent } from 'react';
import { Check, LocateFixed } from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusGeoAnchor } from '../../types';
import { FloatingWindow } from '../../windows/FloatingWindow';

interface EditorGeoWindowProps {
  initial: CampusGeoAnchor | null;
  lang: Language;
  busy: boolean;
  onClose: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Calibrate 3D campus GPS origin, rotation bearing, and privacy geofence radius. */
export function EditorGeoWindow({ initial, lang, busy, onClose, mutate }: EditorGeoWindowProps) {
  const [lat, setLat] = useState(String(initial?.origin_lat ?? 32.0));
  const [lng, setLng] = useState(String(initial?.origin_lng ?? 35.9));
  const [bearing, setBearing] = useState(String(initial?.bearing_deg ?? 0));
  const [radius, setRadius] = useState(String(initial?.geofence_radius_m ?? 250));

  const fillMyGps = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(
      '/campus-geo',
      {
        origin_lat: Number(lat),
        origin_lng: Number(lng),
        bearing_deg: Number(bearing),
        scale: 1,
        geofence_radius_m: Number(radius),
      },
      lang === 'ar' ? 'تم حفظ معايرة GPS والسياج الجغرافي' : 'Geo calibration saved',
    );
    if (ok) onClose();
  };

  return (
    <FloatingWindow
      id="editor-geo"
      title={lang === 'ar' ? 'معايرة موقع المدرسة GPS' : 'Campus GPS Geo-Anchor'}
      subtitle={lang === 'ar' ? 'اربط الخريطة ثلاثية الأبعاد بإحداثيات المدرسة الفعلية' : 'Align 3D campus to real-world GPS'}
      dock="center"
      width={380}
      zIndex={56}
      onFocus={() => {}}
      onClose={onClose}
    >
      <form className="sp-form" onSubmit={(e) => void handleSave(e)}>
        <div className="sp-row-2">
          <label className="sp-field">
            <span>{lang === 'ar' ? 'خط العرض (Lat)' : 'Latitude'}</span>
            <input type="number" step="0.000001" required value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'خط الطول (Lng)' : 'Longitude'}</span>
            <input type="number" step="0.000001" required value={lng} onChange={(e) => setLng(e.target.value)} />
          </label>
        </div>
        <div className="sp-row-2">
          <label className="sp-field">
            <span>{lang === 'ar' ? 'زاوية البوصلة (°)' : 'Bearing (°)'}</span>
            <input type="number" step="1" min={-360} max={360} value={bearing} onChange={(e) => setBearing(e.target.value)} />
          </label>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'نصف قطر السياج (م)' : 'Geofence Radius (m)'}</span>
            <input type="number" step="10" min={20} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} />
          </label>
        </div>
        <div className="sp-row-actions">
          <button type="button" className="sp-btn-soft" onClick={fillMyGps}>
            <LocateFixed size={14} />
            <span>{lang === 'ar' ? 'موقعي الآن' : 'Use Current GPS'}</span>
          </button>
          <button type="submit" className="sp-btn-primary" disabled={busy}>
            <Check size={14} />
            <span>{lang === 'ar' ? 'حفظ المعايرة' : 'Save Anchor'}</span>
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
}
