/**
 * Apple Liquid Glass "Teachers in Work" floating dock for managers:
 * shows live active teachers, their status pulse (in class / on campus / mismatch),
 * current room or scheduled subject, and 1-click fly-to & inspection.
 */
import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Radio, Users } from 'lucide-react';
import type { Language } from '../i18n';
import { useGsapEntrance } from '../spatial/editor/editorMotion';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import type { TeacherPresenceRecord } from '../types';

interface ActiveTeachersBarProps {
  presence: TeacherPresenceRecord[];
  rooms: ResolvedSpatialRoom[];
  lang: Language;
  onSelectTeacher: (teacherId: string) => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
}

/** Floating Apple-style live roster of teachers currently working on campus. */
export function ActiveTeachersBar({
  presence,
  rooms,
  lang,
  onSelectTeacher,
  onFlyToRoom,
}: ActiveTeachersBarProps) {
  const [expanded, setExpanded] = useState(true);
  const dockRef = useRef<HTMLDivElement>(null);

  const active = presence
    .filter((t) => t.status !== 'offline' || Boolean(t.room_id))
    .sort((a, b) => (a.status === 'mismatch' ? -1 : b.status === 'mismatch' ? 1 : 0));

  useGsapEntrance(dockRef, { opacity: 0, y: 14, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.34 }, []);

  if (active.length === 0) return null;

  const roomMap = new Map(rooms.map((r) => [r.roomId, r]));

  return (
    <aside ref={dockRef} className="sp-teachers-dock" aria-label={lang === 'ar' ? 'المعلمون في العمل الآن' : 'Teachers in Work'}>
      <button type="button" className="sp-teachers-head" onClick={() => setExpanded((v) => !v)}>
        <span className="sp-teachers-title">
          <span className="sp-live-pulse" />
          <Users size={13} />
          <strong>{lang === 'ar' ? 'المعلمون في العمل الآن' : 'Teachers in Work'}</strong>
          <em className="sp-teachers-count">{active.length}</em>
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {expanded && (
        <div className="sp-teachers-list">
          {active.slice(0, 8).map((t) => {
            const room = t.room_id ? roomMap.get(t.room_id) : undefined;
            const statusClass = t.status === 'mismatch' ? 'is-amber' : t.status === 'in_class' ? 'is-blue' : 'is-green';
            return (
              <button
                key={t.teacher_id}
                type="button"
                className="sp-teacher-chip"
                onClick={() => {
                  onSelectTeacher(t.teacher_id);
                  if (room) onFlyToRoom(room);
                }}
              >
                <span className={`sp-status-dot ${statusClass}`} />
                <span className="sp-teacher-chip-meta">
                  <strong>{t.teacher_name || t.teacher_id}</strong>
                  <small>
                    {room ? room.label : t.scheduled_section || (lang === 'ar' ? 'داخل الحرم' : 'On Campus')}
                  </small>
                </span>
                <Radio size={11} className="sp-teacher-chip-sig" />
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
