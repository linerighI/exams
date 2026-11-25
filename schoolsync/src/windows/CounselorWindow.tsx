/**
 * Assistant Principal & Counselor floating window: live school-wide absences & late
 * arrivals grouped by class plus open attendance incident resolution.
 */
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Compass } from 'lucide-react';
import type { Language } from '../i18n';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { tr } from '../translations';
import type { State } from '../types';
import { FloatingWindow } from './FloatingWindow';

interface CounselorWindowProps {
  room: ResolvedSpatialRoom;
  rooms: ResolvedSpatialRoom[];
  data: State;
  lang: Language;
  busy: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onFlyToRoom: (room: ResolvedSpatialRoom) => void;
  onOpenStudentProfile: (studentId: string) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Counselor & Assistant office window for daily absences and incidents. */
export function CounselorWindow({
  room,
  rooms,
  data,
  lang,
  busy,
  zIndex,
  onFocus,
  onClose,
  onFlyToRoom,
  onOpenStudentProfile,
  mutate,
}: CounselorWindowProps) {
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});

  const flaggedStudents = data.students.filter(
    (s) => s.today_status === 'absent' || s.today_status === 'late',
  );
  const openIncidents = data.incidents.filter((i) => i.status !== 'resolved');

  return (
    <FloatingWindow
      id={`room-${room.slotId}`}
      title={room.label}
      subtitle={`${flaggedStudents.length} ${lang === 'ar' ? 'غياب / تأخر اليوم' : 'absent/late today'}`}
      dock="right"
      width={440}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-tab-pane">
        <h4 className="sp-subhead">{lang === 'ar' ? 'الغياب والتأخر اليوم' : 'Today Absences & Late'}</h4>
        {flaggedStudents.length === 0 ? (
          <p className="sp-empty-note">{lang === 'ar' ? 'لا يوجد غياب أو تأخر مسجل اليوم' : 'No absences or late records today'}</p>
        ) : (
          <div className="sp-list-stack">
            {flaggedStudents.map((st) => {
              const clsRoom = rooms.find((r) => r.className === st.section);
              return (
                <div key={st.id} className="sp-info-row">
                  <button
                    type="button"
                    className="sp-student-name-btn"
                    onClick={() => onOpenStudentProfile(st.id)}
                  >
                    <strong>{st.name}</strong>
                    <small>{st.section}</small>
                  </button>
                  <div className="sp-row-actions">
                    <span className={`sp-status-tag is-${st.today_status}`}>{tr(st.today_status || '')}</span>
                    {clsRoom && (
                      <button type="button" className="sp-icon-btn" onClick={() => onFlyToRoom(clsRoom)}>
                        <Compass size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <h4 className="sp-subhead">{lang === 'ar' ? 'حالات تحتاج إلى تحقق' : 'Open Incidents'}</h4>
        {openIncidents.length === 0 ? (
          <p className="sp-empty-note">{lang === 'ar' ? 'لا توجد حالات مفتوحة الآن' : 'All clear — no open incidents'}</p>
        ) : (
          <div className="sp-list-stack">
            {openIncidents.map((inc) => (
              <div key={inc.id} className="sp-inline-box">
                <div className="sp-note-head">
                  <AlertTriangle size={14} className="is-coral" />
                  <strong>{inc.student_name}</strong>
                  <small>{inc.date}</small>
                </div>
                <p className="sp-small-copy">{inc.detail}</p>
                <div className="sp-row-actions">
                  <input
                    placeholder={lang === 'ar' ? 'أدخل نتيجة المتابعة…' : 'Verification note…'}
                    value={resolutionText[inc.id] || ''}
                    onChange={(e) => setResolutionText({ ...resolutionText, [inc.id]: e.target.value })}
                  />
                  <button
                    type="button"
                    className="sp-btn-soft"
                    disabled={busy || !(resolutionText[inc.id] || '').trim()}
                    onClick={() =>
                      void mutate(
                        `/incidents/${inc.id}`,
                        { status: 'resolved', resolution: resolutionText[inc.id].trim() },
                        lang === 'ar' ? 'تمت معالجة الحالة' : 'Incident resolved',
                      )
                    }
                  >
                    <CheckCircle2 size={14} />
                    <span>{lang === 'ar' ? 'إغلاق' : 'Resolve'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
