import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { inflateRawSync } from 'node:zlib';
import { z } from 'zod';
import { id, code, type Store } from './store';
const derive = promisify(scrypt);
const fail = (message: string) => Object.assign(Error(message), { statusCode: 400 });
export const nationalNumber = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/\s/g, '');
const lookup = (store: Store, value: string) => {
  let secret = store.getSetting('student-national-secret');
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    store.setSetting('student-national-secret', secret);
  }
  return createHmac('sha256', secret).update(value).digest('hex');
};
export async function nationalStudent(store: Store, input: string) {
  const value = nationalNumber(input);
  if (!/^\d{10}$/.test(value)) return undefined;
  const credentials = store.getSetting('student-national-credentials') || {};
  if (!Object.keys(credentials).length) return undefined;
  const index = lookup(store, value);
  const found = Object.entries(credentials).find(([, c]: any) => c.index === index);
  if (!found) return undefined;
  const [studentId, credential] = found as [string, { salt: string; hash: string }];
  const computed = (await derive(value, credential.salt, 64)) as Buffer;
  const expected = Buffer.from(credential.hash, 'hex');
  return expected.length === computed.length && timingSafeEqual(expected, computed)
    ? store.get('students', studentId)
    : undefined;
}
// Validate and inflate each bounded ZIP member before handing an XLSX to ExcelJS.
// No archive entries are written to disk, and formulas/macros are never executed.
export function checkRosterZip(bytes: Buffer) {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw fail('ملف Excel غير صالح. احفظه بصيغة XLSX.');
  const count = bytes.readUInt16LE(end + 10);
  let at = bytes.readUInt32LE(end + 16),
    total = 0;
  if (count > 512 || bytes.readUInt16LE(end + 4) !== 0 || bytes.readUInt16LE(end + 6) !== 0)
    throw fail('ملف Excel كبير أو غير مدعوم');
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || bytes.readUInt32LE(at) !== 0x02014b50)
      throw fail('بنية Excel غير صالحة');
    const flags = bytes.readUInt16LE(at + 8),
      method = bytes.readUInt16LE(at + 10),
      packed = bytes.readUInt32LE(at + 20),
      size = bytes.readUInt32LE(at + 24),
      n = bytes.readUInt16LE(at + 28),
      extra = bytes.readUInt16LE(at + 30),
      comment = bytes.readUInt16LE(at + 32),
      offset = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + n).toString('utf8');
    total += size;
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      size > 16 * 1024 * 1024 ||
      total > 32 * 1024 * 1024 ||
      /vbaProject|externalLinks/i.test(name) ||
      name.split(/[\\/]/).includes('..')
    )
      throw fail('يجب أن يكون الملف جدول طلاب فقط دون وحدات ماكرو أو روابط خارجية، وبحجم محدود');
    if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50)
      throw fail('ملف Excel تالف');
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    if (start + packed > bytes.length) throw fail('ملف Excel غير مكتمل');
    const raw = bytes.subarray(start, start + packed),
      data = method === 8 ? inflateRawSync(raw, { maxOutputLength: Math.max(1, size + 1) }) : raw;
    if (
      data.length !== size ||
      (name.endsWith('.xml') && /<!DOCTYPE|<!ENTITY/i.test(data.toString('utf8')))
    )
      throw fail('محتوى Excel غير صالح');
    at += 46 + n + extra + comment;
  }
}
const clean = (v: any): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (v.richText)
    return v.richText
      .map((x: any) => x.text)
      .join('')
      .trim();
  return ''; // formulas, errors, dates and hyperlinks cannot become identity fields
};
const header = (v: string) =>
  v
    .normalize('NFKC')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\s_\-:]/g, '')
    .toLowerCase();
