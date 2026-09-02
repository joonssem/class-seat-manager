PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS school_year (
  school_year_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student (
  student_id TEXT PRIMARY KEY,
  school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id),
  student_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('남', '여')),
  enrollment_status TEXT NOT NULL CHECK (enrollment_status IN ('재학', '전출')),
  transfer_in_date TEXT,
  transfer_out_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (school_year_id, student_number)
);

CREATE TABLE IF NOT EXISTS classroom_layout (
  classroom_layout_id TEXT PRIMARY KEY,
  school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id),
  name TEXT NOT NULL,
  canvas_width REAL NOT NULL,
  canvas_height REAL NOT NULL,
  coordinate_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classroom_element (
  element_id TEXT PRIMARY KEY,
  classroom_layout_id TEXT NOT NULL REFERENCES classroom_layout(classroom_layout_id),
  element_type TEXT NOT NULL CHECK (element_type IN ('chalkboard', 'front-door', 'back-door', 'desk')),
  x REAL NOT NULL, y REAL NOT NULL, width REAL NOT NULL, height REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 0,
  position_override_json TEXT
);

CREATE TABLE IF NOT EXISTS seat (
  seat_id TEXT PRIMARY KEY,
  classroom_layout_id TEXT NOT NULL REFERENCES classroom_layout(classroom_layout_id),
  element_id TEXT NOT NULL UNIQUE REFERENCES classroom_element(element_id),
  seat_code TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  auto_position_tags_json TEXT NOT NULL,
  override_position_tags_json TEXT
);

CREATE TABLE IF NOT EXISTS seat_position_tag (
  seat_position_tag_id TEXT PRIMARY KEY,
  seat_id TEXT NOT NULL REFERENCES seat(seat_id),
  tag_key TEXT NOT NULL,
  tag_group TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('auto', 'manual')),
  weight REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS seating_session (
  seating_session_id TEXT PRIMARY KEY,
  school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id),
  classroom_layout_id TEXT NOT NULL REFERENCES classroom_layout(classroom_layout_id),
  sequence_no INTEGER NOT NULL,
  occurred_on TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed')),
  algorithm_version TEXT,
  seed INTEGER,
  score_summary_json TEXT,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  UNIQUE (school_year_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS seating_assignment (
  assignment_id TEXT PRIMARY KEY,
  seating_session_id TEXT NOT NULL REFERENCES seating_session(seating_session_id),
  student_id TEXT NOT NULL REFERENCES student(student_id),
  seat_id TEXT NOT NULL REFERENCES seat(seat_id),
  position_snapshot_json TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  student_number_snapshot INTEGER NOT NULL,
  UNIQUE (seating_session_id, student_id),
  UNIQUE (seating_session_id, seat_id)
);

CREATE INDEX IF NOT EXISTS idx_student_school_year ON student(school_year_id, enrollment_status);
CREATE INDEX IF NOT EXISTS idx_seating_session_school_year ON seating_session(school_year_id, status, sequence_no);
CREATE INDEX IF NOT EXISTS idx_assignment_student ON seating_assignment(student_id);
