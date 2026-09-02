import type { StudentPairConstraint, StudentSeatConstraint } from "../../domain/models";
interface Statement { all(...params: unknown[]): Record<string, unknown>[]; }
interface SqliteDatabase { prepare(sql: string): Statement; }
export interface ConstraintRepository { seat(schoolYearId: string): StudentSeatConstraint[]; pairs(schoolYearId: string): StudentPairConstraint[]; }
export class SqliteConstraintRepository implements ConstraintRepository {
  constructor(private readonly database: SqliteDatabase) {}
  seat(schoolYearId: string): StudentSeatConstraint[] { return this.database.prepare("SELECT student_id, tag_key, expected_value, strength FROM student_seat_constraint WHERE school_year_id = ? AND is_active = 1").all(schoolYearId).map((row) => ({ studentId: String(row.student_id), tag: row.tag_key as StudentSeatConstraint["tag"], expected: row.expected_value === "true" ? true : row.expected_value === "false" ? false : String(row.expected_value), strength: row.strength as StudentSeatConstraint["strength"] })); }
  pairs(schoolYearId: string): StudentPairConstraint[] { return this.database.prepare("SELECT student_a_id, student_b_id, relation_type, min_distance, strength FROM student_pair_constraint WHERE school_year_id = ? AND is_active = 1").all(schoolYearId).map((row) => ({ studentAId: String(row.student_a_id), studentBId: String(row.student_b_id), type: row.relation_type as StudentPairConstraint["type"], minDistance: row.min_distance === null ? undefined : Number(row.min_distance), strength: row.strength as StudentPairConstraint["strength"] })); }
}
