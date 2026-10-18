import { z } from 'zod';
import type { Store } from './store';
import type { Session } from '../src/types';
import type { ReportOptions } from '../src/pdfOptions';
import { escapeHTML as e, printDocument, printMath, printImage } from './printDocument';
import { attemptQuestions } from './examDelivery';

const reportOptions = z.object({
  sections: z
    .array(z.enum(['students', 'results', 'exams', 'banks', 'activity', 'accounts']))
    .min(1)
    .max(6),
  includeLoginCodes: z.boolean().default(false),
  includeAnswerDetails: z.boolean().default(false),
  includeArchived: z.boolean().default(true),
});
const date = (v: any) => (v ? new Date(v).toLocaleString('ar-JO') : '—');
const states: Record<string, string> = {
  active: 'جارٍ',
  submitted: 'مسلّم',
  review: 'بانتظار المراجعة',
  draft: 'مسودة',
  published: 'منشور',
  closed: 'مغلق',
  approved: 'معتمد',
};
const state = (v: string) => states[v] || v;
const table = (headers: string[], rows: unknown[][]) =>
  rows.length
    ? `<table><thead><tr>${headers.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((v) => `<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '<p class="notice">لا توجد سجلات.</p>';

export function schoolReport(store: Store, options: ReportOptions, accounts: any[]) {
  const students = store
    .all('students')
    .sort((a, b) =>
      `${a.grade} ${a.section} ${a.name}`.localeCompare(`${b.grade} ${b.section} ${b.name}`, 'ar', {
        numeric: true,
      }),
    );
  const exams = store.all('exams');
  const byStudent = new Map(students.map((s) => [s.id, s]));
  const byExam = new Map(exams.map((x) => [x.id, x]));
  const archived =
    options.includeArchived &&
    store.db.prepare("SELECT name FROM sqlite_master WHERE name='archived_attempts'").get()
      ? store.all('archived_attempts')
      : [];
  const attempts = [
    ...store.all('attempts').map((a) => ({ ...a, archived: false })),
    ...archived.map((a) => ({ ...a, archived: true })),
  ];
  const sections: string[] = [];
  const section = (title: string, body: string) =>
    sections.push(
      `<section class="report-section ${!sections.length ? 'first' : ''}"><h2 class="section-title">${title}</h2>${body}</section>`,
    );
  if (options.sections.includes('students'))
    section(
      'سجل الطلاب',
      table(
        [
          'رقم الطالب',
          'الاسم',
          'الصف',
          'الشعبة',
          'طريقة الدخول',
          ...(options.includeLoginCodes ? ['رمز الدخول'] : []),
        ],
        students.map((s) => [
          s.id,
          s.name,
          s.grade,
          s.section,
          s.loginMethod === 'national' ? 'الرقم الوطني أو الرمز البديل' : 'رمز الطالب',
          ...(options.includeLoginCodes ? [s.code || 'غير متوفر'] : []),
        ]),
      ) +
        (options.includeLoginCodes
          ? '<p class="notice">خاص بالمعلم: يتضمن رموز دخول الطلاب. الأرقام الوطنية مخزنة بصورة محمية ولا يمكن استرجاعها من قاعدة البيانات.</p>'
          : ''),
    );
  if (options.sections.includes('results')) {
    section(
      'العلامات والمحاولات',
      table(
        ['الطالب / الرقم', 'الامتحان', 'العلامة / الكلية', 'الحالة', 'بدء / تسليم'],
        attempts.map((a) => {
          const student = byStudent.get(a.studentId),
            exam = byExam.get(a.examId);
          return [
            `${student?.name || a.studentName || 'طالب محذوف'} / ${a.studentId}`,
            exam?.title || a.examTitle || a.examId,
            `${a.score ?? 'لم تصحح'} / ${exam?.total ?? a.total ?? '—'}`,
            `${state(a.status)}${a.archived ? ' (مؤرشفة)' : ''}`,
            `${date(a.startedAt)} / ${date(a.submittedAt)}`,
          ];
        }),
      ),
    );
    if (options.includeAnswerDetails)
      for (const a of attempts) {
        const exam = byExam.get(a.examId);
        const questions = a.assignedQuestions || (exam ? attemptQuestions(a, exam) : []);
        const letters = ['أ', 'ب', 'ج', 'د'];
        section(
          `تفاصيل محاولة ${e(byStudent.get(a.studentId)?.name || a.studentId)}`,
          `<p>${e(exam?.title || a.examId)} · ${e(a.id)} · ${e(state(a.status))}${a.archived ? ' · مؤرشفة' : ''}</p><p>الموعد النهائي: ${e(date(a.deadline))} · الكاميرا: ${a.cameraExempt ? 'معفى' : a.cameraAvailable ? 'متاحة' : 'غير متاحة'}</p>${questions.map((q: any, i: number) => `<article class="question"><small>السؤال ${i + 1} · الإجابة: ${e(letters[a.answers?.[q.id]] || 'دون إجابة')} · الصحيح: ${e(letters[q.correct])}${a.lateAnswers?.[q.id] !== undefined ? ` · إجابة متأخرة: ${e(letters[a.lateAnswers[q.id]])}` : ''}</small><h3>${printMath(q.text)}</h3>${printImage(q.image)}<div class="options">${q.options.map((o: string, j: number) => `<div>${letters[j]} · ${printMath(o)}</div>`).join('')}</div><p>${printMath(q.explanation)}</p></article>`).join('') || '<p class="notice">نص الأسئلة غير متوفر لهذه المحاولة المؤرشفة.</p>'}`,
        );
      }
  }
  if (options.sections.includes('exams'))
    section(
      'الامتحانات وإعداداتها',
      exams
        .map(
          (x) =>
            `<article class="question"><h3>${e(x.title)}</h3>${table(['المادة / الصف / الشعبة', 'الحالة / النوع', 'المدة / العلامة', 'عدد أسئلة الطالب'], [[`${x.subject} / ${x.grade} / ${x.section || 'الكل'}`, `${state(x.status)} / ${x.kind} / ${x.term}`, `${x.duration} دقيقة / ${x.total}`, x.delivery?.count || x.questions.length]])}<p>من ${e(date(x.opensAt))} إلى ${e(date(x.closesAt))}</p><p>نموذج ${x.delivery ? 'عشوائي' : 'ثابت'} · الكاميرا ${x.cameraRequired ? 'مطلوبة' : 'اختيارية'} · الآلة الحاسبة ${x.calculatorAllowed ? 'مسموحة' : 'غير مسموحة'} · GeoGebra ${x.geogebraAllowed ? 'مسموح' : 'غير مسموح'}</p>${options.includeLoginCodes ? `<p>رمز الامتحان: <b class="code">${e(x.code)}</b></p>` : ''}</article>`,
        )
        .join('') || '<p>لا توجد امتحانات.</p>',
    );
  if (options.sections.includes('banks')) {
    const counts = new Map<string, { all: number; approved: number }>();
    for (const q of store.all('bank_questions')) {
      const n = counts.get(q.bookId) || { all: 0, approved: 0 };
      n.all++;
      if (q.status === 'approved') n.approved++;
      counts.set(q.bookId, n);
    }
    section(
      'فهرس بنوك الأسئلة',
      table(
        ['البنك', 'المادة / الصف', 'الفصل', 'الأسئلة / المعتمدة'],
        store
          .all('books')
          .map((b) => [
            b.title,
            `${b.subject} / ${b.grade}`,
            b.term,
            `${counts.get(b.id)?.all || 0} / ${counts.get(b.id)?.approved || 0}`,
          ]),
      ) +
        '<p class="notice">لتصدير نص الأسئلة والرسوم ومفتاح الإجابة، استخدم تصدير PDF من صفحة البنك.</p>',
    );
  }
  if (options.sections.includes('activity'))
    section(
      'سجل العمليات',
      table(
        ['التاريخ', 'العملية'],
        (
          store.db.prepare('SELECT createdAt,event FROM audit ORDER BY createdAt').all() as any[]
        ).map((a) => [date(a.createdAt), a.event]),
      ),
    );
  if (options.sections.includes('accounts'))
    section(
      'حسابات المعلمين',
      table(
        ['الاسم', 'اسم المستخدم', 'الصلاحية', 'الحالة', 'الصفوف'],
        accounts.map((a) => [
          a.name,
          a.username,
          a.isAdmin ? 'مدير' : 'معلم',
          a.disabled ? 'موقوف' : 'نشط',
          a.isAdmin
            ? 'إدارة الحسابات'
            : (a.classes || []).map((c: any) => `${c.grade} / ${c.section}`).join('، '),
        ]),
      ) +
        '<p class="notice">كلمات مرور المعلمين مخزنة كتجزئات ولا يمكن استرجاعها. يمكن تغييرها من إعدادات الحسابات.</p>',
    );
  return printDocument(
    'تقرير بيانات المدرسة',
    store.getSetting('config').school,
    `بيانات حساب المعلم الحالي · ${date(Date.now())}`,
    `<p class="notice">تقرير للقراءة والطباعة ضمن صلاحيات حسابك. الصور الرقابية والملفات الأصلية والمحادثات والإعدادات السرية ليست ضمن التقرير. للاحتفاظ بالبيانات الكاملة القابلة للاستعادة استخدم النسخة الاحتياطية JSON.</p><div class="stats"><div class="stat"><b>${students.length}</b>طالب</div><div class="stat"><b>${exams.length}</b>امتحان</div><div class="stat"><b>${attempts.length}</b>محاولة</div></div>${sections.join('')}`,
    true,
  );
}

export function registerReports(
  app: any,
  store: Store,
  teacher: (req: any) => Session,
  accounts: () => any[],
) {
  app.post('/api/reports/document', async (req: any, reply: any) => {
    const session = teacher(req);
    const options = reportOptions.parse(req.body);
    reply.header('Cache-Control', 'no-store');
    const visibleAccounts = session.teacher?.isAdmin
      ? accounts()
      : [session.teacher].filter(Boolean);
    return { html: schoolReport(store, options, visibleAccounts) };
  });
}
