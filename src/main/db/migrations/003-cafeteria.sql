CREATE TABLE IF NOT EXISTS cafeteria_layout (
  cafeteria_layout_id TEXT PRIMARY KEY, school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id),
  seat_count INTEGER NOT NULL DEFAULT 22, rows INTEGER NOT NULL DEFAULT 2, seats_per_row INTEGER NOT NULL DEFAULT 11,
  teacher_seat_json TEXT NOT NULL, seat_geometry_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cafeteria_session (
  cafeteria_session_id TEXT PRIMARY KEY, school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id),
  semester INTEGER NOT NULL CHECK (semester IN (1, 2)), sequence_no INTEGER NOT NULL, occurred_on TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed')), seed INTEGER, created_at TEXT NOT NULL, confirmed_at TEXT,
  UNIQUE (school_year_id, semester, sequence_no)
);
CREATE TABLE IF NOT EXISTS cafeteria_assignment (
  assignment_id TEXT PRIMARY KEY, cafeteria_session_id TEXT NOT NULL REFERENCES cafeteria_session(cafeteria_session_id),
  student_id TEXT NOT NULL REFERENCES student(student_id), queue_order INTEGER NOT NULL, cafeteria_seat_id TEXT NOT NULL, role TEXT,
  UNIQUE (cafeteria_session_id, student_id), UNIQUE (cafeteria_session_id, cafeteria_seat_id)
);
CREATE TABLE IF NOT EXISTS semester_leadership (
  leadership_id TEXT PRIMARY KEY, school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id), semester INTEGER NOT NULL,
  student_id TEXT NOT NULL REFERENCES student(student_id), role TEXT NOT NULL CHECK (role IN ('president', 'vice-president')),
  starts_on TEXT, ends_on TEXT, is_cafeteria_marshal INTEGER NOT NULL DEFAULT 0 CHECK (is_cafeteria_marshal IN (0, 1))
);
