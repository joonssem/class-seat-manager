import type { Student, StudentPairConstraint } from "./models";

export interface CafeteriaAssignment { studentId: string; queueOrder: number; cafeteriaSeatId: string; role?: "marshal"; }
export interface CafeteriaPairDetail { studentAId: string; studentBId: string; type: StudentPairConstraint["type"]; strength: StudentPairConstraint["strength"]; queueDistance: number; seatDistance: number; facing: boolean; status: "satisfied" | "warning" | "violation"; penalty: number; }
export interface CafeteriaEvaluation { score: number; totalPenalty: number; genderAdjacencyPenalty: number; genderScore: number; pairDetails: CafeteriaPairDetail[]; }
export interface CafeteriaResult { assignments: CafeteriaAssignment[]; seed: number; marshalIds: string[]; evaluation: CafeteriaEvaluation; }
export type CafeteriaGenerationMode = "random" | "marshal";

const randomStudentSeats = Array.from({ length: 21 }, (_, index) => `CAF-${String(index + 2).padStart(2, "0")}`);
const marshalQueueSeats = Array.from({ length: 19 }, (_, index) => `CAF-${String(index + 3).padStart(2, "0")}`);
const facingSeat = (seatId: string): string => {
  const number = Number(seatId.slice(-2));
  return `CAF-${String(number <= 11 ? number + 11 : number - 11).padStart(2, "0")}`;
};
const random = (seed: number): (() => number) => { let state = seed >>> 0; return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; }; };
const shuffle = <T,>(items: T[], rng: () => number): T[] => [...items].sort(() => rng() - 0.5);

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

function genderAdjacencyPenalty(assignments: CafeteriaAssignment[], students: Student[]): number {
  const genderById = new Map(students.map((student) => [student.studentId, student.gender]));
  const bySeat = new Map(assignments.map((item) => [Number(item.cafeteriaSeatId.slice(-2)), item]));
  let penalty = 0;
  for (const row of [[2, 11], [12, 22]] as const) for (let seat = row[0]; seat < row[1]; seat += 1) {
    const current = bySeat.get(seat); const next = bySeat.get(seat + 1);
    if (current && next && genderById.get(current.studentId) === genderById.get(next.studentId)) penalty += 1;
  }
  return penalty;
}

export function evaluateCafeteriaPairs(assignments: CafeteriaAssignment[], constraints: StudentPairConstraint[], students: Student[] = []): CafeteriaEvaluation {
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
    // 마주보는 자리는 줄 거리나 같은 줄의 옆자리와 별개로 직접 대면하는 자리다.
    // 모든 pair 유형에서 이를 가까운 자리로 취급해 점수에 명시적으로 반영한다.
    const facingViolation = facing && constraint.type !== "바로 인접 금지";
    const violated = constraint.type === "바로 인접 금지" ? queueDistance <= 1 || facing || seatDistance <= 1 : constraint.type === "최소 거리" ? queueDistance < (constraint.minDistance ?? 1) || seatDistance < (constraint.minDistance ?? 1) || facingViolation : facingViolation;
    const penalty = constraint.type === "가능한 한 멀리" ? multiplier * (1 / Math.max(queueDistance, 1) + 1 / Math.max(seatDistance, 1) + (facing ? 1 : 0)) : violated ? multiplier : 0;
    pairDetails.push({ studentAId: constraint.studentAId, studentBId: constraint.studentBId, type: constraint.type, strength: constraint.strength, queueDistance, seatDistance, facing, status: violated ? constraint.strength === "필수" ? "violation" : "warning" : penalty === 0 ? "satisfied" : "warning", penalty });
    return total + penalty;
  }, 0);
  const genderPenalty = genderAdjacencyPenalty(assignments, students);
  return { totalPenalty, score: Math.max(0, Math.round(100 - Math.min(100, totalPenalty * 10))), genderAdjacencyPenalty: genderPenalty, genderScore: Math.max(0, Math.round(100 - genderPenalty * 10)), pairDetails };
}

export function generateCafeteriaResult(students: Student[], marshalCandidateIds: string[] = [], seed = Date.now(), pairConstraints: StudentPairConstraint[] = [], mode: CafeteriaGenerationMode = "random"): CafeteriaResult {
  const active = students.filter((student) => student.enrollmentStatus === "재학");
  if (active.length > 21) throw new Error("급식실 학생 자리는 21명까지 배정할 수 있습니다.");
  const rng = random(seed);
  const candidates = active.filter((student) => marshalCandidateIds.includes(student.studentId));
  if (mode === "marshal" && candidates.length < 2) throw new Error("인솔 후보 중 재학생이 2명 이상 필요합니다.");

  if (mode === "random") {
    const makeAssignments = (rows: Student[]): CafeteriaAssignment[] => rows.map((student, index) => ({ studentId: student.studentId, queueOrder: index + 1, cafeteriaSeatId: randomStudentSeats[index] }));
    let queue = shuffle(active, rng);
    let best = makeAssignments(queue);
    let bestEvaluation = evaluateCafeteriaPairs(best, pairConstraints, active);
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const next = shuffle(queue, rng);
      const evaluation = evaluateCafeteriaPairs(makeAssignments(next), pairConstraints, active);
      if (evaluation.totalPenalty + evaluation.genderAdjacencyPenalty * 3 <= bestEvaluation.totalPenalty + bestEvaluation.genderAdjacencyPenalty * 3) { queue = next; best = makeAssignments(next); bestEvaluation = evaluation; }
    }
    const assignments = best.sort((a, b) => a.queueOrder - b.queueOrder);
    return { assignments, seed, marshalIds: candidates.map((student) => student.studentId), evaluation: evaluateCafeteriaPairs(assignments, pairConstraints, active) };
  }

  const marshalIds = shuffle(candidates, rng).slice(0, 2).map((student) => student.studentId);
  const marshals = marshalIds.map((studentId, index) => ({ studentId, queueOrder: active.length - 1 + index, cafeteriaSeatId: index === 0 ? "CAF-02" : "CAF-22", role: "marshal" as const }));
  let queue = shuffle(active.filter((student) => !marshalIds.includes(student.studentId)), rng);
  const makeAssignments = (rows: Student[]): CafeteriaAssignment[] => [...rows.map((student, index) => ({ studentId: student.studentId, queueOrder: index + 1, cafeteriaSeatId: marshalQueueSeats[index] })), ...marshals];
  let best = makeAssignments(queue); let bestEvaluation = evaluateCafeteriaPairs(best, pairConstraints, active);
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const next = shuffle(queue, rng); const evaluation = evaluateCafeteriaPairs(makeAssignments(next), pairConstraints, active);
    if (evaluation.totalPenalty + evaluation.genderAdjacencyPenalty * 3 <= bestEvaluation.totalPenalty + bestEvaluation.genderAdjacencyPenalty * 3) { queue = next; best = makeAssignments(next); bestEvaluation = evaluation; }
  }
  const assignments = best.sort((a, b) => a.queueOrder - b.queueOrder);
  return { assignments, seed, marshalIds, evaluation: evaluateCafeteriaPairs(assignments, pairConstraints, active) };
}
