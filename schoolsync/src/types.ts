/**
 * Domain TypeScript contracts shared across SchoolSync client modules.
 */
import type {
  CampusLayout,
  RoomKind,
  SpatialRoomRecord,
  TeacherPresenceRecord,
  WingId,
} from './spatial/engine/spatialTypes';

export type * from './spatial/engine/spatialTypes';

export type Role = 'student' | 'parent' | 'teacher' | 'assistant' | 'admin';
export type LayoutMode = 'auto' | 'phone' | 'tablet' | 'desktop';

export interface LoginRequest {
  portal: 'staff' | 'family';
  email?: string;
  nationalId?: string;
  password: string;
}

export const isSchoolRole = (role: Role): boolean =>
  role === 'teacher' || role === 'assistant' || role === 'admin';

export const isManagerRole = (role: Role): boolean => role === 'assistant' || role === 'admin';

export interface User {
  id: string;
  school_id: string;
  name: string;
  email: string;
  role: Role;
  section: string | null;
}

export interface School {
  id: string;
  name: string;
  timezone: string;
  start_time: string;
  end_time: string;
  period_minutes?: number;
  break_minutes?: number;
  period_count?: number;
  workdays?: string;
  duty_notes?: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  grade_level: string;
  location: string;
  room: string;
  sort_order?: number;
}

export interface SubjectItem {
  id: string;
  school_id: string;
  name: string;
  description: string;
  color: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  email: string;
  classes: string[];
  subjects: string[];
  wings?: WingId[];
}

export interface Student {
  id: string;
  school_id: string;
  user_id: string | null;
  name: string;
  section: string;
  initials: string;
  color: string;
  guardian_phone?: string;
  national_id?: string;
  has_account?: boolean;
  last_absence?: string | null;
  today_status?: 'present' | 'absent' | 'late' | 'excused' | null;
}

export interface Lesson {
  id: string;
  section: string;
  teacher_id: string;
  teacher: string;
  subject: string;
  room: string;
  weekday: number;
  start: string;
  end: string;
  color: string;
  period_number?: number;
}

export interface Homework {
  id: string;
  section: string;
  subject: string;
  title: string;
  description: string;
  due: string;
  color: string;
  teacher: string;
  submission: string | null;
}

export interface Grade {
  id: string;
  student_id: string;
  subject: string;
  title: string;
  score: number;
  max: number;
  published: number;
  date: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  lesson_id: string | null;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  subject: string;
  start: string;
}

export interface Incident {
  id: string;
  student_id: string;
  student_name: string;
  date: string;
  status: string;
  detail: string;
  resolution: string | null;
}

export interface Note {
  id: string;
  student_id: string;
  author: string;
  content: string;
  category?: 'behavior' | 'academic' | 'general';
  created: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created: string;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  read: number;
  created: string;
}

export interface State {
  user: User;
  school: School;
  date: string;
  students: Student[];
  student: Student | null;
  classes: SchoolClass[];
  subjects: SubjectItem[];
  teachers: TeacherProfile[];
  teacherWings?: WingId[];
  spatialRooms?: SpatialRoomRecord[];
  campusLayout?: CampusLayout | null;
  teacherPresence?: TeacherPresenceRecord[];
  lessons: Lesson[];
  homework: Homework[];
  grades: Grade[];
  attendance: Attendance[];
  incidents: Incident[];
  notes: Note[];
  announcements: Announcement[];
  notifications: Notification[];
  messages: unknown[];
  contacts: unknown[];
  accounts: { id: string; name: string; email: string; role: Role; section: string | null }[];
  rosterAttendance: Attendance[];
  familyAccess: { student_id: string; guardian_id: string; guardian_name: string }[];
  schoolWorkspace: {
    lessons: Lesson[];
    homework: { id: string; section: string; subject: string; title: string; due: string }[];
  } | null;
  demo: boolean;
}

export type { RoomKind };
