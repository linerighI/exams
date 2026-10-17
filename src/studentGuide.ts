export type GuideAction =
  | 'exams'
  | 'results'
  | 'home'
  | 'resume'
  | 'missing'
  | 'review'
  | 'mark'
  | 'next'
  | 'previous'
  | 'submit'
  | 'calculator'
  | 'geometry'
  | 'focus'
  | 'checklist';
export type GuideExam = {
  id: string;
  total: number;
  answered: number;
  missing: number[];
  flagged: number[];
  current: number;
  remaining: number;
  online: boolean;
  pending: number;
  saveState?: 'saving' | 'saved' | 'error';
  frozen: boolean;
  finished: boolean;
  finishRequested: boolean;
  modalOpen: boolean;
  calculator: boolean;
  geometry: boolean;
};
export type GuideContext = {
  name: string;
  page: string;
  connected: boolean;
  available: number;
  active: number;
  published: number;
  waiting: number;
  exam: GuideExam | null;
};
export type GuideAnswer = { text: string; actions?: { id: GuideAction; label: string }[] };
export const helpTopics = [
  {
    id: 'start',
    title: 'كيف أبدأ امتحاني؟',
    category: 'getting-ready',
    keywords: ['كيف ابدا', 'ابدا الامتحان', 'الامتحانات', 'رمز الامتحان', 'انضمام'],
  },
  {
    id: 'progress',
    title: 'كم أنجزت؟',
    category: 'exam',
    keywords: [
      'كم اجبت',
      'كم انجزت',
      'تقدمي',
      'كم باقي',
      'كم بقى',
      'الاسئله المتبقيه',
      'اسئله ناقصه',
    ],
  },
  {
    id: 'save',
    title: 'هل إجاباتي محفوظة؟',
    category: 'connection',
    keywords: ['حفظ', 'محفوظه', 'محفوظ', 'اجاباتي', 'ضاعت', 'اختفت'],
  },
  {
    id: 'connection',
    title: 'انقطع الاتصال، ماذا أفعل؟',
    category: 'connection',
    keywords: ['الاتصال', 'متصل', 'انترنت', 'الشبكه', 'شبكه', 'المعلم غير متاح', 'فصل'],
  },
  {
    id: 'time',
    title: 'كيف يعمل وقت الامتحان؟',
    category: 'exam',
    keywords: ['وقت', 'دقيقه', 'العد التنازلي', 'انتهى الوقت', 'مؤقت', 'ساعة'],
  },
  {
    id: 'submit',
    title: 'كيف أسلّم الامتحان؟',
    category: 'exam',
    keywords: ['اسلم', 'تسليم', 'انهي', 'انهاء', 'خلصت', 'انتهيت'],
  },
  {
    id: 'colors',
    title: 'ماذا تعني ألوان الكرة؟',
    category: 'exam',
    keywords: ['لون', 'الوان', 'ازرق', 'احمر', 'اخضر', 'الكره'],
  },
  {
    id: 'review',
    title: 'كيف أراجع الأسئلة؟',
    category: 'exam',
    keywords: [
      'مراجعه',
      'اراجع',
      'علامه',
      'اعلم السؤال',
      'علم السؤال',
      'غير مجاب',
      'تخطيت',
      'تجاوزت',
    ],
  },
  {
    id: 'change',
    title: 'هل أستطيع تغيير إجابتي؟',
    category: 'exam',
    keywords: ['اغير', 'تعديل', 'اختياري', 'غيرت', 'اختار الاجابه', 'اختيار الاجابه'],
  },
  {
    id: 'calculator',
    title: 'أين الآلة الحاسبة؟',
    category: 'tools',
    keywords: ['اله حاسبه', 'اله الحاسبه', 'حاسبه', 'الحاسبه', 'calculator'],
  },
  {
    id: 'geometry',
    title: 'هل يمكنني استخدام GeoGebra؟',
    category: 'tools',
    keywords: ['geogebra', 'جيوجبرا', 'جيوجيبرا', 'جيوبجرا', 'رسم', 'هندسه'],
  },
  {
    id: 'results',
    title: 'أين درجتي ونتيجتي؟',
    category: 'results',
    keywords: ['درجه', 'درجتي', 'نتيجه', 'نتيجتي', 'نتائجي', 'علامتي', 'علامات', 'نشر النتائج'],
  },
  {
    id: 'resume',
    title: 'كيف أتابع بعد إعادة التشغيل؟',
    category: 'connection',
    keywords: [
      'اعاده التشغيل',
      'اغلق التطبيق',
      'استعيد',
      'استرجع',
      'اكمل',
      'متابعه',
      'ارجع للمحاوله',
    ],
  },
  {
    id: 'camera',
    title: 'لماذا يطلب المعلم الكاميرا؟',
    category: 'exam',
    keywords: ['كاميرا', 'تصوير', 'صوره', 'صورتي'],
  },
  {
    id: 'logout',
    title: 'كيف أسجّل الخروج؟',
    category: 'account',
    keywords: ['خروج', 'حساب', 'كلمه مرور', 'كلمه السر', 'اخرج', 'اقفل التطبيق'],
  },
  {
    id: 'help',
    title: 'هل تساعدني في حل الأسئلة؟',
    category: 'getting-ready',
    keywords: [
      'حل السؤال',
      'الاجابه الصحيحه',
      'حل الامتحان',
      'اعطني الحل',
      'جواب',
      'احسب',
      'حل لي',
    ],
  },
  {
    id: 'focus',
    title: 'أحتاج لحظة للتركيز',
    category: 'getting-ready',
    keywords: ['تركيز', 'متوتر', 'قلق', 'اهدا', 'استراحه', 'صعب', 'تعبت'],
  },
  {
    id: 'ready',
    title: 'ماذا أجهّز قبل البدء؟',
    category: 'getting-ready',
    keywords: ['استعداد', 'جاهز', 'اجهز', 'قبل الامتحان', 'قبل البدء'],
  },
  {
    id: 'move',
    title: 'كيف أحرك رفيقي وأصغّره؟',
    category: 'account',
    keywords: ['اسحب', 'احرك', 'اصغر', 'حجم', 'رفيق', 'حركه', 'تحريك', 'مساعد'],
  },
] as const;
export type HelpTopic = (typeof helpTopics)[number]['id'];
export function normalizeHelp(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u064b-\u065f\u0670ـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function findHelpTopic(text: string): HelpTopic | null {
  const normalized = normalizeHelp(text);
  if (!normalized) return null;
  // Explicit requests for a solution never resolve to a mathematical or answer-producing tool.
  if (
    [
      'حل السؤال',
      'الاجابه الصحيحه',
      'حل الامتحان',
      'اعطني الحل',
      'احسب',
      'حل لي',
      'ما الجواب',
      'ما جواب',
      'ما ناتج',
    ].some((k) => normalized.includes(normalizeHelp(k)))
  )
    return 'help';
  const ranked = helpTopics
    .map((topic) => ({
      id: topic.id,
      score: topic.keywords.reduce(
        (best, k) =>
          normalized.includes(normalizeHelp(k)) ? Math.max(best, normalizeHelp(k).length) : best,
        0,
      ),
    }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.id ?? null;
}
function rawGuideAnswer(topic: HelpTopic | null, c: GuideContext): GuideAnswer {
  const e = c.exam,
    action = (id: GuideAction, label: string) => ({ id, label });
  if (!topic)
    return {
      text: 'أستطيع مساعدتك في استخدام التطبيق، الحفظ، الوقت، الأدوات والنتائج. اختر سؤالًا جاهزًا أو جرّب مثلًا: «هل إجاباتي محفوظة؟».',
      actions: [action('checklist', 'قائمة الاستعداد')],
    };
  switch (topic) {
    case 'start':
      if (e?.finished)
        return {
          text: 'تم تسليم هذه المحاولة. يمكنك العودة لمساحتك ومتابعة النتيجة بعد نشرها من المعلم.',
          actions: [action('results', 'افتح نتائجي')],
        };
      return e
        ? {
            text: 'أنت داخل محاولتك الآن. اختر إجابة لكل سؤال، وانتقل بالسابق والتالي أو بخريطة الأسئلة. لا تحتاج إلى بدء محاولة أخرى.',
            actions: e.missing.length
              ? [action('missing', 'أول سؤال غير مجاب')]
              : [action('submit', 'مراجعة التسليم')],
          }
        : {
            text: c.active
              ? `لديك ${c.active} محاولات غير مكتملة. اختر «متابعة الامتحان» للعودة إلى محاولتك الحالية قبل انتهاء الوقت.`
              : c.available
                ? `لديك ${c.available} امتحانات متاحة للبدء. افتح «امتحاناتي» واقرأ المدة ثم اختر «ابدأ الامتحان». يمكنك أيضًا إدخال الرمز الذي يعطيك إياه المعلم.`
                : 'لا يوجد امتحان متاح للبدء الآن. تظهر امتحانات صفك عندما ينشرها المعلم ويبدأ موعد إتاحتها. يمكنك إدخال رمز الامتحان في «امتحاناتي».',
            actions: [
              action(c.active ? 'resume' : 'exams', c.active ? 'متابعة محاولتي' : 'افتح امتحاناتي'),
            ],
          };
    case 'progress':
      return e
        ? {
            text: e.finished
              ? 'وصلت محاولتك إلى جهاز المعلم. يمكنك العودة لمساحتك ومتابعة نشر النتيجة.'
              : `أجبت عن ${e.answered} من ${e.total} أسئلة. ${e.missing.length ? `بقي ${e.missing.length} دون إجابة؛ أرقامها: ${e.missing.join('، ')}.` : 'أجبت عن كل الأسئلة؛ راجع اختياراتك قبل تأكيد التسليم.'}${e.flagged.length ? ` علّمت ${e.flagged.length} أسئلة للمراجعة.` : ''}`,
            actions: e.finished
              ? []
              : e.missing.length
                ? [action('missing', 'خذني لأول سؤال غير مجاب')]
                : [action('submit', 'مراجعة التسليم')],
          }
        : {
            text: `في مساحتك ${c.available} امتحانات متاحة، و${c.active} محاولات غير مكتملة، و${c.published} نتائج منشورة.`,
            actions: [action('exams', 'امتحاناتي'), action('results', 'نتائجي')],
          };
    case 'save':
      if (e?.saveState === 'error')
        return {
          text: 'تعذر الحفظ على هذا الجهاز. لا أستطيع تأكيد حماية آخر التعديلات. أبقِ التطبيق مفتوحًا وأبلغ المعلم قبل المتابعة.',
        };
      if (e?.saveState === 'saving')
        return {
          text: 'جارٍ كتابة آخر التعديلات على هذا الجهاز. انتظر تحديث حالة الحفظ؛ لا تغلق التطبيق أثناء ذلك.',
        };
      return e
        ? {
            text: e.finished
              ? 'تم تأكيد تسليم المحاولة إلى جهاز المعلم.'
              : e.pending
                ? `لديك ${e.pending} إجابات محفوظة على هذا الجهاز تنتظر تأكيد إرسالها. أبقِ التطبيق مفتوحًا؛ يحاول الإرسال تلقائيًا عند عودة الاتصال. إذا ظهر تنبيه بفشل الحفظ، أبلغ المعلم.`
                : e.online
                  ? 'لا توجد إجابات بانتظار الإرسال، والاتصال بجهاز المعلم متاح. راقب حالة الحفظ بجوار خريطة الأسئلة.'
                  : 'لا توجد إجابات جديدة في طابور الإرسال حاليًا، لكن الاتصال بجهاز المعلم غير متاح. راقب حالة الحفظ وأبلغ المعلم إن استمر الانقطاع.',
          }
        : {
            text: 'أثناء الامتحان تُحفظ الاختيارات على جهازك أولًا ثم تُرسل إلى جهاز المعلم. «محفوظة على الجهاز» تعني أن الإرسال لم يُؤكَّد بعد. إذا ظهر فشل في الحفظ، أبلغ المعلم قبل المتابعة.',
          };
    case 'connection':
      return {
        text:
          (e?.online ?? c.connected)
            ? 'الاتصال بجهاز المعلم متاح حاليًا. الامتحان داخل شبكة المدرسة لا يحتاج إلى إنترنت خارجي.'
            : 'الاتصال بجهاز المعلم غير متاح حاليًا. أبقِ التطبيق مفتوحًا، وتأكد من بقائك على شبكة المدرسة وأبلغ المعلم. يعيد التطبيق محاولة الإرسال تلقائيًا. انقطاع الاتصال لا يوقف وقت الامتحان.',
      };
    case 'time':
      return e
        ? {
            text: e.finished
              ? 'انتهت المحاولة وتم التسليم.'
              : `وقت سؤالك بقي نحو ${Math.ceil(e.remaining / 60)} دقائق. العدّاد في أعلى الامتحان هو المرجع المباشر. يستمر الوقت أثناء فتح المساعدة أو الأدوات أو انقطاع الاتصال. عند انتهاء الوقت تتوقف التعديلات ويُطلب تسليم المحفوظ تلقائيًا.`,
          }
        : {
            text: 'تظهر مدة كل امتحان وموعد إتاحته على بطاقته. يبدأ وقت المحاولة عند بدء الامتحان؛ إعادة التشغيل أو فتح المساعدة لا تعيد الوقت من البداية.',
            actions: [action('exams', 'عرض امتحاناتي')],
          };
    case 'submit':
      return e
        ? {
            text: e.finished
              ? 'وصلت إجاباتك إلى جهاز المعلم؛ لا تحتاج إلى التسليم مرة أخرى.'
              : e.frozen
                ? 'توقفت التعديلات أو بدأ التسليم. أبقِ التطبيق مفتوحًا حتى تظهر رسالة تأكيد وصول الإجابات؛ عند انقطاع الاتصال ينتظر التطبيق عودته.'
                : e.missing.length
                  ? `بقي ${e.missing.length} أسئلة دون إجابة. أكملها أو راجعها أولًا. عندما تجيب عن الجميع تصبح الكرة خضراء، ثم تراجع التسليم وتضغط «تأكيد التسليم».`
                  : 'كل الأسئلة مجابة. اضغط «تسليم الامتحان»، ثم راجع عدد الإجابات وأكّد التسليم. بعد التسليم لا يمكنك تعديل الاختيارات.',
            actions: e.frozen
              ? []
              : e.missing.length
                ? [action('missing', 'راجع الأسئلة المتبقية')]
                : [action('submit', 'افتح مراجعة التسليم')],
          }
        : {
            text: 'داخل المحاولة ستجد زر «تسليم الامتحان» أسفل كرتي. يراجع التطبيق اكتمال الإجابات، ثم يطلب تأكيدًا قبل التسليم.',
          };
    case 'colors':
      return {
        text: 'الأزرق: المحاولة جارية أو أنا جاهز للمساعدة. الأحمر: أسئلة متروكة عند المراجعة النهائية أو اتصال غير متاح؛ اقرأ الحالة المكتوبة لتعرف السبب. الأخضر: كل الأسئلة مجابة أو تم تأكيد التسليم. اللون الأخضر لا يعني أن الإجابات صحيحة؛ صحة الإجابات والدرجة لا تظهر إلا وفق نشر المعلم.',
      };
    case 'review':
      return e && !e.finished
        ? {
            text: `يمكنك استخدام خريطة الأسئلة للتنقل. علّم السؤال الحالي لتعود إليه؛ العلامة لا تغيّر إجابتك ولا ترسل اختيارًا. ${e.flagged.length ? `لديك ${e.flagged.length} أسئلة معلّمة.` : 'لم تعلّم أسئلة للمراجعة بعد.'}`,
            actions: [
              ...(!e.frozen
                ? [
                    action(
                      'mark',
                      e.flagged.includes(e.current)
                        ? 'إزالة علامة هذا السؤال'
                        : 'علّم هذا السؤال للمراجعة',
                    ),
                  ]
                : []),
              ...(e.missing.length ? [action('missing', 'أول سؤال غير مجاب')] : []),
              ...(e.flagged.length ? [action('review', 'أول سؤال معلّم')] : []),
            ],
          }
        : {
            text: 'أثناء الامتحان يمكنك التنقل بخريطة الأسئلة، ووضع علامة على سؤال تريد مراجعته لاحقًا. المراجعة لا تختار إجابة بدلًا منك.',
          };
    case 'change':
      return {
        text:
          e?.frozen || e?.finished
            ? 'توقفت التعديلات لأن الوقت انتهى أو بدأ التسليم. لا أستطيع تغيير ذلك.'
            : 'قبل انتهاء الوقت وقبل التسليم، يمكنك الضغط على بديل آخر لتغيير اختيارك. يُحفظ آخر اختيار. لا أستطيع تحديد أي البدائل صحيح.',
      };
    case 'calculator':
      return e
        ? {
            text: e.calculator
              ? e.frozen
                ? 'توقفت أدوات الحل بعد انتهاء الوقت أو بدء التسليم.'
                : 'المعلم سمح بالآلة الحاسبة في هذا الامتحان. اضبط DEG للدرجات أو RAD للراديان حسب السؤال، ثم أدخل العدد واضغط الدالة. إغلاق الآلة لا يوقف الوقت.'
              : 'المعلم لم يفعّل الآلة الحاسبة لهذا الامتحان. لا يمكنني فتحها أو تجاوز هذا الإعداد.',
            actions: e.calculator && !e.frozen ? [action('calculator', 'افتح الآلة الحاسبة')] : [],
          }
        : {
            text: 'تظهر الآلة الحاسبة داخل الامتحان إذا سمح بها المعلم لذلك الامتحان. صلاحية استخدامها يحددها المعلم.',
          };
    case 'geometry':
      return e
        ? {
            text: e.geometry
              ? e.frozen
                ? 'توقفت أدوات الرسم بعد انتهاء الوقت أو بدء التسليم.'
                : 'المعلم سمح بـ GeoGebra في هذه المحاولة. استخدمه للرسم والاستكشاف. الرسم مساحة مساعدة؛ إجابتك المسجلة هي البديل الذي تختاره في السؤال.'
              : 'المعلم لم يفعّل GeoGebra لهذا الامتحان. لا يمكنني فتحه أو تغيير الصلاحيات.',
            actions: e.geometry && !e.frozen ? [action('geometry', 'افتح GeoGebra')] : [],
          }
        : {
            text: 'تظهر أداة GeoGebra أثناء الامتحان عندما يسمح المعلم بها. تعمل النسخة المضمنة محليًا ولا تحتاج إلى حساب خارجي.',
          };
    case 'results':
      return {
        text: `لديك ${c.published} نتائج منشورة و${c.waiting} امتحانات مكتملة بانتظار نشر الدرجة. لا يُعرض التقدير بعد التسليم مباشرة إلا إذا نشره المعلم. راجع معلم المادة لأي استفسار عن التصحيح.`,
        actions: e && !e.finished ? [] : [action('results', 'افتح نتائجي')],
      };
    case 'resume':
      return {
        text:
          e && !e.finished
            ? 'هذه هي محاولتك الحالية. يحافظ التطبيق على الأسئلة المختارة والإجابات المحفوظة، والوقت يستمر من الموعد الأصلي. لا تمسح بيانات التطبيق. إذا طلب رمزك لتجديد الاتصال فاستخدم رمز صاحب هذه المحاولة.'
            : 'تعيد جلسة الطالب فتح المحاولة المحفوظة عند إعادة التشغيل. ويمكنك اختيار «متابعة الامتحان» من امتحاناتك. لا تمسح بيانات التطبيق؛ الوقت الأصلي لا يبدأ من جديد.',
        actions: !e && c.active ? [action('resume', 'متابعة محاولتي')] : [],
      };
    case 'camera':
      return {
        text: 'إذا طلب المعلم صورة، تظهر نافذة توضّح الطلب قبل الالتقاط. يمكنك الموافقة أو الرفض، وتُبلّغ حالة الطلب للمعلم. هذه صورة واحدة للطلب، وليست بث فيديو. لا أفتح الكاميرا بنفسي.',
      };
    case 'logout':
      return {
        text: 'اختر «تسجيل الخروج» من الشريط الجانبي ثم اطلب من المعلم إدخال كلمة مرور حسابه. يلزم الاتصال بجهاز المعلم للتحقق. لا أستطيع فك القفل، والخروج لا يسلّم امتحانًا غير مكتمل تلقائيًا.',
      };
    case 'help':
      return {
        text: 'أنا دليل لاستخدام التطبيق وتنظيم المراجعة، ولا أقدّم حل السؤال أو أختار البديل الصحيح. أستطيع شرح الحفظ والوقت والتنقل، أو فتح الأدوات التي سمح بها المعلم.',
        actions:
          e && !e.finished
            ? [action('focus', 'لحظة للتركيز')]
            : [action('checklist', 'استعد للامتحان')],
      };
    case 'focus':
      return {
        text: 'خذ لحظة قصيرة: أرح كتفيك، واقرأ المطلوب مرة أخرى، ثم ارجع للخيارات خطوة بخطوة. تستطيع الانتقال لسؤال آخر والعودة للمراجعة. وقت الامتحان يستمر أثناء هذه الوقفة.',
        actions: [action('focus', 'وقفة تركيز قصيرة')],
      };
    case 'ready':
      return {
        text: 'راجع اسم الامتحان ومدته، اعرف طريقة حفظ الإجابات، وتأكد من طريقة التسليم. جهّز الأدوات الورقية التي سمح بها معلمك. قائمة الاستعداد للتذكير فقط ولا تغيّر شروط الامتحان.',
        actions: [action('checklist', 'افتح قائمة الاستعداد')],
      };
    case 'move':
      return {
        text: 'أبقى معك أثناء التنقل والتمرير. اسحب مقبض التحريك لأعلى أو أسفل، أو استخدم سهمي لوحة المفاتيح عند تحديده. يمكنك تصغير الكرة أو تشغيل وضع التركيز لإيقاف الحركة والتنبيهات؛ اضغط الكرة متى احتجتني.',
      };
  }
}
export function studentGuideAnswer(topic: HelpTopic | null, c: GuideContext): GuideAnswer {
  const answer = rawGuideAnswer(topic, c);
  return {
    ...answer,
    ...(answer.actions
      ? { actions: answer.actions.filter((action) => allowedGuideAction(action.id, c)) }
      : {}),
  };
}
export function guideTone(c: GuideContext): 'blue' | 'red' | 'green' {
  const e = c.exam;
  if (e?.finished) return 'green';
  if (e?.saveState === 'error') return 'red';
  if (!(e?.online ?? c.connected)) return 'red';
  if (e && e.answered === e.total) return 'green';
  if (e && e.missing.length && (e.finishRequested || e.current === e.total)) return 'red';
  return 'blue';
}
export function allowedGuideAction(id: GuideAction, c: GuideContext): boolean {
  const e = c.exam;
  if (['home', 'exams', 'results', 'resume'].includes(id)) return !e || e.finished;
  if (['focus', 'checklist'].includes(id)) return true;
  if (!e || e.finished) return false;
  if (id === 'calculator') return e.calculator && !e.frozen;
  if (id === 'geometry') return e.geometry && !e.frozen;
  if (id === 'submit' || id === 'mark') return !e.frozen;
  if (id === 'missing') return !!e.missing.length;
  if (id === 'review') return !!e.flagged.length;
  return id === 'next' ? e.current < e.total : id === 'previous' ? e.current > 1 : false;
}
