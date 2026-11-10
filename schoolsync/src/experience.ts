import type { Role } from './types';
export const isSchoolRole = (role: Role) => role === 'teacher' || role === 'admin';
const familyViews = new Set([
  'today',
  'schedule',
  'homework',
  'grades',
  'attendance',
  'inbox',
  'notes',
  'you',
]);
const teacherViews = new Set(['dashboard', 'classes', 'classroom', 'schedule', 'inbox', 'you']);
export function homeFor(role: Role) {
  return isSchoolRole(role) ? 'dashboard' : 'today';
}
export function viewFor(role: Role, requested: string) {
  if (role === 'admin' && requested === 'management') return requested;
  return (isSchoolRole(role) ? teacherViews : familyViews).has(requested)
    ? requested
    : homeFor(role);
}
