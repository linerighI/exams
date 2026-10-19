import { questionTypeGuide, questionTypeExample } from './questionTypeGuide';
import { questionKinds, type QuestionKind } from './questionFormats';
import { questionQualityGuide } from './questionQuality';
export const providers = {
  gemini: { name: 'Gemini', url: 'https://gemini.google.com/' },
  chatgpt: { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  claude: { name: 'Claude', url: 'https://claude.ai/' },
} as const;
export type BankMeta = { title: string; subject: string; grade: string; term: string };
export const pictureInstruction = (includePictures: boolean) =>
  includePictures
    ? 'اختيار المعلم: تضمين صور ورسوم تعليمية. خصوصًا في الرياضيات والفيزياء، أعط أولوية لأسئلة تتطلب قراءة الرسم نفسه (منحنى، شكل هندسي، دائرة كهربائية أو مخطط قوى)، وليست صورًا للزينة. اربط نص السؤال وتسميات الرسم والخيارات والإجابة والتفسير بدقة. استخرج الرسم الحقيقي من الكتاب باستخدام page وbox، أو قدّم رسم SVG مبسطًا صحيحًا داخل svg. ضع requiresImage:true لكل سؤال لا يمكن حله دون الرسم. لا تدّع إرفاق صورة غير موجودة؛ اترك السؤال للمراجعة إذا تعذر الرسم.'
    : 'اختيار المعلم: أسئلة دون صور. اختر أسئلة مكتفية بالنص ولا تتطلب الاطلاع على رسم. لا تستخدم عبارة حسب الشكل ولا تعتمد على صورة مفقودة. اجعل requiresImage:false وbox:null وsvg:null ولا تولّد رسومًا.';
export function bankPrompt(
  meta: BankMeta,
  count: number,
  range: string,
  difficulty: string,
  includePictures = true,
  kinds: readonly QuestionKind[] = questionKinds.map((k) => k[0]),
) {
  return `أنت معلم خبير بالمنهج الأردني. سأرفق الكتاب بنفسي هنا. أنشئ بنك أسئلة عربيًا للمراجعة البشرية.
الكتاب: ${meta.title}؛ المادة: ${meta.subject}؛ الصف: ${meta.grade}؛ الفصل: ${meta.term}.
${questionQualityGuide}
${pictureInstruction(includePictures)}
الهدف ${count} سؤالًا متميزًا؛ الصعوبة ${difficulty}؛ نطاق صفحات PDF: ${range || 'جميع صفحات الدروس'}.
ابدأ بتحديد الفصول والدروس واستبعد الغلاف والفهرس وحقوق النشر والصفحات الخالية. وزع الأسئلة على الدروس. أعطني البنك كاملًا في تسليم واحد: ملف JSON واحد يحتوي جميع الأسئلة وPDF مطابق إن أمكن. لا تقسّم العمل إلى دفعات ولا تطلب «تابع». أعط كل سؤال id ثابتًا. لا تُكمل العدد بالتكرار أو معلومات مخترعة؛ إذا تعذر العدد أو اصطدمت بحدود الموقع، اذكر العدد الحقيقي بوضوح ولا تدّع اكتماله.
${questionTypeGuide(kinds)}
المطلوب لكل سؤال مفتاح أو معيار تصحيح مطابق لنوعه، وتفسير للمعلم ومقتطف evidence يدعم السؤال. اكتب المعادلات LaTeX داخل \\( ... \\) أو \\[ ... \\]، مع الهروب الصحيح للشرطة العكسية داخل JSON. لا تُدخل HTML أو شيفرة تنفيذية.
page هو موضع الصفحة في ملف PDF الأصلي بدءًا من 1، وليس رقم الصفحة المطبوع. احتفظ pageCount بعدد صفحات الملف الأصلي. للرسوم الموجودة فعلًا: requiresImage=true، وbox=[left,top,right,bottom] بإحداثيات 0..1 نسبة إلى الصفحة كاملة، الأصل أعلى اليسار. لا تخمّن الإحداثيات إن لم تستطع تحديدها؛ استخدم null واشرح الحاجة للصورة. لا تقص رسمًا يكشف الإجابة.
للرسوم: أدرج صورة المصدر في PDF وقدّم box لقصها. للرسم الجديد البسيط قدّم SVG كاملًا داخل حقل svg في JSON (مع الهروب الصحيح)، أو ملف id.svg مطابقًا لمعرف السؤال. استخدم svg/g/path/rect/circle/ellipse/line/polyline/polygon/text/tspan/title/desc فقط، وviewBox مع أبعاد رقمية. يمكنك استخدام fill وstroke وstroke-width وfont-size وإحداثيات النقاط وتسميات x وy وθ. لا scripts أو style أو foreignObject أو صور أو روابط خارجية أو use/href أو DOCTYPE أو events. راجع العلاقات الهندسية ولا تختلق رسمًا غير مؤكد. إذا تعذر توفير الصورة فضع svg:null وrequiresImage:true واذكر الحاجة إليها.
أعد ملف JSON واحدًا صالحًا قابلًا للتنزيل، بلا تعليقات أو Markdown داخل الملف، بهذه البنية بالضبط:
${JSON.stringify({ version: 1, book: { ...meta, pageCount: 132 }, questions: kinds.map(questionTypeExample) }, null, 2)}
القيم أعلاه مثال للبنية فقط؛ استبدل عدد الصفحات والمحتوى ببيانات الكتاب الفعلية. لا تُرجع الأسئلة المثال كما هي.
إن أمكن، أرفق PDF مقروءًا مطابقًا لنفس الأسئلة مع الرسوم ومفتاح الإجابة في نهايته. إذا تعذر إنشاء PDF، أعطني JSON فقط؛ التطبيق يصدر PDF. لا تدّع إنشاء ملف لم تنشئه. سلّم البنك كاملًا والملفات المتاحة في هذه الإجابة.`;
}
