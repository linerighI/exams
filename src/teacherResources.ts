export const schoolSubjects = [
  'اللغة العربية',
  'اللغة الإنجليزية',
  'الرياضيات',
  'العلوم',
  'الفيزياء',
  'الكيمياء',
  'العلوم الحياتية',
  'علوم الأرض والبيئة',
  'التربية الإسلامية',
  'التربية المسيحية',
  'الدراسات الاجتماعية',
  'تاريخ الأردن',
  'الجغرافيا',
  'التربية الوطنية والمدنية',
  'المهارات الرقمية',
  'الثقافة المالية',
  'التربية المهنية',
  'التربية الفنية',
  'التربية الرياضية',
  'اللغة الفرنسية',
  'المباحث المهنية والتقنية',
];
export const grades = [
  'الأول',
  'الثاني',
  'الثالث',
  'الرابع',
  'الخامس',
  'السادس',
  'السابع',
  'الثامن',
  'التاسع',
  'العاشر',
  'الحادي عشر',
  'الثاني عشر',
];
export type TeacherResource = {
  id: string;
  title: string;
  description: string;
  url: string;
  subjects: string[];
  category: 'jordan' | 'science' | 'languages' | 'digital' | 'general';
  note?: string;
};
export const teacherResources: TeacherResource[] = [
  {
    id: 'nccd',
    title: 'الكتب المدرسية الأردنية',
    description: 'المركز الوطني لتطوير المناهج: اختر الصف والمبحث وراجع طبعة الكتاب المعتمدة.',
    url: 'https://nccd.gov.jo/Ar/Pages/Publications/?type=3',
    subjects: [],
    category: 'jordan',
  },
  {
    id: 'moe',
    title: 'وزارة التربية والتعليم',
    description: 'الموقع الرسمي للتعليمات والإعلانات والمصادر التربوية الأردنية.',
    url: 'https://moe.gov.jo/',
    subjects: [],
    category: 'jordan',
  },
  {
    id: 'darsak',
    title: 'منصة درسك',
    description: 'دروس مصوّرة مرتبطة بالمنهاج الأردني؛ قد يتطلب الوصول تسجيل الدخول.',
    url: 'https://darsak.gov.jo/',
    subjects: [],
    category: 'jordan',
  },
  {
    id: 'joacademy',
    title: 'جو أكاديمي',
    description: 'دروس وملفات ومراجعات للصفوف الأساسية والثانوية في الأردن.',
    url: 'https://www.joacademy.com/',
    subjects: [],
    category: 'jordan',
    note: 'مصدر مستقل · بعض الخدمات مدفوعة',
  },
  {
    id: 'google',
    title: 'بحث Google',
    description: 'ابحث باسم الوحدة والصف والمبحث للوصول إلى أمثلة ومراجع للسؤال.',
    url: 'https://www.google.com/',
    subjects: [],
    category: 'general',
  },
  {
    id: 'images',
    title: 'صور Google',
    description: 'ابحث عن شكل أو خريطة أو صورة توضيحية. راجع المصدر وحقوق الاستخدام.',
    url: 'https://www.google.com/search?tbm=isch',
    subjects: [],
    category: 'general',
  },
  {
    id: 'scholar',
    title: 'الباحث العلمي',
    description: 'مراجع وأبحاث لدعم إعداد الأسئلة وقراءة الأدلة التربوية.',
    url: 'https://scholar.google.com/',
    subjects: [],
    category: 'general',
  },
  {
    id: 'commons',
    title: 'مكتبة الصور · Wikimedia Commons',
    description: 'رسوم وصور وخرائط مع بيان ترخيص كل ملف وبيانات نسبه إلى صاحبه.',
    url: 'https://commons.wikimedia.org/',
    subjects: [],
    category: 'general',
  },
  {
    id: 'phet',
    title: 'محاكاة PhET بالعربية',
    description: 'محاكاة تفاعلية للرياضيات والفيزياء والكيمياء والأحياء وعلوم الأرض.',
    url: 'https://phet.colorado.edu/ar/',
    subjects: [
      'الرياضيات',
      'العلوم',
      'الفيزياء',
      'الكيمياء',
      'العلوم الحياتية',
      'علوم الأرض والبيئة',
    ],
    category: 'science',
  },
  {
    id: 'geogebra3d',
    title: 'GeoGebra ثلاثي الأبعاد',
    description: 'استكشف المجسّمات والأسطح والإحداثيات في مساحة ثلاثية الأبعاد.',
    url: 'https://www.geogebra.org/3d',
    subjects: ['الرياضيات', 'الفيزياء'],
    category: 'science',
  },
  {
    id: 'iupac',
    title: 'الجدول الدوري · IUPAC',
    description: 'مرجع العناصر الكيميائية من الاتحاد الدولي للكيمياء البحتة والتطبيقية.',
    url: 'https://iupac.org/what-we-do/periodic-table-of-elements/',
    subjects: ['العلوم', 'الكيمياء'],
    category: 'science',
  },
  {
    id: 'nasa',
    title: 'مصادر تعليمية · NASA',
    description: 'مواد تعليمية عن الفضاء والأرض والعلوم لدعم الأسئلة المصوّرة.',
    url: 'https://www.nasa.gov/learning-resources/',
    subjects: ['العلوم', 'الفيزياء', 'علوم الأرض والبيئة', 'الجغرافيا'],
    category: 'science',
  },
  {
    id: 'maps',
    title: 'خرائط Google',
    description: 'مواقع ومسافات وتضاريس لدعم أسئلة الجغرافيا والدراسات الاجتماعية.',
    url: 'https://www.google.com/maps',
    subjects: [
      'الجغرافيا',
      'الدراسات الاجتماعية',
      'تاريخ الأردن',
      'التربية الوطنية والمدنية',
      'علوم الأرض والبيئة',
    ],
    category: 'general',
  },
  {
    id: 'doha',
    title: 'معجم الدوحة التاريخي',
    description: 'معاني الألفاظ وشواهد الاستعمال؛ معين لغوي عند صياغة السؤال.',
    url: 'https://www.dohadictionary.org/',
    subjects: ['اللغة العربية'],
    category: 'languages',
  },
  {
    id: 'british',
    title: 'المجلس الثقافي البريطاني · الأردن',
    description: 'مصادر لتعلم الإنجليزية ومهارات القراءة واللغة.',
    url: 'https://www.britishcouncil.jo/en/english/learn-online',
    subjects: ['اللغة الإنجليزية'],
    category: 'languages',
  },
  {
    id: 'scratch',
    title: 'Scratch',
    description: 'برمجة مرئية ووسائط تفاعلية لأسئلة التفكير الحاسوبي والمشروعات.',
    url: 'https://scratch.mit.edu/',
    subjects: ['المهارات الرقمية', 'التربية المهنية', 'المباحث المهنية والتقنية'],
    category: 'digital',
  },
  {
    id: 'code',
    title: 'Code.org',
    description: 'أنشطة ومناهج في علوم الحاسوب والتفكير المنطقي.',
    url: 'https://code.org/',
    subjects: ['المهارات الرقمية', 'التربية المهنية', 'المباحث المهنية والتقنية'],
    category: 'digital',
  },
];
// Exact destinations plus two bounded Google search paths. Never expose a generic native URL launcher.
export function trustedTeacherResource(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2500) throw Error('رابط أداة غير صالح');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash)
    throw Error('رابط أداة غير مسموح');
  if (teacherResources.some((resource) => new URL(resource.url).href === url.href)) return url.href;
  if (
    url.origin === 'https://www.google.com' &&
    url.pathname === '/search' &&
    [...url.searchParams.keys()].every((k) => ['q', 'tbm'].includes(k)) &&
    (!url.searchParams.has('tbm') || url.searchParams.get('tbm') === 'isch') &&
    (url.searchParams.get('q') || '').length <= 1000
  )
    return url.href;
  throw Error('رابط أداة غير مسموح');
}
