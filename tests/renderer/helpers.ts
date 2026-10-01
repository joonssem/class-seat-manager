import { vi } from "vitest";
import type { AppApi } from "../../src/shared/contracts/app";
import type { Student } from "../../src/domain/models";
import type { LayoutItem } from "../../src/domain/classroom-layout";

export const students: Student[] = [
  { studentId: "s1", schoolYearId: "sy", studentNumber: 1, name: "김하나", gender: "남", enrollmentStatus: "재학", createdAt: "", updatedAt: "" },
  { studentId: "s2", schoolYearId: "sy", studentNumber: 2, name: "이두리", gender: "여", enrollmentStatus: "재학", createdAt: "", updatedAt: "" }
];

export const desks: LayoutItem[] = [
  { id: "seat-1", type: "desk", x: 0.05, y: 0.2, width: 0.1, height: 0.12 },
  { id: "seat-2", type: "desk", x: 0.7, y: 0.6, width: 0.1, height: 0.12 }
];

export const evaluation = {
  totalPenalty: 1, score: 88, hardViolations: [], reasonCodes: [],
  breakdown: { sameSeat: 0, repeatProximity: 0, genderAdjacency: 0.5, positionExperience: 0, studentPosition: 0, pairDistance: 0, groupActivity: 0 },
  conditionSummary: [{ group: "성별 균형", label: "성별 인접", status: "warning" as const, detail: "가까운 좌석의 같은 성별 인접을 반영했습니다.", penalty: 0.5 }],
  pairDetails: [{ studentAId: "s1", studentAName: "김하나", studentBId: "s2", studentBName: "이두리", seatAId: "seat-1", seatBId: "seat-2", type: "가능한 한 멀리" as const, strength: "가급적" as const, currentDistance: 0.2, targetDistance: 0.9, relation: "옆자리", risk: 0.9, status: "warning" as const }]
};

export function installAppApi(overrides: Partial<{ generate: AppApi["seating"]["generate"]; evaluate: AppApi["seating"]["evaluate"] }> = {}) {
  const api = {
    students: { list: vi.fn().mockResolvedValue(students) },
    classroom: { get: vi.fn().mockResolvedValue({ classroomLayoutId: "layout", schoolYearId: "sy", items: desks }) },
    seating: {
      cancelGenerate: vi.fn().mockResolvedValue(undefined),
      onGenerateProgress: vi.fn(() => () => undefined),
      generate: vi.fn(overrides.generate ?? (() => Promise.resolve([
        { seed: 1, algorithmVersion: "t", assignments: [{ studentId: "s1", seatId: "seat-1" }, { studentId: "s2", seatId: "seat-2" }], evaluation },
        { seed: 2, algorithmVersion: "t", assignments: [{ studentId: "s2", seatId: "seat-1" }, { studentId: "s1", seatId: "seat-2" }], evaluation: { ...evaluation, score: 70 } }
      ]))),
      evaluate: vi.fn(overrides.evaluate ?? (() => Promise.resolve({ ...evaluation, score: 55 })))
    }
  };
  (window as unknown as { appApi: unknown }).appApi = api;
  return api;
}
