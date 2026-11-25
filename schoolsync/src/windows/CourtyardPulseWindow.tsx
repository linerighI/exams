/**
 * Central Courtyard floating window: school-wide real-time pulse showing total
 * attendance counters, currently active classrooms, and the daily Jordanian bell timeline.
 */
import { Activity, Compass, Users } from 'lucide-react';
import type { Language } from '../i18n';
import { buildPeriodSlots, formatClock, minutesOf, nowMinutesInZone, weekdayOfDate } from '../jordanTime';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { getRoomLiveSnapshot } from '../spatial/RoomCalloutLayer';
import type { State } from '../types';
import { FloatingWindow } from './FloatingWindow';

interface CourtyardPulseWindowProps {
  room: ResolvedSpatialRoom;
  rooms: ResolvedSpatialRoom[];
  data: State;
  lang: Language;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
}

/** Live school-wide attendance & bell-schedule dashboard window. */
export function CourtyardPulseWindow({
  room,
  rooms,
  data,
  lang,
  zIndex,
  onFocus,
  onClose,
  onFlyToRoom,
}: CourtyardPulseWindowProps) {
  const present = data.students.filter((s) => s.today_status === 'present').length;
  const absent = data.students.filter((s) => s.today_status === 'absent').length;
  const late = data.students.filter((s) => s.today_status === 'late').length;
  const slots = buildPeriodSlots(data.school);
  const nowMin = nowMinutesInZone(data.school.timezone);
  const weekday = weekdayOfDate(data.date);
  const allLessons = data.schoolWorkspace?.lessons || data.lessons || [];
  const activeCount = allLessons.filter(
    (l) => l.weekday === weekday && minutesOf(l.start) <= nowMin && minutesOf(l.end) > nowMin,
  ).length;

  const classRooms = rooms.filter((r) => r.kind === 'classroom' && r.className);

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={lang === 'ar' ? 'نبض المدرسة المباشر والحضور العام' : 'Live Campus Pulse'}
      dock="right"
      width={450}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-tab-pane">
        <div className="sp-kpi-grid">
          <div className="sp-kpi-card">
            <Users size={15} className="is-blue" />
            <strong>{data.students.length}</strong>
            <small>{lang === 'ar' ? 'إجمالي الطلبة' : 'Students'}</small>
          </div>
          <div className="sp-kpi-card">
            <Activity size={15} className="is-emerald" />
            <strong>{present}</strong>
            <small>{lang === 'ar' ? 'حاضر اليوم' : 'Present'}</small>
          </div>
          <div className="sp-kpi-card">
            <strong className="is-coral">{absent}</strong>
            <small>{lang === 'ar' ? 'غائب' : 'Absent'}</small>
          </div>
          <div className="sp-kpi-card">
            <strong>{activeCount}</strong>
            <small>{lang === 'ar' ? 'حصص جارية' : 'Active Now'}</small>
          </div>
        </div>

        <h4 className="sp-subhead">{lang === 'ar' ? 'جدول الجرس اليومي' : 'Daily Bell Schedule'}</h4>
        <div className="sp-bell-strip">
          {slots.map((s) => {
            const isNow = minutesOf(s.start) <= nowMin && minutesOf(s.end) > nowMin;
            return (
              <div key={s.periodNumber} className={`sp-bell-pill ${isNow ? 'is-now' : ''}`}>
                <strong>{lang === 'ar' ? s.labelAr : s.labelEn}</strong>
                <small>{formatClock(s.start, lang)}</small>
              </div>
            );
          })}
        </div>

        <h4 className="sp-subhead">
          {lang === 'ar' ? `الشعب الدراسية (${classRooms.length})` : `Classrooms (${classRooms.length})`}
          {late > 0 ? ` · ${late} ${lang === 'ar' ? 'متأخر' : 'late'}` : ''}
        </h4>
        <div className="sp-list-stack">
          {classRooms.map((r) => {
            const snap = getRoomLiveSnapshot(r, data);
            return (
              <div key={r.slotId} className="sp-info-row">
                <div>
                  <strong>{r.label}</strong>
                  <small>
                    {snap.activeLesson
                      ? `${snap.activeLesson.teacher} · ${snap.activeLesson.subject}`
                      : `${snap.presentCount}/${snap.totalStudents} ${lang === 'ar' ? 'حاضر' : 'present'}`}
                  </small>
                </div>
                <button type="button" className="sp-btn-soft" onClick={() => onFlyToRoom(r)}>
                  <Compass size={13} />
                  <span>{lang === 'ar' ? 'انتقال' : 'Inspect'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </FloatingWindow>
  );
}
