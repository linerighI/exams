/**
 * Classroom floating window opened directly over the 3D campus: shows live teacher on duty,
 * 1-tap present/absent/late/excused student attendance toggles, clickable Student Profile launch,
 * class schedule tab, and assigned teachers/homework.
 */
import { useMemo, useState } from 'react';
import { CheckCheck, Pencil, Search } from 'lucide-react';
import type { Language } from '../i18n';
import { formatClock, minutesOf, nowMinutesInZone } from '../jordanTime';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { getRoomLiveSnapshot } from '../spatial/RoomCalloutLayer';
import { isManagerRole, type State } from '../types';
import { ClassroomScheduleTab } from './ClassroomScheduleTab';
import { ClassroomTeachersTab } from './ClassroomTeachersTab';
import { FloatingWindow } from './FloatingWindow';

interface ClassroomWindowProps {
  room: ResolvedSpatialRoom;
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onEditLabel: () => void;
  onOpenStudentProfile: (studentId: string) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

type AttStatus = 'present' | 'absent' | 'late' | 'excused';

const STATUS_BUTTONS: { key: AttStatus; ar: string; en: string }[] = [
  { key: 'present', ar: 'حاضر', en: 'P' },
  { key: 'absent', ar: 'غائب', en: 'A' },
  { key: 'late', ar: 'متأخر', en: 'L' },
  { key: 'excused', ar: 'بعذر', en: 'E' },
];

/** Floating classroom command center anchored alongside the selected 3D room. */
export function ClassroomWindow({
  room,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  onEditLabel,
  onOpenStudentProfile,
  mutate,
}: ClassroomWindowProps) {
  const [tab, setTab] = useState<'students' | 'schedule' | 'teachers'>('students');
  const [filter, setFilter] = useState('');

  const manager = isManagerRole(data.user.role);
  const live = getRoomLiveSnapshot(room, data);
  const roster = useMemo(
    () =>
      data.students
        .filter((s) => s.section === room.className)
        .filter((s) => !filter.trim() || s.name.toLowerCase().includes(filter.trim().toLowerCase())),
    [data.students, room.className, filter],
  );
  const classTeachers = useMemo(
    () => data.teachers.filter((t) => t.classes.includes(room.className)),
    [data.teachers, room.className],
  );

  const nowMin = nowMinutesInZone(data.school.timezone);
  const minsLeft = live.activeLesson ? Math.max(0, minutesOf(live.activeLesson.end) - nowMin) : 0;

  const markAllPresent = async () => {
    for (const st of roster) {
      if (st.today_status !== 'present') {
        await mutate('/attendance/quick', { studentId: st.id, status: 'present' }, 'Attendance recorded');
      }
    }
  };

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={
        room.className
          ? `${lang === 'ar' ? 'الشعبة' : 'Section'}: ${room.className} · ${live.totalStudents} ${lang === 'ar' ? 'طالب' : 'students'}`
          : lang === 'ar'
            ? 'قاعة غير مرتبطة بشعبة بعد'
            : 'Unlinked classroom slot'
      }
      dock="right"
      width={460}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
      headerActions={
        manager ? (
          <button
            type="button"
            className="sp-icon-btn"
            title={lang === 'ar' ? 'تعديل اسم القاعة' : 'Rename room'}
            onClick={onEditLabel}
          >
            <Pencil size={14} />
          </button>
        ) : undefined
      }
    >
      {!room.className ? (
        <div className="sp-empty-state">
          <p>{lang === 'ar' ? 'هذه القاعة غير مرتبطة بشعبة دراسية حالياً.' : 'This room slot has no assigned class yet.'}</p>
          {manager && (
            <button type="button" className="sp-btn-primary" onClick={onEditLabel}>
              {lang === 'ar' ? 'تسمية وربط القاعة' : 'Label & Link Class'}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={`sp-live-banner ${live.activeLesson ? 'is-live' : ''}`}>
            <div className="sp-live-banner-dot" />
            <div className="sp-live-banner-text">
              {live.activeLesson ? (
                <>
                  <strong>{live.activeLesson.teacher} · {live.activeLesson.subject}</strong>
                  <small>
                    {lang === 'ar'
                      ? `الحصة الحالية (${formatClock(live.activeLesson.start, lang)}) · متبقي ${minsLeft} د`
                      : `Now (${live.activeLesson.start}) · ${minsLeft}m left`}
                  </small>
                </>
              ) : live.nextLesson ? (
                <>
                  <strong>{lang === 'ar' ? 'الحصة القادمة: ' : 'Next: '}{live.nextLesson.teacher} · {live.nextLesson.subject}</strong>
                  <small>{formatClock(live.nextLesson.start, lang)}</small>
                </>
              ) : (
                <>
                  <strong>{classTeachers[0]?.name || (lang === 'ar' ? 'لا توجد حصة جارية الآن' : 'No active lesson now')}</strong>
                  <small>{lang === 'ar' ? 'يمكنك عرض الجدول أو تعديله من تبويب الجدول' : 'View or edit lessons in Schedule'}</small>
                </>
              )}
            </div>
          </div>

          <div className="sp-segmented">
            <button type="button" className={tab === 'students' ? 'is-active' : ''} onClick={() => setTab('students')}>
              {lang === 'ar' ? 'الطلبة والحضور' : 'Students'}
            </button>
            <button type="button" className={tab === 'schedule' ? 'is-active' : ''} onClick={() => setTab('schedule')}>
              {lang === 'ar' ? 'جدول الصف' : 'Schedule'}
            </button>
            <button type="button" className={tab === 'teachers' ? 'is-active' : ''} onClick={() => setTab('teachers')}>
              {lang === 'ar' ? 'المعلمون والواجبات' : 'Teachers'}
            </button>
          </div>

          {tab === 'students' && (
            <div className="sp-tab-pane">
              <div className="sp-toolbar-row">
                <div className="sp-search-mini">
                  <Search size={13} />
                  <input
                    placeholder={lang === 'ar' ? 'تصفية الطلبة…' : 'Filter students…'}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </div>
                <button type="button" className="sp-btn-soft" onClick={() => void markAllPresent()} disabled={roster.length === 0}>
                  <CheckCheck size={14} />
                  <span>{lang === 'ar' ? 'تحضير الكل' : 'All Present'}</span>
                </button>
              </div>

              <div className="sp-stats-pills">
                <span className="is-green">{lang === 'ar' ? `حاضر ${live.presentCount}` : `Present ${live.presentCount}`}</span>
                <span className="is-coral">{lang === 'ar' ? `غائب ${live.absentCount}` : `Absent ${live.absentCount}`}</span>
                <span>{lang === 'ar' ? `الكل ${live.totalStudents}` : `Total ${live.totalStudents}`}</span>
              </div>

              <div className="sp-student-list">
                {roster.map((st) => (
                  <div key={st.id} className="sp-student-row">
                    <button
                      type="button"
                      className="sp-student-name-btn"
                      onClick={() => onOpenStudentProfile(st.id)}
                      title={lang === 'ar' ? 'فتح ملف الطالب' : 'Open student profile'}
                    >
                      <span className="sp-mini-avatar">{st.initials || st.name.slice(0, 2)}</span>
                      <span>{st.name}</span>
                    </button>
                    <div className="sp-att-group">
                      {STATUS_BUTTONS.map((b) => (
                        <button
                          key={b.key}
                          type="button"
                          className={`sp-att-btn is-${b.key} ${st.today_status === b.key ? 'is-active' : ''}`}
                          onClick={() =>
                            void mutate('/attendance/quick', { studentId: st.id, status: b.key }, 'Attendance recorded')
                          }
                        >
                          {lang === 'ar' ? b.ar : b.en}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'schedule' && (
            <ClassroomScheduleTab
              className={room.className}
              roomLabel={room.label}
              data={data}
              lang={lang}
              manager={manager}
              busy={busy}
              mutate={mutate}
            />
          )}

          {tab === 'teachers' && (
            <ClassroomTeachersTab
              className={room.className}
              data={data}
              lang={lang}
              busy={busy}
              mutate={mutate}
            />
          )}
        </>
      )}
    </FloatingWindow>
  );
}
