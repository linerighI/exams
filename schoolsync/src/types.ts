export type Role = 'student' | 'parent' | 'teacher' | 'admin';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  section: string | null;
}
export interface Student {
  id: string;
  name: string;
  section: string;
  initials: string;
  color: string;
  user_id: string | null;
}
export interface Lesson {
  teacher_id: string;
  id: string;
  subject: string;
  start: string;
  end: string;
  room: string;
  color: string;
  teacher: string;
  weekday: number;
  section: string;
}
export interface Homework {
  id: string;
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
  subject: string;
  title: string;
  score: number;
  max: number;
  date: string;
  published: number;
}
export interface Attendance {
  id: string;
  lesson_id: string;
  student_id: string;
  date: string;
  status: string;
  subject: string;
  start: string;
}
export interface Incident {
  id: string;
  student_name: string;
  status: string;
  detail: string;
  resolution: string | null;
  date: string;
}
export interface Note {
  id: string;
  author: string;
  content: string;
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
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender: string;
  content: string;
  created: string;
}
export interface State {
  user: User;
  school: { name: string; timezone: string; start_time: string; end_time: string };
  date: string;
  students: Student[];
  student: Student | null;
  lessons: Lesson[];
  homework: Homework[];
  grades: Grade[];
  attendance: Attendance[];
  incidents: Incident[];
  notes: Note[];
  announcements: Announcement[];
  notifications: Notification[];
  messages: Message[];
  contacts: { id: string; name: string; role: Role }[];
  accounts: { id: string; name: string; email: string; role: Role; section: string | null }[];
  rosterAttendance: Attendance[];
  familyAccess: { student_id: string; guardian_id: string; guardian_name: string }[];
  schoolWorkspace: {
    lessons: Lesson[];
    homework: { id: string; section: string; subject: string; title: string; due: string }[];
  } | null;
  demo: boolean;
}
