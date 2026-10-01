import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SeatingService } from "../../src/application/seating-service";
import { SqliteSeatingHistoryRepository } from "../../src/main/db/seating-history-repository";
import { SqliteSeatingRepository } from "../../src/main/db/seating-repository";

vi.mock("electron", () => ({ app: { isPackaged: false } }));

const temporaryDirectories: string[] = [];
let nativeBindingAvailable = false;
try {
  const Database = require("better-sqlite3");
  const database = new Database(":memory:");
  database.close();
  nativeBindingAvailable = true;
} catch {
  // test:integration(Electron 내장 Node)에서는 반드시 실행되어야 하므로 스킵 대신 실패시킨다.
  nativeBindingAvailable = process.env.REQUIRE_SQLITE === "1";
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
  }
});

describe("confirmed seating history flow", () => {
  it.skipIf(!nativeBindingAvailable)("writes a confirmed seating and returns it from history", async () => {
    const directory = mkdtempSync(join(tmpdir(), "class-seat-manager-confirm-"));
    temporaryDirectories.push(directory);
    const { openDatabase } = await import("../../src/main/db/database");
    const database = openDatabase(join(directory, "class-seat-manager.sqlite"));
    try {
      const now = "2026-04-01T00:00:00.000Z";
      database.prepare("INSERT INTO school_year (school_year_id, label, starts_on, ends_on, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)").run("sy-2026", "2026학년도", "2026-03-01", "2027-02-28", now, now);
      database.prepare("INSERT INTO classroom_layout (classroom_layout_id, school_year_id, name, canvas_width, canvas_height, coordinate_version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1, ?, ?)").run("layout-1", "sy-2026", "기본 교실", now, now);
      const insertElement = database.prepare("INSERT INTO classroom_element (element_id, classroom_layout_id, element_type, x, y, width, height, rotation, z_index, position_override_json) VALUES (?, ?, 'desk', ?, 0, 0.1, 0.1, 0, ?, NULL)");
      const insertSeat = database.prepare("INSERT INTO seat (seat_id, classroom_layout_id, element_id, seat_code, is_active, auto_position_tags_json) VALUES (?, ?, ?, ?, 1, '{}')");
      insertElement.run("seat-01", "layout-1", 0, 0); insertElement.run("seat-02", "layout-1", 0.2, 1);
      insertSeat.run("seat-01", "layout-1", "seat-01", "seat-01"); insertSeat.run("seat-02", "layout-1", "seat-02", "seat-02");
      const insertStudent = database.prepare("INSERT INTO student (student_id, school_year_id, student_number, name, gender, enrollment_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '재학', ?, ?)");
      insertStudent.run("stu-1", "sy-2026", 1, "학생1", "남", now, now); insertStudent.run("stu-2", "sy-2026", 2, "학생2", "여", now, now);

      const service = new SeatingService(new SqliteSeatingRepository(database), () => "session-1");
      const sequence = service.confirm("sy-2026", "layout-1", [
        { studentId: "stu-1", schoolYearId: "sy-2026", studentNumber: 1, name: "학생1", gender: "남", enrollmentStatus: "재학", createdAt: now, updatedAt: now },
        { studentId: "stu-2", schoolYearId: "sy-2026", studentNumber: 2, name: "학생2", gender: "여", enrollmentStatus: "재학", createdAt: now, updatedAt: now }
      ], [
        { id: "seat-01", type: "desk", x: 0, y: 0, width: 0.1, height: 0.1 },
        { id: "seat-02", type: "desk", x: 0.2, y: 0, width: 0.1, height: 0.1 }
      ], [{ studentId: "stu-1", seatId: "seat-01" }, { studentId: "stu-2", seatId: "seat-02" }], 1, "2026-04-15");
      const history = new SqliteSeatingHistoryRepository(database);
      const sessions = history.list("sy-2026");

      expect(sequence).toBe(1);
      expect(sessions).toEqual([expect.objectContaining({ seatingSessionId: "session-1", semester: 1, sequenceNo: 1, occurredOn: "2026-04-15", assignmentCount: 2 })]);
      expect(history.assignments("session-1")).toHaveLength(2);
    } finally {
      database.close();
    }
  });
  it.skipIf(!nativeBindingAvailable)("1학기 기록이 있어도 2학기 자리배치를 저장할 수 있다 (번호는 학년도 단위로 이어진다)", async () => {
    const directory = mkdtempSync(join(tmpdir(), "class-seat-manager-semester-"));
    temporaryDirectories.push(directory);
    const { openDatabase } = await import("../../src/main/db/database");
    const database = openDatabase(join(directory, "class-seat-manager.sqlite"));
    try {
      const now = "2026-04-01T00:00:00.000Z";
      database.prepare("INSERT INTO school_year (school_year_id, label, starts_on, ends_on, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?)").run("sy-2026", "2026학년도", "2026-03-01", "2027-02-28", now, now);
      database.prepare("INSERT INTO classroom_layout (classroom_layout_id, school_year_id, name, canvas_width, canvas_height, coordinate_version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, 1, ?, ?)").run("layout-1", "sy-2026", "기본 교실", now, now);
      database.prepare("INSERT INTO classroom_element (element_id, classroom_layout_id, element_type, x, y, width, height, rotation, z_index, position_override_json) VALUES (?, ?, 'desk', 0, 0, 0.1, 0.1, 0, 0, NULL)").run("seat-01", "layout-1");
      database.prepare("INSERT INTO seat (seat_id, classroom_layout_id, element_id, seat_code, is_active, auto_position_tags_json) VALUES (?, ?, ?, ?, 1, '{}')").run("seat-01", "layout-1", "seat-01", "seat-01");
      database.prepare("INSERT INTO student (student_id, school_year_id, student_number, name, gender, enrollment_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '재학', ?, ?)").run("stu-1", "sy-2026", 1, "학생1", "남", now, now);
      const students = [{ studentId: "stu-1", schoolYearId: "sy-2026", studentNumber: 1, name: "학생1", gender: "남" as const, enrollmentStatus: "재학" as const, createdAt: now, updatedAt: now }];
      const desks = [{ id: "seat-01", type: "desk" as const, x: 0, y: 0, width: 0.1, height: 0.1 }];
      const assignments = [{ studentId: "stu-1", seatId: "seat-01" }];
      const service = new SeatingService(new SqliteSeatingRepository(database));

      expect(service.confirm("sy-2026", "layout-1", students, desks, assignments, 1, "2026-04-15")).toBe(1);
      expect(service.confirm("sy-2026", "layout-1", students, desks, assignments, 2, "2026-09-15")).toBe(2);
      expect(service.confirmBatch("sy-2026", "layout-1", students, desks, [{ semester: 2, occurredOn: "2026-10-01", assignments }, { semester: 2, occurredOn: "2026-10-02", assignments }])).toEqual([3, 4]);
      expect(new SqliteSeatingHistoryRepository(database).list("sy-2026").map((row) => row.semester).sort()).toEqual([1, 2, 2, 2]);
    } finally {
      database.close();
    }
  });
});
