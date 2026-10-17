import { z } from 'zod';
import { id, type Store } from './store';

const folderInput = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine((s) => !s.includes('\uFFFD'), 'صحّح اسم المجلد'),
  color: z.enum(['blue', 'mint', 'violet', 'amber', 'rose']),
});
type Folder = z.infer<typeof folderInput> & { id: string };
type Organization = { folders: Folder[]; questionFolders: Record<string, string> };
const fail = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export function registerBankOrganization(
  app: any,
  store: Store,
  teacher: (r: any) => any,
  validate: (q: any) => void,
) {
  const key = (bookId: string) => `bank-organization:${bookId}`;
  const book = (req: any) => {
    teacher(req);
    if (!store.get('books', req.params.id)) throw fail('البنك غير موجود', 404);
    return req.params.id as string;
  };
  const read = (bookId: string): Organization =>
    store.getSetting(key(bookId)) || { folders: [], questionFolders: {} };
  const folder = (state: Organization, folderId: string) => {
    const found = state.folders.find((f) => f.id === folderId);
    if (!found) throw fail('المجلد غير موجود', 404);
    return found;
  };
  const unique = (state: Organization, name: string, except?: string) => {
    const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();
    if (state.folders.some((f) => f.id !== except && norm(f.name) === norm(name)))
      throw fail('يوجد مجلد بهذا الاسم', 409);
  };
  app.get('/api/books/:id/organization', async (req: any) => read(book(req)));
  app.post('/api/books/:id/folders', async (req: any) => {
    const bookId = book(req),
      input = folderInput.parse(req.body),
      state = read(bookId);
    if (state.folders.length >= 100) throw fail('الحد الأقصى 100 مجلد');
    unique(state, input.name);
    const created = { ...input, id: id() };
    state.folders.push(created);
    store.setSetting(key(bookId), state);
    return created;
  });
  app.put('/api/books/:id/folders/:folderId', async (req: any) => {
    const bookId = book(req),
      input = folderInput.parse(req.body),
      state = read(bookId),
      found = folder(state, req.params.folderId);
    unique(state, input.name, found.id);
    Object.assign(found, input);
    store.setSetting(key(bookId), state);
    return found;
  });
  app.delete('/api/books/:id/folders/:folderId', async (req: any) => {
    const bookId = book(req),
      state = read(bookId),
      found = folder(state, req.params.folderId);
    state.folders = state.folders.filter((f) => f.id !== found.id);
    for (const [questionId, folderId] of Object.entries(state.questionFolders))
      if (folderId === found.id) delete state.questionFolders[questionId];
    store.setSetting(key(bookId), state);
    return { ok: true };
  });
  app.post('/api/books/:id/questions/bulk', async (req: any) => {
    const bookId = book(req);
    const input = z
      .object({
        ids: z.array(z.string().min(1).max(100)).min(1).max(500),
        action: z.enum(['approve', 'draft', 'delete', 'move']),
        folderId: z.string().max(100).nullable().optional(),
      })
      .parse(req.body);
    const ids = [...new Set(input.ids)],
      state = read(bookId);
    const questions = ids.map((qid) => store.get('bank_questions', qid));
    if (questions.some((q) => !q || q.bookId !== bookId))
      throw fail('بعض الأسئلة غير موجودة في هذا البنك. حدّث القائمة.', 404);
    if (input.action === 'move') {
      if (input.folderId === undefined) throw fail('اختر المجلد الوجهة');
      if (input.folderId) folder(state, input.folderId);
    }
    if (input.action === 'approve')
      for (const q of questions) {
        validate(q);
        if (q.requiresImage && !q.image)
          throw fail('يتضمن التحديد سؤالًا يحتاج صورة. أرفق الصورة قبل الاعتماد.');
        if (
          [q.text, q.chapter, q.explanation, ...q.options].some((s: string) => s.includes('\uFFFD'))
        )
          throw fail('يتضمن التحديد نصًا تالفًا. صحّح النص قبل الاعتماد.');
      }
    store.db.transaction(() => {
      for (const q of questions) {
        if (input.action === 'delete') {
          store.db.prepare('DELETE FROM bank_questions WHERE id=?').run(q.id);
          delete state.questionFolders[q.id];
        } else if (input.action === 'move') {
          if (input.folderId) state.questionFolders[q.id] = input.folderId;
          else delete state.questionFolders[q.id];
        } else {
          q.status = input.action === 'approve' ? 'approved' : 'draft';
          if (input.action === 'approve') q.cropWarning = undefined;
          store.db
            .prepare('UPDATE bank_questions SET data=? WHERE id=?')
            .run(JSON.stringify(q), q.id);
        }
      }
      if (input.action === 'move' || input.action === 'delete')
        store.setSetting(key(bookId), state);
      store.audit(`bank:${bookId}:${input.action}:${ids.length}`);
    })();
    return { count: ids.length };
  });
  app.put('/api/books/:id/chapter', async (req: any) => {
    const bookId = book(req);
    const input = z
      .object({
        previous: z.string().max(2000),
        name: z
          .string()
          .trim()
          .min(1)
          .max(2000)
          .refine((s) => !s.includes('\uFFFD'), 'صحّح اسم الفصل'),
      })
      .parse(req.body);
    const questions = store
      .all('bank_questions')
      .filter((q) => q.bookId === bookId && q.chapter === input.previous);
    if (!questions.length) throw fail('الفصل غير موجود', 404);
    store.db.transaction(() => {
      for (const q of questions)
        store.db
          .prepare('UPDATE bank_questions SET data=? WHERE id=?')
          .run(JSON.stringify({ ...q, chapter: input.name }), q.id);
    })();
    return { count: questions.length };
  });
}
