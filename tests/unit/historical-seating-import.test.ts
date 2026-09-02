import { describe, expect, it } from "vitest";
import { parseHistoricalSession, validateHistoricalSession } from "../../src/domain/historical-seating-import";
import type { LayoutItem } from "../../src/domain/classroom-layout";
import { students } from "../fixtures/seat-fixture";

const desks: LayoutItem[] = [
  { id: "seat-01", type: "desk", x: 0, y: 0, width: 0.1, height: 0.1 },
  { id: "seat-02", type: "desk", x: 0.2, y: 0, width: 0.1, height: 0.1 }
];

describe("historical seating import", () => {
  it("parses tab-separated historical rows", () => {
    expect(parseHistoricalSession("학생 이름\t자리 번호\n학생1\t01\n학생2\tseat-02", 1).assignments).toHaveLength(2);
  });

  it("matches names and seat numbers and detects duplicates", () => {
    const result = validateHistoricalSession(parseHistoricalSession("학생1\t01\n학생1\t02", 1), students, desks);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("학생이 중복 배정되었습니다.");
  });
});
