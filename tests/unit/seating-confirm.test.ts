import { describe, expect, it } from "vitest";
import { SeatingService, type SeatingRepository } from "../../src/application/seating-service";
import type { LayoutItem } from "../../src/domain/classroom-layout";
import type { Student } from "../../src/domain/models";

const students: Student[] = [
  { studentId: "stu-1", schoolYearId: "sy-2026", studentNumber: 1, name: "학생1", gender: "남", enrollmentStatus: "재학", createdAt: "2026-03-01", updatedAt: "2026-03-01" },
  { studentId: "stu-2", schoolYearId: "sy-2026", studentNumber: 2, name: "학생2", gender: "여", enrollmentStatus: "재학", createdAt: "2026-03-01", updatedAt: "2026-03-01" }
];
const desks: LayoutItem[] = [
  { id: "seat-01", type: "desk", x: 0, y: 0, width: 0.1, height: 0.1 },
  { id: "seat-02", type: "desk", x: 0.2, y: 0, width: 0.1, height: 0.1 }
];

describe("normal seating confirmation", () => {
  it("persists the selected semester and date with the confirmed assignment", () => {
    let saved: Parameters<SeatingRepository["saveConfirmed"]>[0] | undefined;
    const repository: SeatingRepository = {
      nextSequence: () => 3,
      saveConfirmed: (input) => { saved = input; },
      saveConfirmedBatch: () => undefined
    };
    const service = new SeatingService(repository, () => "session-1");

    const sequence = service.confirm("sy-2026", "layout-1", students, desks, [{ studentId: "stu-1", seatId: "seat-01" }, { studentId: "stu-2", seatId: "seat-02" }], 1, "2026-04-15");

    expect(sequence).toBe(3);
    expect(saved).toMatchObject({ seatingSessionId: "session-1", schoolYearId: "sy-2026", classroomLayoutId: "layout-1", semester: 1, sequenceNo: 3, occurredOn: "2026-04-15" });
    expect(saved?.assignments).toHaveLength(2);
  });
});
