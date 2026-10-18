import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export type DatabaseFile = { path: string; bytes: Buffer };
export async function databaseWorkbook(
  files: DatabaseFile[],
  summary: { name: string; students: number; exams: number; books: number; attempts: number }[],
  readable: { name: string; headers: string[]; rows: unknown[][] }[] = [],
) {
  const book = new ExcelJS.Workbook();
  book.creator = 'الشريقي للامتحانات';
  book.created = new Date();
  const intro = book.addWorksheet('اقرأ أولًا', { views: [{ rightToLeft: true }] });
  intro.addRows([
    ['نسخة قواعد البيانات الكاملة', 'Alshereqi Database Backup v1'],
    ['التاريخ', new Date().toISOString()],
    [
      'المحتوى',
      'قواعد البيانات الأصلية لكل حسابات المعلمين، بما فيها الأسئلة والطلاب والمحاولات والإعدادات والرسوم والتسجيلات وسلة المحذوفات.',
    ],
    ['الخصوصية', 'يتضمن الملف رموز الدخول وتجزئات كلمات المرور وبيانات خاصة. احفظه في مكان آمن.'],
    [
      'الاستعادة',
      'ورقتا Manifest وDatabase Chunks تحفظان ملفات SQLite الأصلية دون فقد. استخدم أداة استخراج النسخة لاستعادتها إلى مجلد منفصل ومراجعتها قبل استبدال بيانات التطبيق.',
    ],
    [
      'حدود النسخة',
      'لا تشمل ملفات تثبيت التطبيق أو نماذج AI أو ذاكرة المتصفح. المفاتيح المحمية بواسطة Windows قد تحتاج إعادة إدخال على جهاز آخر.',
    ],
  ]);
  intro.columns = [{ width: 25 }, { width: 110 }];
  intro.eachRow((r) => {
    r.height = 55;
    r.alignment = { wrapText: true, vertical: 'middle' };
  });
  const totals = book.addWorksheet('حسابات وبيانات', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  totals.addRow(['الحساب', 'الطلاب', 'الامتحانات', 'البنوك', 'المحاولات']);
  summary.forEach((s) => totals.addRow([s.name, s.students, s.exams, s.books, s.attempts]));
  totals.columns.forEach((c) => (c.width = 25));
  for (const section of readable) {
    const sheet = book.addWorksheet(section.name, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });
    sheet.addRow(section.headers);
    for (const row of section.rows)
      sheet.addRow(
        row.map((value) =>
          typeof value === 'string' && value.length > 32000
            ? value.slice(0, 31950) + ' [النص الكامل محفوظ في قاعدة البيانات]'
            : value,
        ),
      );
    sheet.columns.forEach((c) => {
      c.width = 25;
      c.numFmt = '@';
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: section.headers.length },
    };
  }
  const manifest = book.addWorksheet('Manifest');
  manifest.addRow(['Path', 'Bytes', 'SHA256', 'Parts']);
  manifest.columns = [{ width: 65 }, { width: 18 }, { width: 70 }, { width: 12 }];
  const chunks = book.addWorksheet('Database Chunks');
  chunks.addRow(['Path', 'Part', 'Base64']);
  chunks.columns = [{ width: 60 }, { width: 12 }, { width: 100 }];
  for (const file of files) {
    const data = file.bytes.toString('base64'),
      parts = Math.ceil(data.length / 30000);
    manifest.addRow([
      file.path,
      file.bytes.length,
      createHash('sha256').update(file.bytes).digest('hex'),
      parts,
    ]);
    for (let at = 0, i = 0; at < data.length; at += 30000, i++)
      chunks.addRow([file.path, i + 1, data.slice(at, at + 30000)]);
  }
  for (const sheet of book.worksheets) {
    const header = sheet.getRow(1);
    header.height = 30;
    header.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 12 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF247F96' } };
    });
    sheet.views = [
      {
        rightToLeft: !['Manifest', 'Database Chunks'].includes(sheet.name),
        state: 'frozen',
        ySplit: 1,
      },
    ];
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
export function backupProtectionFile(directory: string): DatabaseFile[] {
  const path = join(directory, 'api-key-protection');
  return existsSync(path) ? [{ path: 'api-key-protection', bytes: readFileSync(path) }] : [];
}
export async function readDatabaseWorkbook(bytes: Buffer): Promise<DatabaseFile[]> {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as any);
  const manifest = book.getWorksheet('Manifest'),
    chunks = book.getWorksheet('Database Chunks');
  if (!manifest || !chunks) throw Error('ليست نسخة قاعدة بيانات كاملة');
  const data = new Map<string, Map<number, string>>();
  chunks.eachRow((row, i) => {
    if (i === 1) return;
    const path = String(row.getCell(1).value),
      part = Number(row.getCell(2).value),
      text = String(row.getCell(3).value);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || !Number.isSafeInteger(part) || part < 1)
      throw Error('جزء غير صالح');
    const values = data.get(path) || new Map();
    if (values.has(part)) throw Error('جزء مكرر');
    values.set(part, text);
    data.set(path, values);
  });
  const result: DatabaseFile[] = [];
  manifest.eachRow((row, i) => {
    if (i === 1) return;
    const path = String(row.getCell(1).value),
      size = Number(row.getCell(2).value),
      hash = String(row.getCell(3).value),
      parts = Number(row.getCell(4).value),
      values = data.get(path);
    if (
      !/^(school\.sqlite|teachers\.sqlite|api-key-protection|teachers\/[a-f0-9]{32}\/school\.sqlite)$/.test(
        path,
      ) ||
      result.some((f) => f.path === path) ||
      !Number.isSafeInteger(size) || size < 0 ||
      !Number.isSafeInteger(parts) || parts < 1 ||
      !values ||
      values.size !== parts
    )
      throw Error('ملف غير صالح أو أجزاء مفقودة');
    const text = Array.from({ length: parts }, (_, j) => {
        if (!values.has(j + 1)) throw Error('جزء مفقود');
        return values.get(j + 1)!;
      }).join(''),
      bytes = Buffer.from(text, 'base64');
    if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== hash)
      throw Error('فشل التحقق من سلامة النسخة');
    if (path.endsWith('.sqlite') && bytes.subarray(0, 16).toString() !== 'SQLite format 3\u0000')
      throw Error('قاعدة بيانات غير صالحة');
    result.push({ path, bytes });
  });
  if (
    !result.some((f) => f.path === 'teachers.sqlite') ||
    !result.some((f) => f.path === 'school.sqlite')
  )
    throw Error('النسخة غير مكتملة');
  return result;
}
