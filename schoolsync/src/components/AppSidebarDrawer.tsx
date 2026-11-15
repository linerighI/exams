/**
 * WinUI 3 Global NavigationView Sidebar Drawer (`القائمة الجانبية`).
 * Houses every role-scoped screen, secondary portal shortcuts, child switcher,
 * dark mode toggle, and language selector cleanly off the main canvas.
 */
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCheck,
  Clock,
  House,
  Languages,
  LogOut,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  UserRound,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import type { Language } from '../i18n';
import { WinButton, WinSideDrawer } from '../schoolsync-ui';
import type { State } from '../types';

interface NavEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function AppSidebarDrawer({
  open,
  onClose,
  data,
  view,
  lang,
  dark,
  staff,
  manager,
  setDark,
  setLang,
  go,
  openSheet,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  data: State;
  view: string;
  lang: Language;
  dark: boolean;
  staff: boolean;
  manager: boolean;
  setDark: (v: boolean) => void;
  setLang: (l: Language) => void;
  go: (tab: string) => void;
  openSheet: (name: string) => void;
  onLogout: () => Promise<void>;
}) {
  const ar = lang === 'ar';
  const unread = data.notifications.filter((n) => !n.read).length;
  const pendingWork = data.homework.filter((h) => !h.submission).length;
  const isStudent = data.user.role === 'student';

  const screens: NavEntry[] = staff
    ? [
        { id: 'dashboard', label: ar ? 'الرئيسية والملخص' : 'Dashboard', icon: House },
        { id: 'students', label: ar ? 'الطلاب والحضور' : 'Students & Roll Call', icon: Users },
        { id: 'schedule', label: ar ? 'الجدول الرئيسي' : 'Master Timetable', icon: CalendarDays },
        ...(manager
          ? [{ id: 'management', label: ar ? 'إدارة المدرسة' : 'School Admin Canvas', icon: ShieldCheck }]
          : []),
        { id: 'alerts', label: ar ? 'التنبيهات والتعاميم' : 'Alerts & Notices', icon: Bell, badge: unread },
      ]
    : [
        { id: 'today', label: ar ? 'اليوم ونبض الدوام' : 'Today', icon: House },
        { id: 'schedule', label: ar ? 'الجدول الدراسي' : 'Timetable', icon: CalendarDays },
        { id: 'homework', label: ar ? 'الواجبات' : 'Homework', icon: BookOpen, badge: pendingWork },
        { id: 'grades', label: ar ? 'العلامات' : 'Grades', icon: TrendingUp },
        { id: 'attendance', label: ar ? 'سجل الحضور والغياب' : 'Attendance History', icon: CheckCheck },
        { id: 'notes', label: ar ? 'ملاحظات المعلمين' : 'Teacher Notes', icon: Sparkles, badge: data.notes.length },
        { id: 'alerts', label: ar ? 'التنبيهات والتعاميم' : 'Alerts', icon: Bell, badge: unread },
      ];

  const jump = (target: string) => {
    onClose();
    go(target);
  };

  const triggerSheet = (sheetName: string) => {
    onClose();
    openSheet(sheetName);
  };

  return (
    <WinSideDrawer
      open={open}
      onClose={onClose}
      title={ar ? 'القائمة والتنقّل السريع' : 'Navigation & Tools'}
      subtitle={
        staff
          ? data.school.name
          : `${data.student?.name || data.user.name} · ${data.school.name}`
      }
    >
      <div className="wui-nav-group" role="navigation" aria-label={ar ? 'شاشات التطبيق' : 'App screens'}>
        <span className="wui-nav-group-label">{ar ? 'جميع الشاشات' : 'ALL SCREENS'}</span>
        {screens.map((item) => {
          const active = view === item.id || (item.id === 'students' && view === 'student-profile');
          return (
            <button
              key={item.id}
              type="button"
              className={`wui-nav-item ${active ? 'active' : ''}`}
              onClick={() => jump(item.id)}
            >
              <span className="wui-nav-item-main">
                <item.icon size={17} />
                <span>{item.label}</span>
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="wui-nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {!staff && (
        <div className="wui-nav-group">
          <span className="wui-nav-group-label">{ar ? 'أدوات سريعة' : 'QUICK TOOLS'}</span>
          <button type="button" className="wui-nav-item" onClick={() => triggerSheet('companion')}>
            <span className="wui-nav-item-main">
              <Sparkles size={17} />
              <span>{ar ? 'نبض اليوم المدرسي' : 'Day Pulse Companion'}</span>
            </span>
          </button>
          {data.students.length > 1 && (
            <button type="button" className="wui-nav-item" onClick={() => triggerSheet('children')}>
              <span className="wui-nav-item-main">
                <Users size={17} />
                <span>{ar ? 'تبديل الطالب' : 'Switch child'}</span>
              </span>
            </button>
          )}
          <button type="button" className="wui-nav-item" onClick={() => triggerSheet('notices')}>
            <span className="wui-nav-item-main">
              <Volume2 size={17} />
              <span>{ar ? 'التعاميم المدرسية' : 'School notices'}</span>
            </span>
          </button>
          {isStudent && (
            <button type="button" className="wui-nav-item" onClick={() => triggerSheet('focus')}>
              <span className="wui-nav-item-main">
                <Clock size={17} />
                <span>{ar ? 'جلسة تركيز للدراسة' : 'Focus timer'}</span>
              </span>
            </button>
          )}
        </div>
      )}

      <div className="wui-sidebar-footer">
        <button
          type="button"
          className={`wui-nav-item ${view === 'you' ? 'active' : ''}`}
          onClick={() => jump('you')}
        >
          <span className="wui-nav-item-main">
            <UserRound size={17} />
            <span>{ar ? 'حسابي والإعدادات' : 'Account & Settings'}</span>
          </span>
        </button>

        <div className="wui-sidebar-prefs">
          <WinButton variant="standard" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
            {dark ? (ar ? 'فاتح' : 'Light') : (ar ? 'داكن' : 'Dark')}
          </WinButton>
          <WinButton variant="standard" onClick={() => setLang(ar ? 'en' : 'ar')}>
            <Languages size={15} />
            {ar ? 'English' : 'العربية'}
          </WinButton>
        </div>

        <WinButton
          variant="subtle"
          onClick={() => {
            onClose();
            void onLogout();
          }}
        >
          <LogOut size={15} />
          {ar ? 'تسجيل الخروج' : 'Sign out'}
        </WinButton>
      </div>
    </WinSideDrawer>
  );
}
