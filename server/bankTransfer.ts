import { z } from 'zod';
import katex from '../src/mathRenderer';
import { createHash } from 'node:crypto';
import { id, type Store } from './store';
import { normalizeCropBox } from './cropBox';
import { mathSegments } from '../src/mathNotation';
import { safeSvg } from '../src/svgDiagram';
import { printDocument, printMath, printImage, escapeHTML } from './printDocument';
import type { BankPDFOptions } from '../src/pdfOptions';
import { questionSchema, questionFields, refineQuestion } from './questionSchema';
import {
  questionOptionsDistinct,
  kindLabel,
  kindOf,
  answerKeyText,
  matchingColumns,
  orderingOptions,
} from '../src/questionFormats';
const str = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine((s) => !s.includes('\uFFFD'), 'النص تالف؛ استخدم ملف UTF-8 صحيحًا');
const badInput = (message: string) => Object.assign(new Error(message), { statusCode: 400 });
const metadata = z.object({
  title: str,
  subject: str,
  grade: str,
  term: z.enum(['الأول', 'الثاني']),
  pageCount: z.number().int().min(1).max(500),
});
const item = questionFields.extend({
  id: z.string().max(100).default('candidate'),
  text: str,
  options: questionSchema.shape.options.default([]),
  correct: questionSchema.shape.correct.default(0),
  explanation: str,
  page: z.number().int().positive(),
  difficulty: z.enum(['سهل', 'متوسط', 'صعب']),
  chapter: str,
  lesson: z.string().max(2000).default(''),
  evidence: str,
  requiresImage: z.boolean().default(false),
  box: z.unknown().optional(),
  atlasBox: z.unknown().optional(),
  svg: z.string().max(100000).nullable().optional(),
  image: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
const checkedItem = item.superRefine(refineQuestion);
const envelope = z.object({
  version: z.literal(1),
  batchId: str.optional().default('bank'),
  book: metadata,
  questions: z.array(z.unknown()).min(1).max(1000),
});
const norm = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/−/g, '-')
    .replace(/[\s\u064B-\u065F]/gu, '');
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
function notationWarnings(q: any) {
  const warnings: string[] = [];
  for (const value of [q.text, ...q.options, q.explanation]) {
    if (
      (value.match(/\$/g) || []).length % 2 ||
      (value.match(/\\\(/g) || []).length !== (value.match(/\\\)/g) || []).length ||
      (value.match(/\\\[/g) || []).length !== (value.match(/\\\]/g) || []).length
    )
      warnings.push('محددات معادلة غير مكتملة');
    for (const part of mathSegments(value))
      if (part.math)
        try {
          katex.renderToString(part.text, {
            throwOnError: true,
            trust: false,
            maxExpand: 200,
            strict: 'error',
          });
        } catch {
          warnings.push('صيغة رياضية تحتاج تصحيحًا');
        }
  }
  return [...new Set(warnings)];
}
export function registerBankTransfer(
  app: any,
  store: Store,
  teacher: (r: any) => any,
  render: (
    b: any,
    from: number,
    to?: number,
    signal?: AbortSignal,
    crop?: number[],
  ) => Promise<any>,
) {
  const importing = new Set<string>();
  const validate = (body: any) => {
    const parsedInput = z
      .object({ data: envelope, bookId: z.string().max(100).optional() })
      .safeParse(body);
    if (!parsedInput.success)
      throw badInput(
        'بنية ملف البنك غير صالحة. يلزم version:1 وبيانات book وعدد 1–1000 سؤال. راجع: ' +
          [...new Set(parsedInput.error.issues.map((i) => i.path.join('.')))].join('، '),
      );
    const input = parsedInput.data;
    if (!input.bookId) {
      const match = store
        .all('books')
        .find(
          (b) =>
            b.pageCount === input.data.book.pageCount &&
            ['title', 'subject', 'grade', 'term'].every(
              (k) => norm(b[k]) === norm((input.data.book as any)[k]),
            ),
        );
      if (match) input.bookId = match.id;
    }
    const existing = input.bookId ? store.get('books', input.bookId) : null;
    if (input.bookId && !existing) throw badInput('البنك غير موجود');
    if (
      existing &&
      ['title', 'subject', 'grade', 'term'].some(
        (k) => norm(existing[k]) !== norm((input.data.book as any)[k]),
      )
    )
      throw badInput(
        'بيانات الملف لا تطابق البنك المختار. اختر بنكًا مطابقًا أو استورده كبنك جديد.',
      );
    if (existing && existing.pageCount !== input.data.book.pageCount)
      throw badInput('عدد صفحات الملف لا يطابق الكتاب الأصلي');
    const known = store.all('bank_questions').filter((q) => q.bookId === input.bookId);
    const keys = new Set(known.map((q) => norm(q.text)));
    const accepted: any[] = [],
      rejected: any[] = [],
      duplicates: any[] = [];
    input.data.questions.forEach((value, index) => {
      const parsed = checkedItem.safeParse(value);
      if (!parsed.success) {
        rejected.push({
          index: index + 1,
          message:
            'حقول غير صالحة: ' +
            [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join('، '),
        });
        return;
      }
      const q = parsed.data;
      if (q.page > input.data.book.pageCount) {
        rejected.push({ index: index + 1, message: 'صفحة المصدر خارج الكتاب' });
        return;
      }
      if (!questionOptionsDistinct(q, norm)) {
        rejected.push({ index: index + 1, message: 'الخيارات مكررة' });
        return;
      }
      if (keys.has(norm(q.text))) {
        duplicates.push({ index: index + 1, message: 'سؤال مكرر' });
        return;
      }
      keys.add(norm(q.text));
      const crop = normalizeCropBox(q.box);
      const warnings = notationWarnings(q);
      let svg: string | undefined;
      let image = q.image;
      if (q.svg)
        try {
          svg = safeSvg(q.svg);
        } catch (e) {
          warnings.push((e as Error).message);
          image = undefined;
        }
      if (image) {
        const bytes = Buffer.from(image.split(',')[1], 'base64');
        if (!(
          (bytes[0] === 137 && bytes.subarray(1, 4).toString() === 'PNG') ||
          (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        )) {
          image = undefined;
          warnings.push('ملف الصورة غير صالح');
        }
      }
      if (crop.warning) warnings.push(crop.warning);
      if(q.atlasBox&&!image)warnings.push('أرفق لوحة الرسوم المشتركة لقص atlasBox وربطه بالسؤال قبل الاعتماد.');
      const requiresImage = q.requiresImage || !!crop.box || !!q.svg || !!q.atlasBox;
      if (requiresImage && !image && !existing?.pdf)
        warnings.push('أرفق صورة أو الكتاب الأصلي لقص الرسم');
      if (requiresImage && !image && !crop.box) warnings.push('أرفق الرسم أو حدده قبل الاعتماد');
      accepted.push({
        ...q,
        svg,
        image,
        box: crop.box,
        requiresImage,
        reviewWarnings: warnings,
        sourceIndex: index + 1,
      });
    });
    return {
      ...input,
      accepted,
      rejected,
      duplicates,
      repairNeeded: accepted.filter((q) => q.reviewWarnings.length).length,
    };
  };
  app.post('/api/bank/import/preview', async (req: any) => {
    teacher(req);
    return validate(req.body);
  });
  app.post('/api/bank/import/commit', async (req: any) => {
    teacher(req);
    if (importing.has(store.tenantId()))
      throw badInput('يوجد بنك قيد الحفظ. انتظر اكتماله ثم أعد المحاولة.');
    importing.add(store.tenantId());
    try {
      const result = validate(req.body);
      if (!result.accepted.length) throw badInput('لا توجد أسئلة جديدة صالحة للاستيراد');
      const b = result.bookId
        ? store.get('books', result.bookId)
        : {
            ...result.data.book,
            id: id(),
            pages: Array.from({ length: result.data.book.pageCount }, (_, i) => ({
              page: i + 1,
              included: true,
              reason: 'مستورد من موقع الذكاء الاصطناعي',
              chapter: '',
              lesson: '',
            })),
            createdAt: Date.now(),
            origin: 'external',
          };
      const rows: any[] = [];
      for (const q of result.accepted) {
        let image: string | undefined = q.image;
        let cropWarning = q.reviewWarnings.join('، ') || undefined;
        if (!image && b.pdf && q.box)
          try {
            const crop = await render(b, q.page, q.page, undefined, q.box);
            image = `data:image/png;base64,${crop.pages[0].image}`;
          } catch {
            cropWarning = 'تعذر قص الرسم. حدده من صفحة المصدر.';
          }
        rows.push({
          ...q,
          id: id(),
          externalId: q.id,
          batchId: result.data.batchId,
          bookId: b.id,
          status: 'draft',
          createdAt: Date.now(),
          image,
          cropWarning,
        });
      }
      store.db.transaction(() => {
        store.put('books', b);
        for (const q of rows) store.put('bank_questions', q);
      })();
      return {
        bookId: b.id,
        imported: rows.length,
        skipped: result.rejected.length + result.duplicates.length,
        repairNeeded: rows.filter((q) => q.cropWarning).length,
      };
    } finally {
      importing.delete(store.tenantId());
    }
  });
  app.get('/api/books/:id/companion', async (req: any) => {
    teacher(req);
    const b = store.get('books', req.params.id);
    if (!b?.companionPdf) throw badInput('لا يوجد PDF مرافق');
    return { pdf: b.companionPdf };
  });
  app.post('/api/books/:id/source', async (req: any) => {
    teacher(req);
    const b = store.get('books', req.params.id);
    if (!b) throw badInput('البنك غير موجود');
    const pdf = z
      .string()
      .max(42_000_000)
      .parse(req.body.pdf)
      .replace(/^data:[^,]*;base64,/, '');
    const bytes = Buffer.from(pdf, 'base64');
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || bytes.length > 30 * 1024 * 1024)
      throw badInput('ارفع PDF حتى 30 ميجابايت');
    if (b.pdf)
      throw badInput('الكتاب الأصلي مرتبط بالفعل؛ لا يمكن استبداله لتجنب تغيير مصادر الأسئلة');
    const preview = await render({ ...b, pdf }, 1);
    if (preview.count !== b.pageCount)
      throw badInput('عدد صفحات الملف لا يطابق بيانات البنك. صحح الملف أو بيانات الدفعة.');
    b.pdf = pdf;
    b.fingerprint = createHash('sha256').update(bytes).digest('hex');
    store.put('books', b);
    let cropped = 0;
    for (const q of store
      .all('bank_questions')
      .filter((q) => q.bookId === b.id && q.box && !q.image)) {
      try {
        const result = await render(b, q.page, q.page, undefined, q.box);
        q.image = `data:image/png;base64,${result.pages[0].image}`;
        q.cropWarning = undefined;
        q.status = 'draft';
        store.put('bank_questions', q);
        cropped++;
      } catch {}
    }
    return { ok: true, cropped };
  });
  app.post('/api/books/:id/companion', async (req: any) => {
    teacher(req);
    const b = store.get('books', req.params.id);
    if (!b) throw badInput('البنك غير موجود');
    const pdf = z
      .string()
      .max(42_000_000)
      .parse(req.body.pdf)
      .replace(/^data:[^,]*;base64,/, '');
    const bytes = Buffer.from(pdf, 'base64');
    if (bytes.subarray(0, 5).toString() !== '%PDF-' || bytes.length > 30 * 1024 * 1024)
      throw badInput('ملف PDF غير صالح أو أكبر من 30 ميجابايت');
    b.companionPdf = pdf;
    store.put('books', b);
    return { ok: true };
  });
  app.get('/api/books/:id/document', async (req: any, reply: any) => {
    teacher(req);
    reply.header('Cache-Control', 'no-store');
    const b = store.get('books', req.params.id);
    if (!b) throw badInput('البنك غير موجود');
    const options = z
      .object({
        audience: z.enum(['teacher', 'student']).default('teacher'),
        approvedOnly: z
          .enum(['true', 'false'])
          .default('false')
          .transform((v) => v === 'true'),
        chapter: z.string().max(300).default(''),
        title: z.string().trim().max(200).default(''),
      })
      .parse(req.query);
    return {
      html: bankDocument(
        b,
        store.all('bank_questions').filter((q) => q.bookId === b.id),
        options,
        store.getSetting('config').school,
      ),
    };
  });
}
export function bankDocument(
  book: any,
  questions: any[],
  options?: Partial<BankPDFOptions>,
  school = 'مدرسة محمد الشريقي',
) {
  const student = options?.audience === 'student';
  const selected = questions.filter(
    (q) =>
      ((!options?.approvedOnly && !student) || q.status === 'approved') &&
      (!options?.chapter || q.chapter === options.chapter),
  );
  const letters = ['أ', 'ب', 'ج', 'د'];
  const content = `${student ? '<div class="signature"><span>اسم الطالب: ................................</span><span>الشعبة: .............</span><span>التاريخ: .............</span></div>' : '<p class="notice">المسودات للمراجعة فقط. نسخة الطالب تحتوي الأسئلة المعتمدة وحدها دون الإجابات.</p>'}
    <div class="stats"><div class="stat"><b>${selected.length}</b>سؤال</div><div class="stat"><b>${escapeHTML(book.grade)}</b>الصف</div><div class="stat"><b>${escapeHTML(book.term)}</b>الفصل</div></div>
    ${selected.length ? selected.map((q, i) => `<article class="question"><div class="question-meta"><span class="number">السؤال ${i + 1}</span><span>${escapeHTML(kindLabel(q))} · ${escapeHTML(q.chapter || '')} · ${escapeHTML(q.difficulty || '')}${student ? '' : ` · صفحة ${escapeHTML(q.page)} · ${q.status === 'approved' ? 'معتمد' : 'مسودة'}`}</span></div><h2>${printMath(q.text)}</h2>${printImage(q.image) || (q.requiresImage ? '<p class="warning">رسم مطلوب قبل اعتماد السؤال</p>' : '')}${bankAnswerArea(q)}</article>`).join('') : '<p class="notice">لا توجد أسئلة تطابق خيارات التصدير.</p>'}
    ${!student && selected.length ? `<section class="key"><h2 class="section-title">مفتاح الإجابة · للمعلم</h2>${selected.map((q, i) => `<div class="answer"><strong>${i + 1} · ${['single', 'boolean'].includes(kindOf(q)) ? letters[q.correct] + ' · ' : ''}${printMath(answerKeyText(q))}</strong><p>${printMath(q.explanation)}</p></div>`).join('')}</section>` : ''}`;
  return printDocument(
    options?.title || book.title,
    school,
    `${book.subject} · ${options?.chapter || 'جميع الموضوعات'} · ${student ? 'ورقة أسئلة' : 'بنك الأسئلة ومفتاح الإجابة'}`,
    content,
    !student,
  );
}
function bankAnswerArea(q: any) {
  const k = kindOf(q),
    hint = q.keywordGrading
      ? `<p class="notice">للدرجة الكاملة: ${q.keywordGrading.required} أفكار صحيحة ومختلفة، بعد مراجعة المعلم.</p>`
      : '';
  if (['single', 'multiple', 'boolean'].includes(k))
    return `${k === 'multiple' ? '<p>اختر جميع الإجابات الصحيحة.</p>' : ''}<div class="options">${q.options.map((o: string, j: number) => `<div>${['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'][j]} · ${printMath(o)}</div>`).join('')}</div>`;
  if (k === 'order')
    return `<p>رتّب العناصر بكتابة أرقام الترتيب الصحيح.</p><div class="options">${orderingOptions(
      q,
    )
      .map((o) => `<div>□ ${printMath(o)}</div>`)
      .join('')}</div>`;
  if (k === 'match') {
    const cols = matchingColumns(q);
    return `<p>صل العناصر بما يناسبها.</p><table><tbody>${cols.left.map((v, i) => `<tr><td>${printMath(v)}</td><td style="width:30%">................</td><td>${printMath(cols.right[i])}</td></tr>`).join('')}</tbody></table>`;
  }
  if (k === 'draw')
    return '<div style="height:180px;border:1px solid #b8c9dc;border-radius:10px;margin-top:16px">مساحة الرسم والكتابة بالقلم</div>';
  return (
    hint +
    Array.from(
      { length: k === 'essay' ? 5 : k === 'blank' ? q.blankAnswers?.length || 1 : 2 },
      (_, i) =>
        `<p style="line-height:2.6">${k === 'blank' ? `${i + 1}. ` : ''}........................................................................</p>`,
    ).join('')
  );
}
