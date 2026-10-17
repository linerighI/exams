import { z } from 'zod';
import { id, type Store } from './store';

const folderInput = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.enum(['blue', 'mint', 'violet', 'amber', 'rose']),
});
type Folder = z.infer<typeof folderInput> & { id: string; createdAt: number };
type Organization = { folders: Folder[]; bookFolders: Record<string, string> };
const key = 'library-organization';
const fail = (message: string, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

export function registerLibraryFolders(app: any, store: Store, teacher: (request: any) => any) {
  // One tenant-scoped setting keeps folder moves atomic and includes them in existing backups.
  // It is separate from book data so asynchronous OCR/import jobs cannot overwrite organization.
  const read = (): Organization => store.getSetting(key) || { folders: [], bookFolders: {} };
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
  app.get('/api/library/folders', async (req: any) => {
    teacher(req);
    return read();
  });
  app.post('/api/library/folders', async (req: any) => {
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
  app.put('/api/library/folders/:id', async (req: any) => {
    teacher(req);
    const input = folderInput.parse(req.body),
      value = read(),
      folder = find(value, req.params.id);
    unique(value, input.name, folder.id);
    Object.assign(folder, input);
    save(value);
    return folder;
  });
  app.delete('/api/library/folders/:id', async (req: any) => {
    teacher(req);
    const value = read(),
      folder = find(value, req.params.id);
    value.folders = value.folders.filter((item) => item.id !== folder.id);
    for (const [bookId, folderId] of Object.entries(value.bookFolders))
      if (folderId === folder.id) delete value.bookFolders[bookId];
    save(value);
    return { ok: true };
  });
  app.put('/api/library/move', async (req: any) => {
    teacher(req);
    const input = z
      .object({
        bookIds: z.array(z.string().min(1).max(100)).min(1).max(500),
        folderId: z.string().min(1).max(100).nullable(),
      })
      .parse(req.body);
    const value = read();
    if (input.folderId) find(value, input.folderId);
    for (const bookId of input.bookIds)
      if (!store.get('books', bookId)) throw fail('الكتاب غير موجود', 404);
    for (const bookId of input.bookIds) {
      if (input.folderId) value.bookFolders[bookId] = input.folderId;
      else delete value.bookFolders[bookId];
    }
    save(value);
    return { ok: true };
  });
}
