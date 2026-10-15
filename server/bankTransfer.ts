import { z } from 'zod';
import katex from 'katex';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { id, type Store } from './store';
import { normalizeCropBox } from './cropBox';
import { mathSegments } from '../src/mathNotation';
import { safeSvg } from '../src/svgDiagram';
const str = z.string().trim().min(1).max(2000);
const badInput = (message: string) => Object.assign(new Error(message), { statusCode: 400 });
const metadata = z.object({
  title: str,
  subject: str,
  grade: str,
  term: z.enum(['الأول', 'الثاني']),
  pageCount: z.number().int().min(1).max(500),
});
const item = z.object({
  id: z.string().max(100).optional(),
  text: str,
  options: z.array(str.max(800)).length(4),
  correct: z.number().int().min(0).max(3),
  explanation: str,
  page: z.number().int().positive(),
  difficulty: z.enum(['سهل', 'متوسط', 'صعب']),
  chapter: str,
  lesson: z.string().max(2000).default(''),
  evidence: str,
  requiresImage: z.boolean().default(false),
  box: z.unknown().optional(),
  svg: z.string().max(100000).nullable().optional(),
  image: z
    .string()
    .max(3_000_000)
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
});
const envelope = z.object({
  version: z.literal(1),
  batchId: str.optional().default('bank'),
  book: metadata,
  questions: z.array(z.unknown()).min(1).max(500),
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
        'بنية ملف البنك غير صالحة. يلزم version:1 وبيانات book وعدد 1–500 سؤال. راجع: ' +
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
      const parsed = item.safeParse(value);
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
      if (new Set(q.options.map(norm)).size !== 4) {
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
      const requiresImage = q.requiresImage || !!crop.box || !!q.svg;
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
  app.get('/api/books/:id/document', async (req: any) => {
    teacher(req);
    const b = store.get('books', req.params.id);
    if (!b) throw badInput('البنك غير موجود');
    return {
      html: bankDocument(
        b,
        store.all('bank_questions').filter((q) => q.bookId === b.id),
      ),
    };
  });
}
export function bankDocument(book: any, questions: any[]) {
  const req = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);
  const katexPath = dirname(req.resolve('katex/package.json'));
  const css = readFileSync(join(katexPath, 'dist/katex.min.css'), 'utf8').replace(
    /url\((?:['"])?fonts\/([^)'"\s]+)(?:['"])?\)/g,
    (_all, name) =>
      `url(data:font/${name.endsWith('woff2') ? 'woff2' : name.endsWith('woff') ? 'woff' : 'ttf'};base64,${readFileSync(join(katexPath, 'dist/fonts', name)).toString('base64')})`,
  );
  const font = readFileSync(
    req.resolve('@fontsource/tajawal/files/tajawal-arabic-400-normal.woff2'),
  ).toString('base64');
  const text = (value: string) =>
    mathSegments(value)
      .map((p) => {
        if (!p.math) return escape(p.text);
        try {
          return `<span dir="ltr" class="formula">${katex.renderToString(p.text, { throwOnError: true, trust: false, displayMode: !!p.display, maxExpand: 200 })}</span>`;
        } catch {
          return `<span class="invalid">${escape(p.text)}</span>`;
        }
      })
      .join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:"><style>${css}@font-face{font-family:Tajawal;src:url(data:font/woff2;base64,${font})}body{font-family:Tajawal,Arial;color:#203650;font-size:16px;line-height:1.8}h1{color:#3775c7}header{border-bottom:2px solid #dce7f2;margin-bottom:24px}article{break-inside:avoid;border:1px solid #dce7f2;border-radius:14px;padding:18px;margin:16px 0}small{color:#63758a}.options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.options div{border:1px solid #e5ecf4;padding:6px 12px;border-radius:8px}img{display:block;max-width:95%;max-height:240px;margin:12px auto}.formula{display:inline-block;direction:ltr;unicode-bidi:isolate}.invalid,.warning{color:#9d481e}.key{break-before:page}h2{font-size:20px}@page{size:A4;margin:18mm}</style></head><body><header><small>مدرسة محمد الشريقي · بنك أسئلة للمراجعة</small><h1>${escape(book.title)}</h1><p>${escape(book.subject)} · ${escape(book.grade)} · الفصل ${escape(book.term)} · ${questions.length} سؤال</p><small>تحتاج المسودات إلى مراجعة المعلم قبل النشر.</small></header>${questions.map((q, i) => `<article><small>${i + 1} · ${escape(q.chapter)} · صفحة المصدر ${q.page} · ${escape(q.status === 'approved' ? 'معتمد' : 'مسودة')}</small><h2>${text(q.text)}</h2>${q.image && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(q.image) ? `<img src="${q.image}" alt="رسم السؤال">` : q.requiresImage ? '<p class="warning">رسم مطلوب قبل اعتماد السؤال</p>' : ''}<div class="options">${q.options.map((o: string, j: number) => `<div>${['أ', 'ب', 'ج', 'د'][j]} · ${text(o)}</div>`).join('')}</div></article>`).join('')}<section class="key"><h1>مفتاح الإجابة · للمعلم</h1>${questions.map((q, i) => `<article><strong>${i + 1} · ${['أ', 'ب', 'ج', 'د'][q.correct]}</strong><p>${text(q.explanation)}</p></article>`).join('')}</section></body></html>`;
}
