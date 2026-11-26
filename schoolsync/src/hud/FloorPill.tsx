/**
 * Dynamic Apple-style vertical floor switcher pill reading floors from CampusLayout,
 * with teacher access locking, roof cutaway toggle, and camera reset.
 */
import { useRef } from 'react';
import { Compass, Layers, Lock } from 'lucide-react';
import type { Language } from '../i18n';
import { gsapPop, useGsapEntrance } from '../spatial/editor/editorMotion';
import type { CampusLayout } from '../types';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from '../spatial/roomCatalog';

interface FloorPillProps {
  floor: FloorFilter;
  layout: CampusLayout;
  rooms: ResolvedSpatialRoom[];
  showRoofs: boolean;
  access: TeacherAccess;
  lang: Language;
  onChangeFloor: (next: FloorFilter) => void;
  onToggleRoofs: () => void;
  onResetCamera: () => void;
}

/** Vertical Apple floor selector dynamically synced with CampusLayout.floors. */
export function FloorPill({
  floor,
  layout,
  rooms,
  showRoofs,
  access,
  lang,
  onChangeFloor,
  onToggleRoofs,
  onResetCamera,
}: FloorPillProps) {
  const orderedFloors = [...layout.floors].sort((a, b) => b.index - a.index);
  const dockRef = useRef<HTMLDivElement>(null);

  useGsapEntrance(
    dockRef,
    { opacity: 0, x: 18, scale: 0.96 },
    { opacity: 1, x: 0, scale: 1, duration: 0.42, ease: 'power4.out' },
    [layout.floors.length],
  );

  const canAccessFloor = (floorId: string): boolean => {
    if (!access.restricted) return true;
    const onFloor = rooms.some((r) => r.floorId === floorId && access.allowedWings.has(r.wing));
    if (onFloor) return true;
    return layout.wings.some(
      (w) => access.allowedWings.has(w.id) && (w.floorIds.length === 0 || w.floorIds.includes(floorId)),
    );
  };

  return (
    <div ref={dockRef} className="sp-floor-dock" aria-label={lang === 'ar' ? 'تبديل الطوابق' : 'Floor Switcher'}>
      <div className="sp-floor-pill">
        {orderedFloors.map((fl) => {
          const allowed = canAccessFloor(fl.id);
          return (
            <button
              key={fl.id}
              type="button"
              className={`sp-floor-btn ${floor === fl.id ? 'is-active' : ''}`}
              disabled={!allowed}
              title={lang === 'ar' ? fl.labelAr : fl.labelEn}
              onClick={(e) => {
                gsapPop(e.currentTarget);
                onChangeFloor(fl.id);
              }}
            >
              <span>{fl.index}</span>
              {!allowed && <Lock size={10} className="sp-floor-lock" />}
            </button>
          );
        })}

        {!access.restricted && layout.floors.length > 1 && (
          <button
            type="button"
            className={`sp-floor-btn is-all ${floor === 'all' ? 'is-active' : ''}`}
            title={lang === 'ar' ? 'كامل المدرسة' : 'All Floors'}
            onClick={() => onChangeFloor('all')}
          >
            <span>{lang === 'ar' ? 'الكل' : 'All'}</span>
          </button>
        )}
      </div>

      <div className="sp-view-tools">
        {!access.restricted && (
          <button
            type="button"
            className={`sp-tool-btn ${showRoofs ? 'is-active' : ''}`}
            title={lang === 'ar' ? 'إظهار / إخفاء الأسقف' : 'Toggle Roof Shell'}
            onClick={onToggleRoofs}
          >
            <Layers size={16} />
          </button>
        )}
        <button
          type="button"
          className="sp-tool-btn"
          title={lang === 'ar' ? 'إعادة ضبط المنظور' : 'Reset Drone View'}
          onClick={onResetCamera}
        >
          <Compass size={16} />
        </button>
      </div>
    </div>
  );
}
