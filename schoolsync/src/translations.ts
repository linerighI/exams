/**
 * Bilingual Arabic/English dictionary and server-error translator for SchoolSync.
 */
let language = 'ar';

/** Set active client dictionary language (`ar` or `en`). */
export function setLanguage(value: string): void {
  language = value;
}

export const arabic: Record<string, string> = {
  'Change password': 'تغيير كلمة المرور',
  'Current password': 'كلمة المرور الحالية',
  'New password': 'كلمة المرور الجديدة',
  'Password updated': 'تم تحديث كلمة المرور',
  'Current password is incorrect': 'كلمة المرور الحالية غير صحيحة',
  'Save changes': 'حفظ التغييرات',
  'School settings': 'إعدادات المدرسة',
  'Schedule a lesson': 'إضافة حصة',
  'School name': 'اسم المدرسة',
  Timezone: 'المنطقة الزمنية',
  'Draft grades': 'مسودات العلامات',
  'Publish grade': 'نشر العلامة',
  'Choose a teacher': 'اختر المعلم',
  Weekday: 'اليوم',
  'Choose a teacher assigned to this class': 'اختر معلماً مكلّفاً بهذه الشعبة',
  'Lesson must be within school hours': 'يجب أن تكون الحصة ضمن ساعات الدوام',
  'School hours must include existing lessons': 'يجب أن تشمل ساعات الدوام الحصص المسجّلة',
  'Invalid school timezone': 'المنطقة الزمنية للمدرسة غير صحيحة',
  '8A': 'الثامن أ',
  '6B': 'السادس ب',
  'A calmer school day is on its way.': 'نجهّز المساحة المكانية ثلاثية الأبعاد…',
  'Attendance recorded': 'تم حفظ الحضور',
  Close: 'إغلاق',
  Email: 'البريد الإلكتروني',
  End: 'النهاية',
  Start: 'البداية',
  Password: 'كلمة المرور',
  Retry: 'إعادة المحاولة',
  Room: 'القاعة',
  Subject: 'المادة',
  Teacher: 'المعلم',
  Student: 'الطالب',
  Title: 'العنوان',
  'Saved successfully': 'تم الحفظ بنجاح',
  'Saved and shared successfully': 'تم الحفظ والمشاركة بنجاح',
  'Sign in': 'تسجيل الدخول',
  'Updates marked as read': 'تمت قراءة المستجدات',
  Sun: 'الأحد',
  Mon: 'الإثنين',
  Tue: 'الثلاثاء',
  Wed: 'الأربعاء',
  Thu: 'الخميس',
  Fri: 'الجمعة',
  Sat: 'السبت',
  student: 'طالب',
  parent: 'ولي أمر',
  teacher: 'معلم',
  assistant: 'مساعد المدير',
  admin: 'المدير',
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'بعذر',
  open: 'جديدة',
  investigating: 'قيد المتابعة',
  resolved: 'تمت المعالجة',
  Mathematics: 'الرياضيات',
  'English language': 'اللغة الإنجليزية',
  Science: 'العلوم',
  Arabic: 'اللغة العربية',
  'Art & design': 'الفنون والتصميم',
  History: 'التاريخ',
  'Please sign in to continue': 'يرجى تسجيل الدخول للمتابعة',
  'Email or password is incorrect': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'Unable to save. Please try again.': 'تعذّر الحفظ. حاول مجدداً.',
  'Attendance can only be recorded for today': 'يمكن تسجيل الحضور لليوم الحالي فقط',
  'This lesson is not scheduled for today': 'هذه الحصة غير مجدولة اليوم',
  'Attendance is available from the lesson start until dismissal':
    'يتاح تسجيل الحضور من بداية الحصة حتى نهاية اليوم الدراسي',
  'Student access denied': 'ليس لديك صلاحية الوصول إلى هذا الطالب',
  'Staff access required': 'هذه الميزة مخصصة لموظفي المدرسة',
  'Administrator access required': 'هذه الميزة مخصصة لإدارة المدرسة',
  'Schedule conflict: class, teacher, or room already booked':
    'تعارض في الجدول: الشعبة أو المعلم أو القاعة مشغولون في هذا الوقت',
  'Score cannot exceed maximum': 'لا يمكن أن تتجاوز العلامة الحد الأعلى',
  'This email already has an account': 'يوجد حساب بهذا البريد الإلكتروني بالفعل',
  'Unable to connect': 'تعذّر الاتصال بالمدرسة',
  'Unable to connect to the school': 'تعذّر الاتصال بالمدرسة',
  'Failed to fetch': 'تعذّر الاتصال. تحقّق من الشبكة وحاول مجدداً.',
};

/** Translate server messages or labels when Arabic is active. */
export function tr(text: string): string {
  return language === 'ar' ? arabic[text] || text : text;
}
