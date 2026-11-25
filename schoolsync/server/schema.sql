PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schools(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Amman',
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '14:30',
  period_minutes INTEGER NOT NULL DEFAULT 45,
  break_minutes INTEGER NOT NULL DEFAULT 5,
  period_count INTEGER NOT NULL DEFAULT 8,
  workdays TEXT NOT NULL DEFAULT '0,1,2,3,4',
  duty_notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','parent','teacher','assistant','admin')),
  section TEXT
);
CREATE TABLE IF NOT EXISTS classes(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(school_id, name)
);
CREATE TABLE IF NOT EXISTS subjects(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'blue',
  UNIQUE(school_id, name)
);
CREATE TABLE IF NOT EXISTS teacher_classes(
  school_id TEXT NOT NULL REFERENCES schools(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  class_name TEXT NOT NULL,
  PRIMARY KEY(teacher_id, class_name)
);
CREATE TABLE IF NOT EXISTS teacher_subjects(
  school_id TEXT NOT NULL REFERENCES schools(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  PRIMARY KEY(teacher_id, subject)
);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS students(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  initials TEXT NOT NULL,
  color TEXT NOT NULL,
  guardian_phone TEXT NOT NULL DEFAULT '',
  national_id TEXT NOT NULL DEFAULT '',
  national_id_hash TEXT
);
CREATE TABLE IF NOT EXISTS guardian_links(guardian_id TEXT NOT NULL REFERENCES users(id),student_id TEXT NOT NULL REFERENCES students(id),PRIMARY KEY(guardian_id,student_id));
CREATE TABLE IF NOT EXISTS lessons(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  section TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  room TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  color TEXT NOT NULL,
  period_number INTEGER NOT NULL DEFAULT 1,
  CHECK(start<end)
);
CREATE TABLE IF NOT EXISTS homework(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),section TEXT NOT NULL,teacher_id TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,due TEXT NOT NULL,color TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS submissions(homework_id TEXT NOT NULL REFERENCES homework(id),student_id TEXT NOT NULL REFERENCES students(id),content TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(homework_id,student_id));
CREATE TABLE IF NOT EXISTS grades(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),student_id TEXT NOT NULL REFERENCES students(id),teacher_id TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,title TEXT NOT NULL,score REAL NOT NULL,max REAL NOT NULL,published INTEGER NOT NULL DEFAULT 0,date TEXT NOT NULL,CHECK(score>=0 AND score<=max AND max>0));
CREATE TABLE IF NOT EXISTS attendance(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),student_id TEXT NOT NULL REFERENCES students(id),lesson_id TEXT NOT NULL REFERENCES lessons(id),date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),recorded_by TEXT NOT NULL REFERENCES users(id),UNIQUE(student_id,lesson_id,date));
CREATE TABLE IF NOT EXISTS daily_attendance(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('present','absent','late','excused')),
  label TEXT NOT NULL DEFAULT 'الحضور اليومي',
  lesson_id TEXT REFERENCES lessons(id),
  recorded_by TEXT NOT NULL REFERENCES users(id),
  updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, date)
);
CREATE TABLE IF NOT EXISTS incidents(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),student_id TEXT NOT NULL REFERENCES students(id),date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','investigating','resolved')),detail TEXT NOT NULL,resolution TEXT,UNIQUE(student_id,date));
CREATE TABLE IF NOT EXISTS incident_events(id TEXT PRIMARY KEY,incident_id TEXT NOT NULL REFERENCES incidents(id),actor_id TEXT NOT NULL REFERENCES users(id),detail TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),student_id TEXT NOT NULL REFERENCES students(id),author_id TEXT NOT NULL REFERENCES users(id),content TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'general',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),sender_id TEXT NOT NULL REFERENCES users(id),recipient_id TEXT NOT NULL REFERENCES users(id),content TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS announcements(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),author_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,content TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,content TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),actor_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS family_credentials(student_id TEXT PRIMARY KEY REFERENCES students(id),school_id TEXT NOT NULL REFERENCES schools(id),guardian_id TEXT NOT NULL REFERENCES users(id),national_id_hash TEXT NOT NULL UNIQUE,code_hash TEXT NOT NULL,updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS lesson_school_section ON lessons(school_id,section,weekday,start);
CREATE INDEX IF NOT EXISTS attendance_student_date ON attendance(student_id,date);
CREATE INDEX IF NOT EXISTS daily_attendance_school_date ON daily_attendance(school_id,date,student_id);
CREATE INDEX IF NOT EXISTS notification_user ON notifications(user_id,created);
CREATE TABLE IF NOT EXISTS spatial_rooms(
  school_id TEXT NOT NULL REFERENCES schools(id),
  slot_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'classroom',
  class_name TEXT NOT NULL DEFAULT '',
  wing TEXT NOT NULL DEFAULT 'west-main',
  PRIMARY KEY(school_id, slot_id)
);
CREATE TABLE IF NOT EXISTS teacher_wings(
  school_id TEXT NOT NULL REFERENCES schools(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  wing TEXT NOT NULL,
  PRIMARY KEY(teacher_id, wing)
);
CREATE TABLE IF NOT EXISTS campus_layouts(
  school_id TEXT NOT NULL REFERENCES schools(id),
  status TEXT NOT NULL CHECK(status IN ('draft','published')),
  version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(school_id, status)
);
CREATE TABLE IF NOT EXISTS campus_geo_anchors(
  school_id TEXT PRIMARY KEY REFERENCES schools(id),
  origin_lat REAL NOT NULL,
  origin_lng REAL NOT NULL,
  bearing_deg REAL NOT NULL DEFAULT 0,
  scale REAL NOT NULL DEFAULT 1,
  geofence_radius_m REAL NOT NULL DEFAULT 250,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS campus_beacons(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  room_id TEXT NOT NULL,
  floor_id TEXT NOT NULL,
  beacon_type TEXT NOT NULL CHECK(beacon_type IN ('qr','nfc','wifi','ble')),
  identifier TEXT NOT NULL,
  rssi_ref REAL NOT NULL DEFAULT -60,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  z REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS teacher_presence(
  teacher_id TEXT PRIMARY KEY REFERENCES users(id),
  school_id TEXT NOT NULL REFERENCES schools(id),
  room_id TEXT,
  floor_id TEXT,
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  z REAL NOT NULL DEFAULT 0,
  lat REAL,
  lng REAL,
  accuracy_m REAL,
  source TEXT NOT NULL DEFAULT 'schedule',
  confidence REAL NOT NULL DEFAULT 0.35,
  status TEXT NOT NULL DEFAULT 'offline',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS teacher_location_history(
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  room_id TEXT,
  floor_id TEXT,
  x REAL NOT NULL DEFAULT 0,
  z REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_teacher_history ON teacher_location_history(school_id, teacher_id, recorded_at);
