export type Snapshot = {
  reviewFlags?: string[];
  scope: string;
  studentId: string;
  attempt: any;
  questions: any[];
  exam: {
    title: string;
    total: number;
    calculatorAllowed?: boolean;
    geogebraAllowed?: boolean;
    appearance?: import('./examAppearance').ExamAppearance;
    audio?: import('./AudioAttachment').ExamAudio;
  };
  serverNow: number;
  offset: number;
  answers: Record<string, import('./questionFormats').Answer>;
  revisions: Record<string, number>;
  pending: Record<
    string,
    { questionId: string; choice: import('./questionFormats').Answer; revision: number }
  >;
  submitPending: boolean;
};
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('school-exams', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('attempts', { keyPath: 'attempt.id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveSnapshot(snapshot: Snapshot) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('attempts', 'readwrite');
    tx.objectStore('attempts').put(snapshot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export function selectSnapshot(
  all: Snapshot[],
  studentId: string,
  scope: string,
  filter: { examId?: string; attemptId?: string; includeExpired?: boolean } = {},
) {
  return all
    .filter(
      (s) =>
        s.scope === scope &&
        s.studentId === studentId &&
        !s.attempt.submittedAt &&
        (!filter.examId || s.attempt.examId === filter.examId) &&
        (!filter.attemptId || s.attempt.id === filter.attemptId) &&
        (filter.includeExpired || s.attempt.deadline > Date.now() + s.offset),
    )
    .sort((a, b) => b.attempt.startedAt - a.attempt.startedAt)[0];
}
export async function findSnapshot(
  studentId: string,
  scope: string,
  filter: { examId?: string; attemptId?: string; includeExpired?: boolean } = {},
) {
  const db = await open();
  const all = await new Promise<Snapshot[]>((resolve, reject) => {
    const request = db.transaction('attempts').objectStore('attempts').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return selectSnapshot(all, studentId, scope, filter);
}
