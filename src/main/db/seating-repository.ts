import type { SeatingRepository } from "../../application/seating-service";
import type { SeatingAssignment } from "../../domain/models";

interface Statement { all(...params: unknown[]): Record<string, unknown>[]; get(...params: unknown[]): Record<string, unknown> | undefined; run(...params: unknown[]): void; }
interface SqliteDatabase { prepare(sql: string): Statement; exec(sql: string): void; }

export class SqliteSeatingRepository implements SeatingRepository {
  constructor(private readonly database: SqliteDatabase) {}
  nextSequence(schoolYearId: string, semester: number): number { const row = this.database.prepare("SELECT COALESCE(MAX(sequence_no), 0) AS max_sequence FROM seating_session WHERE school_year_id = ? AND semester = ? AND status = 'confirmed'").get(schoolYearId, semester); return Number(row?.max_sequence ?? 0) + 1; }
  saveConfirmed(input: { seatingSessionId: string; schoolYearId: string; classroomLayoutId: string; semester: number; sequenceNo: number; occurredOn: string; assignments: Array<SeatingAssignment & { positionSnapshot: object; displayNameSnapshot: string; studentNumberSnapshot: number }> }): void {
    const now = new Date().toISOString();
    this.database.exec("BEGIN");
    try {
      this.database.prepare("INSERT INTO seating_session (seating_session_id, school_year_id, classroom_layout_id, semester, sequence_no, occurred_on, status, algorithm_version, created_at, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 'manual-v1', ?, ?)").run(input.seatingSessionId, input.schoolYearId, input.classroomLayoutId, input.semester, input.sequenceNo, input.occurredOn, now, now);
      const insert = this.database.prepare("INSERT INTO seating_assignment (assignment_id, seating_session_id, student_id, seat_id, position_snapshot_json, display_name_snapshot, student_number_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)");
      input.assignments.forEach((assignment) => insert.run(crypto.randomUUID(), input.seatingSessionId, assignment.studentId, assignment.seatId, JSON.stringify(assignment.positionSnapshot), assignment.displayNameSnapshot, assignment.studentNumberSnapshot));
      this.database.exec("COMMIT");
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  saveConfirmedBatch(inputs: Array<{ seatingSessionId: string; schoolYearId: string; classroomLayoutId: string; semester: number; sequenceNo: number; occurredOn: string; assignments: Array<SeatingAssignment & { positionSnapshot: object; displayNameSnapshot: string; studentNumberSnapshot: number }> }>): void { const now = new Date().toISOString(); this.database.exec("BEGIN"); try { const sessionInsert = this.database.prepare("INSERT INTO seating_session (seating_session_id, school_year_id, classroom_layout_id, semester, sequence_no, occurred_on, status, algorithm_version, created_at, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', 'historical-import-v1', ?, ?)"); const assignmentInsert = this.database.prepare("INSERT INTO seating_assignment (assignment_id, seating_session_id, student_id, seat_id, position_snapshot_json, display_name_snapshot, student_number_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)"); inputs.forEach((input) => { sessionInsert.run(input.seatingSessionId, input.schoolYearId, input.classroomLayoutId, input.semester, input.sequenceNo, input.occurredOn, now, now); input.assignments.forEach((assignment) => assignmentInsert.run(crypto.randomUUID(), input.seatingSessionId, assignment.studentId, assignment.seatId, JSON.stringify(assignment.positionSnapshot), assignment.displayNameSnapshot, assignment.studentNumberSnapshot)); }); this.database.exec("COMMIT"); } catch (error) { this.database.exec("ROLLBACK"); throw error; } }
}
