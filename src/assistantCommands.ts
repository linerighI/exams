export const assistantCommands = [
  {
    id: 'prompt',
    ar: 'طلب',
    aliases: ['prompt', 'صياغة'],
    label: 'تعديل طلب البنك',
    description: 'اقترح صياغة جديدة لطلب توليد البنك',
  },
  {
    id: 'exam',
    ar: 'امتحان',
    aliases: ['exam', 'اختبار'],
    label: 'إنشاء مسودة امتحان',
    description: 'اجمع أسئلة معتمدة من البنك',
  },
  {
    id: 'books',
    ar: 'كتاب',
    aliases: ['book', 'books', 'بنوك', 'بنك'],
    label: 'استكشاف البنوك',
    description: 'ابحث عن الكتب والبنوك المحفوظة',
  },
  {
    id: 'questions',
    ar: 'أسئلة',
    aliases: ['questions', 'اسئلة', 'سؤال'],
    label: 'بحث في الأسئلة',
    description: 'اعرض أسئلة البنك قبل تجميعها',
  },
  {
    id: 'exams',
    ar: 'امتحانات',
    aliases: ['exams'],
    label: 'امتحانات المدرسة',
    description: 'اعرض الامتحانات ومسوداتها',
  },
  {
    id: 'students',
    ar: 'طالب',
    aliases: ['student', 'students', 'طلاب'],
    label: 'الطلاب والصفوف',
    description: 'ابحث عن طالب أو صف',
  },
  {
    id: 'insights',
    ar: 'إحصاءات',
    aliases: ['insights', 'stats', 'احصاءات', 'نتائج'],
    label: 'قراءة النتائج',
    description: 'ملخص محسوب محليًا من النتائج',
  },
  {
    id: 'edit',
    ar: 'تعديل',
    aliases: ['edit'],
    label: 'تعديل مسودة',
    description: 'غيّر عنوان المسودة ووقتها ودرجتها',
  },
  {
    id: 'monitor',
    ar: 'متابعة',
    aliases: ['monitor', 'live'],
    label: 'متابعة المختبر',
    description: 'المحاولات النشطة والتسليمات',
  },
  {
    id: 'settings',
    ar: 'إعدادات',
    aliases: ['settings', 'اعدادات'],
    label: 'إعدادات النظام',
    description: 'افتح إعدادات الشبكة والنموذج',
  },
  {
    id: 'help',
    ar: 'مساعدة',
    aliases: ['help', 'اوامر', 'أوامر'],
    label: 'ما الذي يمكنني فعله؟',
    description: 'دليل الأدوات والأوامر المتاحة',
  },
] as const;
export function parseCommand(text: string) {
  const match = text.match(/^\s*\/([^\s/]+)(?:\s+([\s\S]*))?$/);
  if (!match) return;
  const command = assistantCommands.find(
    (c) =>
      c.ar === match[1] ||
      c.id === match[1].toLowerCase() ||
      (c.aliases as readonly string[]).includes(match[1].toLowerCase()),
  );
  return command ? { command, rest: match[2] || '' } : undefined;
}