const aliases: Record<string, string[]> = {
  name: [
    'الاسم',
    'اسم الطالب',
    'اسم الطالب الرباعي',
    'اسم الطالب كاملا',
    'name',
    'student name',
    'fullname',
  ],
  national: [
    'الرقم الوطني',
    'رقم وطني',
    'الرقم الوطني للطالب',
    'national id',
    'national number',
    'nationalid',
  ],
  id: ['رقم الطالب', 'الرقم المدرسي', 'student id', 'id'],
  grade: ['الصف', 'الصف الدراسي', 'grade', 'class'],
  section: ['الشعبة', 'section'],
};
type Entry = {
  id: string;
  name: string;
  grade: string;
  section: string;
  national: string;
  row: number;
  existing: boolean;
};
export function registerStudentRoster(
  app: any,
  store: Store,
  teacher: (r: any) => any,
  otherStores: () => Store[],
  checkGrade: (grade: string, section: string) => void = () => {},
) {
  const previews = new Map<
    string,
    { owner: string; expires: number; entries: Entry[]; mode: string }
  >();
  app.post('/api/students/roster/preview', async (req: any) => {
    teacher(req);
    const input = z
      .object({
        filename: z.string().max(250),
        file: z.string().max(11_000_000),
        sheet: z.string().max(200).optional(),
        headerRow: z.number().int().min(1).max(20).optional(),
        columns: z.record(z.string(), z.number().int().min(-1).max(49)).optional(),
        grade: z.string().trim().max(100).default(''),
        section: z.string().trim().max(100).default('أ'),
        mode: z.enum(['skip', 'update']).default('skip'),
      })
      .parse(req.body);
    const encoded = input.file.includes(',')
      ? input.file.slice(input.file.indexOf(',') + 1)
      : input.file;
    if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) throw fail('ملف غير صالح');
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > 8 * 1024 * 1024) throw fail('الحد الأقصى للملف 8 ميغابايت');
    let rows: string[][] = [],
      sheets: string[] = [];
    if (/\.xlsx$/i.test(input.filename)) {
      checkRosterZip(bytes);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes as any);
      sheets = workbook.worksheets.map((s) => s.name);
      const sheet =
        workbook.worksheets.find((s) => s.name === input.sheet) || workbook.worksheets[0];
      if (!sheet || sheet.rowCount > 3020 || sheet.columnCount > 50)
        throw fail('الحد الأقصى 3000 طالب و50 عمودًا');
      for (let r = 1; r <= sheet.rowCount; r++)
        rows.push(
          Array.from({ length: sheet.columnCount }, (_, c) =>
            clean(sheet.getRow(r).getCell(c + 1).value),
          ),
        );
    } else if (/\.csv$/i.test(input.filename)) {
      rows = parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), {
        bom: true,
        skip_empty_lines: false,
        relax_column_count: true,
        trim: true,
      });
      if (rows.length > 3020 || rows.some((r) => r.length > 50))
        throw fail('الحد الأقصى 3000 طالب و50 عمودًا');
    } else throw fail('اختر XLSX أو CSV. احفظ ملفات XLS القديمة بصيغة XLSX.');
    let headerIndex = input.headerRow
      ? input.headerRow - 1
      : rows
          .slice(0, 20)
          .findIndex((r) => r.some((c) => aliases.national.map(header).includes(header(c))));
    if (headerIndex < 0) headerIndex = 0;
    const labels = (rows[headerIndex] || []).map((value) =>
        /^\d{10}$/.test(nationalNumber(value)) ? 'عنوان مخفي' : value,
      ),
      columns: Record<string, number> = {};
    for (const [key, names] of Object.entries(aliases))
      columns[key] =
        input.columns?.[key] ?? labels.findIndex((v) => names.map(header).includes(header(v)));
    const assignedColumns = Object.values(columns).filter((v) => v >= 0);
    if (
      columns.name < 0 ||
      columns.national < 0 ||
      new Set(assignedColumns).size !== assignedColumns.length
    )
      return {
        token: '',
        sheets,
        sheet: input.sheet || sheets[0] || '',
        headerRow: headerIndex + 1,
        columns,
        labels,
        issues: [
          {
            row: headerIndex + 1,
            message: 'اختر عمودًا مختلفًا لكل حقل، وحدد الاسم والرقم الوطني ثم أعد المعاينة.',
          },
        ],
        rows: [],
        count: 0,
        added: 0,
        existing: 0,
      };
    const credentials = store.getSetting('student-national-credentials') || {},
      seen = new Set<string>(),
      ids = new Set<string>(),
      entries: Entry[] = [],
      issues: { row: number; message: string }[] = [];
    for (let r = headerIndex + 1; r < rows.length; r++) {
      const values = rows[r];
      if (values.every((v) => !v)) continue;
      const get = (key: string) => values[columns[key]] || '';
      const national = nationalNumber(get('national')),
        name = get('name'),
        grade = get('grade') || input.grade,
        section = get('section') || input.section;
      if (!/^\d{10}$/.test(national)) {
        issues.push({
          row: r + 1,
          message: 'الرقم الوطني يجب أن يتكون من 10 أرقام؛ احفظ الأرقام التي تبدأ بصفر كنص.',
        });
        continue;
      }
      if (
        !/\p{L}/u.test(name) ||
        name.length > 300 ||
        !grade ||
        grade.length > 100 ||
        !section ||
        section.length > 100
      ) {
        issues.push({ row: r + 1, message: 'أكمل الاسم والصف والشعبة' });
        continue;
      }
      const index = lookup(store, national);
      if (seen.has(index)) {
        issues.push({ row: r + 1, message: 'رقم وطني مكرر داخل الملف' });
        continue;
      }
      seen.add(index);
      if ([name, grade, section].some((value) => nationalNumber(value).includes(national))) {
        issues.push({
          row: r + 1,
          message: 'ظهر الرقم الوطني في حقل عام. راجع ربط أعمدة الاسم والصف والشعبة.',
        });
        continue;
      }
      if (
        otherStores().some((s) =>
          Object.values(s.getSetting('student-national-credentials') || {}).some(
            (v: any) => v.index === lookup(s, national),
          ),
        )
      ) {
        issues.push({
          row: r + 1,
          message: 'هذا الطالب مسجل في حساب معلم آخر؛ لم يتم تغيير حسابه',
        });
        continue;
      }
      const existingId = Object.keys(credentials).find((k) => credentials[k].index === index);
      const supplied = get('id');
      let studentId =
        existingId || (supplied && nationalNumber(supplied) !== national ? supplied : id());
      if (
        studentId.length > 300 ||
        ids.has(studentId) ||
        ['__proto__', 'constructor', 'prototype'].includes(studentId)
      ) {
        issues.push({ row: r + 1, message: 'رقم طالب مكرر أو طويل' });
        continue;
      }
      ids.add(studentId);
      const existing = store.get('students', studentId);
      if (existing && credentials[studentId] && credentials[studentId].index !== index) {
        issues.push({ row: r + 1, message: 'رقم الطالب مرتبط بهوية مختلفة' });
        continue;
      }
      entries.push({
        id: studentId,
        name,
        grade,
        section,
        national,
        row: r + 1,
        existing: !!existing,
      });
      try {
        checkGrade(grade, section);
      } catch {
        issues.push({ row: r + 1, message: 'هذا الصف غير مسند إلى حسابك. راجع مدير الحسابات.' });
      }
    }
    if (entries.length > 3000) throw fail('الحد الأقصى 3000 طالب');
    for (const [token, p] of previews)
      if (p.expires < Date.now() || p.owner === store.tenantId()) previews.delete(token);
    const token = id();
    if (!issues.length && entries.length) {
      previews.set(token, {
        owner: store.tenantId(),
        expires: Date.now() + 10 * 60000,
        entries,
        mode: input.mode,
      });
      setTimeout(() => previews.delete(token), 10 * 60000).unref();
    }
    return {
      token: issues.length ? '' : token,
      sheets,
      sheet: input.sheet || sheets[0] || '',
      headerRow: headerIndex + 1,
      columns,
      labels,
      issues,
      rows: entries.map(({ national, ...e }) => ({
        ...e,
        national: `••••••${national.slice(-4)}`,
        action: e.existing ? (input.mode === 'skip' ? 'تخطي' : 'تحديث') : 'إضافة',
      })),
      count: entries.length,
      added: entries.filter((e) => !e.existing).length,
      existing: entries.filter((e) => e.existing).length,
    };
  });
  app.post('/api/students/roster/commit', async (req: any) => {
    teacher(req);
    const { token } = z.object({ token: z.string().length(32) }).parse(req.body),
      preview = previews.get(token);
    if (!preview || preview.owner !== store.tenantId() || preview.expires < Date.now())
      throw fail('انتهت المعاينة. راجع الملف من جديد.');
    previews.delete(token); // a preview is consumed once, even if hashing fails
    for (const entry of preview.entries) checkGrade(entry.grade, entry.section);
    const prepared: { entry: Entry; credential: any }[] = [];
    const before = JSON.stringify([
      store.all('students'),
      store.getSetting('student-national-credentials'),
    ]);
    for (let i = 0; i < preview.entries.length; i += 2)
      await Promise.all(
        preview.entries.slice(i, i + 2).map(async (entry) => {
          if (entry.existing && preview.mode === 'skip') return;
          const salt = randomBytes(16).toString('hex'),
            hash = (await derive(entry.national, salt, 64)) as Buffer;
          prepared.push({
            entry,
            credential: { index: lookup(store, entry.national), salt, hash: hash.toString('hex') },
          });
        }),
      );
    if (
      before !==
      JSON.stringify([store.all('students'), store.getSetting('student-national-credentials')])
    )
      throw fail('تغيرت قائمة الطلاب أثناء التحضير. أعد المعاينة.');
    if (
      prepared.some(({ entry }) =>
        otherStores().some((s) =>
          Object.values(s.getSetting('student-national-credentials') || {}).some(
            (v: any) => v.index === lookup(s, entry.national),
          ),
        ),
      )
    )
      throw fail('تغير تسجيل أحد الطلاب. أعد المعاينة.');
    store.db.transaction(() => {
      const credentials = store.getSetting('student-national-credentials') || {};
      for (const { entry, credential } of prepared) {
        const old = store.get('students', entry.id);
        store.put('students', {
          ...old,
          id: entry.id,
          name: entry.name,
          grade: entry.grade,
          section: entry.section,
          code: old?.code || code(),
          loginMethod: 'national',
        });
        credentials[entry.id] = credential;
      }
      store.setSetting('student-national-credentials', credentials);
      store.audit(`استيراد قائمة طلاب: ${prepared.length}`);
    })();
    return { count: prepared.length, skipped: preview.entries.length - prepared.length };
  });
}
