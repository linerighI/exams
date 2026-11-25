/**
 * Minimalist floating Apple HUD over the 3D viewport:
 * Top-left brand + live Jordanian bell period pill, Top-right school name, Spotlight search,
 * Principal quick room-label toggle, Notifications popover, and Account popover.
 */
import { useEffect, useState } from 'react';
import {
  Bell,
  Box,
  Clock,
  Globe,
  LogOut,
  Pencil,
  Radio,
  ShieldAlert,
  WifiOff,
} from 'lucide-react';
import type { Language } from '../i18n';
import { buildPeriodSlots, formatClock, minutesOf, nowMinutesInZone } from '../jordanTime';
import type { ResolvedSpatialRoom, TeacherAccess } from '../spatial/roomCatalog';
import type { TrackerStatus } from '../tracking/teacherTracker';
import { isManagerRole, isSchoolRole, type State } from '../types';
import { SpotlightSearch } from './SpotlightSearch';

interface SpatialHudProps {
  data: State | null;
  schoolName: string;
  rooms: ResolvedSpatialRoom[];
  access: TeacherAccess;
  lang: Language;
  offline: boolean;
  editLabelsMode: boolean;
  editorMode: boolean;
  trackingStatus?: TrackerStatus;
  onSelectRoom: (room: ResolvedSpatialRoom) => void;
  onSelectStudent: (studentId: string, room: ResolvedSpatialRoom | null) => void;
  setLang: (lang: Language) => void;
  setEditLabelsMode: (v: boolean) => void;
  onToggleEditor: () => void;
  onMarkNotificationsRead: () => void;
  onLogout: () => void;
}

