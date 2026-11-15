/**
 * Multilingual step-by-step login story copy for the Orb-centered Prism Login screen.
 */
import type { Language } from './i18n';

/** Return localized onboarding story copy for the active portal (`family` vs `staff`). */
export function getLoginStoryCopy(portal: 'family' | 'staff', lang: Language) {
  const ar = lang === 'ar';
  if (portal === 'family') {
    return {
      eyebrow: ar ? 'حساب واحد يجمع الطالب والعائلة' : 'ONE SHARED STUDENT & FAMILY SPACE',
      headline: ar ? 'يومك المدرسي.\nبوضوح وهدوء.' : 'Your school day.\nCalm and clear.',
      steps: ar
        ? [
            ['اتصل بالخادم من أي مكان', 'اضغط على الكرة لإدخال رابط الخادم السحابي أو التبديل للمحلي.'],
            ['أدخل الرقم الوطني للطالب', 'اسم المستخدم هو الرقم الوطني، وكلمة المرور أول ٥ أرقام متبوعةً بـ \u2066@Alshereqi.Edu\u2069.'],
            ['تابع اليوم الدراسي لحظياً', 'الحضور، الواجبات، العلامات، وإشعارات الهاتف الفورية في مكان واحد.'],
          ]
        : [
            ['Connect from anywhere', 'Tap the Orb to link a Cloudflare/ngrok server URL or local PC.'],
            ['Sign in with National ID', 'Use the student National ID and first 5 digits + @Alshereqi.Edu.'],
            ['Follow the school day live', 'Attendance, homework, grades, and native phone alerts in one place.'],
          ],
    };
  }
  return {
    eyebrow: ar ? 'لوحة الطاقم الإداري والتعليمي' : 'TEACHER & SCHOOL ADMINISTRATION',
    headline: ar ? 'أدِر مدرستك.\nمن أي مكان.' : 'Run your school.\nFrom anywhere.',
    steps: ar
      ? [
          ['رابط خادم دائم للطاقم', 'اضغط على الكرة لربط رابط النفق السحابي أو التحقق من حالة الخادم.'],
          ['إدارة الجدول والحضور', 'سجّل الغياب بلمسة واحدة ورتّب شعب المدرسة من الهاتف أو الكمبيوتر.'],
          ['إشعارات فورية للأهالي', 'كل غياب أو تعميم يصل فوراً إلى لوحة إشعارات الهاتف.'],
        ]
      : [
          ['Cloud or LAN server link', 'Tap the Orb anytime to bind a cloud tunnel or inspect server health.'],
          ['1-tap roll call & timetable', 'Mark attendance and manage sorted Jordanian sections smoothly.'],
          ['Instant mobile alerts', 'Every attendance update and notice pushes straight to phone notifications.'],
        ],
  };
}
