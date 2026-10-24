export const layers = [
  {
    id: 'zunis',
    name: 'Zunis',
    version: 1,
    label: 'الحماية',
    detail: 'صلاحيات الحسابات وحماية جلسة الامتحان والبيانات.',
  },
  {
    id: 'animato',
    name: 'Animato',
    version: 1,
    label: 'الحركة',
    detail: 'انتقالات واضحة واستجابة مرئية، مع احترام تقليل الحركة.',
  },
  {
    id: 'laned',
    name: 'LANED',
    version: 1,
    label: 'وظائف التطبيق',
    detail: 'قواعد الخدمات والتحقق من الأسئلة والرسوم قبل النشر.',
  },
] as const;
export const subjectServices = [
  {
    id: 'arabic',
    name: 'خدمة العربية',
    version: 1,
    description: 'النص العربي، فهم المقروء، القواعد والتعبير.',
    scope: 'العربية',
  },
  {
    id: 'english',
    name: 'English service',
    version: 1,
    description: 'القراءة والمفردات والقواعد والكتابة باتجاه إنجليزي صحيح.',
    scope: 'English',
  },
  {
    id: 'math',
    name: 'خدمة الرياضيات والعلوم',
    version: 1,
    description: 'معادلات ورسوم ووحدات للرياضيات والفيزياء والكيمياء.',
    scope: 'رياضيات · فيزياء · كيمياء',
  },
] as const;
export type SubjectService = (typeof subjectServices)[number]['id'];
export function subjectService(subject: string): SubjectService {
  const value = subject
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0640]/g, '');
  if (
    /رياض|حساب|جبر|هندس|تفاضل|تكامل|احصاء|إحصاء|فيزي|كيمي|math|physics|chemistry|algebra|geometry|calculus|science|علوم/.test(
      value,
    )
  )
    return 'math';
  return /انجليز|إنجليز|english/.test(value) ? 'english' : 'arabic';
}
export function subjectServiceGuide(service: SubjectService) {
  const header = `[LANED 1 · ${service} service 1]` + (service==='math' ? '\nتدعم الخدمة صيغ \\ce للتفاعلات والشحنات الكيميائية و\\pu للوحدات العلمية، داخل الأقواس الرياضية وبالهروب الصحيح في JSON.' : '');
  if (service === 'english')
    return `${header}\nWrite question text, reading passages, choices and student rubrics in English. Preserve source quotations exactly, distinguish grammar rules from stylistic preferences, and provide accepted alternatives for open writing. Never use Arabic as a replacement for an English reading passage. Teacher notes may be Arabic.`;
  if (service === 'arabic')
    return `${header}\nخدمة العربية: حافظ على نصوص المصدر والتشكيل المؤثر في المعنى. ميّز القاعدة عن الاحتمال اللغوي، واذكر البدائل المقبولة في التعبير. لا تعتبر صياغة واحدة جوابًا وحيدًا إذا صح غيرها.`;
  return `${header}\nخدمة الرياضيات والعلوم: حل السؤال تحققًا قبل صياغة المفتاح. حدّد المجال والشروط والثوابت ووحدات SI، وميّز المتجه عن مقداره والكتلة عن الوزن والدرجة عن الراديان. في الكيمياء راجع اتزان المعادلات والشحنات وحالة المادة، وفي الفيزياء اتجاهات القوى والأبعاد والأرقام المعنوية. اكتب الكسور والجذور والأسس والمتجهات والوحدات بصيغة LaTeX صالحة بين \\( و \\). لا تساوِ بين تعبيرين بمجرد اختبار عدد محدود من القيم، ولا تقبل جذورًا دخيلة. أظهر تفسيرًا تعليميًا موجزًا لا مسودة تفكير.\nإذا طلب المعلم رسومًا: صمّم سؤالًا يحتاج قراءة الرسم؛ عرّف المحاور والوحدات والمقياس ونقاط البيانات واتجاهات الأسهم. طابق الرسم مع القيم تمامًا، ولا تظهر جذور المسألة أو الناتج المطلوب في الرسم. استخدم SVG بسيطًا صالحًا أو قص المصدر الفعلي؛ لا تخترع إحداثيات لصورة المصدر. لا تضع صورًا زخرفية بدل البيانات.\nراجع تكافؤ الخيارات مثل 1/2 و0.5، والدقة والوحدات، وميّز النتيجة الدقيقة عن التقريب المسموح. لا تعتبر الفحص الآلي إثباتًا لصحة الحل؛ اعتماد المعلم مطلوب.`;
}
