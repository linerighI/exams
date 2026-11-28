/**
 * Class Lead Teacher resolution helpers: resolves the true locked `مربي الصف`
 * from explicit `classes.lead_teacher_id` or `users.section` instead of alphabetical order.
 */
import type { State, TeacherProfile } from '../types';

/** Resolve the locked homeroom / lead teacher for a class (never hijacked alphabetically). */
export function resolveClassLeadTeacher(data: State | null, className: string): TeacherProfile | null {
  if (!data || !className) return null;
  const cls = data.classes.find((c) => c.name === className);
  if (cls?.lead_teacher_id) {
    const explicit = data.teachers.find((t) => t.id === cls.lead_teacher_id);
    if (explicit) return explicit;
  }
  return data.teachers.find((t) => t.homeroomSection === className) || null;
}

/** Return the locked Class Lead Teacher separately from other teachers assigned to the section. */
export function sortClassTeachers(
  data: State,
  className: string,
): { lead: TeacherProfile | null; others: TeacherProfile[] } {
  const lead = resolveClassLeadTeacher(data, className);
  const others = data.teachers.filter(
    (t) => t.classes.includes(className) && t.id !== lead?.id,
  );
  return { lead, others };
}
