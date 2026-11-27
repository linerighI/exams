/**
 * Master School Schedule Window (Zahaapp-inspired, Apple Liquid Glass):
 * Live clock, Manual/Auto mode, timing controls, Duty Notes, Absent Staff banner,
 * Smart Math Absence Rewriter, Profiles, Transpose, Official Print, and Fullscreen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft, Clock, FolderOpen, Maximize2, Minimize2,
  Printer, RotateCw, Sparkles, UserCheck, UserX, X, Zap,
} from 'lucide-react';
import { api } from '../api';
import type { Language } from '../i18n';
import { JORDAN_WEEKDAYS, minutesOf, nowMinutesInZone, weekdayOfDate } from '../jordanTime';
import type { ResolvedSpatialRoom } from '../spatial/roomCatalog';
import { isManagerRole, type State } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { ScheduleCellModal } from './ScheduleCellModal';
import { ScheduleGrid } from './ScheduleGrid';
import { ScheduleProfilesModal, StaffAbsenceModal } from './ScheduleToolsPopovers';
import type { ScheduleLessonItem, ScheduleOverview } from './scheduleTypes';

interface SchoolScheduleWindowProps {
  data: State;
  rooms: ResolvedSpatialRoom[];
  lang: Language;
  busy: boolean;
  onClose: () => void;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Full-featured Master Schedule center for the entire school. */
