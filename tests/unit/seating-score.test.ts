import { describe, expect, it } from "vitest";
import { evaluateAllocation, generateCandidates } from "../../src/domain/seating-engine";
import { gridDistance, gridSpacing } from "../../src/domain/seat-grid";
import type { ConfirmedSeatingSession, Seat, Student } from "../../src/domain/models";

const pts: Array<[number, number, number]> = [[2, .05, .25], [3, .24, .25], [4, .45, .25], [5, .65, .25], [6, .05, .39], [7, .24, .39], [8, .45, .39], [9, .65, .39], [10, .05, .52], [11, .24, .52], [12, .45, .52], [13, .65, .52]];
const seats: Seat[] = pts.map(([n, x, y]) => ({ seatId: `seat-${n}`, seatCode: `s${n}`, x, y, width: .105, height: .12, isActive: true, position: { vertical: y < .3 ? "앞" : y < .45 ? "중간" : "뒤", horizontal: x < .3 ? "왼쪽" : x < .6 ? "가운데" : "오른쪽", nearFrontDoor: false, nearBackDoor: false } }));
const students: Student[] = Array.from({ length: 12 }, (_, i) => ({ studentId: `s${i}`, schoolYearId: "y", studentNumber: i + 1, name: `학생${i + 1}`, gender: i < 7 ? "남" : "여", enrollmentStatus: "재학", createdAt: "", updatedAt: "" }));
const rotate = (shift: number) => students.map((s, i) => ({ studentId: s.studentId, seatId: seats[(i + shift) % seats.length].seatId }));
const history: ConfirmedSeatingSession[] = [0, 1, 2, 3, 4].map((n) => ({ sequenceNo: n + 1, occurredOn: `2026-03-0${n + 1}`, assignments: rotate(n * 5) }));

describe("점수 체계", () => {
  it("이력이 많아도 점수가 0으로 눌리지 않고, 최적화한 배치가 무작위 수준보다 높다", () => {
    const input = { students, seats, history, seed: 11, settings: { restartCount: 4, maxIterations: 400 } };
    const best = generateCandidates(input)[0];
    expect(best.evaluation.score).toBeGreaterThan(20);
    expect(best.evaluation.score).toBeLessThanOrEqual(100);
    expect(Object.values(best.evaluation.relative).every((v) => v >= 0)).toBe(true);
  });

  it("후보 생성 결과의 점수가 나쁜 배치(전원 같은 자리 반복)보다 높다", () => {
    const input = { students, seats, history, seed: 11, settings: { restartCount: 4, maxIterations: 400 } };
    const repeated = evaluateAllocation(input, history[4].assignments);
    expect(generateCandidates(input)[0].evaluation.score).toBeGreaterThan(repeated.score);
  });

  it("이력과 조건이 전혀 없는 항목은 점수에서 제외된다(감점 없는 배치 = 100점에 가깝다)", () => {
    const solo = evaluateAllocation({ students: [students[0]], seats: [seats[0]], history: [] }, [{ studentId: "s0", seatId: seats[0].seatId }]);
    expect(solo.score).toBe(100);
  });

  it("문 근처가 아닌 자리끼리는 위치 경험 반복으로 세지 않는다", () => {
    const past = [{ sequenceNo: 1, occurredOn: "2026-03-01", assignments: [{ studentId: "s0", seatId: "seat-2" }] }];
    const moved = evaluateAllocation({ students: [students[0]], seats, history: past }, [{ studentId: "s0", seatId: "seat-13" }]);
    expect(moved.breakdown.positionExperience).toBe(0);
    const stayed = evaluateAllocation({ students: [students[0]], seats, history: past }, [{ studentId: "s0", seatId: "seat-2" }]);
    expect(stayed.breakdown.positionExperience).toBeGreaterThan(0);
  });
});

describe("최소 거리(자리 칸 수)", () => {
  const pair = [{ studentAId: "s0", studentBId: "s1", type: "최소 거리" as const, minDistance: 2, strength: "가급적" as const }];
  const place = (seatB: string) => [{ studentId: "s0", seatId: "seat-2" }, { studentId: "s1", seatId: seatB }];
  const input = { students: students.slice(0, 2), seats, history: [], pairConstraints: pair };

  it("칸 수로 거리를 잰다: 옆자리 1, 한 자리 건너뜀 2", () => {
    const spacing = gridSpacing(seats);
    expect(gridDistance(seats[0], seats[1], spacing)).toBeCloseTo(1, 0);
    expect(gridDistance(seats[0], seats[2], spacing)).toBeCloseTo(2, 0);
    expect(gridDistance(seats[0], seats[4], spacing)).toBeCloseTo(1, 0);
  });

  it("2칸 이상 조건: 옆자리는 위반, 한 자리 건너뛰면 만족", () => {
    expect(evaluateAllocation(input, place("seat-3")).pairDetails[0].status).toBe("warning");
    expect(evaluateAllocation(input, place("seat-4")).pairDetails[0].status).toBe("satisfied");
  });
});
