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

function repository(): SeatingRepository & { saved: unknown[] } {
  const result = { saved: [] as unknown[] };
  return { nextSequence: () => 1, saveConfirmed: () => undefined, saveConfirmedBatch: (inputs) => result.saved.push(...inputs) , ...result };
}

describe("historical seating batch save", () => {
  it("saves five validated sessions as one batch with semester sequences", () => {
    const repo = repository(); const service = new SeatingService(repo, (() => { let n = 0; return () => `session-${++n}`; })());
    const assignments = [{ studentId: "stu-1", seatId: "seat-01" }, { studentId: "stu-2", seatId: "seat-02" }];
    const sequences = service.confirmBatch("sy-2026", "layout-1", students, desks, Array.from({ length: 5 }, (_, index) => ({ semester: 1, occurredOn: `2026-0${index + 3}-15`, assignments })));
    expect(sequences).toEqual([1, 2, 3, 4, 5]); expect(repo.saved).toHaveLength(5);
  });

  it("rejects a duplicate assignment before saving anything", () => {
    const repo = repository(); const service = new SeatingService(repo); const assignments = [{ studentId: "stu-1", seatId: "seat-01" }, { studentId: "stu-1", seatId: "seat-02" }];
    expect(() => service.confirmBatch("sy-2026", "layout-1", students, desks, [{ semester: 1, occurredOn: "2026-03-15", assignments }])).toThrow(); expect(repo.saved).toHaveLength(0);
  });
});
