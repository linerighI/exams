import { z } from 'zod';
import type { Store } from './store';
const tool = z.enum([
  'writer',
  'calculator',
  'geometry',
  'equations',
  'units',
  'statistics',
  'blueprint',
  'rubric',
]);
export function registerWorkflow(
  app: any,
  store: Store,
  teacher: (req: any) => any,
  secure: boolean,
) {
  app.get('/api/security/status', async () => ({
    brand: 'Zunis',
    transport: secure ? 'https' : 'development-http',
    passwordHashing: 'scrypt',
    teacherAuthorization: true,
    studentLogoutAuthorization: true,
    checkedAt: new Date().toISOString(),
  }));
  app.get('/api/workspace', async (req: any) => {
    teacher(req);
    return (
      store.getSetting('workspace-layout') || {
        order: [],
        workflow: ['blueprint', 'writer', 'geometry'],
      }
    );
  });
  app.put('/api/workspace', async (req: any) => {
    teacher(req);
    const input = z
      .object({ order: z.array(tool).max(8), workflow: z.array(tool).max(8) })
      .parse(req.body);
    if (
      new Set(input.order).size !== input.order.length ||
      new Set(input.workflow).size !== input.workflow.length
    )
      throw Object.assign(Error('الأدوات مكررة في المسار'), { statusCode: 400 });
    store.setSetting('workspace-layout', input);
    return input;
  });
  app.get('/api/workspace/summary', async (req: any) => {
    teacher(req);
    const exams = store.all('exams'),
      attempts = store.all('attempts'),
      questions = store.all('bank_questions');
    return {
      students: store.all('students').length,
      books: store.all('books').length,
      questions: questions.length,
      ready: questions.filter((q: any) => q.status === 'approved' || q.approved === true).length,
      drafts: exams.filter((e: any) => e.status === 'draft').length,
      published: exams.filter((e: any) => e.status === 'published').length,
      active: attempts.filter((a: any) => !a.submittedAt).length,
      submitted: attempts.filter((a: any) => a.submittedAt).length,
      checkedAt: Date.now(),
    };
  });
}
