/**
 * Instant frosted Spotlight search pill across 3D rooms, classes, teachers, and students.
 * Selecting a result flies the 3D drone to the target space and opens its floating window.
 */
import { useMemo, useState } from 'react';
import { Building2, GraduationCap, Search, UserRound, X } from 'lucide-react';
import type { Language } from '../i18n';
import type { ResolvedSpatialRoom, TeacherAccess } from '../spatial/roomCatalog';
import { getRoomLiveSnapshot } from '../spatial/RoomCalloutLayer';
import type { State } from '../types';

interface SpotlightSearchProps {
  data: State;
  rooms: ResolvedSpatialRoom[];
  access: TeacherAccess;
  lang: Language;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  onSelectStudent: (studentId: string, room: ResolvedSpatialRoom | null) => void;
}

/** Spotlight search input + floating result popover for staff on the 3D campus. */
export function SpotlightSearch({
  data,
  rooms,
  access,
  lang,
  onSelectRoom,
  onSelectStudent,
}: SpotlightSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const allowedRooms = useMemo(
    () => rooms.filter((r) => !access.restricted || access.allowedSlots.has(r.slotId)),
    [rooms, access],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { rooms: [], teachers: [], students: [] };

    const matchedRooms = allowedRooms
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.className.toLowerCase().includes(q) ||
          r.slotId.toLowerCase().includes(q),
      )
      .slice(0, 5);

    const matchedTeachers = !access.restricted
      ? data.teachers
          .filter(
            (t) =>
              t.name.toLowerCase().includes(q) ||
              t.subjects.some((s) => s.toLowerCase().includes(q)) ||
              t.classes.some((c) => c.toLowerCase().includes(q)),
          )
          .slice(0, 4)
      : [];

    const matchedStudents = data.students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.section.toLowerCase().includes(q) ||
          (s.national_id && s.national_id.includes(q)),
      )
      .slice(0, 6);

    return { rooms: matchedRooms, teachers: matchedTeachers, students: matchedStudents };
  }, [query, allowedRooms, access.restricted, data.teachers, data.students]);

  const hasResults =
    results.rooms.length > 0 || results.teachers.length > 0 || results.students.length > 0;

  return (
    <div className="sp-spotlight">
      <div className="sp-spotlight-box">
        <Search size={15} className="sp-spotlight-icon" />
        <input
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder={
            lang === 'ar' ? 'ابحث عن صف، طالب، معلم، أو قاعة…' : 'Search room, student, teacher…'
          }
          aria-label={lang === 'ar' ? 'بحث سريع' : 'Spotlight search'}
        />
        {query && (
          <button
            type="button"
            className="sp-spotlight-clear"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear'}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="sp-spotlight-drop">
          {!hasResults && (
            <div className="sp-spotlight-empty">
              {lang === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching records'}
            </div>
          )}

          {results.rooms.map((room) => {
            const snap = getRoomLiveSnapshot(room, data);
            return (
              <button
                key={room.slotId}
                type="button"
                className="sp-spotlight-item"
                onClick={() => {
                  onSelectRoom(room);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <Building2 size={15} className="is-blue" />
                <div>
                  <strong>{room.label}</strong>
                  <small>
                    {snap.activeLesson
                      ? `${snap.activeLesson.teacher} · ${snap.activeLesson.subject}`
                      : room.className || (lang === 'ar' ? 'الطابق ' + room.floor : `Floor ${room.floor}`)}
                  </small>
                </div>
              </button>
            );
          })}

          {results.teachers.map((t) => {
            const activeRoom = allowedRooms.find((r) => {
              const snap = getRoomLiveSnapshot(r, data);
              return snap.activeLesson?.teacher_id === t.id;
            });
            const fallbackRoom =
              activeRoom ||
              allowedRooms.find((r) => t.classes.includes(r.className)) ||
              allowedRooms.find((r) => r.kind === 'teachers') ||
              null;
            return (
              <button
                key={t.id}
                type="button"
                className="sp-spotlight-item"
                onClick={() => {
                  if (fallbackRoom) onSelectRoom(fallbackRoom);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <GraduationCap size={15} className="is-emerald" />
                <div>
                  <strong>{t.name}</strong>
                  <small>
                    {activeRoom
                      ? `${lang === 'ar' ? 'حالياً في' : 'Now in'} ${activeRoom.label}`
                      : t.classes.join('، ') || (lang === 'ar' ? 'معلم' : 'Teacher')}
                  </small>
                </div>
              </button>
            );
          })}

          {results.students.map((st) => {
            const room = allowedRooms.find((r) => r.className === st.section) || null;
            return (
              <button
                key={st.id}
                type="button"
                className="sp-spotlight-item"
                onClick={() => {
                  onSelectStudent(st.id, room);
                  setOpen(false);
                  setQuery('');
                }}
              >
                <UserRound size={15} className="is-indigo" />
                <div>
                  <strong>{st.name}</strong>
                  <small>{st.section}</small>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
