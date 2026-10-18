import Database from 'better-sqlite3';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Settings } from '../src/types';
export const id = () => randomBytes(16).toString('hex');
export const code = () => randomBytes(6).toString('hex').toUpperCase();
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(':');
  const candidate = scryptSync(password, salt, 64);
  return timingSafeEqual(candidate, Buffer.from(key, 'hex'));
}
export function openStore(directory: string) {
  mkdirSync(directory, { recursive: true });
  const db = new Database(join(directory, 'school.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  for (const table of ['books', 'bank_questions', 'book_jobs', 'assets', 'conversations', 'trash']) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table}(id TEXT PRIMARY KEY,data TEXT NOT NULL)`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY, data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS exams(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,examId TEXT NOT NULL,studentId TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(examId,studentId));
 CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,attemptId TEXT NOT NULL,createdAt INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS camera_requests(id TEXT PRIMARY KEY,attemptId TEXT NOT NULL,state TEXT NOT NULL,createdAt INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,createdAt INTEGER NOT NULL,event TEXT NOT NULL);`);
  db.exec(
    "CREATE INDEX IF NOT EXISTS attempt_deadline ON attempts(json_extract(data,'$.deadline')) WHERE json_extract(data,'$.submittedAt') IS NULL",
  );
  db.exec('CREATE INDEX IF NOT EXISTS attempt_student ON attempts(studentId)');
  const defaults: Settings = {
    school: 'مدرسة محمد الشريقي',
    retentionDays: 30,
    model: 'qwen3:1.7b',
    pythonPath: '',
    aiProvider: 'ollama',
    openaiModel: 'gpt-4.1-mini',
    geminiModel: 'gemini-3.8-flash',
    localSpeed: 'fast',
  };
  const getSetting = (key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any;
    return row ? JSON.parse(row.value) : null;
  };
  const setSetting = (key: string, value: unknown) =>
    db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(value));
  setSetting('config', { ...defaults, ...(getSetting('config') || {}) });
  const all = (table: string) =>
    (db.prepare(`SELECT data FROM ${table}`).all() as any[]).map((r) => JSON.parse(r.data));
  // Filter in SQLite before reading potentially large embedded question images.
  const attemptsFor = (studentId?: string, examId?: string) => {
    const clauses = [
      studentId !== undefined ? 'studentId=?' : '',
      examId !== undefined ? 'examId=?' : '',
    ].filter(Boolean);
    return (
      db
        .prepare(
          `SELECT data FROM attempts${clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''}`,
        )
        .all(...[studentId, examId].filter((v) => v !== undefined)) as any[]
    ).map((row) => JSON.parse(row.data));
  };
  const get = (table: string, key: string) => {
    const row = db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(key) as any;
    return row ? JSON.parse(row.data) : null;
  };
  const put = (table: string, value: any) => {
    if (table === 'attempts')
      db.prepare('INSERT OR REPLACE INTO attempts VALUES (?,?,?,?)').run(
        value.id,
        value.examId,
        value.studentId,
        JSON.stringify(value),
      );
    else
      db.prepare(`INSERT OR REPLACE INTO ${table} VALUES (?,?)`).run(
        value.id,
        JSON.stringify(value),
      );
  };
  const audit = (event: string) =>
    db.prepare('INSERT INTO audit VALUES (?,?,?)').run(id(), Date.now(), event);
  return {
    db,
    directory,
    getSetting,
    setSetting,
    all,
    get,
    put,
    audit,
    attemptsFor,
    tenantId: () => 'master',
  };
}
export type Store = ReturnType<typeof openStore>;
