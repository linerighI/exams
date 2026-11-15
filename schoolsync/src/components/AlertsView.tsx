/**
 * One-way Alerts & School Announcements center (replaces two-way chat messaging).
 */
import { useRef } from 'react';
import { Bell, BellRing, CheckCheck, ShieldAlert, Sparkles, Volume2 } from 'lucide-react';
import type { Language } from '../i18n';
import { ensureNativeNotificationPermission, showNativeNotification } from '../nativeNotify';
import { useStaggerGrid } from '../schoolsync-ui';
import type { State } from '../types';
import { Empty, Section } from '../ui';

export function AlertsView({
  data,
  lang,
  mutate,
  busy,
}: {
  data: State;
  lang: Language;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  busy: boolean;
}) {
  const ar = lang === 'ar';
  const unreadCount = data.notifications.filter((n) => !n.read).length;
  const listRef = useRef<HTMLDivElement>(null);
  useStaggerGrid(listRef, '.alert-card', [data.notifications.length, data.announcements.length]);

  return (
    <div ref={listRef} className="alerts-view">
      <div className="page-intro" data-reveal>
        <div className="eyebrow">{ar ? 'إشعارات المدرسة الفورية' : 'INSTANT SCHOOL ALERTS'}</div>
        <h1>
          {ar ? 'التنبيهات' : 'Alerts'}
          <span className="greeting-dot">.</span>
        </h1>
        <p>
          {ar
            ? 'تصلك تنبيهات الغياب وملاحظات السلوك والعلامات والتعاميم مباشرة من المدرسة.'
            : 'Instant absence alerts, class notes, marks, and school announcements.'}
        </p>
      </div>

      <div className="alerts-toolbar" data-reveal>
        <span>
          {unreadCount > 0
            ? ar
              ? `${unreadCount} تنبيهات غير مقروءة`
              : `${unreadCount} unread alerts`
            : ar
              ? 'جميع التنبيهات مقروءة'
              : 'All alerts caught up'}
        </span>
        <div className="chip-row">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={async () => {
              await ensureNativeNotificationPermission();
              if (await mutate('/notifications/test', {}, ar ? 'تم إرسال إشعار تجريبي إلى هاتفك' : 'Test alert sent')) {
                await showNativeNotification({
                  id: `test-${Date.now()}`,
                  title: ar ? 'إشعار تجريبي · مدرسة محمد الشريقي' : 'Test Alert',
                  content: ar ? 'هكذا تصلك إشعارات المدرسة في لوحة إشعارات الهاتف.' : 'Sample native phone alert.',
                });
              }
            }}
          >
            <BellRing size={15} />
            {ar ? 'إشعار تجريبي للهاتف' : 'Test phone alert'}
          </button>
          {unreadCount > 0 && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void mutate(
                  '/notifications/read',
                  {},
                  ar ? 'تم تحديد جميع التنبيهات كمقروءة' : 'All alerts marked read',
                )
              }
            >
              <CheckCheck size={16} />
              {ar ? 'تحديد الكل كمقروء' : 'Mark all read'}
            </button>
          )}
        </div>
      </div>

      <Section title={ar ? 'التنبيهات الفورية' : 'Notifications'} />
      {data.notifications.length ? (
        <div className="alerts-list" data-reveal>
          {data.notifications.map((n) => {
            const isAbsence = n.title.includes('غياب') || n.title.includes('تأخر');
            const isNote = n.title.includes('ملاحظة');
            return (
              <article
                className={`alert-card t-stagger-row ${n.read ? '' : 'unread'} ${isAbsence ? 'urgent' : ''}`}
                key={n.id}
                onClick={() => {
                  if (!n.read && !busy) void mutate(`/notifications/${n.id}/read`, {}, ar ? 'تمت قراءة التنبيه' : 'Alert marked read');
                }}
                style={{ cursor: n.read ? 'default' : 'pointer' }}
              >
                <span className={`alert-icon ${isAbsence ? 'rose' : isNote ? 'amber' : 'blue'}`}>
                  {isAbsence ? (
                    <ShieldAlert size={18} />
                  ) : isNote ? (
                    <Sparkles size={18} />
                  ) : (
                    <Bell size={18} />
                  )}
                </span>
                <div className="alert-copy">
                  <div className="alert-head">
                    <h3>{n.title}</h3>
                    <small>{n.created.slice(0, 10)}</small>
                  </div>
                  <p>{n.content}</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={ar ? 'لا توجد تنبيهات حالياً' : 'No alerts yet'}
          detail={
            ar
              ? 'ستظهر هنا تنبيهات الحضور والملاحظات والعلامات فور صدورها.'
              : 'Attendance alerts, notes, and grade updates will appear here immediately.'
          }
        />
      )}

      {data.announcements.length > 0 && (
        <>
          <Section title={ar ? 'التعاميم المدرسية' : 'School Announcements'} />
          <div className="alerts-list" data-reveal>
            {data.announcements.map((a) => (
              <article className="alert-card t-stagger-row" key={a.id}>
                <span className="alert-icon mint">
                  <Volume2 size={18} />
                </span>
                <div className="alert-copy">
                  <div className="alert-head">
                    <h3>{a.title}</h3>
                    <small>{a.created.slice(0, 10)}</small>
                  </div>
                  <p>{a.content}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
