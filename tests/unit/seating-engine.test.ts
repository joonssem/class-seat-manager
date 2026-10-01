import { describe, expect, it } from "vitest";
import { evaluateAllocation, generateCandidates, generateCandidatesAsync, validateAllocation } from "../../src/domain/seating-engine";
import { seats, students } from "../fixtures/seat-fixture";

describe("자리배치 엔진", () => {
  it("학생과 좌석의 중복 배정을 검증한다", () => {
    const errors = validateAllocation({ students, seats, history: [] }, [
      { studentId: "stu-1", seatId: "seat-1" },
      { studentId: "stu-2", seatId: "seat-1" }
    ]);
    expect(errors).toContain("좌석 중복 배정이 있습니다.");
  });

  it("같은 seed에서 재현 가능한 후보를 생성한다", () => {
    const input = { students, seats, history: [], seed: 42, settings: { restartCount: 4, maxIterations: 100 } };
    expect(generateCandidates(input)).toEqual(generateCandidates(input));
  });

  it("전출 학생을 자동배치 대상에서 제외한다", () => {
    const input = { students: [...students, { ...students[0], studentId: "stu-out", enrollmentStatus: "전출" as const }], seats, history: [] };
    const candidate = generateCandidates(input)[0];
    expect(candidate.assignments).toHaveLength(students.length);
    expect(candidate.assignments.some((a) => a.studentId === "stu-out")).toBe(false);
  });

  it("필수 위치 조건 위반을 hard violation으로 표시한다", () => {
    const evaluation = evaluateAllocation({ students, seats, history: [], seatConstraints: [{ studentId: "stu-1", tag: "nearBackDoor", expected: true, strength: "필수" }] }, [{ studentId: "stu-1", seatId: "seat-1" }]);
    expect(evaluation.hardViolations.length).toBeGreaterThan(0);
  });

  it("가능한 한 멀리 조건을 현재 거리와 최대 거리의 차이로 평가한다", () => {
    const pairConstraint = { studentAId: "stu-1", studentBId: "stu-2", type: "가능한 한 멀리" as const, strength: "가급적" as const };
    const near = evaluateAllocation({ students, seats, history: [], pairConstraints: [pairConstraint] }, [
      { studentId: "stu-1", seatId: "seat-1" }, { studentId: "stu-2", seatId: "seat-2" },
      ...students.slice(2).map((student, index) => ({ studentId: student.studentId, seatId: seats[index + 2].seatId }))
    ]);
    const far = evaluateAllocation({ students, seats, history: [], pairConstraints: [pairConstraint] }, [
      { studentId: "stu-1", seatId: "seat-1" }, { studentId: "stu-2", seatId: "seat-6" },
      ...students.slice(2).map((student, index) => ({ studentId: student.studentId, seatId: seats[index + 1].seatId }))
    ]);
    expect(near.breakdown.pairDistance).toBeGreaterThan(far.breakdown.pairDistance);
    expect(far.breakdown.pairDistance).toBe(0);
    expect(far.hardViolations).toHaveLength(0);
    expect(far.pairDetails).toEqual([expect.objectContaining({ studentAId: "stu-1", studentBId: "stu-2", type: "가능한 한 멀리", currentDistance: expect.any(Number), targetDistance: expect.any(Number), status: "satisfied" })]);
  });
});

describe("비동기 후보 생성", () => {
  const input = { students, seats, history: [], seed: 42, settings: { restartCount: 4, maxIterations: 100 } };

  it("동기 생성과 같은 후보를 만들고 진행을 보고한다", async () => {
    const progress: Array<[number, number]> = [];
    const result = await generateCandidatesAsync(input, { onProgress: (done, total) => progress.push([done, total]) });
    expect(result).toEqual(generateCandidates(input));
    expect(progress[0]).toEqual([0, 4]);
    expect(progress[progress.length - 1]).toEqual([4, 4]);
  });

  it("취소하면 빈 배열을 반환하고 더 이상 진행하지 않는다", async () => {
    let calls = 0;
    const result = await generateCandidatesAsync(input, { onProgress: () => { calls += 1; }, isCancelled: () => calls >= 2 });
    expect(result).toEqual([]);
    expect(calls).toBeLessThan(5);
  });
});
