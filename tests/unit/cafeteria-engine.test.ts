import { describe, expect, it } from "vitest";
import { evaluateCafeteriaPairs, generateCafeteriaResult } from "../../src/domain/cafeteria-engine";
import { students } from "../fixtures/seat-fixture";

const candidateIds = ["stu-1", "stu-2", "stu-3", "stu-4"];

describe("급식실 줄서기 엔진", () => {
  it("같은 seed에서 같은 줄서기를 만든다", () => {
    expect(generateCafeteriaResult(students, candidateIds, 7)).toEqual(generateCafeteriaResult(students, candidateIds, 7));
  });

  it("평소에는 인솔 후보를 포함한 모든 학생을 2~22번에 무작위 배치한다", () => {
    const result = generateCafeteriaResult(students, candidateIds, 7);
    expect(result.assignments).toHaveLength(students.length);
    expect(result.assignments.some((assignment) => assignment.role === "marshal")).toBe(false);
    expect(new Set(result.assignments.map((assignment) => assignment.studentId))).toEqual(new Set(students.map((student) => student.studentId)));
    expect(result.assignments.map((assignment) => assignment.cafeteriaSeatId).sort()).toEqual(students.map((_, index) => `CAF-${String(index + 2).padStart(2, "0")}`).sort());
    expect(result.marshalIds).toEqual(candidateIds);
  });

  it("인솔자 확인 모드에서는 후보 2명을 2번과 22번 자리에 배정한다", () => {
    const result = generateCafeteriaResult(students, candidateIds, 7, [], "marshal");
    const marshals = result.assignments.filter((assignment) => assignment.role === "marshal");
    expect(marshals).toHaveLength(2);
    expect(marshals.map((assignment) => assignment.cafeteriaSeatId).sort()).toEqual(["CAF-02", "CAF-22"]);
  });

  it("교사 1번 자리는 비워 둔다", () => {
    const result = generateCafeteriaResult(students, candidateIds, 7);
    expect(result.assignments.some((assignment) => assignment.cafeteriaSeatId === "CAF-01")).toBe(false);
  });

  it("같은 줄에서 연속한 같은 성별 자리에 패널티를 준다", () => {
    const ordered = [students[0], students[2], students[1], students[3], students[4], students[5]];
    const assignments = ordered.map((student, index) => ({ studentId: student.studentId, queueOrder: index + 1, cafeteriaSeatId: `CAF-${String(index + 2).padStart(2, "0")}` }));
    const evaluation = evaluateCafeteriaPairs(assignments, [], students);
    expect(evaluation.genderAdjacencyPenalty).toBeGreaterThan(0);
    expect(evaluation.genderScore).toBeLessThan(100);
  });

  it("마주보는 좌석은 최소 거리 pair 점수에도 반영한다", () => {
    const evaluation = evaluateCafeteriaPairs([
      { studentId: "stu-1", queueOrder: 1, cafeteriaSeatId: "CAF-02" },
      { studentId: "stu-2", queueOrder: 5, cafeteriaSeatId: "CAF-13" }
    ], [{ studentAId: "stu-1", studentBId: "stu-2", type: "최소 거리", minDistance: 1, strength: "가급적" }], students);
    expect(evaluation.pairDetails[0]?.facing).toBe(true);
    expect(evaluation.pairDetails[0]?.penalty).toBe(3);
    expect(evaluation.totalPenalty).toBe(3);
  });

  it("마주보는 좌석은 가능한 한 멀리 pair에서 옆자리보다 높은 패널티를 준다", () => {
    const constraint = { studentAId: "stu-1", studentBId: "stu-2", type: "가능한 한 멀리" as const, strength: "가급적" as const };
    const facing = evaluateCafeteriaPairs([
      { studentId: "stu-1", queueOrder: 1, cafeteriaSeatId: "CAF-02" },
      { studentId: "stu-2", queueOrder: 5, cafeteriaSeatId: "CAF-13" }
    ], [constraint], students);
    const beside = evaluateCafeteriaPairs([
      { studentId: "stu-1", queueOrder: 1, cafeteriaSeatId: "CAF-02" },
      { studentId: "stu-2", queueOrder: 5, cafeteriaSeatId: "CAF-03" }
    ], [constraint], students);
    expect(facing.totalPenalty).toBeGreaterThan(beside.totalPenalty);
  });
});
