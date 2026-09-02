import { describe, expect, it } from "vitest";
import { createSeatChart } from "../../src/domain/seat-chart";
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
});
