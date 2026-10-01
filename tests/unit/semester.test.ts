import { describe, expect, it } from "vitest";
import { semesterOf } from "../../src/domain/semester";

describe("배치일 기준 학기 분류", () => {
  it.each([["2026-03-02", 1], ["2026-08-31", 1], ["2026-09-01", 2], ["2026-12-20", 2], ["2027-01-15", 2], ["2027-02-28", 2]])("%s → %i학기", (date, semester) => {
    expect(semesterOf(date)).toBe(semester);
  });

  it("형식이 올바르지 않으면 undefined", () => {
    expect(semesterOf("")).toBeUndefined();
    expect(semesterOf("2026-13-01")).toBeUndefined();
    expect(semesterOf("26/03/01")).toBeUndefined();
  });
});
