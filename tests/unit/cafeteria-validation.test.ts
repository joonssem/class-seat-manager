import { describe, expect, it } from "vitest";
import { validateCafeteriaAssignments } from "../../src/domain/cafeteria-engine";

describe("급식실 배치 검증", () => {
  it("중복 학생·좌석·순번을 거부한다", () => {
    const errors = validateCafeteriaAssignments([
      { studentId: "student-1", queueOrder: 1, cafeteriaSeatId: "CAF-01" },
      { studentId: "student-1", queueOrder: 1, cafeteriaSeatId: "CAF-01" }
    ]);
    expect(errors).toEqual(expect.arrayContaining(["급식실 배치에 학생 중복이 있습니다.", "급식실 좌석 중복이 있습니다.", "줄서기 순번이 중복됩니다.", "급식실 학생 좌석 ID가 올바르지 않습니다."]));
  });

  it("22번을 초과하거나 잘못된 좌석 ID를 거부한다", () => {
    const errors = validateCafeteriaAssignments([{ studentId: "student-1", queueOrder: 23, cafeteriaSeatId: "CAF-23" }]);
    expect(errors).toEqual(expect.arrayContaining(["줄서기 순번은 1부터 21 사이여야 합니다.", "급식실 학생 좌석 ID가 올바르지 않습니다."]));
  });

  it("인솔자는 2번 또는 22번 자리에만 배정한다", () => {
    expect(validateCafeteriaAssignments([{ studentId: "student-1", queueOrder: 1, cafeteriaSeatId: "CAF-12", role: "marshal" }])).toContain("인솔 학생은 2번 또는 22번 자리에 배정해야 합니다.");
    expect(validateCafeteriaAssignments([{ studentId: "student-1", queueOrder: 1, cafeteriaSeatId: "CAF-22", role: "marshal" }])).not.toContain("인솔 학생은 2번 또는 22번 자리에 배정해야 합니다.");
  });
});
