import { describe, expect, it } from "vitest";
import { validateConstraintSet } from "../../src/application/constraint-service";

describe("자리배치 조건 검증", () => {
  it("자기 자신과 pair를 만들 수 없다", () => {
    expect(validateConstraintSet({ seat: [], pairs: [{ studentAId: "a", studentBId: "a", type: "바로 인접 금지", strength: "필수" }] })).toContain("같은 학생을 pair로 지정할 수 없습니다.");
  });
  it("최소 거리는 양수여야 한다", () => {
    expect(validateConstraintSet({ seat: [], pairs: [{ studentAId: "a", studentBId: "b", type: "최소 거리", minDistance: 0, strength: "가급적" }] })).toContain("최소 거리 조건에는 0보다 큰 거리를 입력해야 합니다.");
  });
});
