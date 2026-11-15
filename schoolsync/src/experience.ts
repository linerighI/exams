/**
 * Strict role-based screen routing helpers separating family and school spaces.
 */
import type { Role } from './types';

export const isSchoolRole = (role: Role): boolean =>
  role === 'teacher' || role === 'assistant' || role === 'admin';

export const isManagerRole = (role: Role): boolean => role === 'assistant' || role === 'admin';

const familyViews = new Set([
  'today',
  'schedule',
  'homework',
  'grades',
  'attendance',
  'alerts',
  'notes',
  'you',
]);

const teacherViews = new Set([
  'dashboard',
  'students',
  'student-profile',
  'schedule',
  'alerts',
  'classroom',
  'you',
]);

export function homeFor(role: Role): string {
  return isSchoolRole(role) ? 'dashboard' : 'today';
}

export function viewFor(role: Role, requested: string): string {
  if (isManagerRole(role) && requested === 'management') return requested;
  return (isSchoolRole(role) ? teacherViews : familyViews).has(requested)
    ? requested
    : homeFor(role);
}
