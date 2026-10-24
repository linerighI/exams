import type { Session } from './types';
export const LANDING_KEY = 'school-first-launch:v1';
export const ROLE_KEY = 'school-preferred-role:v1';
type StorageRead = Pick<Storage, 'getItem'>;
export function readPreference(storage: StorageRead, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
export function landingRequired(storage: StorageRead) {
  return readPreference(storage, LANDING_KEY) !== 'seen';
}
export function preferredRole(storage: StorageRead): Session['role'] {
  return readPreference(storage, ROLE_KEY) === 'student' ? 'student' : 'teacher';
}
export function introductionKey(session: Session, school: string) {
  return [
    'school-introduction',
    'v1',
    school,
    session.role,
    session.teacherId || 'master',
    session.role === 'student'
      ? session.student?.id || 'unknown'
      : session.teacher?.id || session.teacherId || 'master',
  ]
    .map(encodeURIComponent)
    .join(':');
}
export function introductionRequired(storage: StorageRead, session: Session, school: string) {
  return readPreference(storage, introductionKey(session, school)) !== 'seen';
}
export function rememberOnboarding(key: string, value = 'seen') {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* The current screen still advances when storage is unavailable. */
  }
}
