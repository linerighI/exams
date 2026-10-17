export type Snapshot = {
  reviewFlags?: string[];
  scope: string;
  studentId: string;
  attempt: any;
  questions: any[];
  exam: { title: string; total: number; calculatorAllowed?: boolean; geogebraAllowed?: boolean };
  serverNow: number;
  offset: number;
  answers: Record<string, number>;
  revisions: Record<string, number>;
  pending: Record<string, { questionId: string; choice: number; revision: number }>;
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
export async function findSnapshot(studentId: string, scope: string) {
  const db = await open();
  const all = await new Promise<Snapshot[]>((resolve, reject) => {
    const request = db.transaction('attempts').objectStore('attempts').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return all
    .filter((s) => s.scope === scope && s.studentId === studentId && !s.attempt.submittedAt)
    .sort((a, b) => b.attempt.startedAt - a.attempt.startedAt)[0];
}
