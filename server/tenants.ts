import Database from 'better-sqlite3';
import { AsyncLocalStorage } from 'node:async_hooks';
import { join } from 'node:path';
import { openStore, hashPassword, verifyPassword, id, type Store } from './store';
export type TeacherAccount = {
  id: string;
  username: string;
  name: string;
  password: string;
  isAdmin: boolean;
  disabled: boolean;
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
      return Reflect.get(forTeacher(current()), key);
    },
  }) as Store;
  const create = (username: string, name: string, password: string, isAdmin = false) => {
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
    };
    save(a);
    const own = forTeacher(a.id);
    own.setSetting('password', a.password);
    return a;
  };
  return {
    store,
    accounts,
    account,
    save,
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
