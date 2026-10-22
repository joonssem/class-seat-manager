import { expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClassroomService } from "../../src/application/classroom-service";
import { SeatingService } from "../../src/application/seating-service";
import { confirmGroupSeating } from "../../src/application/group-seating-service";
import { SqliteClassroomRepository } from "../../src/main/db/classroom-repository";
import { SqliteSeatingRepository } from "../../src/main/db/seating-repository";
import { SqliteSeatingHistoryRepository } from "../../src/main/db/seating-history-repository";
import type { GroupInput } from "../../src/domain/group-seating";

vi.mock("electron", () => ({ app: { isPackaged: false } }));
let available = false;
try { const DB = require("better-sqlite3"); const db = new DB(":memory:"); db.close(); available = true; } catch { available = process.env.REQUIRE_SQLITE === "1"; }

it.skipIf(!available)("saves group layout and history together and rolls both back on history write failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "group-seating-"));
  const { openDatabase } = await import("../../src/main/db/database");
  const db = openDatabase(join(directory, "test.sqlite"));
  try {
    db.prepare("INSERT INTO school_year VALUES ('sy', '2026학년도', '2026-03-01', '2027-02-28', 'active', '', '')").run();
    const insert = db.prepare("INSERT INTO student (student_id, school_year_id, student_number, name, gender, enrollment_status, created_at, updated_at) VALUES (?, 'sy', ?, ?, ?, '재학', '', '')");
    const students: GroupInput["students"] = Array.from({ length: 7 }, (_, i) => ({ studentId: `s${i}`, schoolYearId: "sy", studentNumber: i + 1, name: `학생${i}`, gender: i % 2 ? "남" : "여", enrollmentStatus: "재학", createdAt: "", updatedAt: "" }));
    students.forEach((s) => insert.run(s.studentId, s.studentNumber, s.name, s.gender));
    const classroom = new ClassroomService(new SqliteClassroomRepository(db));
    const seating = new SeatingService(new SqliteSeatingRepository(db));
    const history = new SqliteSeatingHistoryRepository(db);
    const oldItems = students.map((s, i) => ({ id: `old-${s.studentId}`, type: "desk" as const, x: i * 0.1, y: 0.2, width: 0.08, height: 0.1 }));
    const oldLayout = classroom.save("sy", oldItems);
    seating.confirm("sy", oldLayout.classroomLayoutId, students, oldItems, students.map((s, i) => ({ studentId: s.studentId, seatId: oldItems[i].id })), 2, "2026-10-01");
    const input: GroupInput = { students, sizes: [3, 4], pairs: [], positions: [], spreadIds: [], namespace: "sy", fixtures: [] };
    const groups = [students.slice(0, 3).map((s) => s.studentId), students.slice(3).map((s) => s.studentId)];
    expect(confirmGroupSeating(input, groups, "2026-10-22", classroom, seating, (work) => db.transaction(work)())).toBe(2);
    expect(history.list("sy")).toHaveLength(2);
    expect(classroom.get("sy")?.items.filter((i) => i.type === "desk")).toHaveLength(7);
    expect(history.latestAssignments("sy").every((a) => a.seatId.startsWith("group-"))).toBe(true);
    const before = classroom.get("sy");
    db.exec("CREATE TRIGGER reject_group_save BEFORE INSERT ON seating_assignment BEGIN SELECT RAISE(ABORT, 'forced write failure'); END");
    expect(() => confirmGroupSeating({ ...input, sizes: [4, 3] }, [groups.flat().slice(0, 4), groups.flat().slice(4)], "2026-10-23", classroom, seating, (work) => db.transaction(work)())).toThrow("forced write failure");
    expect(classroom.get("sy")).toEqual(before);
    expect(history.list("sy")).toHaveLength(2);
    expect(() => confirmGroupSeating(input, groups, "2026-02-30", classroom, seating, (work) => db.transaction(work)())).toThrow("유효한");
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
