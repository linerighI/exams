import Database from 'better-sqlite3';
import { AsyncLocalStorage } from 'node:async_hooks';
import { join } from 'node:path';
import { openStore, hashPassword, verifyPassword, id, type Store } from './store';
import { gradeKey, sectionKey, classId } from './classMatch';
export type TeacherAccount = {
  id: string;
  username: string;
  name: string;
  password: string;
  isAdmin: boolean;
  disabled: boolean;
  grades?: string[];
  classes?: { id: string; grade: string; section: string }[];
};
export const accountView = ({ password, ...account }: TeacherAccount) => account;
export function openTenantStores(directory: string) {
  const primary = openStore(directory);
  const registry = new Database(join(directory, 'teachers.sqlite'));
  registry.exec(
    'CREATE TABLE IF NOT EXISTS teachers(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,data TEXT NOT NULL)',
  );
  const scope = new AsyncLocalStorage<string>();
  const stores = new Map<string, Store>([['master', primary]]);
  const accounts = () =>
    (registry.prepare('SELECT data FROM teachers').all() as any[]).map(
      (row) => JSON.parse(row.data) as TeacherAccount,
    );
  const account = (key: string) => accounts().find((a) => a.id === key);
  const save = (a: TeacherAccount) =>
    registry
      .prepare(
        'INSERT INTO teachers VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,data=excluded.data',
      )
      .run(a.id, a.username, JSON.stringify(a));
  if (!accounts().length && primary.getSetting('password'))
    save({
      id: 'master',
      username: 'admin',
      name: 'المعلم المسؤول',
      password: primary.getSetting('password'),
      isAdmin: true,
      disabled: false,
    });
  const current = () => scope.getStore() || 'master';
  const allowed = (key: string, grade: string, section?: string) => {
    const a = account(key);
    return (
      !!a &&
      (a.isAdmin ||
        (typeof grade === 'string' &&
          !!a.classes?.some(
            (c) =>
              gradeKey(c.grade) === gradeKey(grade) &&
              (!section || sectionKey(c.section) === sectionKey(section)),
          )))
    );
  };
  const checkGrade = (key: string, grade: string, section?: string) => {
    if (!allowed(key, grade, section))
      throw Object.assign(
        new Error('هذا الصف غير مسند إلى حسابك. اطلب من مدير الحسابات إسناده إليك.'),
        { statusCode: 403 },
      );
  };
  const forTeacher = (key: string) => {
    let value = stores.get(key);
    if (!value) {
      if (!account(key)) throw Error('حساب غير موجود');
      value = openStore(join(directory, 'teachers', key));
      value.setSetting('config', {
        ...value.getSetting('config'),
        school: primary.getSetting('config').school,
      });
      for (const job of value.all('book_jobs'))
        if (job.status === 'running') {
          job.status = 'paused';
          job.message = 'توقفت المعالجة عند إغلاق البرنامج';
          value.put('book_jobs', job);
        }
      stores.set(key, value);
    }
    return value;
  };
  const store = new Proxy(primary, {
    get(_target, key) {
      if (key === 'tenantId') return current;
      const own = forTeacher(current());
      const visible = (table: string, row: any): boolean => {
        if (!row) return true;
        if (table === 'students' || table === 'exams')
          return allowed(current(), row.grade, row.section);
        if (table === 'attempts' || table === 'archived_attempts') {
          const exam = own.get('exams', row.examId),
            student = own.get('students', row.studentId);
          return (
            !!exam &&
            !!student &&
            allowed(current(), exam.grade, exam.section) &&
            allowed(current(), student.grade, student.section)
          );
        }
        return true;
      };
      if (key === 'all')
        return (table: string) => own.all(table).filter((row) => visible(table, row));
      if (key === 'get')
        return (table: string, id: string) => {
          const row = own.get(table, id);
          if (!visible(table, row))
            throw Object.assign(new Error('هذا الصف غير مسند إلى حسابك'), { statusCode: 403 });
          return row;
        };
      if (key === 'put')
        return (table: string, row: any) => {
          // Check both original and destination grade, so guessing an ID cannot overwrite hidden records.
          if (!visible(table, own.get(table, row.id)) || !visible(table, row))
            throw Object.assign(new Error('هذا الصف غير مسند إلى حسابك. راجع مدير الحسابات.'), {
              statusCode: 403,
            });
          return own.put(table, row);
        };
      return Reflect.get(own, key);
    },
  }) as Store;
  const create = (
    username: string,
    name: string,
    password: string,
    isAdmin = false,
    classes: { id: string; grade: string; section: string }[] = [],
  ) => {
    username = username.normalize('NFKC').trim().toLowerCase();
    if (accounts().some((a) => a.username === username))
      throw Object.assign(new Error('اسم المستخدم مستخدم بالفعل'), { statusCode: 409 });
    const a: TeacherAccount = {
      id: accounts().length ? id() : 'master',
      username,
      name,
      password: hashPassword(password),
      isAdmin,
      disabled: false,
      ...(!isAdmin ? { classes } : {}),
    };
    save(a);
    const own = forTeacher(a.id);
    own.setSetting('password', a.password);
    return a;
  };
  // Preserve existing classes during upgrade, without granting every other grade.
  for (const a of accounts())
    if (!a.isAdmin && a.classes === undefined) {
      const own = forTeacher(a.id);
      const existing = new Map<string, { id: string; grade: string; section: string }>();
      for (const row of own.all('students'))
        if (
          typeof row.grade === 'string' &&
          typeof row.section === 'string' &&
          (!a.grades || a.grades.includes(gradeKey(row.grade)))
        ) {
          const id = classId(row.grade, row.section);
          existing.set(id, { id, grade: row.grade, section: row.section });
        }
      a.classes = [...existing.values()];
      delete a.grades;
      save(a);
    }
  const classes = () => {
    const groups = new Map<string, { id: string; grade: string; section: string; count: number }>();
    for (const a of accounts())
      for (const student of forTeacher(a.id).all('students')) {
        if (typeof student.grade !== 'string' || typeof student.section !== 'string') continue;
        const id = classId(student.grade, student.section),
          group = groups.get(id);
        if (group) group.count++;
        else groups.set(id, { id, grade: student.grade, section: student.section, count: 1 });
      }
    return [...groups.values()].sort(
      (a, b) =>
        a.grade.localeCompare(b.grade, 'ar', { numeric: true }) ||
        a.section.localeCompare(b.section, 'ar'),
    );
  };
  return {
    store,
    accounts,
    account,
    save,
    allowed,
    checkGrade,
    classes,
    create,
    current,
    forTeacher,
    run: <T>(key: string, fn: () => T) => scope.run(key, fn),
    verify: (username: string, password: string) => {
      const a = accounts().find(
        (a) => a.username === username.normalize('NFKC').trim().toLowerCase(),
      );
      return a && !a.disabled && verifyPassword(password, a.password) ? a : undefined;
    },
    close: () => {
      for (const s of stores.values()) s.db.close();
      registry.close();
    },
  };
}
