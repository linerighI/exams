import { createHash } from 'node:crypto';
import { id, type Store } from './store';

export const workspaceTools = [
  ['writer', 'مختبر كتابة الأسئلة'],
  ['calculator', 'الآلة الحاسبة العلمية'],
  ['geometry', 'GeoGebra · الرسم والهندسة'],
  ['equations', 'محرر الصيغ والمعادلات'],
  ['units', 'محوّل الوحدات'],
  ['statistics', 'الإحصاء'],
  ['blueprint', 'جدول مواصفات الامتحان'],
  ['rubric', 'سُلّم تقدير الأداء'],
];
const features = [
  {
    page: 'books',
    title: 'الكتب وبنك الأسئلة',
    terms:
      /بنك|بنوك|كتاب|كتب|سؤال|أسئلة|اسئلة|مجلد|اعتماد|مراجعة|folder|bank|book|question|approv/i,
    text: 'المكتبة: رفع PDF أو استيراد JSON بترميز UTF-8، OCR وصور ورسوم، مجلدات ملونة للكتب. داخل البنك: بحث وحالة وصعوبة وفصل، 12 سؤالًا للصفحة، تحديد بالسحب الأزرق أو المربعات أو Ctrl/Shift وتحديد الكل، اعتماد جماعي أو إعادة للمراجعة أو نقل أو حذف. اسحب الأسئلة إلى مجلدات البنك الملونة. حذف المجلد يعيد الأسئلة إلى غير مصنف. قلم الفصل يصحح اسمه. اعتماد السؤال يتطلب خيارات صحيحة وصورته إن كانت مطلوبة. ملفات الكتاب وإعداداته تفتح تصدير PDF والمصدر والصفحات والتوليد. إنشاء الامتحان يستخدم المعتمد فقط.',
  },
  {
    page: 'exams',
    title: 'الامتحانات',
    terms: /امتحان|اختبار|مسودة|توزيع|عشوائ|نشر|إتاحة|اتاحة|exam|draft|random|publish/i,
    text: 'إنشاء وتعديل مسودات، صف وشعبة وموعد ومدة ودرجة، صور وصيغ ورسوم، توزيع متوازن حسب الفصل والصعوبة. يمكن لكل طالب الحصول على أسئلة عشوائية مختلفة من بنك معتمد؛ تُثبت نسخة أسئلته وإجاباته للتعافي والتصحيح. راجع المجموعة والتوزيع قبل النشر. المعلم يتيح الآلة الحاسبة وGeoGebra للامتحان. AI يقترح رسمًا ثم يراجعه المعلم. إغلاق الإتاحة يمنع المحاولات الجديدة ولا يوقف محاولة بدأت.',
  },
  {
    page: 'monitor',
    title: 'المتابعة والنتائج',
    terms:
      /متابعة|مراقبة|مختبر|جهاز|أجهزة|اجهزة|كامير|بث|تسليم|نتائج|درج|live|monitor|camera|result|score/i,
    text: 'المتابعة والنتائج تجمع المحاولات والدرجات ونشر النتائج وتصدير CSV. الكرة أو إشعار أسفل اليمين يفتح غرفة المتابعة بأقسام الأجهزة والإجابات والكاميرات والتنبيهات. اضغط جهازًا لتفاصيله. بيانات فعلية من الخادم: أجهزة الطلاب المسجلين فقط، نبضات كل 4 ثوان، العرض كل 1.5 ثانية، انقطاع بعد 15 ثانية. الكاميرا بث نحو إطار/ثانية بموافقة الطالب ومؤشر ظاهر، دون صوت أو تسجيل. الإجابات غير المتزامنة تظهر بعد وصولها؛ تُراجع الإجابات المتأخرة. إغلاق الغرفة يوقف طلب البث.',
  },
  {
    page: 'students',
    title: 'الطلاب والصفوف',
    terms: /طالب|طلاب|صف|شعبة|رمز|دخول|student|class|login/i,
    text: 'الطلاب منظمون بالصف والشعبة، مع استيراد Excel/XLSX أو CSV بمعاينة وربط أعمدة وتحقق من التكرار قبل الاعتماد. الرقم الوطني الأردني من 10 أرقام يصبح كلمة دخول الطالب، ويُحفظ كقيمة مشتقة ومملحة لا كنص. لا تطلب الأرقام الوطنية في المحادثة ولا تعرضها؛ وجّه المعلم لنافذة الاستيراد. الرموز القديمة تعمل. الطالب يتصل بالمعلم من كرة الاتصال ثم يدخل برقمه الوطني المسجل أو رمز الطالب. أدوات الربط واكتشاف أجهزة المعلمين تثبت شهادة HTTPS. جلسة الطالب محمية وتتطلب كلمة مرور معلمه للخروج؛ التطبيق ليس بديلًا عن سياسات كشك Windows.',
  },
  {
    page: 'tools',
    title: 'أدوات المعلم',
    terms:
      /أداة|اداة|أدوات|ادوات|حاسب|حساب|جيو|geogebra|calculator|أداة|معادل|إحصاء|احصاء|وحد|مواصفات|سلم|تقدير|tool|rubric|unit|statistic/i,
    text: 'الكرة العائمة في يسار الشاشة تجمع اقتراحات الصفحة ومسار عمل قابل للسحب والإفلات وترتيب محفوظ لكل معلم؛ الأسهم بديل للسحب. افتح تبويب مساري داخل الكرة. الصيغ والرسوم تُنقل إلى مسودة السؤال. تبويب لهذه الصفحة داخل الكرة يقترح التنقل اعتمادًا على بيانات الخادم؛ لا ينفّذ تلقائيًا. الأدوات: مختبر كتابة الأسئلة، حاسبة علمية محلية، GeoGebra للرسم والتقاط صورة للسؤال، محرر الصيغ، تحويل الوحدات، إحصاء، جدول مواصفات متوازن، سُلّم تقدير. مصادر تعليمية للصفوف الأردنية 1–12 حسب المادة والصف مع مفضلة وبحث؛ المصادر الخارجية تحتاج الإنترنت. لا تفتح عنوانًا خارجيًا اعتباطيًا؛ استخدم كتالوج المصادر من صفحة الأدوات.',
  },
  {
    page: 'settings',
    title: 'الإعدادات والذكاء الاصطناعي',
    terms:
      /صوت|إملاء|املاء|ميكروفون|speech|dictation|إعداد|اعداد|محلي|نموذج|ollama|openai|chatgpt|gemini|ذكاء|بطء|نسخ|استعاد|backup|restore|setting|model/i,
    text: 'إعدادات المدرسة والاتصال والنسخ الاحتياطي والاستعادة وبيانات AI. مفتاح API محفوظ مشفرًا ولا يدخل سياق المحادثة. زر الإملاء الصوتي يضيف كلام المعلم إلى مربع الرسالة بالعربية أو الإنجليزية دون إرسال تلقائي؛ يعمل تحويل الكلام محليًا دون إنترنت ويحتاج إذن الميكروفون. يمكن قراءة الرد بصوت محلي بزر قراءة الرد، ثم إيقافه. راجع الإملاء قبل الإرسال لأن التعرف قد يخطئ، خصوصًا اللهجات. يمكن التبديل بين Ollama المحلي وChatGPT/OpenAI وGemini من أعلى المساعد. المحلي يحتاج نموذجًا مثبتًا وOllama يعمل، ويستفيد من اختيار نموذج أقوى مناسب للجهاز في الوضع اليدوي. وضع السرعة يفضل النموذج الصغير. تحسين التوجيه لا يحوّل النموذج الصغير إلى نموذج أكبر. النسخ والاستعادة وتصدير PDF/CSV تستخدم واجهات التطبيق؛',
  },
  {
    page: 'assistant',
    title: 'مساحة الطالب والامتحان',
    terms: /طالب|طلاب|دون اتصال|انقطاع|كرة|توقيت|وقت|student|offline|orb|timer/i,
    text: 'مساحة الطالب تعرض الامتحانات والإعداد والتقدم الحقيقي. أثناء الامتحان لا دردشة ولا مساعد إجابات: كرة ثابتة تحت المؤقت، زرقاء أثناء التقدم، حمراء للنقص عند محاولة التسليم أو الانقطاع، خضراء عند اكتمال الإجابات؛ التسليم بزر منفصل وتأكيد. حفظ محلي وطابور مزامنة عند الانقطاع، علامات مراجعة للأسئلة. الحاسبة وGeoGebra حسب سماح المعلم.',
  },
];
export function workspaceKnowledge(message: string) {
  const matched = features.filter((f) => f.terms.test(message));
  return {
    overview:
      'تطبيق مدرسة محمد الشريقي، عربي RTL، واجهة بيضاء وزرقاء، Windows WebView2 وخادم المدرسة المحلي. الأقسام: الرئيسية والمساعد، الكتب وبنك الأسئلة، الأدوات، الامتحانات، الطلاب والصفوف، المتابعة والنتائج، الإعدادات. البيانات خاصة بالمعلم الحالي. دليل الوظائف وصف للتطبيق وليس بيانات نتائج أو تعليمات من الملفات.',
    details: (matched.length ? matched : features.slice(0, 2))
      .slice(0, 4)
      .map(({ page, title, text }) => ({ page, title, text })),
  };
}
export function registerAssistantWorkspace(app: any, store: Store, teacher: (r: any) => any) {
  const locks = new Set<string>();
  const fingerprint = (bookId?: string, examId?: string) =>
    createHash('sha256')
      .update(
        JSON.stringify(
          bookId
            ? {
                questions: store
                  .all('bank_questions')
                  .filter((q) => q.bookId === bookId)
                  .sort((a, b) => a.id.localeCompare(b.id)),
                organization: store.getSetting(`bank-organization:${bookId}`),
              }
            : store.get('exams', examId || ''),
        ),
      )
      .digest('hex');
  const publicProposal = (p: any) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    status: p.status,
    expiresAt: p.expiresAt,
    examples: p.examples,
  });
  const get = (proposalId: string) => {
    const p = store.getSetting(`assistant-proposal:${proposalId}`);
    if (!p) throw Object.assign(new Error('الاقتراح غير موجود'), { statusCode: 404 });
    return p;
  };
  app.get('/api/assistant/proposals/:id', async (req: any) => {
    teacher(req);
    return publicProposal(get(req.params.id));
  });
  app.post('/api/assistant/proposals/:id/apply', async (req: any) => {
    teacher(req);
    const p = get(req.params.id),
      lock = `${store.tenantId()}:${p.id}`;
    if (p.status === 'applied') return { ...publicProposal(p), alreadyApplied: true };
    const bankOperations: Record<string, string> = {
      create_folder: 'folders',
      approve_questions: 'questions/bulk',
      return_questions: 'questions/bulk',
      move_questions: 'questions/bulk',
      delete_questions: 'questions/bulk',
    };
    const examOperations: Record<string, string> = {
      close_exam: 'close',
      publish_exam: 'publish',
      publish_results: 'results',
    };
    const expectedPath =
      bankOperations[p.operation] && p.bookId
        ? `/api/books/${encodeURIComponent(p.bookId)}/${bankOperations[p.operation]}`
        : examOperations[p.operation] && p.examId
          ? `/api/exams/${encodeURIComponent(p.examId)}/${examOperations[p.operation]}`
          : null;
    if (!expectedPath || p.path !== expectedPath || p.method !== 'POST')
      throw Object.assign(new Error('نوع الاقتراح غير مسموح'), { statusCode: 400 });
    if (p.expiresAt < Date.now())
      throw Object.assign(new Error('انتهت صلاحية الاقتراح؛ اطلب اقتراحًا جديدًا.'), {
        statusCode: 409,
      });
    if (locks.has(lock)) throw Object.assign(new Error('يجري تطبيق الاقتراح'), { statusCode: 409 });
    if (p.fingerprint !== fingerprint(p.bookId, p.examId))
      throw Object.assign(
        new Error('تغيرت البيانات منذ إعداد الاقتراح. اطلب اقتراحًا جديدًا للمراجعة.'),
        { statusCode: 409 },
      );
    locks.add(lock);
    try {
      const result = await app.inject({
        url: p.path,
        method: p.method,
        payload: p.body,
        headers: { authorization: req.headers.authorization },
      });
      if (result.statusCode >= 400)
        throw Object.assign(new Error(result.json().error || 'تعذر تطبيق الاقتراح'), {
          statusCode: result.statusCode,
        });
      p.status = 'applied';
      store.setSetting(`assistant-proposal:${p.id}`, p);
      store.audit(`assistant:applied:${p.operation}:${p.id}`);
      return publicProposal(p);
    } finally {
      locks.delete(lock);
    }
  });
  const context = (bookId?: string) => {
    const qs = bookId ? store.all('bank_questions').filter((q) => q.bookId === bookId) : [];
    const organization = bookId ? store.getSetting(`bank-organization:${bookId}`) : null;
    return {
      folders: organization?.folders || [],
      selectedBank: bookId
        ? {
            id: bookId,
            total: qs.length,
            draft: qs.filter((q) => q.status !== 'approved').length,
            missingImages: qs.filter((q) => q.requiresImage && !q.image).length,
            questions: qs.slice(0, 25).map((q) => ({
              id: q.id,
              text: q.text.slice(0, 140),
              status: q.status,
              chapter: q.chapter,
              difficulty: q.difficulty,
              folderId: organization?.questionFolders?.[q.id],
            })),
          }
        : undefined,
      counts: {
        books: store.all('books').length,
        questions: store.all('bank_questions').length,
        exams: store.all('exams').length,
        students: store.all('students').length,
        activeAttempts: store
          .all('attempts')
          .filter((a) => !a.submittedAt && a.deadline > Date.now()).length,
        review: store.all('attempts').filter((a) => a.status === 'review').length,
      },
    };
  };
  const run = (
    response: any,
    ctx: any,
    message: string,
  ): { reply: string; cards: any[] } | undefined => {
    const cards: any[] = [],
      bookId = response.bookId || ctx.bookId;
    if (response.action === 'open_tool') {
      const found = workspaceTools.find(([tool]) => tool === response.tool);
      return found
        ? {
            reply: `الأداة جاهزة للفتح: ${found[1]}.`,
            cards: [
              {
                kind: 'tool',
                id: found[0],
                tool: found[0],
                page: 'tools',
                title: found[1],
                subtitle: 'افتح الأداة داخل التطبيق',
              },
            ],
          }
        : { reply: 'حدد الأداة المطلوبة أو استخدم /أدوات لعرض القائمة.', cards };
    }
    if (response.action === 'app_help') {
      const relevant = features.filter((f) => f.terms.test(response.query || message));
      for (const f of (relevant.length ? relevant : features).slice(0, 7))
        cards.push({
          kind: 'navigation',
          id: f.page,
          page: f.page,
          title: f.title,
          subtitle: f.text,
        });
      return { reply: 'هذا الدليل يشرح الوظائف المتاحة حاليًا. افتح القسم لإكمال العمل.', cards };
    }
    if (response.action === 'list_tools') {
      for (const [tool, title] of workspaceTools.filter(
        ([, title]) => !response.query || title.includes(response.query),
      ))
        cards.push({
          kind: 'tool',
          id: tool,
          tool,
          page: 'tools',
          title,
          subtitle: 'أداة محلية ضمن مساحة المعلم',
        });
      return { reply: 'اختر الأداة لفتحها مباشرة. أدوات الحساب والرسم تعمل داخل التطبيق.', cards };
    }
    if (response.action === 'bank_readiness' || response.action === 'list_folders') {
      const books = store.all('books').filter((b) => !bookId || b.id === bookId);
      for (const b of books.slice(0, 20)) {
        const qs = store.all('bank_questions').filter((q) => q.bookId === b.id),
          ready = qs.filter((q) => q.status === 'approved' && (!q.requiresImage || q.image)).length;
        if (response.action === 'bank_readiness')
          cards.push({
            kind: 'status',
            id: b.id,
            title: b.title,
            subtitle: `${ready} معتمد · ${qs.filter((q) => q.status !== 'approved').length} للمراجعة · ${qs.filter((q) => q.requiresImage && !q.image).length} يحتاج صورة`,
            value: `${ready} / ${qs.length}`,
            page: 'books',
          });
        else {
          const org = store.getSetting(`bank-organization:${b.id}`) || {
            folders: [],
            questionFolders: {},
          };
          for (const f of org.folders)
            cards.push({
              kind: 'navigation',
              id: f.id,
              page: 'books',
              title: f.name,
              subtitle: `${b.title} · ${qs.filter((q) => org.questionFolders[q.id] === f.id).length} سؤال`,
            });
        }
      }
      if (response.action === 'list_folders' && !bookId)
        for (const f of store.getSetting('library-organization')?.folders || [])
          cards.push({
            kind: 'navigation',
            id: f.id,
            page: 'books',
            title: f.name,
            subtitle: 'مجلد في مكتبة الكتب',
          });
      return {
        reply: cards.length
          ? 'هذه بيانات محفوظة في مساحة المعلم الحالية.'
          : 'لا توجد بيانات مطابقة. أرفق بنكًا أو افتح المكتبة.',
        cards,
      };
    }
    if (response.action === 'open_live')
      return {
        reply: 'افتح غرفة المتابعة لعرض الأجهزة والإجابات والبث الفعلي.',
        cards: [
          {
            kind: 'live_room',
            id: 'live-room',
            page: 'monitor',
            title: 'غرفة المتابعة المباشرة',
            subtitle: 'الأجهزة · الإجابات · الكاميرات · التنبيهات',
          },
        ],
      };
    if (response.action !== 'bank_action' && response.action !== 'exam_action') return;
    let path = '',
      body: any = {},
      title = '',
      subtitle = '',
      method = 'POST',
      examId: string | undefined;
    let examples: string[] = [];
    const operation = response.operation;
    if (response.action === 'exam_action') {
      const exam = store.get('exams', response.examId || ctx.examId || '');
      if (!exam) return { reply: 'حدد الامتحان بالاسم أو اختره أولًا.', cards };
      examId = exam.id;
      const suffix = { close_exam: 'close', publish_exam: 'publish', publish_results: 'results' }[
        operation as string
      ];
      if (!suffix) return { reply: 'اختر نشر الامتحان أو إغلاق إتاحته أو نشر نتائجه.', cards };
      path = `/api/exams/${encodeURIComponent(exam.id)}/${suffix}`;
      title = `${operation === 'close_exam' ? 'إغلاق إتاحة' : operation === 'publish_results' ? 'نشر نتائج' : 'نشر'} «${exam.title}»`;
      subtitle =
        operation === 'close_exam'
          ? 'يمنع المحاولات الجديدة؛ المحاولات التي بدأت تستمر.'
          : operation === 'publish_results'
            ? 'ستتاح النتائج للطلاب بحسب إعدادات الامتحان.'
            : `الصف ${exam.grade} · ${exam.duration} دقيقة · ${exam.delivery?.count || exam.questions.length} سؤال لكل طالب · الموعد ${exam.opensAt}`;
    } else {
      const b = store.get('books', bookId || '');
      if (!b) return { reply: 'أرفق بنك الأسئلة أولًا حتى أحدد الأسئلة والمجلدات بدقة.', cards };
      ctx.bookId = b.id;
      if (operation === 'create_folder') {
        if (!response.folderName?.trim())
          return { reply: 'ما اسم المجلد الجديد داخل البنك؟', cards };
        path = `/api/books/${encodeURIComponent(b.id)}/folders`;
        body = { name: response.folderName, color: response.color || 'blue' };
        title = `إنشاء مجلد «${body.name}»`;
        subtitle = `داخل «${b.title}»`;
      } else {
        const action = {
          approve_questions: 'approve',
          return_questions: 'draft',
          move_questions: 'move',
          delete_questions: 'delete',
        }[operation as string];
        if (!action)
          return {
            reply:
              'يمكنني اقتراح اعتماد الأسئلة أو إعادتها للمراجعة أو نقلها أو حذفها أو إنشاء مجلد.',
            cards,
          };
        const all = store.all('bank_questions').filter((q) => q.bookId === b.id);
        if (response.questionIds?.some((qid: string) => !all.some((q) => q.id === qid)))
          throw Object.assign(new Error('معرّف سؤال خارج البنك المحدد'), { statusCode: 400 });
        const qs = all.filter((q) =>
          response.questionIds?.length
            ? response.questionIds.includes(q.id)
            : (!response.chapter || q.chapter === response.chapter) &&
              (!response.query || `${q.text} ${q.chapter}`.includes(response.query)) &&
              (!response.difficulty ||
                response.difficulty === 'مختلط' ||
                q.difficulty === response.difficulty) &&
              (action !== 'approve' || q.status !== 'approved'),
        );
        if (!qs.length || qs.length > 500)
          return {
            reply: 'لا توجد أسئلة مطابقة، أو تجاوز التحديد 500 سؤال. حدد فصلًا أو مجموعة أصغر.',
            cards,
          };
        if (action === 'approve' && qs.some((q) => q.requiresImage && !q.image))
          return {
            reply: 'تتضمن المجموعة أسئلة تحتاج صورًا. أكمل الصور أولًا؛ لم يُعتمد أي سؤال.',
            cards,
          };
        examples = qs.slice(0, 5).map((q) => q.text);
        path = `/api/books/${encodeURIComponent(b.id)}/questions/bulk`;
        body = { action, ids: qs.map((q) => q.id) };
        const org = store.getSetting(`bank-organization:${b.id}`) || { folders: [] };
        if (action === 'move') {
          const f = org.folders.find(
            (f: any) => response.folderId === f.id || response.folderName === f.name,
          );
          if (!f && response.folderId !== 'unfiled')
            return { reply: 'حدد مجلدًا موجودًا بالاسم. أنشئه أولًا إذا لم يكن موجودًا.', cards };
          body.folderId = f?.id || null;
          subtitle = `إلى ${f?.name || 'غير مصنف'} · `;
        }
        title = `${{ approve: 'اعتماد الأسئلة', draft: 'إعادة الأسئلة للمراجعة', move: 'نقل الأسئلة', delete: 'حذف الأسئلة' }[action]} (${qs.length})`;
        subtitle += `${b.title} · ${response.chapter || 'جميع الفصول المطابقة'}${response.difficulty ? ' · ' + response.difficulty : ''}${response.query ? ' · البحث: ' + response.query : ''}${action === 'delete' ? ' · حذف من البنك' : ''}`;
      }
    }
    const proposal = {
      id: id(),
      operation,
      title,
      subtitle,
      examples,
      path,
      method,
      body,
      status: 'pending',
      bookId: response.action === 'bank_action' ? bookId : undefined,
      examId,
      expiresAt: Date.now() + 15 * 60000,
      fingerprint: fingerprint(response.action === 'bank_action' ? bookId : undefined, examId),
    };
    // Retain a bounded set of suggestions per teacher, using the existing backup/tenant boundary.
    const rows = store.db
      .prepare("SELECT key FROM settings WHERE key LIKE 'assistant-proposal:%'")
      .all() as { key: string }[];
    for (const row of rows.slice(0, Math.max(0, rows.length - 99)))
      store.db.prepare('DELETE FROM settings WHERE key=?').run(row.key);
    store.setSetting(`assistant-proposal:${proposal.id}`, proposal);
    return {
      reply:
        'جهزت هذا الاقتراح. راجع نطاقه ثم اضغط «تطبيق الاقتراح» لتنفيذه؛ لم تتغير بيانات المدرسة بعد.',
      cards: [{ kind: 'proposal', ...publicProposal(proposal) }],
    };
  };
  const intent = (message: string, ctx: any) => {
    const text = message
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .trim();
    if (
      /^(?:اشرح|كيف|هل|أين|اين|وين|ما هي|ماهي|what|how|where)(?:\s|$)/i.test(text) &&
      /التطبيق|النظام|الميكروفون|الإملاء|الاملاء|الكامير|المراقب|المتابعة|مجلد|اعتماد|الربط|رمز الدخول|الحاسب|GeoGebra|جيوجبرا|النسخ الاحتياطي|إتاحة|اتاحة|الامتحان العشوائي|السحب|الخروج/i.test(
        text,
      )
    )
      return { action: 'app_help', reply: '', query: text };
    if (
      /جاهزية|فحص الجاهز|readiness/i.test(text) &&
      /أريد|اريد|اعرض|افحص|فحص|وريني|احتاج|check|show/i.test(text)
    ) {
      const named = store.all('books').filter((b) => text.includes(b.title));
      return {
        action: 'bank_readiness',
        reply: '',
        bookId: named.length === 1 ? named[0].id : ctx.bookId,
      };
    }
    if (/^اعتمد\s+(?:جميع|كل)\s+(?:الأسئلة|الاسئلة|الاسئله)(?:\s|[.،]|$)/.test(text)) {
      const named = store.all('books').filter((b) => text.includes(b.title));
      return {
        action: 'bank_action',
        operation: 'approve_questions',
        reply: '',
        bookId: named.length === 1 ? named[0].id : ctx.bookId,
      };
    }
    const folder = text.match(
      /^(?:انشئ|أنشئ|انشء|أنشء|اعمل|create)\s+(?:لي\s+)?(?:مجلد(?:ا)?|folder)(?:\s+جديد(?:ا)?)?\s+(?:باسم|اسمه|named)\s+(.+?)(?=\s+(?:داخل|في|in)\s+|[،,]|$)/i,
    );
    if (folder) {
      const named = store.all('books').filter((b) => text.includes(b.title));
      return {
        action: 'bank_action',
        operation: 'create_folder',
        reply: '',
        folderName: folder[1].trim(),
        bookId: named.length === 1 ? named[0].id : ctx.bookId,
        color: /أخضر|اخضر|green/i.test(text)
          ? 'mint'
          : /بنفسجي|purple/i.test(text)
            ? 'violet'
            : /وردي|pink/i.test(text)
              ? 'rose'
              : /ذهبي|أصفر|اصفر|gold|yellow/i.test(text)
                ? 'amber'
                : 'blue',
      };
    }
  };
  return { context, run, intent };
}
