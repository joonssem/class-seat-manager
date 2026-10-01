import { describe, expect, it } from "vitest";
import { createSeatChart, fitSeatChart, regularizeSeatChart } from "../../src/domain/seat-chart";
import { seats, students } from "../fixtures/seat-fixture";

describe("자리표 변환", () => {
  it("학생용과 교사용 좌석 배열을 구분한다", () => {
    const items = seats.map((seat) => ({ id: seat.seatId, type: "desk" as const, x: seat.x, y: seat.y, width: seat.width, height: seat.height }));
    const assignments = [{ studentId: students[0].studentId, seatId: seats[0].seatId }];
    const student = createSeatChart(items, students, assignments, "student")[0];
    const teacher = createSeatChart(items, students, assignments, "teacher")[0];
    expect(student.label).toContain(students[0].name);
    expect(teacher.x).toBeCloseTo(1 - student.x - student.width);
    expect(teacher.y).toBeCloseTo(1 - student.y - student.height);
  });

  it("비정사각형 좌석도 교실 중심 기준 점대칭한다", () => {
    const item = { id: "seat-wide", type: "desk" as const, x: 0.2, y: 0.15, width: 0.2, height: 0.1 };
    const teacher = createSeatChart([item], [], [], "teacher")[0];
    expect(teacher.x).toBeCloseTo(0.6);
    expect(teacher.y).toBeCloseTo(0.75);
    expect(teacher.width).toBeCloseTo(0.2);
    expect(teacher.height).toBeCloseTo(0.1);
  });

  const cell = (seatId: string, x: number, y: number) => ({ seatId, label: seatId, x, y, width: 0.1, height: 0.1 });

  it("한쪽에 몰린 좌석을 표시 영역 가운데로 옮기고 여백을 같게 만든다", () => {
    const fitted = fitSeatChart([cell("a", 0.05, 0.1), cell("b", 0.65, 0.1), cell("c", 0.05, 0.8), cell("d", 0.65, 0.8)]);
    const left = Math.min(...fitted.map((c) => c.x));
    const right = 1 - Math.max(...fitted.map((c) => c.x + c.width));
    const top = Math.min(...fitted.map((c) => c.y));
    const bottom = 1 - Math.max(...fitted.map((c) => c.y + c.height));
    expect(left).toBeCloseTo(right);
    expect(top).toBeCloseTo(bottom);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it("좁은 배치가 지나치게 가로로 늘어나지 않는다", () => {
    const fitted = fitSeatChart([cell("a", 0.4, 0.1), cell("b", 0.5, 0.8)], { maxStretch: 1.3 });
    expect(fitted[0].width / fitted[0].height).toBeLessThanOrEqual(1.3 + 1e-9);
  });

  it("들쭉날쭉한 줄은 한 선에 맞추고 간격을 균등하게 편다", () => {
    const xs = [0.05, 0.24, 0.45, 0.65];
    const cells = xs.flatMap((x, column) => [0.2, 0.34].map((y, row) => cell(`s${column}${row}`, x + (row ? 0.01 : 0), y)));
    const regular = regularizeSeatChart(cells);
    const columnCenters = [0, 1, 2, 3].map((column) => regular.find((c) => c.seatId === `s${column}0`)!.x);
    const gaps = columnCenters.slice(1).map((v, i) => v - columnCenters[i]);
    expect(gaps[0]).toBeCloseTo(gaps[1]);
    expect(gaps[1]).toBeCloseTo(gaps[2]);
    expect(regular.find((c) => c.seatId === "s00")!.x).toBeCloseTo(regular.find((c) => c.seatId === "s01")!.x);
  });

  it("복도처럼 의도적으로 넓힌 간격은 유지한다", () => {
    const cells = [0.05, 0.2, 0.35, 0.75].map((x, i) => cell(`s${i}`, x, 0.2));
    const regular = regularizeSeatChart(cells);
    expect(regular[3].x - regular[2].x).toBeGreaterThan((regular[1].x - regular[0].x) * 2);
  });
});
