import { z } from 'zod';
import { id, type Store } from './store';

const folderInput = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.enum(['blue', 'mint', 'violet', 'amber', 'rose']),
});
type Folder = z.infer<typeof folderInput> & { id: string; createdAt: number };
type Organization = { folders: Folder[]; examFolders: Record<string, string> };
const key = 'exam-organization';
const fail = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

export function registerExamFolders(app: any, store: Store, teacher: (request: any) => any) {
  // One tenant-scoped setting keeps folder moves atomic and includes them in existing backups.
  // Organization is separate from exam data so exam edits cannot overwrite folder moves.
  const read = (): Organization => store.getSetting(key) || { folders: [], examFolders: {} };
  const save = (value: Organization) => store.setSetting(key, value);
  const find = (value: Organization, folderId: string) => {
    const folder = value.folders.find((folder) => folder.id === folderId);
    if (!folder) throw fail('المجلد غير موجود', 404);
    return folder;
  };
  const unique = (value: Organization, name: string, except?: string) => {
    const normalized = (text: string) =>
      text.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();
    if (
      value.folders.some(
        (folder) => folder.id !== except && normalized(folder.name) === normalized(name),
      )
    )
      throw fail('يوجد مجلد بهذا الاسم', 409);
  };
  app.get('/api/exam-folders', async (req: any) => {
    teacher(req);
    return read();
  });
  app.post('/api/exam-folders', async (req: any) => {
    teacher(req);
    const input = folderInput.parse(req.body),
      value = read();
    if (value.folders.length >= 100) throw fail('الحد الأقصى 100 مجلد');
    unique(value, input.name);
    const folder = { ...input, id: id(), createdAt: Date.now() };
    value.folders.push(folder);
    save(value);
    return folder;
  });
  app.put('/api/exam-folders/:id', async (req: any) => {
    teacher(req);
    const input = folderInput.parse(req.body),
      value = read(),
      folder = find(value, req.params.id);
    unique(value, input.name, folder.id);
    Object.assign(folder, input);
    save(value);
    return folder;
  });
  app.delete('/api/exam-folders/:id', async (req: any) => {
    teacher(req);
    const value = read(),
      folder = find(value, req.params.id);
    value.folders = value.folders.filter((item) => item.id !== folder.id);
    for (const [examId, folderId] of Object.entries(value.examFolders))
      if (folderId === folder.id) delete value.examFolders[examId];
    save(value);
    return { ok: true };
  });
  app.put('/api/exams/move', async (req: any) => {
    teacher(req);
    const input = z
      .object({
        examIds: z.array(z.string().min(1).max(100)).min(1).max(500),
        folderId: z.string().min(1).max(100).nullable(),
      })
      .parse(req.body);
    const value = read();
    if (input.folderId) find(value, input.folderId);
    for (const examId of input.examIds)
      if (!store.get('exams', examId)) throw fail('الامتحان غير موجود', 404);
    for (const examId of input.examIds) {
      if (input.folderId) value.examFolders[examId] = input.folderId;
      else delete value.examFolders[examId];
    }
    save(value);
    return { ok: true };
  });
}
