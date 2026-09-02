import type { ConstraintSet, ConstraintWriteRepository } from "../../application/constraint-service";
interface Statement { run(...params: unknown[]): void; }
interface SqliteDatabase { prepare(sql: string): Statement; exec(sql: string): void; }
export class SqliteConstraintWriteRepository implements ConstraintWriteRepository {
  constructor(private readonly database: SqliteDatabase) {}
  replace(schoolYearId: string, set: ConstraintSet): void {
    const now = new Date().toISOString(); this.database.exec("BEGIN");
    try {
      this.database.prepare("DELETE FROM student_seat_constraint WHERE school_year_id = ?").run(schoolYearId); this.database.prepare("DELETE FROM student_pair_constraint WHERE school_year_id = ?").run(schoolYearId);
      const seat = this.database.prepare("INSERT INTO student_seat_constraint (constraint_id, school_year_id, student_id, tag_key, expected_value, strength, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)");
      set.seat.forEach((item) => seat.run(crypto.randomUUID(), schoolYearId, item.studentId, item.tag, String(item.expected ?? true), item.strength, now, now));
      const pair = this.database.prepare("INSERT INTO student_pair_constraint (pair_constraint_id, school_year_id, student_a_id, student_b_id, relation_type, min_distance, strength, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)");
      set.pairs.forEach((item) => pair.run(crypto.randomUUID(), schoolYearId, item.studentAId, item.studentBId, item.type, item.minDistance ?? null, item.strength, now, now));
      this.database.exec("COMMIT");
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
}
