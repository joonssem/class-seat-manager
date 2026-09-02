import type { Student, StudentPairConstraint } from "./models";

export interface CafeteriaAssignment { studentId: string; queueOrder: number; cafeteriaSeatId: string; role?: "marshal"; }
export interface CafeteriaPairDetail { studentAId: string; studentBId: string; type: StudentPairConstraint["type"]; strength: StudentPairConstraint["strength"]; queueDistance: number; seatDistance: number; facing: boolean; status: "satisfied" | "warning" | "violation"; penalty: number; }
export interface CafeteriaEvaluation { score: number; totalPenalty: number; pairDetails: CafeteriaPairDetail[]; }
export interface CafeteriaResult { assignments: CafeteriaAssignment[]; seed: number; marshalIds: string[]; evaluation: CafeteriaEvaluation; }

const studentSeats = Array.from({ length: 19 }, (_, index) => `CAF-${String(index + 3).padStart(2, "0")}`);
const facingSeat = (seatId: string): string => {
  const number = Number(seatId.slice(-2));
  return `CAF-${String(number <= 11 ? number + 11 : number - 11).padStart(2, "0")}`;
};
const random = (seed: number): (() => number) => { let state = seed >>> 0; return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; }; };
const shuffle = <T,>(items: T[], rng: () => number): T[] => [...items].sort(() => rng() - 0.5);
const pairKey = (a: string, b: string): string => [a, b].sort().join("::");

export function validateCafeteriaAssignments(assignments: CafeteriaAssignment[]): string[] {
  const errors: string[] = [];
  if (assignments.length > 21) errors.push("급식실 학생 자리는 최대 21자리입니다.");
  if (new Set(assignments.map((item) => item.studentId)).size !== assignments.length) errors.push("급식실 배치에 학생 중복이 있습니다.");
  if (new Set(assignments.map((item) => item.cafeteriaSeatId)).size !== assignments.length) errors.push("급식실 좌석 중복이 있습니다.");
  if (assignments.some((item) => !Number.isInteger(item.queueOrder) || item.queueOrder < 1 || item.queueOrder > 21)) errors.push("줄서기 순번은 1부터 21 사이여야 합니다.");
  if (assignments.some((item) => !/^CAF-(0[2-9]|1[0-9]|2[0-2])$/.test(item.cafeteriaSeatId))) errors.push("급식실 학생 좌석 ID가 올바르지 않습니다.");
  if (new Set(assignments.map((item) => item.queueOrder)).size !== assignments.length) errors.push("줄서기 순번이 중복됩니다.");
  if (assignments.filter((item) => item.role === "marshal").some((item) => item.cafeteriaSeatId !== "CAF-02" && item.cafeteriaSeatId !== "CAF-22")) errors.push("인솔 학생은 2번 또는 22번 자리에 배정해야 합니다.");
  return errors;
}

export function evaluateCafeteriaPairs(assignments: CafeteriaAssignment[], constraints: StudentPairConstraint[]): CafeteriaEvaluation {
  const byStudent = new Map(assignments.map((item) => [item.studentId, item]));
  const pairDetails: CafeteriaPairDetail[] = [];
  const totalPenalty = constraints.reduce((total, constraint) => {
    const a = byStudent.get(constraint.studentAId); const b = byStudent.get(constraint.studentBId);
    if (!a || !b) return total;
    const queueDistance = Math.abs(a.queueOrder - b.queueOrder);
    const seatNumbers = [Number(a.cafeteriaSeatId.slice(-2)), Number(b.cafeteriaSeatId.slice(-2))];
    const seatDistance = Math.abs((seatNumbers[0] - 1) % 11 - (seatNumbers[1] - 1) % 11) + (Math.floor((seatNumbers[0] - 1) / 11) === Math.floor((seatNumbers[1] - 1) / 11) ? 0 : 1);
    const facing = facingSeat(a.cafeteriaSeatId) === b.cafeteriaSeatId;
    const multiplier = constraint.strength === "필수" ? 10 : constraint.strength === "가급적" ? 3 : 1;
    const violated = constraint.type === "바로 인접 금지" ? queueDistance <= 1 || facing || seatDistance <= 1 : constraint.type === "최소 거리" ? queueDistance < (constraint.minDistance ?? 1) || seatDistance < (constraint.minDistance ?? 1) : false;
    const penalty = constraint.type === "가능한 한 멀리" ? multiplier * (1 / Math.max(queueDistance, 1) + 1 / Math.max(seatDistance, 1)) : violated ? multiplier : 0;
    pairDetails.push({ studentAId: constraint.studentAId, studentBId: constraint.studentBId, type: constraint.type, strength: constraint.strength, queueDistance, seatDistance, facing, status: violated ? constraint.strength === "필수" ? "violation" : "warning" : penalty === 0 ? "satisfied" : "warning", penalty });
    return total + penalty;
  }, 0);
  return { totalPenalty, score: Math.max(0, Math.round(100 - Math.min(100, totalPenalty * 10))), pairDetails };
}

export function generateCafeteriaResult(students: Student[], marshalCandidateIds: string[] = [], seed = Date.now(), pairConstraints: StudentPairConstraint[] = []): CafeteriaResult {
  const active = students.filter((student) => student.enrollmentStatus === "재학");
  if (active.length > 21) throw new Error("급식실 학생 자리는 21명까지 배정할 수 있습니다.");
  const rng = random(seed);
  const candidates = active.filter((student) => marshalCandidateIds.includes(student.studentId));
  if (marshalCandidateIds.length && candidates.length < 2) throw new Error("인솔 후보 중 재학생이 2명 이상 필요합니다.");
  const marshalIds = marshalCandidateIds.length ? shuffle(candidates, rng).slice(0, 2).map((student) => student.studentId) : [];
  const marshals = marshalIds.map((studentId, index) => ({ studentId, queueOrder: active.length - 1 + index, cafeteriaSeatId: index === 0 ? "CAF-02" : "CAF-22", role: "marshal" as const }));
  let queue = shuffle(active.filter((student) => !marshalIds.includes(student.studentId)), rng);
  const makeAssignments = (rows: Student[]): CafeteriaAssignment[] => [...rows.map((student, index) => ({ studentId: student.studentId, queueOrder: index + 1, cafeteriaSeatId: studentSeats[index] })), ...marshals];
  let best = makeAssignments(queue); let bestEvaluation = evaluateCafeteriaPairs(best, pairConstraints);
  for (let attempt = 0; attempt < 300; attempt += 1) { const next = shuffle(queue, rng); const evaluation = evaluateCafeteriaPairs(makeAssignments(next), pairConstraints); if (evaluation.totalPenalty <= bestEvaluation.totalPenalty) { queue = next; best = makeAssignments(next); bestEvaluation = evaluation; } }
  const assignments = best.sort((a, b) => a.queueOrder - b.queueOrder);
  return { assignments, seed, marshalIds, evaluation: evaluateCafeteriaPairs(assignments, pairConstraints) };
}
