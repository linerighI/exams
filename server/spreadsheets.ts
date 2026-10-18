import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { Store } from './store';
export async function schoolWorkbook(store: Store, kind: 'students' | 'results' | 'template') {
  const book = new ExcelJS.Workbook();
  book.creator = 'الشريقي للامتحانات';
  book.created = new Date();
  const sheet = book.addWorksheet(
    kind === 'results' ? 'النتائج' : kind === 'template' ? 'نموذج الطلاب' : 'الطلاب',
    {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    },
  );
  let headers: string[], rows: any[][];
  if (kind === 'template') {
    headers = ['رقم الطالب', 'اسم الطالب', 'الرقم الوطني', 'الصف', 'الشعبة'];
    rows = [['1001', 'طالب تجريبي - استبدل هذا السطر', '0123456789', 'العاشر', 'أ']];
  } else if (kind === 'students') {
    headers = ['رقم الطالب', 'الاسم', 'الصف', 'الشعبة', 'رمز الدخول', 'طريقة الدخول'];
    rows = store
      .all('students')
      .sort((a, b) => String(a.id).localeCompare(String(b.id), 'ar', { numeric: true }))
      .map((s) => [
        s.id,
        s.name,
        s.grade,
        s.section,
        s.code,
        s.loginMethod === 'national' ? 'الرقم الوطني أو الرمز البديل' : 'رمز من المعلم',
      ]);
  } else {
    headers = [
      'رقم الطالب',
      'الاسم',
      'الصف',
      'الشعبة',
      'الامتحان',
      'الدرجة',
      'الدرجة الكلية',
      'الحالة',
    ];
    const students = new Map(store.all('students').map((s) => [s.id, s])),
      exams = new Map(store.all('exams').map((e) => [e.id, e]));
    const states: Record<string, string> = {
      active: 'جارٍ',
      submitted: 'مسلّم',
      review: 'بانتظار المراجعة',
    };
    rows = store.all('attempts').map((a) => {
      const s = students.get(a.studentId),
        e = exams.get(a.examId);
      return [
        a.studentId,
        s?.name,
        s?.grade,
        s?.section,
        e?.title,
        a.score,
        e?.total,
        states[a.status] || a.status,
      ];
    });
  }
  sheet.addRow(headers);
  sheet.addRows(rows);
  sheet.columns.forEach((col, i) => {
    col.width = i === 1 || (kind === 'results' && i === 4) ? 32 : 20;
    col.numFmt = '@';
  });
  if (kind === 'results') for (const i of [6, 7]) sheet.getColumn(i).numFmt = '0.##';
  sheet.eachRow((row, n) => {
    row.height = n === 1 ? 32 : 28;
    row.eachCell((cell) => {
      cell.font = {
        name: 'Arial',
        size: 11,
        ...(n === 1
          ? { bold: true, color: { argb: 'FFFFFFFF' } }
          : { color: { argb: 'FF244460' } }),
      };
      cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      if (n === 1 || n % 2 === 0)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: n === 1 ? 'FF247F96' : 'FFF0F6F9' },
        };
    });
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: sheet.rowCount, column: headers.length },
  };
  sheet.pageSetup.printTitlesRow = '1:1';
  sheet.headerFooter.oddFooter = '&C&P / &N';
  return Buffer.from(await book.xlsx.writeBuffer());
}
export function registerSpreadsheets(app: any, store: Store, teacher: (req: any) => unknown) {
  app.get('/api/exports/:kind', async (req: any, reply: any) => {
    teacher(req);
    const kind = z.enum(['students', 'results', 'template']).parse(req.params.kind);
    reply.header('Cache-Control', 'no-store');
    return {
      filename: `${kind}.xlsx`,
      data: (await schoolWorkbook(store, kind)).toString('base64'),
    };
  });
}
