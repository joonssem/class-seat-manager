CREATE TABLE IF NOT EXISTS student_seat_constraint (
  constraint_id TEXT PRIMARY KEY,
  school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id),
  student_id TEXT NOT NULL REFERENCES student(student_id),
  tag_key TEXT NOT NULL,
  expected_value TEXT NOT NULL,
  strength TEXT NOT NULL CHECK (strength IN ('필수', '가급적', '선호')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS student_pair_constraint (
  pair_constraint_id TEXT PRIMARY KEY,
  school_year_id TEXT NOT NULL REFERENCES school_year(school_year_id),
  student_a_id TEXT NOT NULL REFERENCES student(student_id), student_b_id TEXT NOT NULL REFERENCES student(student_id),
  relation_type TEXT NOT NULL CHECK (relation_type IN ('바로 인접 금지', '최소 거리', '가능한 한 멀리')),
  min_distance REAL, strength TEXT NOT NULL CHECK (strength IN ('필수', '가급적', '선호')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)), note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (student_a_id <> student_b_id)
);
CREATE INDEX IF NOT EXISTS idx_seat_constraint_year ON student_seat_constraint(school_year_id, student_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pair_constraint_year ON student_pair_constraint(school_year_id, is_active);
