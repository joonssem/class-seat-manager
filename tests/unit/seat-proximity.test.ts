import { describe, expect, it } from "vitest";
import { seatProximity } from "../../src/domain/seat-proximity";
import { evaluateAllocation } from "../../src/domain/seating-engine";
import type { Seat, Student } from "../../src/domain/models";

// 기본 교실 배치(classroom-editor)와 같은 책상 크기·간격
const desk = (id: string, x: number, y: number): Seat => ({ seatId: id, seatCode: id, x, y, width: 0.105, height: 0.12, isActive: true, position: { vertical: "중간", horizontal: "가운데", nearFrontDoor: false, nearBackDoor: false } });
const center = desk("c", 0.45, 0.52);
const side = desk("side", 0.65, 0.52);
const behind = desk("behind", 0.45, 0.66);
const diagonal = desk("diag", 0.65, 0.66);
const twoSidesAway = desk("far-side", 0.85, 0.52);
const twoRowsBehind = desk("far-row", 0.45, 0.8);

describe("좌석 근접도(시선 기반)", () => {
  it("중심 거리가 더 멀어도 옆자리가 바로 뒤 자리보다 위험하다", () => {
    const toSide = seatProximity(center, side);
    const toBehind = seatProximity(center, behind);
    expect(Math.hypot(0.2, 0)).toBeGreaterThan(Math.hypot(0, 0.14));
    expect(toSide.relation).toBe("옆자리");
    expect(toBehind.relation).toBe("앞뒤");
    expect(toSide.risk).toBeGreaterThan(toBehind.risk);
    expect(toSide.risk).toBeGreaterThanOrEqual(0.5);
  });

  it("대각선은 옆자리보다 낮고 앞뒤보다 높다", () => {
    const d = seatProximity(center, diagonal);
    expect(d.relation).toBe("대각선");
    expect(d.risk).toBeLessThan(seatProximity(center, side).risk);
    expect(d.risk).toBeGreaterThan(seatProximity(center, behind).risk);
  });

  it("앞 학생이 뒤를 돌아보는 각도가 뒤 학생이 앞을 보는 각도보다 크다", () => {
    const p = seatProximity(behind, center); // a=뒤, b=앞
    expect(p.turnAngleA).toBeLessThan(p.turnAngleB);
  });

  it("교실 측면 학생은 중앙 방향을 바라보므로 안쪽 이웃이 바깥 이웃보다 보기 쉽다", () => {
    const left = desk("left", 0.05, 0.5);
    const right = desk("right", 0.25, 0.5);
    const p = seatProximity(left, right);
    expect(p.turnAngleA).toBeLessThan(p.turnAngleB);
  });

  it("앞줄 우측 학생은 칠판 중앙을 보려고 몸이 왼쪽으로 틀어져 있어 바깥(오른쪽) 이웃을 보려면 더 많이 돌려야 한다", () => {
    const frontRight = desk("fr", 0.65, 0.1);
    const outerNeighbor = desk("fr-outer", 0.85, 0.1);
    const innerNeighbor = desk("fr-inner", 0.45, 0.1);
    const toOuter = seatProximity(frontRight, outerNeighbor).turnAngleA;
    const toInner = seatProximity(frontRight, innerNeighbor).turnAngleA;
    const midRowToSide = seatProximity(center, side).turnAngleA;
    expect(toOuter).toBeGreaterThan(midRowToSide);
    expect(toOuter).toBeGreaterThan(toInner);
  });

  it("한 칸 건너뛴 자리는 영향이 없거나 훨씬 작다", () => {
    expect(seatProximity(center, twoSidesAway).risk).toBe(0);
    expect(seatProximity(center, twoRowsBehind).risk).toBeLessThan(seatProximity(center, behind).risk);
  });
});

describe("성별 인접 평가", () => {
  const student = (n: number, gender: "남" | "여"): Student => ({ studentId: `s${n}`, schoolYearId: "sy", studentNumber: n, name: `학생${n}`, gender, enrollmentStatus: "재학", createdAt: "", updatedAt: "" });
  const students = [student(1, "남"), student(2, "남"), student(3, "여")];
  const seats = [center, side, twoSidesAway];
  const input = { students, seats, history: [] };

  it("같은 성별이 바로 옆자리면 한 칸 떨어진 경우보다 감점이 크다", () => {
    const bad = evaluateAllocation(input, [{ studentId: "s1", seatId: "c" }, { studentId: "s2", seatId: "side" }, { studentId: "s3", seatId: "far-side" }]);
    const good = evaluateAllocation(input, [{ studentId: "s1", seatId: "c" }, { studentId: "s3", seatId: "side" }, { studentId: "s2", seatId: "far-side" }]);
    expect(bad.breakdown.genderAdjacency).toBeGreaterThan(0.5);
    expect(good.breakdown.genderAdjacency).toBe(0);
    expect(bad.totalPenalty).toBeGreaterThan(good.totalPenalty);
    expect(bad.reasonCodes.some((r) => r.includes("옆자리"))).toBe(true);
  });

  it("바로 인접 금지 조건은 옆자리를 위반으로 판정한다", () => {
    const constraint = { studentAId: "s1", studentBId: "s2", type: "바로 인접 금지" as const, strength: "필수" as const };
    const result = evaluateAllocation({ ...input, pairConstraints: [constraint] }, [{ studentId: "s1", seatId: "c" }, { studentId: "s2", seatId: "side" }, { studentId: "s3", seatId: "far-side" }]);
    expect(result.hardViolations.some((v) => v.includes("필수 거리 조건"))).toBe(true);
  });
});
