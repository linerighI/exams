/**
 * Dynamic Apple-style vertical floor switcher pill reading floors from CampusLayout,
 * with teacher access locking, roof cutaway toggle, and camera reset.
 */
import { useRef } from 'react';
import { CalendarDays, Compass, Layers, Lock } from 'lucide-react';
import type { Language } from '../i18n';
import { minutesOf, nowMinutesInZone, weekdayOfDate } from '../jordanTime';
import { gsapPop, useGsapEntrance } from '../spatial/editor/editorMotion';
import type { CampusLayout, State } from '../types';
import type { FloorFilter, ResolvedSpatialRoom, TeacherAccess } from '../spatial/roomCatalog';

interface FloorPillProps {
  floor: FloorFilter;
  layout: CampusLayout;
  rooms: ResolvedSpatialRoom[];
  data?: State | null;
  showRoofs: boolean;
  scheduleOpen?: boolean;
  access: TeacherAccess;
  lang: Language;
  onChangeFloor: (next: FloorFilter) => void;
  onToggleRoofs: () => void;
  onResetCamera: () => void;
  onToggleSchedule?: () => void;
}

/** Vertical Apple floor selector dynamically synced with CampusLayout.floors. */
export function FloorPill({
  floor,
  layout,
  rooms,
  data,
  showRoofs,
  scheduleOpen = false,
  access,
  lang,
  onChangeFloor,
  onToggleRoofs,
  onResetCamera,
  onToggleSchedule,
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

      {onToggleSchedule && (
        <button
          type="button"
          className={`sp-mini-sched-btn ${scheduleOpen ? 'is-active' : ''}`}
          title={lang === 'ar' ? 'فتح الجدول الرئيسي للمدرسة' : 'Open Master Schedule'}
          onClick={(e) => {
            gsapPop(e.currentTarget);
            onToggleSchedule();
          }}
        >
          <div className="sp-mini-sched-head">
            <CalendarDays size={11} />
            <span>{lang === 'ar' ? 'الجدول' : 'Grid'}</span>
          </div>
          <div className="sp-mini-sched-grid" aria-hidden="true">
            {(() => {
              const allLessons = data?.schoolWorkspace?.lessons || data?.lessons || [];
              const wd = data ? weekdayOfDate(data.date) : 0;
              const nowMin = data ? nowMinutesInZone(data.school.timezone) : -1;
              const secs = (data?.classes || []).slice(0, 3);
              const rows = secs.length ? secs.map((c) => c.name) : ['1', '2', '3'];
              return rows.map((sec) => (
                <div key={sec} className="sp-mini-sched-row">
                  {[1, 2, 3, 4].map((p) => {
                    const hit = allLessons.find((l) => l.section === sec && l.weekday === wd && (l.period_number || 1) === p);
                    const live = hit && nowMin >= 0 && minutesOf(hit.start) <= nowMin && minutesOf(hit.end) > nowMin;
                    return <i key={p} className={`${hit ? 'has-lesson' : ''} ${live ? 'is-live' : ''}`} />;
                  })}
                </div>
              ));
            })()}
          </div>
        </button>
      )}
    </div>
  );
}
