/**
 * Shared TypeScript contracts for the Master School Schedule matrix, live timing config,
 * teacher absence tracking, and saved schedule profiles.
 */
import type { Lesson } from '../types';

export interface ScheduleLessonItem extends Lesson {
  period_number?: number;
  status?: 'active' | 'canceled';
  teacher_absent?: number;
}

export interface ScheduleTeacherItem {
  id: string;
  name: string;
  email: string;
  section: string | null;
  is_absent?: number;
}

export interface ScheduleProfileItem {
  id: string;
  name: string;
  created_at: string;
}

export interface ScheduleOverview {
  weekday: number;
  school: {
    start_time: string;
    end_time: string;
    timezone: string;
    period_minutes: number;
    break_minutes: number;
    period_count: number;
    schedule_mode: 'manual' | 'auto';
    active_period: number | null;
    duty_notes: string;
  };
  slots: { periodNumber: number; start: string; end: string }[];
  classes: { id: string; name: string; grade_level: string; room: string }[];
  teachers: ScheduleTeacherItem[];
  leadTeachers: Record<string, { id: string; name: string }>;
  lessons: ScheduleLessonItem[];
  profiles: ScheduleProfileItem[];
}
