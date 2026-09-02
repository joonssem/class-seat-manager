import type { LeadershipRepository } from "../../application/leadership-service";
interface Statement { all(...params: unknown[]): Record<string, unknown>[]; run(...params: unknown[]): void; }
interface SqliteDatabase { prepare(sql: string): Statement; exec(sql: string): void; }
export class SqliteLeadershipRepository implements LeadershipRepository {
  constructor(private readonly database: SqliteDatabase) {}
  list(schoolYearId: string, semester: number): string[] { return this.database.prepare("SELECT student_id FROM semester_leadership WHERE school_year_id = ? AND semester = ? AND is_cafeteria_marshal = 1 ORDER BY student_id").all(schoolYearId, semester).map((row) => String(row.student_id)); }
  replace(schoolYearId: string, semester: number, studentIds: string[]): void { const now = new Date().toISOString(); this.database.exec("BEGIN"); try { this.database.prepare("DELETE FROM semester_leadership WHERE school_year_id = ? AND semester = ?").run(schoolYearId, semester); const insert = this.database.prepare("INSERT INTO semester_leadership (leadership_id, school_year_id, semester, student_id, role, is_cafeteria_marshal) VALUES (?, ?, ?, ?, ?, 1)"); studentIds.forEach((studentId, index) => insert.run(crypto.randomUUID(), schoolYearId, semester, studentId, index === 0 ? "president" : "vice-president")); this.database.exec("COMMIT"); } catch (error) { this.database.exec("ROLLBACK"); throw error; } }
}
