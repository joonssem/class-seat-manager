import { describe, expect, it } from "vitest";
import { generateGroups, groupAssignments, groupLayout, reviewGroups, type GroupInput } from "../../src/domain/group-seating";
import type { Student } from "../../src/domain/models";

export const groupStudents: Student[] = Array.from({ length: 21 }, (_, i) => ({ studentId: `s${i + 1}`, schoolYearId: "sy", studentNumber: i + 1, name: `학생${i + 1}`, gender: i < 9 ? "남" : "여", enrollmentStatus: "재학", createdAt: "", updatedAt: "" }));
const input: GroupInput = { students: groupStudents, sizes: [4, 4, 4, 4, 5], pairs: [], positions: [], spreadIds: [], fixtures: [], namespace: "sy" };

describe("cooperative group allocation", () => {
  it("assigns 21 students once, balances 9 boys and 12 girls, and spreads five selected students", () => {
    const configured = { ...input, spreadIds: ["s1", "s2", "s3", "s4", "s5"], pairs: [{ studentAId: "s1", studentBId: "s10", type: "바로 인접 금지" as const, strength: "필수" as const }] };
    const plan = generateGroups(configured, 123);
    expect(plan.review.hard).toEqual([]);
    expect(plan.groups.map((g) => g.length)).toEqual([4, 4, 4, 4, 5]);
    expect(new Set(plan.groups.flat()).size).toBe(21);
    expect(plan.groups.every((g) => g.filter((id) => configured.spreadIds.includes(id)).length === 1)).toBe(true);
    expect(plan.groups.map((g) => g.filter((id) => Number(id.slice(1)) <= 9).length).sort()).toEqual([1, 2, 2, 2, 2]);
    expect(plan.groups.find((g) => g.includes("s1"))?.includes("s10")).toBe(false);
    expect(Number(plan.groups[4][4].slice(1))).toBeLessThanOrEqual(9);
    expect(generateGroups(configured, 123).groups).toEqual(plan.groups);
  });
  it("shows infeasible mandatory membership conflicts instead of accepting them", () => {
    const pairs: GroupInput["pairs"] = [];
    for (let a = 1; a <= 6; a++) for (let b = a + 1; b <= 6; b++) pairs.push({ studentAId: `s${a}`, studentBId: `s${b}`, type: "가능한 한 멀리", strength: "필수" });
    expect(generateGroups({ ...input, pairs }, 7).review.hard.length).toBeGreaterThan(0);
  });
  it("rechecks manual swaps, distinguishes soft and hard conditions, and validates membership", () => {
    const groups = [groupStudents.slice(0, 4), groupStudents.slice(4, 8), groupStudents.slice(8, 12), groupStudents.slice(12, 16), groupStudents.slice(16)].map((g) => g.map((s) => s.studentId));
    groups[2][0] = "s21"; groups[4][4] = "s9";
    const pair = { studentAId: "s1", studentBId: "s2", type: "최소 거리" as const, strength: "가급적" as const };
    const soft = reviewGroups({ ...input, pairs: [{ ...pair, type: "최소 거리", minDistance: 100 }] }, groups);
    expect(soft.hard).toEqual([]); expect(soft.warnings.some((m) => m.includes("같은 모둠"))).toBe(true);
    expect(reviewGroups({ ...input, pairs: [{ ...pair, type: "최소 거리", minDistance: 100, strength: "필수" }] }, groups).hard.length).toBeGreaterThan(0);
    const duplicate = groups.map((g) => [...g]); duplicate[0][0] = duplicate[0][1];
    expect(reviewGroups(input, duplicate).hard.length).toBeGreaterThan(0);
    expect(reviewGroups({ ...input, positions: [{ studentId: "s1", tag: "vertical", expected: "뒤", strength: "필수" }] }, groups).hard.some((m) => m.includes("위치 조건"))).toBe(true);
  });
  it("rejects wrong totals, oversized groups and excess spread selections", () => {
    expect(() => generateGroups({ ...input, sizes: [4, 4] })).toThrow("합계");
    expect(() => generateGroups({ ...input, sizes: [6, 5, 5, 5] })).toThrow("3~5명");
    expect(() => generateGroups({ ...input, spreadIds: groupStudents.slice(0, 6).map((s) => s.studentId) })).toThrow("모둠 수");
  });
  it("requires a boy in the fifth group's rear seat after manual exchanges", () => {
    const plan = generateGroups(input, 81);
    const groups = plan.groups.map((g) => [...g]);
    const femaleIndex = groups[4].findIndex((id) => groupStudents.find((s) => s.studentId === id)?.gender === "여");
    [groups[4][4], groups[4][femaleIndex]] = [groups[4][femaleIndex], groups[4][4]];
    expect(reviewGroups(input, groups).hard).toContain("5모둠의 가장 뒷자리(5번 자리)는 남학생으로 배정하세요.");
  });
  it("creates nonoverlapping desks and retains fixtures and unique assignment IDs", () => {
    const board = { id: "board", type: "chalkboard" as const, x: 0.4, y: 0, width: 0.2, height: 0.05 };
    const layout = groupLayout(input.sizes, "sy", [board]);
    expect(layout).toContainEqual(board);
    const desks = layout.filter((i) => i.type === "desk");
    expect(desks).toHaveLength(21);
    for (const desk of desks) { expect(desk.x + desk.width).toBeLessThanOrEqual(1); expect(desk.y + desk.height).toBeLessThanOrEqual(1); }
    for (let a = 0; a < desks.length; a++) for (let b = a + 1; b < desks.length; b++) {
      const xOverlap = Math.min(desks[a].x + desks[a].width, desks[b].x + desks[b].width) - Math.max(desks[a].x, desks[b].x);
      const yOverlap = Math.min(desks[a].y + desks[a].height, desks[b].y + desks[b].height) - Math.max(desks[a].y, desks[b].y);
      expect(xOverlap > 1e-9 && yOverlap > 1e-9).toBe(false);
    }
    const plan = generateGroups(input, 42);
    expect(new Set(groupAssignments(plan.groups, layout).map((a) => a.seatId)).size).toBe(21);
  });
});
