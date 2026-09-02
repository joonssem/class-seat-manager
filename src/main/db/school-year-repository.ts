import type { SchoolYear } from "../../domain/school-year";
import type { SchoolYearRepository } from "../../application/school-year-service";

interface Statement {
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): void;
}

interface SqliteDatabase {
  prepare(sql: string): Statement;
}

function fromRow(row: Record<string, unknown>): SchoolYear {
  return {
    schoolYearId: String(row.school_year_id), label: String(row.label), startsOn: String(row.starts_on), endsOn: String(row.ends_on),
    status: row.status as SchoolYear["status"], createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

export class SqliteSchoolYearRepository implements SchoolYearRepository {
  constructor(private readonly database: SqliteDatabase) {}
  list(): SchoolYear[] { return this.database.prepare("SELECT * FROM school_year ORDER BY starts_on DESC").all().map(fromRow); }
  insert(schoolYear: SchoolYear): void { this.database.prepare("INSERT INTO school_year (school_year_id, label, starts_on, ends_on, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(schoolYear.schoolYearId, schoolYear.label, schoolYear.startsOn, schoolYear.endsOn, schoolYear.status, schoolYear.createdAt, schoolYear.updatedAt); }
  archiveAll(): void { this.database.prepare("UPDATE school_year SET status = 'archived', updated_at = ? WHERE status = 'active'").run(new Date().toISOString()); }
}
