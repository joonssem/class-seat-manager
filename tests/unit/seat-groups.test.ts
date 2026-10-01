import { describe, expect, it } from "vitest";
import { columnGroups } from "../../src/domain/seat-groups";
import { evaluateAllocation, generateCandidates } from "../../src/domain/seating-engine";
import type { Seat, Student } from "../../src/domain/models";

const desk = (id: string, x: number, y: number): Seat => ({ seatId: id, seatCode: id, x, y, width: 0.105, height: 0.12, isActive: true, position: { vertical: "중간", horizontal: "가운데", nearFrontDoor: false, nearBackDoor: false } });
// 2줄 x 3행
const seats = [desk("a1", 0.1, 0.2), desk("a2", 0.1, 0.4), desk("a3", 0.1, 0.6), desk("b1", 0.5, 0.2), desk("b2", 0.5, 0.4), desk("b3", 0.5, 0.6)];
const student = (n: number, gender: "남" | "여"): Student => ({ studentId: `s${n}`, schoolYearId: "y", studentNumber: n, name: `학생${n}`, gender, enrollmentStatus: "재학", createdAt: "", updatedAt: "" });
const students = [student(1, "남"), student(2, "남"), student(3, "남"), student(4, "여"), student(5, "여"), student(6, "여")];
const place = (order: string[]) => order.map((studentId, index) => ({ studentId, seatId: seats[index].seatId }));

describe("세로 한 줄 모둠", () => {
  it("x좌표가 같은 좌석끼리 위에서 아래 순서로 묶는다", () => {
    expect(columnGroups(seats)).toEqual([["a1", "a2", "a3"], ["b1", "b2", "b3"]]);
  });

  it("혼자 있는 줄은 모둠으로 보지 않는다", () => {
    expect(columnGroups([desk("x", 0.1, 0.1), desk("y", 0.6, 0.1)])).toEqual([]);
  });

  it("옵션이 꺼져 있으면 모둠 점수를 계산하지 않는다", () => {
    const e = evaluateAllocation({ students, seats, history: [] }, place(["s1", "s2", "s3", "s4", "s5", "s6"]));
    expect(e.breakdown.groupActivity).toBe(0);
  });

  it("한 성별로만 이뤄진 세로 모둠에 감점을 준다", () => {
    const mono = evaluateAllocation({ students, seats, history: [], settings: { groupActivity: true } }, place(["s1", "s2", "s3", "s4", "s5", "s6"]));
    const mixed = evaluateAllocation({ students, seats, history: [], settings: { groupActivity: true } }, place(["s1", "s4", "s2", "s5", "s3", "s6"]));
    expect(mono.breakdown.groupActivity).toBeGreaterThanOrEqual(2);
    expect(mixed.breakdown.groupActivity).toBe(0);
  });

  it("이전에 같은 줄이었던 학생이 다시 같은 줄이면 감점한다", () => {
    const history = [{ sequenceNo: 1, occurredOn: "2026-03-02", assignments: place(["s1", "s4", "s2", "s5", "s3", "s6"]) }];
    const again = evaluateAllocation({ students, seats, history, settings: { groupActivity: true } }, place(["s1", "s4", "s2", "s5", "s3", "s6"]));
    const fresh = evaluateAllocation({ students, seats, history, settings: { groupActivity: true } }, place(["s1", "s5", "s6", "s4", "s2", "s3"]));
    expect(again.breakdown.groupActivity).toBeGreaterThan(fresh.breakdown.groupActivity);
  });

  it("후보 생성은 옵션을 켜면 성별이 섞인 세로 모둠을 만든다", () => {
    const best = generateCandidates({ students, seats, history: [], seed: 3, settings: { groupActivity: true, restartCount: 6, maxIterations: 300 } })[0];
    expect(best.evaluation.breakdown.groupActivity).toBe(0);
  });
});
