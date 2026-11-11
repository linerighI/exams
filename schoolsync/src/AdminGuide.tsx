/**
 * SchoolSync Administrator Guide & Quick Action Panel
 *
 * Provides a clean, highly accessible, step-by-step guidance card and administrative
 * quick actions for school principals and administrators. Designed specifically for
 * non-technical users to easily understand school setup, teacher onboarding,
 * student registration, and family credentials.
 */

import {
  CalendarDays,
  CheckCircle2,
  Clock,
  KeyRound,
  Megaphone,
  School,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  ArrowLeft,
} from 'lucide-react';
import type { State } from './types';
import type { Language } from './i18n';

interface AdminGuideProps {
  data: State;
  lang: Language;
  onAction: (tool: string) => void;
}

export function AdminGuide({ data, lang, onAction }: AdminGuideProps) {
  const ar = lang === 'ar';

  const hasHours = Boolean(data.school?.start_time && data.school?.end_time);
  const hasStaff = data.accounts.some((a) => a.role === 'teacher');
  const hasStudents = data.students.length > 0;
  const hasFamilyAccess = data.familyAccess.length > 0;
  const hasLessons = Boolean(data.schoolWorkspace?.lessons?.length);

  const steps = [
    {
      num: 1,
      id: 'school',
      icon: Clock,
      title: ar ? 'أوقات الدوام والمدرسة' : 'School Hours & Settings',
      description: ar
        ? `الدوام الحالي من ${data.school?.start_time || '08:00'} إلى ${data.school?.end_time || '14:00'}`
        : `Operating hours: ${data.school?.start_time || '08:00'} - ${data.school?.end_time || '14:00'}`,
      done: hasHours,
      buttonLabel: ar ? 'تعديل الدوام' : 'Edit Hours',
    },
    {
      num: 2,
      id: 'account',
      icon: UserPlus,
      title: ar ? 'إضافة المعلمين والشعب' : 'Teachers & Staff Accounts',
      description: ar
        ? hasStaff
          ? 'تم تسجيل معلمين في المدرسة بنجاح'
          : 'سجّل حسابات المعلمين وحدد شعبهم الدراسية'
        : hasStaff
          ? 'Teachers have been registered'
          : 'Create teacher logins and assign their class sections',
      done: hasStaff,
      buttonLabel: ar ? 'إضافة معلّم' : 'Add Teacher',
    },
    {
      num: 3,
      id: 'student',
      icon: Users,
      title: ar ? 'تسجيل الطلاب' : 'Student Enrollment',
      description: ar
        ? hasStudents
          ? `مسجّل حالياً ${data.students.length} طالب في المدرسة`
          : 'أضف أسماء الطلاب ووزعهم على الشعب'
        : hasStudents
          ? `${data.students.length} students enrolled`
          : 'Enroll students and place them in sections',
      done: hasStudents,
      buttonLabel: ar ? 'تسجيل طالب' : 'Enroll Student',
    },
    {
      num: 4,
      id: 'family',
      icon: KeyRound,
      title: ar ? 'بيانات دخول العائلة' : 'Family Access Codes',
      description: ar
        ? hasFamilyAccess
          ? 'تم إعداد رموز الدخول للعائلات'
          : 'أنشئ رمز دخول خاص بكل طالب ليتابعه ولي أمره'
        : hasFamilyAccess
          ? 'Family access codes generated'
          : 'Generate national ID access codes for parents',
      done: hasFamilyAccess,
      buttonLabel: ar ? 'توليد الرموز' : 'Setup Codes',
    },
    {
      num: 5,
      id: 'lesson',
      icon: CalendarDays,
      title: ar ? 'جدول الحصص الأسبوعي' : 'Weekly Timetable',
      description: ar
        ? hasLessons
          ? 'تمت جدولة الحصص الدراسية للأسبوع'
          : 'وزّع الحصص والمواد على المعلمين والقاعات'
        : hasLessons
          ? 'Weekly timetable configured'
          : 'Schedule subjects, teachers, and rooms',
      done: hasLessons,
      buttonLabel: ar ? 'إضافة حصة' : 'Add Lesson',
    },
    {
      num: 6,
      id: 'announcement',
      icon: Megaphone,
      title: ar ? 'إعلان ترحيبي للمدرسة' : 'School Announcement',
      description: ar
        ? 'شارك خبراً أو رسالة ترحيبية تظهر لجميع أولياء الأمور والمعلمين'
        : 'Post a welcome message or general update to all families',
      done: data.announcements.length > 0,
      buttonLabel: ar ? 'نشر إعلان' : 'Post Update',
    },
  ];

  const allComplete = hasHours && hasStaff && hasStudents && hasFamilyAccess && hasLessons;

  return (
    <section className="admin-guide-card" data-reveal>
      <div className="admin-guide-header">
        <span className="admin-guide-pill">
          <Sparkles size={14} />
          {ar ? 'دليل إدارة المدرسة المبسط' : 'Simplified School Admin Guide'}
        </span>
        <h2>
          {allComplete
            ? ar
              ? 'مدرستك جاهزة وتعمل بسلاسة'
              : 'Your school is configured and ready'
            : ar
              ? 'خطوات تجهيز المدرسة الأساسية'
              : 'Core steps to get your school ready'}
        </h2>
        <p>
          {ar
            ? 'خطوات واضحة وسريعة بدون أي تعقيد تقني. اضغط على أي خطوة للبدء بها مباشرة.'
            : 'Simple, direct steps without technical jargon. Tap any step to open it immediately.'}
        </p>
      </div>

      <div className="admin-guide-steps">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`admin-guide-step ${step.done ? 'is-done' : ''}`}
          >
            <div className="admin-guide-step-lead">
              <span className={`step-badge ${step.done ? 'done-badge' : ''}`}>
                {step.done ? <CheckCircle2 size={16} /> : step.num}
              </span>
              <div className="step-info">
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </div>
            </div>
            <button
              type="button"
              className="admin-step-button"
              onClick={() => onAction(step.id)}
            >
              <step.icon size={15} />
              <span>{step.buttonLabel}</span>
              <ArrowLeft size={14} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
