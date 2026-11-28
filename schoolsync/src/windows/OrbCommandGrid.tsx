/**
 * Quick Spatial Actions grid and Sandbox Role Previewer rendered inside the
 * upgraded Blue Orb Command Companion window.
 */
import { Box, Building2, CalendarDays, Eye, Globe, Radio, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import type { Language } from '../i18n';
import { isManagerRole, isSchoolRole, type DemoRole, type State } from '../types';

export interface OrbCompanionActions {
  onOpenSchedule: () => void;
  onToggleEditor: () => void;
  onOpenRoomByKind: (kind: 'principal' | 'reception' | 'teachers' | 'classroom') => void;
  onToggleRoofs: () => void;
  onToggleLang: () => void;
  onSwitchDemoRole?: (role: DemoRole) => Promise<void>;
}

interface OrbCommandGridProps {
  data: State;
  lang: Language;
  actions: OrbCompanionActions;
  onOpenConnection: () => void;
  onCloseCompanion: () => void;
}

/** 2-column Apple Glass command launcher tailored to the signed-in user role. */
export function OrbCommandGrid({
  data,
  lang,
  actions,
  onOpenConnection,
  onCloseCompanion,
}: OrbCommandGridProps) {
  const ar = lang === 'ar';
  const staff = isSchoolRole(data.user.role);
  const manager = isManagerRole(data.user.role);

  const runAndClose = (fn: () => void) => {
    fn();
    onCloseCompanion();
  };

  return (
    <div className="sp-orb-cmd-grid">
      {staff && (
        <button type="button" className="sp-orb-cmd-tile" onClick={() => runAndClose(actions.onOpenSchedule)}>
          <span className="sp-orb-cmd-icon"><CalendarDays size={15} /></span>
          <div>
            <strong>{ar ? 'الجدول الرئيسي' : 'Master Schedule'}</strong>
            <small>{ar ? 'عرض وتعديل حصص اليوم' : 'School-wide matrix'}</small>
          </div>
        </button>
      )}

      {manager && (
        <button type="button" className="sp-orb-cmd-tile" onClick={() => runAndClose(() => actions.onOpenRoomByKind('principal'))}>
          <span className="sp-orb-cmd-icon"><Building2 size={15} /></span>
          <div>
            <strong>{ar ? 'مكتب المدير' : 'Principal Office'}</strong>
            <small>{ar ? 'الشعب والمعلمون والطلبة' : 'Classes, staff & enroll'}</small>
          </div>
        </button>
      )}

      {manager && (
        <button type="button" className="sp-orb-cmd-tile" onClick={() => runAndClose(() => actions.onOpenRoomByKind('reception'))}>
          <span className="sp-orb-cmd-icon is-emerald"><UserCheck size={15} /></span>
          <div>
            <strong>{ar ? 'الاستقبال والتسجيل' : 'Reception Desk'}</strong>
            <small>{ar ? `${data.students.length} طالب مسجل` : `${data.students.length} students`}</small>
          </div>
        </button>
      )}

      {manager && (
        <button type="button" className="sp-orb-cmd-tile" onClick={() => runAndClose(actions.onToggleEditor)}>
          <span className="sp-orb-cmd-icon is-amber"><Box size={15} /></span>
          <div>
            <strong>{ar ? 'محرر SARE 3D' : 'SARE 3D Studio'}</strong>
            <small>{ar ? 'تصميم القاعات والأثاث' : 'Edit campus 3D'}</small>
          </div>
        </button>
      )}

      {staff && (
        <button type="button" className="sp-orb-cmd-tile" onClick={actions.onToggleRoofs}>
          <span className="sp-orb-cmd-icon"><Eye size={15} /></span>
          <div>
            <strong>{ar ? 'أسقف المجسم 3D' : 'Toggle 3D Roofs'}</strong>
            <small>{ar ? 'إظهار / إخفاء الأسقف' : 'Interior / exterior'}</small>
          </div>
        </button>
      )}

      <button type="button" className="sp-orb-cmd-tile" onClick={actions.onToggleLang}>
        <span className="sp-orb-cmd-icon"><Globe size={15} /></span>
        <div>
          <strong>{ar ? 'English UI' : 'الواجهة العربية'}</strong>
          <small>{ar ? 'تبديل لغة التطبيق' : 'Switch language'}</small>
        </div>
      </button>

      <button type="button" className="sp-orb-cmd-tile" onClick={onOpenConnection}>
        <span className="sp-orb-cmd-icon is-emerald"><Radio size={15} /></span>
        <div>
          <strong>{ar ? 'الخادم والنفق' : 'Server & Cloud'}</strong>
          <small>{ar ? 'فحص الشبكة والرابط' : 'LAN & tunnel link'}</small>
        </div>
      </button>
    </div>
  );
}

interface SandboxRolePanelProps {
  data: State;
  lang: Language;
  onSwitchRole: (role: DemoRole) => Promise<void>;
}

/** 1-click isolated sandbox role switcher inside the Blue Orb. */
export function SandboxRolePanel({ data, lang, onSwitchRole }: SandboxRolePanelProps) {
  const ar = lang === 'ar';
  const roles: { id: DemoRole; ar: string; en: string; descAr: string; descEn: string; userId: string }[] = [
    { id: 'admin', ar: 'المدير العام', en: 'Principal', descAr: 'كامل المبنى والصلاحيات', descEn: 'Full campus control', userId: 'admin-demo' },
    { id: 'assistant', ar: 'مساعد المدير', en: 'Assistant', descAr: 'إدارة الجدول والشعب', descEn: 'Schedule & students', userId: 'assistant-demo' },
    { id: 'teacher', ar: 'معلم (جناح غرب)', en: 'Teacher (West)', descAr: 'جناح غرب + عزل ضبابي', descEn: 'Wing-locked fog view', userId: 'teacher-demo' },
    { id: 'teacher2', ar: 'معلم (جناح شرق)', en: 'Teacher (East)', descAr: 'جناح شرق + عزل ضبابي', descEn: 'East wing isolated', userId: 'teacher-sibling' },
    { id: 'parent', ar: 'ولي الأمر', en: 'Parent', descAr: 'منظور العائلة والدرجات', descEn: 'Family portal view', userId: 'parent-demo' },
    { id: 'student', ar: 'حساب الطالب', en: 'Student', descAr: 'جدولي وواجباتي', descEn: 'Student portal view', userId: 'student-demo' },
  ];

  return (
    <div className="sp-tab-pane">
      <div className="sp-inline-box">
        <div className="sp-po-card-head">
          <strong>
            <ShieldCheck size={14} style={{ verticalAlign: -2, marginInlineEnd: 5 }} />
            {ar ? 'معاينة الأدوار (بيئة اختبار آمنة)' : 'Isolated Role Previewer'}
          </strong>
        </div>
        <p className="sp-po-hint">
          {ar
            ? 'بدّل فوراً بين حساب المدير والمعلم المعزول بالجناح والعائلة دون إنشاء حسابات أو المساس بقاعدة البيانات الحية.'
            : 'Switch immediately between Principal, Wing-locked Teacher, and Family views with zero impact on your live database.'}
        </p>
      </div>
      <div className="sp-sandbox-grid">
        {roles.map((r) => {
          const active = data.user.id === r.userId;
          return (
            <button
              key={r.id}
              type="button"
              className={`sp-sandbox-role-btn ${active ? 'is-active' : ''}`}
              onClick={() => void onSwitchRole(r.id)}
            >
              <strong>
                {active && <Sparkles size={11} style={{ marginInlineEnd: 4, color: '#007aff' }} />}
                {ar ? r.ar : r.en}
              </strong>
              <small>{ar ? r.descAr : r.descEn}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
