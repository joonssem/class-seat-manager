import type { Student } from "../../domain/models";
import type { StudentRepository } from "../../application/student-service";

interface Statement {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): void;
}

export interface SqliteDatabase {
  prepare(sql: string): Statement;
}

function fromRow(row: Record<string, unknown>): Student {
  return {
    studentId: String(row.student_id),
    schoolYearId: String(row.school_year_id),
    studentNumber: Number(row.student_number),
    name: String(row.name),
    gender: row.gender as Student["gender"],
    enrollmentStatus: row.enrollment_status as Student["enrollmentStatus"],
    transferInDate: row.transfer_in_date ? String(row.transfer_in_date) : undefined,
    transferOutDate: row.transfer_out_date ? String(row.transfer_out_date) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export class SqliteStudentRepository implements StudentRepository {
  constructor(private readonly database: SqliteDatabase) {}

  list(schoolYearId: string): Student[] {
    const rows = this.database.prepare("SELECT * FROM student WHERE school_year_id = ? ORDER BY student_number").all(schoolYearId);
    return rows.map(fromRow);
  }

  getById(studentId: string): Student | undefined {
    const row = this.database.prepare("SELECT * FROM student WHERE student_id = ?").get(studentId);
    return row ? fromRow(row) : undefined;
  }

  insert(student: Student): void {
    this.database.prepare(`INSERT INTO student (student_id, school_year_id, student_number, name, gender, enrollment_status, transfer_in_date, transfer_out_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(student.studentId, student.schoolYearId, student.studentNumber, student.name, student.gender, student.enrollmentStatus, student.transferInDate ?? null, student.transferOutDate ?? null, student.createdAt, student.updatedAt);
  }

  update(student: Student): void {
    this.database.prepare(`UPDATE student SET student_number = ?, name = ?, gender = ?, enrollment_status = ?, transfer_in_date = ?, transfer_out_date = ?, updated_at = ? WHERE student_id = ?`).run(student.studentNumber, student.name, student.gender, student.enrollmentStatus, student.transferInDate ?? null, student.transferOutDate ?? null, student.updatedAt, student.studentId);
  }
}
