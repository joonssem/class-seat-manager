ALTER TABLE seating_session ADD COLUMN semester INTEGER NOT NULL DEFAULT 2 CHECK (semester IN (1, 2));
CREATE INDEX IF NOT EXISTS idx_seating_session_semester ON seating_session(school_year_id, semester, sequence_no);
