/**
 * Detailed `Student Profile` (`ملف الطالب`) WinUI 3 Workbench: sticky student hero
 * with single-line attendance controls, collapsible quick actions, and filterable record timeline.
 */
import { useMemo } from 'react';
import { ArrowRight, Check, Clock, Eye, Phone, Sparkles, X } from 'lucide-react';
import { pulseToggle } from '../animation';
import { StudentAvatar } from '../components/StudentAvatar';
import { isManagerRole } from '../experience';
import type { Language } from '../i18n';
import { WinExpander, animateSuccessFlash } from '../schoolsync-ui';
import type { State } from '../types';
import { Empty } from '../ui';
import { StudentActions } from './StudentActions';
import { StudentTimelinePanel } from './StudentTimelinePanel';

export function StudentProfile({
  data,
  lang,
  mutate,
  busy,
  onBack,
  onPreview,
}: {
  data: State;
  lang: Language;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
  busy: boolean;
  onBack: () => void;
  onPreview: (studentId: string) => void;
}) {
  const ar = lang === 'ar';
  const s = data.student;
  const manager = isManagerRole(data.user.role);

  const subjectChoices = useMemo(() => {
    const set = new Set<string>();
    const teacherProfile = data.teachers.find((t) => t.id === data.user.id);
    if (teacherProfile && !manager) {
      for (const sub of teacherProfile.subjects) set.add(sub);
      for (const l of data.schoolWorkspace?.lessons || []) {
        if (s && l.section === s.section && l.teacher_id === data.user.id) set.add(l.subject);
      }
    } else {
      for (const sub of data.subjects) set.add(sub.name);
      for (const l of data.lessons) set.add(l.subject);
    }
    return [...set];
  }, [data, manager, s]);

  if (!s) {
    return (
      <Empty
        title={ar ? 'اختر طالباً' : 'Select a student'}
        detail={ar ? 'عد إلى قائمة الطلاب واختر طالباً لعرض ملفه.' : 'Go back to Students and tap a card.'}
      />
    );
  }

  const quickMark = async (e: React.MouseEvent<HTMLButtonElement>, status: 'present' | 'absent' | 'late') => {
    pulseToggle(e.currentTarget);
    animateSuccessFlash(e.currentTarget.closest<HTMLElement>('.student-hero-card'));
    await mutate(
      '/attendance/quick',
      { studentId: s.id, status },
      status === 'absent'
        ? ar ? 'تم تسجيل الغياب وإشعار ولي الأمر فوراً' : 'Marked absent & parent notified'
        : status === 'late'
          ? ar ? 'تم تسجيل التأخر وإشعار ولي الأمر' : 'Marked late & parent notified'
          : ar ? 'تم تسجيل الحضور' : 'Marked present',
    );
  };

  return (
    <div className="student-profile-view">
      <div className="sp-top-bar" data-reveal>
        <button type="button" className="sp-nav-btn" onClick={onBack}>
          <ArrowRight size={16} />
          {ar ? 'رجوع للطلاب' : 'Back to Students'}
        </button>
        <button type="button" className="sp-nav-btn" onClick={() => onPreview(s.id)}>
          <Eye size={15} />
          {ar ? 'معاينة ولي الأمر' : 'Parent preview'}
        </button>
      </div>

      <div className="sp-grid">
        <div className="sp-aside">
          <section className="student-hero-card t-surface" data-reveal>
            <div className="student-hero-row">
              <StudentAvatar name={s.name} initialsText={s.initials} color={s.color} size="lg" />
              <div>
                <h1>{s.name}</h1>
                <div className="sp-hero-badges">
                  <span className="sp-meta-pill accent">{s.section}</span>
                  <span className="sp-meta-pill">
                    {ar ? 'آخر غياب:' : 'Last absence:'} {s.last_absence || (ar ? 'لا يوجد' : 'None')}
                  </span>
                </div>
                {s.guardian_phone && (
                  <a className="phone-chip" href={`tel:${s.guardian_phone}`}>
                    <Phone size={13} />
                    {s.guardian_phone}
                  </a>
                )}
              </div>
            </div>

            <div className="quick-att-bar" role="group" aria-label={ar ? 'حالة الحضور اليوم' : 'Today attendance'}>
              <button
                type="button"
                className={`quick-att-btn present t-surface ${s.today_status === 'present' ? 'active' : ''}`}
                disabled={busy}
                onClick={(e) => void quickMark(e, 'present')}
              >
                <Check size={15} />
                {ar ? 'حاضر' : 'Present'}
              </button>
              <button
                type="button"
                className={`quick-att-btn absent t-surface ${s.today_status === 'absent' ? 'active' : ''}`}
                disabled={busy}
                onClick={(e) => void quickMark(e, 'absent')}
              >
                <X size={15} />
                {ar ? 'غائب' : 'Absent'}
              </button>
              <button
                type="button"
                className={`quick-att-btn late t-surface ${s.today_status === 'late' ? 'active' : ''}`}
                disabled={busy}
                onClick={(e) => void quickMark(e, 'late')}
              >
                <Clock size={15} />
                {ar ? 'متأخر' : 'Late'}
              </button>
            </div>
            <p className="sp-att-hint">
              {ar ? 'تسجيل الغياب أو التأخر يرسل تنبيهاً فورياً لولي الأمر.' : 'Absent or late notifies the guardian immediately.'}
            </p>
          </section>

          <WinExpander
            className="sp-actions-card"
            title={ar ? 'إضافة ملاحظة أو علامة' : 'Quick Actions'}
            subtitle={ar ? 'إرسال ملاحظة صفية، رصد علامة، أو إعداد دخول العائلة' : 'Notes, marks & family access'}
            icon={<Sparkles size={16} />}
            defaultOpen
          >
            <StudentActions
              student={s}
              subjectChoices={subjectChoices}
              manager={manager}
              lang={lang}
              busy={busy}
              mutate={mutate}
            />
          </WinExpander>
        </div>

        <StudentTimelinePanel
          studentId={s.id}
          notes={data.notes}
          grades={data.grades}
          lang={lang}
          busy={busy}
          onPublishGrade={async (gradeId) => {
            await mutate(`/grades/${gradeId}/publish`, {}, ar ? 'تم نشر العلامة' : 'Grade published');
          }}
        />
      </div>
    </div>
  );
}