export function SchoolScheduleWindow({
  data, lang, busy, onClose, mutate,
}: SchoolScheduleWindowProps) {
  const todayWd = weekdayOfDate(data.date);
  const [weekday, setWeekday] = useState(todayWd >= 0 && todayWd <= 4 ? todayWd : 0);
  const [overview, setOverview] = useState<ScheduleOverview | null>(null);
  const [isTransposed, setIsTransposed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [profilesModal, setProfilesModal] = useState(false);
  const [activeCell, setActiveCell] = useState<{ section: string; periodNumber: number; lesson?: ScheduleLessonItem } | null>(null);
  const [swapSource, setSwapSource] = useState<{ section: string; periodNumber: number; lessonId?: string } | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const manager = isManagerRole(data.user.role);

  const loadOverview = useCallback(async () => {
    try {
      const res = await api<ScheduleOverview>(`/schedule/overview?weekday=${weekday}`);
      setOverview(res);
    } catch { /* ignore */ }
  }, [weekday]);

  useEffect(() => { void loadOverview(); }, [loadOverview, data.lessons.length, data.schoolWorkspace?.lessons.length]);
  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const zone = overview?.school.timezone || data.school.timezone || 'Asia/Amman';
  const liveClockStr = (() => {
    void clockTick;
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-JO' : 'en-US', {
      timeZone: zone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(new Date());
  })();

  const nowMin = nowMinutesInZone(zone);
  const autoActiveSlot = overview?.slots.find((s) => minutesOf(s.start) <= nowMin && minutesOf(s.end) > nowMin) || null;
  const absentTeachers = (overview?.teachers || []).filter((t) => t.is_absent);

  const saveConfig = async (patch: Record<string, unknown>) => {
    if (await mutate('/schedule/config', patch)) await loadOverview();
  };

  const handleSmartRewrite = async () => {
    if (await mutate('/schedule/rewrite-absences', { weekday }, lang === 'ar' ? 'تمت إعادة بناء الجدول للغيابات' : 'Schedule rewritten')) {
      await loadOverview();
    }
  };

  const handleCellClick = async (section: string, periodNumber: number, lesson?: ScheduleLessonItem) => {
    if (!swapSource) {
      setActiveCell({ section, periodNumber, lesson });
      return;
    }
    if (swapSource.section === section && swapSource.periodNumber === periodNumber) {
      setSwapSource(null);
      return;
    }
    if (swapSource.lessonId && lesson?.id) {
      if (await mutate('/lessons/swap', { lessonIdA: swapSource.lessonId, lessonIdB: lesson.id }, lang === 'ar' ? 'تم تبديل الحصتين' : 'Swapped')) {
        await loadOverview();
      }
    }
    setSwapSource(null);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && wrapRef.current) {
      await wrapRef.current.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <FloatingWindow
      id="school-daily-schedule"
      title={lang === 'ar' ? 'الجدول الرئيسي للمدرسة' : 'Master School Schedule'}
      subtitle={overview ? `${overview.classes.length} ${lang === 'ar' ? 'صفاً' : 'classes'} · ${overview.lessons.length} ${lang === 'ar' ? 'حصة' : 'lessons'}` : undefined}
      dock="center"
      width={940}
      zIndex={62}
      onFocus={() => {}}
      onClose={onClose}
    >
      <div ref={wrapRef} className="sp-ms-wrap">
        {/* Official Print-Only Header */}
        <div className="sp-ms-print-header">
          <div>
            <strong>المملكة الأردنية الهاشمية · وزارة التربية والتعليم</strong>
            <small>{data.school.name}</small>
          </div>
          <div className="sp-ms-print-title">
            <strong>الجدول المدرسي العام</strong>
            <small>{JORDAN_WEEKDAYS.find((d) => d.id === weekday)?.ar} · {data.date}</small>
          </div>
          <div className="sp-ms-print-meta">
            {absentTeachers.length > 0 && <small>الغائبون: {absentTeachers.map((t) => t.name).join('، ')}</small>}
            {overview?.school.duty_notes && <small>المناوبون والملاحظات: {overview.school.duty_notes}</small>}
          </div>
        </div>

        <div className="sp-ms-topbar">
          <div className="sp-ms-clock">
            <Clock size={14} className="is-blue" />
            <strong>{liveClockStr}</strong>
            {overview?.school.schedule_mode === 'auto' && autoActiveSlot && (
              <span className="sp-live-chip"><Zap size={10} /> {lang === 'ar' ? `حصة ${autoActiveSlot.periodNumber}` : `P${autoActiveSlot.periodNumber}`}</span>
            )}
          </div>

          {manager && overview && (
            <div className="sp-ms-controls">
              <div className="sp-ms-mode-toggle">
                <button type="button" className={overview.school.schedule_mode === 'manual' ? 'is-active' : ''} onClick={() => void saveConfig({ schedule_mode: 'manual' })}>
                  {lang === 'ar' ? 'يدوي' : 'Manual'}
                </button>
                <button type="button" className={overview.school.schedule_mode === 'auto' ? 'is-active' : ''} onClick={() => void saveConfig({ schedule_mode: 'auto' })}>
                  {lang === 'ar' ? 'تلقائي' : 'Auto'}
                </button>
              </div>
              <input type="time" value={overview.school.start_time} onChange={(e) => void saveConfig({ start_time: e.target.value })} title={lang === 'ar' ? 'وقت البدء' : 'Start Time'} />
              <input type="number" className="sp-ms-num" min={15} max={90} value={overview.school.period_minutes} onChange={(e) => void saveConfig({ period_minutes: Number(e.target.value) || 45 })} title={lang === 'ar' ? 'مدة الحصة (د)' : 'Lesson (min)'} />
              <input type="number" className="sp-ms-num" min={0} max={30} value={overview.school.break_minutes} onChange={(e) => void saveConfig({ break_minutes: Number(e.target.value) || 0 })} title={lang === 'ar' ? 'الاستراحة (د)' : 'Break (min)'} />
            </div>
          )}

          <div className="sp-ms-actions">
            {manager && (
              <>
                <button type="button" className="sp-btn-primary sp-ms-ai-btn" disabled={busy || absentTeachers.length === 0} onClick={() => void handleSmartRewrite()} title={lang === 'ar' ? 'خوارزمية تعويض وإعادة جدولة المعلمين الغائبين' : 'Smart Absence Substitute & Compaction Solver'}>
                  <Sparkles size={13} />
                  <span>{lang === 'ar' ? 'إعادة بناء للغيابات' : 'Smart Rewrite'}</span>
                </button>
                <button type="button" className="sp-icon-btn" onClick={() => setStaffModal(true)} title={lang === 'ar' ? 'غياب المعلمين' : 'Staff Attendance'}><UserCheck size={15} /></button>
                <button type="button" className="sp-icon-btn" onClick={() => setProfilesModal(true)} title={lang === 'ar' ? 'الملفات المحفوظة' : 'Saved Profiles'}><FolderOpen size={15} /></button>
              </>
            )}
            <button type="button" className={`sp-icon-btn ${isTransposed ? 'is-active' : ''}`} onClick={() => setIsTransposed((v) => !v)} title={lang === 'ar' ? 'قلب الجدول' : 'Flip Grid'}><RotateCw size={15} /></button>
            <button type="button" className="sp-icon-btn" onClick={() => window.print()} title={lang === 'ar' ? 'طباعة' : 'Print'}><Printer size={15} /></button>
            <button type="button" className="sp-icon-btn" onClick={() => void toggleFullscreen()} title={lang === 'ar' ? 'ملء الشاشة' : 'Fullscreen'}>{isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
          </div>
        </div>

        <div className="sp-ms-tabs-row">
          <div className="sp-weekday-pills">
            {JORDAN_WEEKDAYS.map((d) => (
              <button key={d.id} type="button" className={weekday === d.id ? 'is-active' : ''} onClick={() => setWeekday(d.id)}>
                {lang === 'ar' ? d.ar : d.en}
              </button>
            ))}
          </div>
        </div>

        {overview && (
          <>
            {manager && (
              <textarea
                className="sp-ms-notes"
                rows={1}
                placeholder={lang === 'ar' ? 'أساتذة المناوبين والملاحظات اليومية (تظهر في الطباعة)…' : 'On-duty teachers & daily notes…'}
                defaultValue={overview.school.duty_notes}
                onBlur={(e) => {
                  if (e.target.value !== overview.school.duty_notes) void saveConfig({ duty_notes: e.target.value });
                }}
              />
            )}

            {absentTeachers.length > 0 && (
              <div className="sp-ms-absent-bar">
                <UserX size={13} />
                <span>{lang === 'ar' ? 'الغائبون اليوم:' : 'Absent:'}</span>
                {absentTeachers.map((t) => <em key={t.id}>{t.name}</em>)}
              </div>
            )}

            {swapSource && (
              <div className="sp-ms-swap-bar">
                <span><ArrowRightLeft size={13} /> {lang === 'ar' ? 'اختر الحصة الهدف لتبديلها…' : 'Click target slot to swap…'}</span>
                <button type="button" className="sp-icon-btn" onClick={() => setSwapSource(null)}><X size={13} /></button>
              </div>
            )}

            <ScheduleGrid
              overview={overview}
              isTransposed={isTransposed}
              isToday={weekday === todayWd}
              autoActivePeriod={autoActiveSlot?.periodNumber ?? null}
              swapSource={swapSource}
              manager={manager}
              lang={lang}
              onStartPeriod={(p) => void saveConfig({ active_period: overview.school.active_period === p ? null : p })}
              onOptimizeSection={(sec) => void mutate('/schedule/optimize-section', { section: sec, weekday }, lang === 'ar' ? 'تم ترتيب الحصص حسب الغيابات' : 'Optimized').then(() => loadOverview())}
              onCellClick={(sec, p, l) => void handleCellClick(sec, p, l)}
            />
          </>
        )}

        {activeCell && overview && (
          <ScheduleCellModal
            section={activeCell.section} weekday={weekday} periodNumber={activeCell.periodNumber}
            lesson={activeCell.lesson} subjects={data.subjects} teachers={overview.teachers}
            lang={lang} busy={busy} onClose={() => setActiveCell(null)}
            onSaveCell={async (payload, msg) => {
              if (await mutate('/schedule/cell', payload, msg)) { setActiveCell(null); await loadOverview(); }
            }}
            onStartSwap={() => {
              setSwapSource({ section: activeCell.section, periodNumber: activeCell.periodNumber, lessonId: activeCell.lesson?.id });
              setActiveCell(null);
            }}
            onToggleAbsent={async (tid, isAbsent) => {
              if (await mutate('/schedule/teacher-absence', { teacherId: tid, isAbsent })) await loadOverview();
            }}
          />
        )}

        {staffModal && overview && (
          <StaffAbsenceModal
            teachers={overview.teachers} lang={lang} onClose={() => setStaffModal(false)}
            onToggle={async (tid, isAbsent) => {
              if (await mutate('/schedule/teacher-absence', { teacherId: tid, isAbsent })) await loadOverview();
            }}
          />
        )}

        {profilesModal && overview && (
          <ScheduleProfilesModal
            profiles={overview.profiles} lang={lang} busy={busy} onClose={() => setProfilesModal(false)}
            onSave={async (name) => {
              if (await mutate('/schedule/profiles', { name }, lang === 'ar' ? 'تم حفظ نسخة الجدول' : 'Profile saved')) await loadOverview();
            }}
            onLoad={async (id) => {
              if (await mutate(`/schedule/profiles/${id}/load`, {}, lang === 'ar' ? 'تم تحميل الجدول' : 'Profile loaded')) { setProfilesModal(false); await loadOverview(); }
            }}
            onDelete={async (id) => {
              if (await mutate(`/schedule/profiles/${id}/delete`, {})) await loadOverview();
            }}
          />
        )}
      </div>
    </FloatingWindow>
  );
}