/** Floating minimalist header HUD anchored cleanly over the 3D scene. */
export function SpatialHud({
  data,
  schoolName,
  rooms,
  access,
  lang,
  offline,
  editLabelsMode,
  editorMode,
  trackingStatus = 'off',
  setLang,
  setEditLabelsMode,
  onToggleEditor,
  onSelectRoom,
  onSelectStudent,
  onMarkNotificationsRead,
  onLogout,
}: SpatialHudProps) {
  const [popover, setPopover] = useState<'none' | 'alerts' | 'account'>('none');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const unread = data ? data.notifications.filter((n) => !n.read).length : 0;
  const staff = data ? isSchoolRole(data.user.role) : false;
  const manager = data ? isManagerRole(data.user.role) : false;

  const zone = data?.school.timezone || 'Asia/Amman';
  const nowStr = (() => {
    void tick;
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    return formatClock(fmt, lang);
  })();

  const activeSlot = data
    ? (() => {
        const nowMin = nowMinutesInZone(zone);
        return buildPeriodSlots(data.school).find(
          (s) => minutesOf(s.start) <= nowMin && minutesOf(s.end) > nowMin,
        );
      })()
    : null;

  const roleSubtitle = !data
    ? lang === 'ar'
      ? 'النظام المكاني ثلاثي الأبعاد'
      : '3D Spatial Campus OS'
    : data.user.role === 'admin'
      ? lang === 'ar'
        ? 'منظور المدير ثلاثي الأبعاد'
        : 'Principal 3D Drone View'
      : data.user.role === 'assistant'
        ? lang === 'ar'
          ? 'منظور مساعد المدير'
          : 'Assistant Principal 3D View'
        : data.user.role === 'teacher'
          ? lang === 'ar'
            ? 'جناح المعلم المخصّص'
            : 'Assigned Teacher Wing'
          : lang === 'ar'
            ? 'مساحة العائلة التفاعلية'
            : 'Family 3D Companion';

  return (
    <header className="sp-hud">
      <div className="sp-hud-brand">
        <div className="sp-brand-title">
          <strong>SchoolSync</strong>
          <span>{roleSubtitle}</span>
        </div>
        {data && (
          <div className="sp-live-clock">
            <Clock size={13} />
            <span>{nowStr}</span>
            {activeSlot && (
              <em className="sp-period-chip">
                {lang === 'ar' ? activeSlot.labelAr : activeSlot.labelEn}
              </em>
            )}
          </div>
        )}
        {offline && (
          <span className="sp-offline-pill">
            <WifiOff size={12} />
            {lang === 'ar' ? 'غير متصل' : 'Offline'}
          </span>
        )}
      </div>

      <div className="sp-hud-actions">
        <span className="sp-school-title">{data?.school.name || schoolName}</span>

        {data && staff && (
          <SpotlightSearch
            data={data}
            rooms={rooms}
            access={access}
            lang={lang}
            onSelectRoom={onSelectRoom}
            onSelectStudent={onSelectStudent}
          />
        )}

        {manager && (
          <>
            <button
              type="button"
              className={`sp-hud-chip ${editorMode ? 'is-active' : ''}`}
              onClick={onToggleEditor}
              title="SARE — School Advanced Rendering Engine"
            >
              <Box size={14} />
              <span>{lang === 'ar' ? 'محرر SARE 3D' : 'SARE 3D Editor'}</span>
            </button>

            {!editorMode && (
              <button
                type="button"
                className={`sp-hud-chip ${editLabelsMode ? 'is-active' : ''}`}
                onClick={() => setEditLabelsMode(!editLabelsMode)}
                title={lang === 'ar' ? 'تسمية وتخصيص الغرف على الخريطة' : 'Edit 3D Room Labels'}
              >
                <Pencil size={14} />
                <span>{lang === 'ar' ? 'تسمية الغرف' : 'Label Rooms'}</span>
              </button>
            )}
          </>
        )}

        {data && data.user.role === 'teacher' && (
          <>
            {access.restricted && (
              <span className="sp-wing-badge">
                <ShieldAlert size={13} />
                {lang === 'ar' ? 'نطاق جناحك المخصّص' : 'Assigned Wing Only'}
              </span>
            )}
            <span className={`sp-hud-chip ${trackingStatus === 'active' ? 'is-active' : ''}`}>
              <Radio size={13} />
              <span>
                {trackingStatus === 'active'
                  ? lang === 'ar' ? 'الموقع نشط' : 'Tracking Live'
                  : trackingStatus === 'paused_hours'
                    ? lang === 'ar' ? 'خارج الدوام' : 'Off Hours'
                    : trackingStatus === 'outside_geofence'
                      ? lang === 'ar' ? 'خارج الحرم' : 'Outside Campus'
                      : lang === 'ar' ? 'التتبع متوقف' : 'Paused'}
              </span>
            </span>
          </>
        )}

        {data ? (
          <>
            <div className="sp-popover-anchor">
              <button
                type="button"
                className="sp-icon-pill"
                aria-label={lang === 'ar' ? 'التنبيهات' : 'Notifications'}
                onClick={() => {
                  const next = popover === 'alerts' ? 'none' : 'alerts';
                  setPopover(next);
                  if (next === 'alerts' && unread > 0) onMarkNotificationsRead();
                }}
              >
                <Bell size={17} />
                {unread > 0 && <i className="sp-badge-dot" />}
              </button>

              {popover === 'alerts' && (
                <div className="sp-popover-card">
                  <div className="sp-popover-head">
                    <strong>{lang === 'ar' ? 'الإشعارات والتنبيهات' : 'Notifications'}</strong>
                    <button type="button" onClick={() => setPopover('none')}>
                      ×
                    </button>
                  </div>
                  <div className="sp-popover-list">
                    {data.notifications.length === 0 ? (
                      <p className="sp-empty-note">
                        {lang === 'ar' ? 'لا توجد تنبيهات جديدة' : 'No notifications'}
                      </p>
                    ) : (
                      data.notifications.slice(0, 12).map((n) => (
                        <div key={n.id} className={`sp-notif-row ${n.read ? '' : 'is-unread'}`}>
                          <strong>{n.title}</strong>
                          <p>{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="sp-popover-anchor">
              <button
                type="button"
                className="sp-avatar-pill"
                onClick={() => setPopover(popover === 'account' ? 'none' : 'account')}
              >
                {data.user.name.slice(0, 2)}
              </button>

              {popover === 'account' && (
                <div className="sp-popover-card is-compact">
                  <div className="sp-account-meta">
                    <strong>{data.user.name}</strong>
                    <small>{data.user.email}</small>
                  </div>
                  <button
                    type="button"
                    className="sp-menu-action"
                    onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                  >
                    <Globe size={15} />
                    <span>{lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}</span>
                  </button>
                  <button
                    type="button"
                    className="sp-menu-action is-danger"
                    onClick={() => {
                      setPopover('none');
                      onLogout();
                    }}
                  >
                    <LogOut size={15} />
                    <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="sp-hud-chip"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          >
            <Globe size={14} />
            <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
        )}
      </div>
    </header>
  );
}
