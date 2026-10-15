export const providers = {
  gemini: { name: 'Gemini', url: 'https://gemini.google.com/' },
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { name: 'Claude', url: 'https://claude.ai/' },
} as const;
export type BankMeta = { title: string; subject: string; grade: string; term: string };
export function bankPrompt(meta: BankMeta, count: number, range: string, difficulty: string) {
  return `أنت معلم خبير بالمنهج الأردني. سأرفق الكتاب بنفسي هنا. أنشئ بنك أسئلة عربيًا للمراجعة البشرية.
الكتاب: ${meta.title}؛ المادة: ${meta.subject}؛ الصف: ${meta.grade}؛ الفصل: ${meta.term}.
الهدف ${count} سؤالًا متميزًا؛ الصعوبة ${difficulty}؛ نطاق صفحات PDF: ${range || 'جميع صفحات الدروس'}.
ابدأ بتحديد الفصول والدروس واستبعد الغلاف والفهرس وحقوق النشر والصفحات الخالية. وزع الأسئلة على الدروس. أعطني البنك كاملًا في تسليم واحد: ملف JSON واحد يحتوي جميع الأسئلة وPDF مطابق إن أمكن. لا تقسّم العمل إلى دفعات ولا تطلب «تابع». أعط كل سؤال id ثابتًا. لا تُكمل العدد بالتكرار أو معلومات مخترعة؛ إذا تعذر العدد أو اصطدمت بحدود الموقع، اذكر العدد الحقيقي بوضوح ولا تدّع اكتماله.
المطلوب لكل سؤال أربعة خيارات مختلفة وإجابة صحيحة واحدة (correct فهرس من 0 إلى 3)، تفسير للمعلم ومقتطف evidence يدعم السؤال. اكتب المعادلات LaTeX داخل \\( ... \\) أو \\[ ... \\]، مع الهروب الصحيح للشرطة العكسية داخل JSON. لا تُدخل HTML أو شيفرة تنفيذية.
page هو موضع الصفحة في ملف PDF الأصلي بدءًا من 1، وليس رقم الصفحة المطبوع. احتفظ pageCount بعدد صفحات الملف الأصلي. للرسوم الموجودة فعلًا: requiresImage=true، وbox=[left,top,right,bottom] بإحداثيات 0..1 نسبة إلى الصفحة كاملة، الأصل أعلى اليسار. لا تخمّن الإحداثيات إن لم تستطع تحديدها؛ استخدم null واشرح الحاجة للصورة. لا تقص رسمًا يكشف الإجابة.
للرسوم: أدرج صورة المصدر في PDF وقدّم box لقصها. للرسم الجديد البسيط قدّم SVG كاملًا داخل حقل svg في JSON (مع الهروب الصحيح)، أو ملف id.svg مطابقًا لمعرف السؤال. استخدم svg/g/path/rect/circle/ellipse/line/polyline/polygon/text/tspan/title/desc فقط، وviewBox مع أبعاد رقمية. يمكنك استخدام fill وstroke وstroke-width وfont-size وإحداثيات النقاط وتسميات x وy وθ. لا scripts أو style أو foreignObject أو صور أو روابط خارجية أو use/href أو DOCTYPE أو events. راجع العلاقات الهندسية ولا تختلق رسمًا غير مؤكد. إذا تعذر توفير الصورة فضع svg:null وrequiresImage:true واذكر الحاجة إليها.
أعد ملف JSON واحدًا صالحًا قابلًا للتنزيل، بلا تعليقات أو Markdown داخل الملف، بهذه البنية بالضبط:
${JSON.stringify({ version: 1, book: { ...meta, pageCount: 132 }, questions: [{ id: 'q-001', text: 'احسب \\(x^{2}\\) عندما \\(x=2\\)', options: ['1', '2', '3', '4'], correct: 3, explanation: 'نعوض ثم نربع.', page: 8, difficulty: 'سهل', chapter: 'اسم الفصل', lesson: 'اسم الدرس', evidence: 'مقتطف من الكتاب', requiresImage: false, box: null, svg: null }] }, null, 2)}
القيم أعلاه مثال للبنية فقط؛ استبدل عدد الصفحات والمحتوى ببيانات الكتاب الفعلية. لا تُرجع الأسئلة المثال كما هي.
إن أمكن، أرفق PDF مقروءًا مطابقًا لنفس الأسئلة مع الرسوم ومفتاح الإجابة في نهايته. إذا تعذر إنشاء PDF، أعطني JSON فقط؛ التطبيق يصدر PDF. لا تدّع إنشاء ملف لم تنشئه. سلّم البنك كاملًا والملفات المتاحة في هذه الإجابة.`;
}
