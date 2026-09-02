import { describe, expect, it } from "vitest";
import { evaluateCafeteriaPairs, generateCafeteriaResult } from "../../src/domain/cafeteria-engine";
import { students } from "../fixtures/seat-fixture";

describe("급식실 줄서기 엔진", () => {
  it("같은 seed에서 같은 줄서기를 만든다", () => {
    expect(generateCafeteriaResult(students, ["stu-1", "stu-2", "stu-3", "stu-4"], 7)).toEqual(generateCafeteriaResult(students, ["stu-1", "stu-2", "stu-3", "stu-4"], 7));
  });
  it("인솔 후보 4명 중 2명을 2번과 22번 자리에 배정한다", () => {
    const result = generateCafeteriaResult(students, ["stu-1", "stu-2", "stu-3", "stu-4"], 7);
    const marshals = result.assignments.filter((assignment) => assignment.role === "marshal");
    expect(marshals).toHaveLength(2);
    expect(marshals.map((assignment) => assignment.cafeteriaSeatId).sort()).toEqual(["CAF-02", "CAF-22"]);
  });
  it("교사 1번 자리를 비우고 학생을 2번 이후 자리에 배치한다", () => {
    const result = generateCafeteriaResult(students, ["stu-1", "stu-2", "stu-3", "stu-4"], 7);
    expect(result.assignments).toHaveLength(students.length);
    expect(new Set(result.assignments.map((assignment) => assignment.cafeteriaSeatId)).size).toBe(students.length);
    expect(result.assignments.some((assignment) => assignment.cafeteriaSeatId === "CAF-01")).toBe(false);
  });
  it("같은 줄에서 연속한 같은 성별 자리에 패널티를 준다", () => {
    const ordered = [students[0], students[2], students[1], students[3], students[4], students[5]];
    const assignments = ordered.map((student, index) => ({ studentId: student.studentId, queueOrder: index + 1, cafeteriaSeatId: `CAF-${String(index + 2).padStart(2, "0")}` }));
    const evaluation = evaluateCafeteriaPairs(assignments, [], students);
    expect(evaluation.genderAdjacencyPenalty).toBeGreaterThan(0);
    expect(evaluation.genderScore).toBeLessThan(100);
  });
});
