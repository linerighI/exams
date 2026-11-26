/**
 * Teachers' Room floating window: live radar showing which classroom every teacher
 * is currently teaching in (with 1-click drone fly-to) plus Principal Wing/Class assignment.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Compass, Layers, Radio } from 'lucide-react';
import type { Language } from '../i18n';
import { minutesOf, nowMinutesInZone, weekdayOfDate } from '../jordanTime';
import { gsapPop, useGsapStagger } from '../spatial/editor/editorMotion';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { isManagerRole, type CampusLayout, type State, type WingId } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { SegmentedTabs } from './SegmentedTabs';

interface TeachersRoomWindowProps {
  room: ResolvedSpatialRoom;
  rooms: ResolvedSpatialRoom[];
  layout: CampusLayout;
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Teachers' lounge command window with live classroom radar and dynamic wing permissions. */
export function TeachersRoomWindow({
  room,
  rooms,
  layout,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  onFlyToRoom,
  mutate,
}: TeachersRoomWindowProps) {
  const manager = isManagerRole(data.user.role);
  const [tab, setTab] = useState<'radar' | 'assign'>('radar');
  const [selectedId, setSelectedId] = useState(data.teachers[0]?.id || '');
  const paneRef = useRef<HTMLDivElement>(null);

  useGsapStagger(paneRef, '.sp-info-row, .sp-chip-picker', [tab, selectedId], {
    y: 8,
    stagger: 0.025,
    duration: 0.24,
  });

  const selectedTeacher = data.teachers.find((t) => t.id === selectedId) || data.teachers[0] || null;
  const [selWings, setSelWings] = useState<WingId[]>(selectedTeacher?.wings || []);
  const [selClasses, setSelClasses] = useState<string[]>(selectedTeacher?.classes || []);
  const [selSubjects, setSelSubjects] = useState<string[]>(selectedTeacher?.subjects || []);

  useEffect(() => {
    if (!selectedTeacher) return;
    setSelWings(selectedTeacher.wings || []);
    setSelClasses(selectedTeacher.classes || []);
    setSelSubjects(selectedTeacher.subjects || []);
  }, [selectedTeacher?.id]);

  const allLessons = data.schoolWorkspace?.lessons || data.lessons || [];
  const weekday = weekdayOfDate(data.date);
  const nowMin = nowMinutesInZone(data.school.timezone);

  const toggleItem = <T,>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleSaveAssignments = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher) return;
    await mutate(
      `/teachers/${selectedTeacher.id}/assignments`,
      { classes: selClasses, subjects: selSubjects, wings: selWings },
      lang === 'ar' ? 'تم تحديث صلاحيات الجناح والشعب للمعلم' : 'Teacher wing & class assignments saved',
    );
  };

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={lang === 'ar' ? 'رادار المعلمين وتوزيع الأجنحة' : 'Live Teacher Radar & Wing Scope'}
      dock="right"
      width={460}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      {manager && (
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'radar', label: <><Radio size={13} /><span>{lang === 'ar' ? 'رادار المعلمين الآن' : 'Live Radar'}</span></> },
            { id: 'assign', label: <><Layers size={13} /><span>{lang === 'ar' ? 'تخصيص الأجنحة والصفوف' : 'Assign Wings'}</span></> },
          ]}
        />
      )}

      <div ref={paneRef} className="sp-tab-pane">

      {tab === 'radar' && (
        <div className="sp-list-stack">
          {data.teachers.map((t) => {
            const activeLesson = allLessons.find(
              (l) =>
                l.teacher_id === t.id &&
                l.weekday === weekday &&
                minutesOf(l.start) <= nowMin &&
                minutesOf(l.end) > nowMin,
            );
            const targetRoom = activeLesson
              ? rooms.find((r) => r.className === activeLesson.section)
              : rooms.find((r) => t.classes.includes(r.className));

            return (
              <div key={t.id} className="sp-info-row">
                <div>
                  <strong>{t.name}</strong>
                  <small>
                    {activeLesson
                      ? `${lang === 'ar' ? 'حالياً في' : 'Now in'} ${activeLesson.section} · ${activeLesson.subject}`
                      : t.classes.length
                        ? `${lang === 'ar' ? 'متفرغ · الشعب:' : 'Available ·'} ${t.classes.join('، ')}`
                        : lang === 'ar'
                          ? 'متفرغ الآن'
                          : 'Available'}
                  </small>
                </div>
                {targetRoom && (
                  <button
                    type="button"
                    className="sp-btn-soft"
                    onClick={() => onFlyToRoom(targetRoom)}
                  >
                    <Compass size={13} />
                    <span>{lang === 'ar' ? 'انتقال' : 'Fly'}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {manager && tab === 'assign' && selectedTeacher && (
        <form className="sp-form" onSubmit={(e) => void handleSaveAssignments(e)}>
          <label className="sp-field">
            <span>{lang === 'ar' ? 'اختر المعلم' : 'Teacher'}</span>
            <select value={selectedTeacher.id} onChange={(e) => setSelectedId(e.target.value)}>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <div className="sp-chip-picker">
            <span>{lang === 'ar' ? 'الأجنحة المسموحة للمعلم (تُحجب بقية الأجنحة بضباب)' : 'Allowed 3D Wings (Others Fogged)'}</span>
            <div className="sp-chip-grid">
              {layout.wings.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`sp-toggle-chip ${selWings.includes(w.id) ? 'is-active' : ''}`}
                  onClick={(e) => { gsapPop(e.currentTarget); setSelWings(toggleItem(selWings, w.id)); }}
                >
                  {lang === 'ar' ? w.labelAr : w.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="sp-chip-picker">
            <span>{lang === 'ar' ? 'الشعب الدراسية المكلّف بها' : 'Assigned Classes'}</span>
            <div className="sp-chip-grid">
              {data.classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`sp-toggle-chip ${selClasses.includes(c.name) ? 'is-active' : ''}`}
                  onClick={(e) => { gsapPop(e.currentTarget); setSelClasses(toggleItem(selClasses, c.name)); }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sp-chip-picker">
            <span>{lang === 'ar' ? 'المواد الدراسية' : 'Subjects'}</span>
            <div className="sp-chip-grid">
              {data.subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`sp-toggle-chip ${selSubjects.includes(s.name) ? 'is-active' : ''}`}
                  onClick={(e) => { gsapPop(e.currentTarget); setSelSubjects(toggleItem(selSubjects, s.name)); }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="sp-btn-primary" disabled={busy}>
            <Check size={15} />
            <span>{lang === 'ar' ? 'حفظ صلاحيات الجناح والشعب' : 'Save Permissions'}</span>
          </button>
        </form>
      )}
      </div>
    </FloatingWindow>
  );
}
