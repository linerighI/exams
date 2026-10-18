import { z } from 'zod';
import { id, type Store } from './store';
import type { Session } from '../src/types';
const kinds = z.enum(['students', 'exams', 'books', 'sources', 'assets']);
const columns: Record<string, string[]> = {
  students: ['id', 'data'],
  exams: ['id', 'data'],
  books: ['id', 'data'],
  bank_questions: ['id', 'data'],
  book_jobs: ['id', 'data'],
  sources: ['id', 'data'],
  assets: ['id', 'data'],
  attempts: ['id', 'examId', 'studentId', 'data'],
  archived_attempts: ['id', 'data'],
  photos: ['id', 'attemptId', 'createdAt', 'data'],
  camera_requests: ['id', 'attemptId', 'state', 'createdAt'],
};
const fail = (message: string, statusCode = 409) => Object.assign(Error(message), { statusCode });
type Group = { table: string; rows: any[] };
export function registerDeletion(
  app: any,
  store: Store,
  teacher: (req: any) => Session,
  loggedIn: (studentId: string) => boolean,
  checkGrade: (grade: string, section?: string) => void,
  usedCodes: () => Set<string>,
) {
  const tableExists = (table: string) =>
    !!store.db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(table);
  const raw = (table: string) =>
    tableExists(table) ? (store.db.prepare(`SELECT * FROM ${table}`).all() as any[]) : [];
  const json = (table: string) => raw(table).map((r) => JSON.parse(r.data));
  const permitted = (entry: any) => {
    try {
      for (const group of entry.groups || [])
        if (['students', 'exams'].includes(group.table))
          for (const row of group.rows) {
            const item = JSON.parse(row.data);
            checkGrade(item.grade, item.section);
          }
      return true;
    } catch {
      return false;
    }
  };
  app.delete('/api/records/:kind/:id', async (req: any) => {
    teacher(req);
    z.object({ confirm: z.literal(true) }).parse(req.body);
    const kind = kinds.parse(req.params.kind),
      key = z.string().min(1).max(300).parse(req.params.id),
      item = store.get(kind, key);
    if (!item) throw fail('العنصر غير موجود', 404);
    const groups: Group[] = [{ table: kind, rows: raw(kind).filter((r) => r.id === key) }];
    const related =
      kind === 'students' || kind === 'exams'
        ? store
            .all('attempts')
            .filter((a) => (kind === 'students' ? a.studentId === key : a.examId === key))
        : [];
    if (related.some((a) => !a.submittedAt && a.deadline > Date.now()))
      throw fail('لا يمكن الحذف أثناء محاولة نشطة. انتظر تسليم الطلاب.');
    if (kind === 'students' && loggedIn(key))
      throw fail('سجّل خروج الطالب أولًا قبل حذفه حتى لا تُقفل جلسته.');
    const settings: any[] = [];
    if (kind === 'students' || kind === 'exams') {
      const match = (a: any) => (kind === 'students' ? a.studentId === key : a.examId === key);
      for (const table of ['attempts', 'archived_attempts']) {
        const rows = raw(table).filter((r) => match(JSON.parse(r.data)));
        // Enforce permissions for every dependent attempt before touching raw rows.
        for (const row of rows) store.get(table, row.id);
        groups.push({ table, rows });
      }
      const attemptIds = new Set(
        groups
          .filter((g) => ['attempts', 'archived_attempts'].includes(g.table))
          .flatMap((g) => g.rows.map((r) => r.id)),
      );
      for (const table of ['photos', 'camera_requests'])
        groups.push({ table, rows: raw(table).filter((r) => attemptIds.has(r.attemptId)) });
      if (kind === 'students') {
        const credentials = store.getSetting('student-national-credentials') || {};
        if (Object.hasOwn(credentials, key))
          settings.push({
            key: 'student-national-credentials',
            entry: key,
            value: credentials[key],
          });
      }
    }
    const detached: { examId: string; questionId: string; bankId: string }[] = [];
    if (kind === 'books') {
      const jobs = store.all('book_jobs').filter((j) => j.bookId === key);
      if (jobs.some((j) => j.status === 'running'))
        throw fail('أوقف معالجة هذا البنك وانتظر توقف المهمة قبل الحذف.');
      const questions = store.all('bank_questions').filter((q) => q.bookId === key),
        ids = new Set(questions.map((q) => q.id));
      const exams = json('exams').filter((e) => e.questions.some((q: any) => ids.has(q.bankId)));
      if (
        exams.some((e) =>
          json('attempts').some(
            (a) => a.examId === e.id && !a.submittedAt && a.deadline > Date.now(),
          ),
        )
      )
        throw fail('البنك مستخدم في امتحان جارٍ. انتظر انتهاء المحاولات.');
      for (const exam of exams) store.get('exams', exam.id);
      groups.push(
        { table: 'bank_questions', rows: raw('bank_questions').filter((r) => ids.has(r.id)) },
        {
          table: 'book_jobs',
          rows: raw('book_jobs').filter(
            (r) => r.bookId === key || JSON.parse(r.data).bookId === key,
          ),
        },
      );
      for (const e of exams)
        for (const q of e.questions)
          if (ids.has(q.bankId))
            detached.push({ examId: e.id, questionId: q.id, bankId: q.bankId });
    }
    if (kind === 'sources' && json('exams').some((e) => e.sourceId === key))
      throw fail('المصدر مستخدم في امتحان محفوظ؛ احذف الامتحان المرتبط أولًا.');
    if (kind === 'assets') {
      const references = [...json('exams'), ...json('attempts'), ...json('archived_attempts')];
      if (
        references.some(
          (e) =>
            e.audio?.id === key ||
            [...(e.questions || []), ...(e.assignedQuestions || [])].some(
              (q: any) => q.audio?.id === key || q.geometryId === key,
            ),
        ) ||
        store.all('bank_questions').some((q) => q.geometryId === key)
      )
        throw fail('الملف مستخدم في امتحان أو سؤال؛ أزل الارتباط به أولًا.');
    }
    const entry = {
      id: id(),
      kind,
      title: item.name || item.title || item.id,
      at: Date.now(),
      groups,
      settings,
      detached,
    };
    store.db.transaction(() => {
      store.put('trash', entry);
      for (const group of groups)
        for (const row of group.rows)
          store.db.prepare(`DELETE FROM ${group.table} WHERE id=?`).run(row.id);
      for (const setting of settings) {
        const value = store.getSetting(setting.key) || {};
        delete value[setting.entry];
        store.setSetting(setting.key, value);
      }
      for (const examId of new Set(detached.map((d) => d.examId))) {
        const exam = store.get('exams', examId);
        exam.questions = exam.questions.map((q: any) =>
          detached.some((d) => d.examId === examId && d.questionId === q.id)
            ? { ...q, bankId: undefined }
            : q,
        );
        store.put('exams', exam);
      }
      store.audit(`نقل إلى المحذوفات: ${kind}:${key}`);
    })();
    return { ok: true, trashId: entry.id };
  });
  app.get('/api/trash', async (req: any) => {
    teacher(req);
    return store
      .all('trash')
      .filter(permitted)
      .map((t) => ({
        id: t.id,
        kind: t.kind,
        title: t.title,
        at: t.at,
        records: t.groups.reduce((n: number, g: Group) => n + g.rows.length, 0),
      }))
      .sort((a, b) => b.at - a.at);
  });
  app.post('/api/trash/:id/restore', async (req: any) => {
    teacher(req);
    const entry = store.get('trash', req.params.id);
    if (!entry) throw fail('العنصر غير موجود', 404);
    if (!permitted(entry)) throw fail('تغيّرت صلاحيات الصفوف؛ اطلب من المدير استعادة العنصر', 403);
    for (const group of entry.groups) {
      if (!Object.hasOwn(columns, group.table)) throw fail('بنية محذوفات غير صالحة');
      for (const row of group.rows) {
        if (!columns[group.table].every((c) => Object.hasOwn(row, c)))
          throw fail('بنية محذوفات غير صالحة');
        if (
          tableExists(group.table) &&
          store.db.prepare(`SELECT id FROM ${group.table} WHERE id=?`).get(row.id)
        )
          throw fail('أُعيد استخدام أحد المعرّفات؛ لم تتم الاستعادة.');
        if (group.table === 'students' && usedCodes().has(JSON.parse(row.data).code))
          throw fail('أُعيد استخدام رمز الطالب. غيّر الرمز المتعارض قبل الاستعادة.');
      }
    }
    const existingCredentials = Object.values(
      store.getSetting('student-national-credentials') || {},
    ) as any[];
    if (
      (entry.settings || []).some((s: any) =>
        existingCredentials.some((c) => c.index === s.value?.index),
      )
    )
      throw fail('الهوية الوطنية مرتبطة الآن بطالب آخر؛ راجع الحسابات قبل الاستعادة.');
    store.db.transaction(() => {
      for (const group of entry.groups) {
        if (!group.rows.length) continue;
        if (group.table === 'archived_attempts')
          store.db.exec(
            'CREATE TABLE IF NOT EXISTS archived_attempts(id TEXT PRIMARY KEY,data TEXT NOT NULL)',
          );
        const fields = columns[group.table];
        for (const row of group.rows)
          store.db
            .prepare(
              `INSERT INTO ${group.table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
            )
            .run(...fields.map((c) => row[c]));
      }
      for (const s of entry.settings || []) {
        if (s.key !== 'student-national-credentials') throw fail('إعداد غير صالح');
        const value = store.getSetting(s.key) || {};
        Object.defineProperty(value, s.entry, {
          value: s.value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
        store.setSetting(s.key, value);
      }
      store.db.prepare('DELETE FROM trash WHERE id=?').run(entry.id);
      store.audit(`استعادة من المحذوفات: ${entry.kind}`);
    })();
    return { ok: true };
  });
  app.delete('/api/trash/:id', async (req: any) => {
    teacher(req);
    z.object({ confirm: z.literal(true) }).parse(req.body);
    const entry = store.get('trash', req.params.id);
    if (!entry || !permitted(entry)) throw fail('العنصر غير متاح', 404);
    store.db.prepare('DELETE FROM trash WHERE id=?').run(entry.id);
    store.audit(`حذف نهائي من المحذوفات: ${entry.kind}`);
    return { ok: true };
  });
  app.get('/api/records/catalog', async (req: any) => {
    teacher(req);
    return ['sources', 'assets'].flatMap((kind) =>
      store
        .all(kind)
        .map((row) => ({
          kind,
          id: row.id,
          title: row.name || (row.mediaKind === 'exam-audio' ? 'تسجيل صوتي' : 'رسم محفوظ'),
        })),
    );
  });
}
