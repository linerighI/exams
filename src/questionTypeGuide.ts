import { questionKinds, type QuestionKind } from './questionFormats';
export function questionTypeGuide(kinds: readonly QuestionKind[] = questionKinds.map((k) => k[0])) {
  return `[question-types-v2]\nعقد أنواع الأسئلة (يحدّث أي تعليمات قديمة تفرض أربعة خيارات على جميع الأسئلة):
الأنواع التي اختارها المعلم فقط: ${kinds.map((kind) => `${kind} (${questionKinds.find((k) => k[0] === kind)![1]})`).join('، ')}.
نوّع بين الأنواع المختارة بما يناسب الهدف والمصدر، ولا تفرض نوعًا غير مناسب لإكمال حصة شكلية. لكل سؤال kind صريح وpoints وزن موجب (١ افتراضيًا)، ونص واضح وexplanation للتصحيح ومصدر page وevidence حقيقي وchapter وdifficulty.
single: أربعة options مختلفة، correct فهرس الجواب الوحيد من 0 إلى 3.
multiple: من 2 إلى 10 options مختلفة؛ correctChoices مصفوفة فهارس جميع الأجوبة الصحيحة دون تكرار. وضح للطالب أن أكثر من جواب مطلوب.
boolean: options:["صح","خطأ"]؛ correct يساوي 0 أو 1. العبارة واضحة وغير مركبة ولا تستخدم نفيًا مزدوجًا.
short: options:[] وcorrect:0؛ acceptedAnswers مصفوفة صيغ قصيرة مقبولة ودقيقة؛ أدرج المرادفات الصحيحة فقط.
essay: options:[] وcorrect:0؛ rubric معيار تقييم مفصل للمعلم وexplanation نموذج إجابة موجز. تصحيح المعلم إلزامي.
blank: options:[] وcorrect:0؛ blankAnswers مصفوفة إجابات الفراغات بالترتيب (1 إلى10). رقّم الفراغات في السؤال ولا تعتمد على طول الخط لتلميح الجواب.
match: options:[] وcorrect:0؛ pairs مصفوفة 2 إلى10 كائنات {left:"العنصر",right:"نظيره الصحيح"}. لا تكرر أي طرف ولا تذكر الاقتران الصحيح في نص السؤال؛ التطبيق يخلط عمود الإجابة.
order: options مصفوفة 2 إلى10 عناصر مختلفة؛ orderCorrect مصفوفة جميع فهارس options بالتسلسل الصحيح. correct:0 للتوافق فقط. يجب أن يكون الترتيب وحيدًا مبررًا، لا تضع الأرقام أو الحل في تسميات العناصر.
draw: options:[] وcorrect:0؛ rubric لتقييم رسم/حل بالقلم، وexplanation وصف الإجابة المتوقعة للمعلم. لا تنشئ صورة لحل الطالب مسبقًا؛ الصورة المرفقة إن وجدت معطى للسؤال فقط.
للأنواع غير single/boolean، correct:0 حقل توافق ولا يمثل مفتاح الإجابة. لا تضع حقول نوع آخر، ولا تعتبر الرسم SVG نوع إجابة منفصلًا عن kind.
اختياري للكتابة short/essay فقط: keywordGrading:{mode:"review",required:2,groups:[{label:"فكرة مستقلة",terms:["عبارة صحيحة","مرادفها"]},...]}. required بين1 وعددالمجموعات (حتى20)، ولكل مجموعة بدائل مستقلة غير مكررة. كل مفهوم يحسب مرة واحدة؛ ليست قائمة كلمات عامة أو طريقة لتمرير جواب بمجرد ذكر كلمتين. تُقترح درجة جزئية فقط ويجب أن يعتمد المعلم المعنى والنفي والوحدات؛ لا تدّع تصحيحًا دلاليًا آليًا. لا تضف هذا الخيار إذا لم يمكن تحديد مفاهيم موثوقة من المصدر.
تحقق من عقد kind ومفتاحه ومعيار التصحيح قبل التسليم؛ الدقة أهم من تنويع مصطنع. لا تتضمن نسخة الطالب أي مفاتيح أو rubric أو كلمات مفتاحية.`;
}
export function questionTypeExample(kind: QuestionKind, index: number) {
  const base = {
    id: `q-${String(index + 1).padStart(3, '0')}`,
    kind,
    points: 1,
    page: 8,
    difficulty: 'سهل',
    chapter: 'اسم الفصل',
    lesson: 'اسم الدرس',
    evidence: 'مقتطف حقيقي من الصفحة يدعم السؤال',
    requiresImage: false,
    box: null,
    svg: null,
    correct: 0,
    options: [] as string[],
    explanation: 'تفسير أو نموذج إجابة للمعلم',
  };
  const formats = {
    single: { text: 'ما ناتج تربيع العدد 2؟', options: ['1', '2', '3', '4'], correct: 3 },
    multiple: {
      text: 'اختر جميع الأعداد الزوجية.',
      options: ['2', '3', '4', '5'],
      correctChoices: [0, 2],
    },
    boolean: { text: 'العدد 2 عدد زوجي.', options: ['صح', 'خطأ'] },
    short: { text: 'ما مضاد كلمة الحزن؟', acceptedAnswers: ['الفرح', 'السعادة'] },
    essay: {
      text: 'اكتب فقرة تشرح فيها الفكرة الرئيسة مع مثال.',
      rubric: 'تحديد الفكرة بدقة، وشرحها، وتقديم مثال مناسب.',
    },
    blank: {
      text: 'أكمل الفراغين بالترتيب: الجملة الاسمية تتكون من (1) ____ و(2) ____.',
      blankAnswers: ['مبتدأ', 'خبر'],
    },
    match: {
      text: 'صل كل كلمة بمرادفها.',
      pairs: [
        { left: 'سعيد', right: 'مسرور' },
        { left: 'منزل', right: 'بيت' },
      ],
    },
    order: {
      text: 'رتب مراحل إعداد الفقرة.',
      options: ['كتابة المسودة', 'اختيار الفكرة', 'مراجعة الفقرة'],
      orderCorrect: [1, 0, 2],
    },
    draw: {
      text: 'ارسم مثلثًا قائمًا وحدد الزاوية القائمة.',
      rubric: 'ثلاثة أضلاع مغلقة وزاوية قائمة صحيحة مع تسميتها.',
    },
  };
  return { ...base, ...formats[kind] };
}
