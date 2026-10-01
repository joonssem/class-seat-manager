import { describe, expect, it } from "vitest";
import { pairProximityStats } from "../../src/domain/pair-proximity-stats";
import type { Seat } from "../../src/domain/models";

const desk = (id: string, x: number, y: number): Seat => ({ seatId: id, seatCode: id, x, y, width: 0.105, height: 0.12, isActive: true, position: { vertical: "중간", horizontal: "가운데", nearFrontDoor: false, nearBackDoor: false } });
const seats = [desk("a", 0.05, 0.5), desk("b", 0.24, 0.5), desk("c", 0.45, 0.5), desk("d", 0.85, 0.5)];
const session = (n: number, order: string[]) => ({ sequenceNo: n, occurredOn: `2026-03-0${n}`, assignments: order.map((studentId, i) => ({ studentId, seatId: seats[i].seatId })) });

describe("짝 근접 통계", () => {
  it("옆자리로 앉은 횟수를 세고 많은 쌍을 앞에 둔다", () => {
    const stats = pairProximityStats([session(1, ["s1", "s2", "s3", "s4"]), session(2, ["s1", "s2", "s4", "s3"])], seats);
    expect(stats[0]).toMatchObject({ studentAId: "s1", studentBId: "s2", sideCount: 2, nearCount: 2 });
  });

  it("떨어져 앉은 쌍은 집계하지 않는다", () => {
    const stats = pairProximityStats([session(1, ["s1", "s2", "s3", "s4"])], seats);
    expect(stats.some((s) => s.studentAId === "s1" && s.studentBId === "s4")).toBe(false);
  });
});
