// Only unambiguous greetings and read-only shortcuts bypass the language model.
// Free-form requests and every write still go through the validated tool path.
export function quickAssistantIntent(message: string) {
  const text = message
    .trim()
    .replace(/[؟?!.,،]+$/g, '')
    .trim();
  const tools: Record<string, string> = {
    الحاسبة: 'calculator',
    'الآلة الحاسبة': 'calculator',
    geogebra: 'geometry',
    جيوجبرا: 'geometry',
    جيوجيبرا: 'geometry',
    'محرر المعادلات': 'equations',
    'محوّل الوحدات': 'units',
    'محول الوحدات': 'units',
    'جدول المواصفات': 'blueprint',
    'سلم التقدير': 'rubric',
  };
  const toolMatch = text.match(/^(?:افتح|شغل|شغّل|open)\s+(.+)$/i);
  if (toolMatch && tools[toolMatch[1].toLowerCase()])
    return { tool: tools[toolMatch[1].toLowerCase()] };
  if (/^(?:hi|hello|hey|مرحبا|مرحبًا|اهلا|أهلا|السلام عليكم)$/i.test(text))
    return { greeting: true };
  if (
    /^(?:(?:هل|أنت|انت)\s*)*(?:تسمعني|تسمع صوتي|تقرأ رسائلي|تقر[اأ] رسالتي)$|^(?:can you hear me|are you there)$/i.test(
      text,
    )
  )
    return { communication: true };
  const match = text.match(
    /^(?:اعرض|أظهر|اظهر|افتح|show|list|open)\s+(?:لي\s+|my\s+|the\s+)?(البنوك|الكتب|الامتحانات|الطلاب|الإحصاءات|الاحصاءات|النتائج|الإعدادات|الاعدادات|الأدوات|الادوات|المجلدات|الجاهزية|المراقبة|tools|folders|readiness|banks|books|exams|students|insights|results|settings)(?:\s+(?:الموجودة في التطبيق|المحفوظة|المتاحة|الخاصة بي|الموجودة))?$/i,
  );
  if (!match) return;
  const key = match[1].toLowerCase();
  const groups: Record<string, string[]> = {
    books: ['البنوك', 'الكتب', 'banks', 'books'],
    exams: ['الامتحانات', 'exams'],
    students: ['الطلاب', 'students'],
    insights: ['الإحصاءات', 'الاحصاءات', 'النتائج', 'insights', 'results'],
    tools: ['الأدوات', 'الادوات', 'tools'],
    folders: ['المجلدات', 'folders'],
    readiness: ['الجاهزية', 'readiness'],
    room: ['المراقبة'],
    settings: ['الإعدادات', 'الاعدادات', 'settings'],
  };
  return { command: Object.keys(groups).find((k) => groups[k].includes(key)) };
}

export function requestsAssistantTools(message: string) {
  const resource =
    /امتحان|اختبار|بنك|بنوك|كتاب|كتب|أسئلة|اسئلة|طالب|طلاب|نتائج|إحصاء|احصاء|إعدادات|اعدادات|مختبر|متابعة|أدوات|ادوات|حاسبة|geogebra|مجلد|اعتماد|جاهزية|كاميرا|مراقبة|مسودة|برومبت|طلب البنك|\b(?:exams?|tests?|banks?|books?|questions?|students?|results?|insights|settings|draft|prompt)\b/i;
  const request =
    /اعتمد|انقل|احذف|أغلق|اغلق|انشر|اعرض|أظهر|اظهر|افتح|أنش[ئء]|انش[ئء]|جهز|جهّز|اجمع|ابحث|عد[ّل]|عدل|غي[ّر]|غير|أريد|اريد|بدي|عايز|احتاج|أحتاج|وريني|\b(?:show|list|open|create|make|prepare|find|search|edit|change|update|want|need)\b/i;
  return resource.test(message) && request.test(message);
}
