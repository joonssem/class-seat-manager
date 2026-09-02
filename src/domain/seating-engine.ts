import type {
  AllocationCandidate,
  AllocationInput,
  ConfirmedSeatingSession,
  EngineSettings,
  Evaluation,
  Seat,
  SeatingAssignment,
  Student
} from "./models";

const DEFAULT_SETTINGS: EngineSettings = {
  nearDistance: 0.18,
  timeDecayLambda: 0.15,
  newcomerRelaxedSessions: 3,
  weights: {
    sameSeat: 30,
    repeatProximity: 25,
    genderAdjacency: 15,
    positionExperience: 15,
    studentPosition: 10,
    pairDistance: 5
  },
  restartCount: 12,
  maxIterations: 1500,
  diversityThreshold: 0.2
};

type AssignmentMap = Map<string, string>;
let generatedSeedOffset = 0;

function mergeSettings(input?: AllocationInput["settings"]): EngineSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    weights: { ...DEFAULT_SETTINGS.weights, ...(input?.weights ?? {}) }
  };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function distance(a: Seat, b: Seat): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

function maximumSeatDistance(seats: Seat[]): number {
  let maximum = 0;
  for (let i = 0; i < seats.length; i += 1) {
    for (let j = i + 1; j < seats.length; j += 1) maximum = Math.max(maximum, distance(seats[i], seats[j]));
  }
  return maximum;
}

function seatById(seats: Seat[]): Map<string, Seat> {
  return new Map(seats.map((seat) => [seat.seatId, seat]));
}

function assignmentToMap(assignments: SeatingAssignment[]): AssignmentMap {
  return new Map(assignments.map((item) => [item.studentId, item.seatId]));
}

function mapToAssignments(map: AssignmentMap): SeatingAssignment[] {
  return [...map.entries()].map(([studentId, seatId]) => ({ studentId, seatId }));
}

function activeStudents(students: Student[]): Student[] {
  return students.filter((student) => student.enrollmentStatus === "재학");
}

function historyWeight(sessionIndex: number, historyLength: number, lambda: number): number {
  return Math.exp(-lambda * (historyLength - 1 - sessionIndex));
}

function historySeatCount(studentId: string, seatId: string, history: ConfirmedSeatingSession[], lambda: number): number {
  return history.reduce((total, session, index) => total + (session.assignments.some((a) => a.studentId === studentId && a.seatId === seatId) ? historyWeight(index, history.length, lambda) : 0), 0);
}

function historyNearPairs(history: ConfirmedSeatingSession[], seats: Seat[], nearDistance: number, lambda: number): Map<string, number> {
  const result = new Map<string, number>();
  const bySeat = seatById(seats);
  for (const [sessionIndex, session] of history.entries()) {
    for (let i = 0; i < session.assignments.length; i += 1) {
      for (let j = i + 1; j < session.assignments.length; j += 1) {
        const left = session.assignments[i];
        const right = session.assignments[j];
        const leftSeat = bySeat.get(left.seatId);
        const rightSeat = bySeat.get(right.seatId);
        if (!leftSeat || !rightSeat || distance(leftSeat, rightSeat) > nearDistance) continue;
        const key = pairKey(left.studentId, right.studentId);
        result.set(key, (result.get(key) ?? 0) + historyWeight(sessionIndex, history.length, lambda));
      }
    }
  }
  return result;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

function positionValue(seat: Seat, tag: string): string | boolean | undefined {
  return seat.position[tag as keyof typeof seat.position];
}

export function validateAllocation(input: AllocationInput, assignments: SeatingAssignment[]): string[] {
  const students = activeStudents(input.students);
  const seats = input.seats.filter((seat) => seat.isActive);
  const studentIds = new Set(students.map((student) => student.studentId));
  const seatIds = new Set(seats.map((seat) => seat.seatId));
  const errors: string[] = [];
  if (seats.length < students.length) errors.push("활성 좌석 수가 재학생 수보다 적습니다.");
  if (assignments.length !== students.length) errors.push("모든 재학생이 정확히 한 번 배정되어야 합니다.");
  if (new Set(assignments.map((a) => a.studentId)).size !== assignments.length) errors.push("학생 중복 배정이 있습니다.");
  if (new Set(assignments.map((a) => a.seatId)).size !== assignments.length) errors.push("좌석 중복 배정이 있습니다.");
  for (const assignment of assignments) {
    if (!studentIds.has(assignment.studentId)) errors.push(`자동배치 대상이 아닌 학생: ${assignment.studentId}`);
    if (!seatIds.has(assignment.seatId)) errors.push(`활성 좌석이 아닌 좌석: ${assignment.seatId}`);
  }
  return [...new Set(errors)];
}

export function evaluateAllocation(input: AllocationInput, assignments: SeatingAssignment[]): Evaluation {
  const settings = mergeSettings(input.settings);
  const students = activeStudents(input.students);
  const seats = input.seats.filter((seat) => seat.isActive);
  const byStudent = new Map(students.map((student) => [student.studentId, student]));
  const bySeat = seatById(seats);
  const maxSeatDistance = maximumSeatDistance(seats);
  const assignmentMap = assignmentToMap(assignments);
  const nearPairs = historyNearPairs(input.history, seats, settings.nearDistance, settings.timeDecayLambda);
  const breakdown = { sameSeat: 0, repeatProximity: 0, genderAdjacency: 0, positionExperience: 0, studentPosition: 0, pairDistance: 0 };
  const reasonCodes: string[] = [];
  const hardViolations = validateAllocation(input, assignments);
  const pairDetails: Evaluation["pairDetails"] = [];
  const historyLength = Math.max(input.history.length, 1);

  for (const student of students) {
    const seat = bySeat.get(assignmentMap.get(student.studentId) ?? "");
    if (!seat) continue;
    const same = historySeatCount(student.studentId, seat.seatId, input.history, settings.timeDecayLambda);
    breakdown.sameSeat += same / historyLength;
    const newcomer = input.history.length < settings.newcomerRelaxedSessions && !input.history.some((s) => s.assignments.some((a) => a.studentId === student.studentId));
    if (!newcomer) {
      breakdown.positionExperience += samePositionPenalty(student.studentId, seat, input.history, seats, settings.timeDecayLambda);
    }
    for (const constraint of input.seatConstraints ?? []) {
      if (constraint.studentId !== student.studentId) continue;
      if (positionValue(seat, constraint.tag) !== (constraint.expected ?? true)) {
        const multiplier = constraint.strength === "필수" ? 10 : constraint.strength === "가급적" ? 3 : 1;
        breakdown.studentPosition += multiplier;
        reasonCodes.push(`${student.name}: 위치 조건 미충족`);
        if (constraint.strength === "필수") hardViolations.push(`${student.name}의 필수 위치 조건을 만족하지 못했습니다.`);
      }
    }
  }

  for (let i = 0; i < assignments.length; i += 1) {
    for (let j = i + 1; j < assignments.length; j += 1) {
      const a = assignments[i];
      const b = assignments[j];
      const seatA = bySeat.get(a.seatId);
      const seatB = bySeat.get(b.seatId);
      const studentA = byStudent.get(a.studentId);
      const studentB = byStudent.get(b.studentId);
      if (!seatA || !seatB || !studentA || !studentB) continue;
      const currentDistance = distance(seatA, seatB);
      if (currentDistance <= settings.nearDistance && studentA.gender === studentB.gender) breakdown.genderAdjacency += 1;
      const pair = pairKey(a.studentId, b.studentId);
      const oldNear = nearPairs.get(pair) ?? 0;
      if (currentDistance <= settings.nearDistance && oldNear > 0) breakdown.repeatProximity += oldNear;
      for (const constraint of input.pairConstraints ?? []) {
        if (pairKey(constraint.studentAId, constraint.studentBId) !== pair) continue;
        if (constraint.type === "가능한 한 멀리") {
          const normalizedShortfall = maxSeatDistance > 0 ? Math.max(0, 1 - currentDistance / maxSeatDistance) : 0;
          const multiplier = constraint.strength === "필수" ? 10 : constraint.strength === "가급적" ? 3 : 1;
          breakdown.pairDistance += normalizedShortfall * multiplier;
          pairDetails.push({ studentAId: studentA.studentId, studentAName: studentA.name, studentBId: studentB.studentId, studentBName: studentB.name, seatAId: seatA.seatId, seatBId: seatB.seatId, type: constraint.type, strength: constraint.strength, currentDistance, targetDistance: maxSeatDistance, status: normalizedShortfall === 0 ? "satisfied" : "warning" });
          continue;
        }
        const violated = constraint.type === "바로 인접 금지" ? currentDistance <= settings.nearDistance : constraint.minDistance !== undefined && currentDistance < constraint.minDistance;
        pairDetails.push({ studentAId: studentA.studentId, studentAName: studentA.name, studentBId: studentB.studentId, studentBName: studentB.name, seatAId: seatA.seatId, seatBId: seatB.seatId, type: constraint.type, strength: constraint.strength, currentDistance, targetDistance: constraint.type === "바로 인접 금지" ? settings.nearDistance : constraint.minDistance, status: violated ? constraint.strength === "필수" ? "violation" : "warning" : "satisfied" });
        if (violated) {
          const multiplier = constraint.strength === "필수" ? 10 : constraint.strength === "가급적" ? 3 : 1;
          breakdown.pairDistance += multiplier;
          reasonCodes.push(`${studentA.name}·${studentB.name}: 거리 조건 미충족`);
          if (constraint.strength === "필수") hardViolations.push(`${studentA.name}과 ${studentB.name}의 필수 거리 조건을 만족하지 못했습니다.`);
        }
      }
    }
  }

  const weighted = settings.weights;
  const totalPenalty = breakdown.sameSeat * weighted.sameSeat + breakdown.repeatProximity * weighted.repeatProximity + breakdown.genderAdjacency * weighted.genderAdjacency + breakdown.positionExperience * weighted.positionExperience + breakdown.studentPosition * weighted.studentPosition + breakdown.pairDistance * weighted.pairDistance;
  const maxPenalty = Math.max(1, students.length * 100);
  const conditionSummary = [
    { group: "자리 이력", label: "같은 자리 반복", status: breakdown.sameSeat === 0 ? "satisfied" as const : "warning" as const, detail: breakdown.sameSeat === 0 ? "반복된 자리가 없습니다." : "과거에 사용한 자리와 겹치는 정도를 반영했습니다.", penalty: breakdown.sameSeat },
    { group: "자리 이력", label: "과거 근접 반복", status: breakdown.repeatProximity === 0 ? "satisfied" as const : "warning" as const, detail: breakdown.repeatProximity === 0 ? "과거 근접 pair 반복이 없습니다." : "과거에 가까웠던 학생 pair의 반복을 반영했습니다.", penalty: breakdown.repeatProximity },
    { group: "성별 균형", label: "성별 인접", status: breakdown.genderAdjacency === 0 ? "satisfied" as const : "warning" as const, detail: breakdown.genderAdjacency === 0 ? "성별 인접 패널티가 없습니다." : "가까운 좌석의 같은 성별 인접을 반영했습니다.", penalty: breakdown.genderAdjacency },
    { group: "학생 조건", label: "학생 위치 조건", status: breakdown.studentPosition === 0 ? "satisfied" as const : "violation" as const, detail: `${input.seatConstraints?.length ?? 0}개 조건을 평가했습니다.`, penalty: breakdown.studentPosition },
    { group: "학생 간 짝", label: "학생 간 짝 거리", status: breakdown.pairDistance === 0 ? "satisfied" as const : "warning" as const, detail: `${input.pairConstraints?.length ?? 0}개 짝 조건을 평가했습니다.`, penalty: breakdown.pairDistance },
    { group: "자리 이력", label: "위치 경험", status: breakdown.positionExperience === 0 ? "satisfied" as const : "warning" as const, detail: "과거 앞·중간·뒤 및 좌·중·우 경험을 반영했습니다.", penalty: breakdown.positionExperience }
  ];
  return { totalPenalty, score: Math.max(0, Math.round(100 - (totalPenalty / maxPenalty) * 100)), hardViolations: [...new Set(hardViolations)], breakdown, reasonCodes: [...new Set(reasonCodes)], conditionSummary, pairDetails };
}

function samePositionPenalty(studentId: string, seat: Seat, history: ConfirmedSeatingSession[], seats: Seat[], lambda: number): number {
  const tags: Array<keyof Seat["position"]> = ["vertical", "horizontal", "nearFrontDoor", "nearBackDoor"];
  const bySeat = seatById(seats);
  let penalty = 0;
  for (const tag of tags) {
    const count = history.reduce((total, session, sessionIndex) => {
      const assignment = session.assignments.find((item) => item.studentId === studentId);
      const historicalSeat = assignment ? bySeat.get(assignment.seatId) : undefined;
      return total + (historicalSeat ? Number(positionValue(historicalSeat, tag) === positionValue(seat, tag)) * historyWeight(sessionIndex, history.length, lambda) : 0);
    }, 0);
    penalty += count;
  }
  return penalty;
}

function randomInitialAssignment(students: Student[], seats: Seat[], random: () => number): AssignmentMap {
  const shuffled = [...seats].sort(() => random() - 0.5);
  return new Map(students.map((student, index) => [student.studentId, shuffled[index].seatId]));
}

function swapRandom(map: AssignmentMap, students: Student[], random: () => number): AssignmentMap {
  const result = new Map(map);
  const a = students[Math.floor(random() * students.length)].studentId;
  let b = students[Math.floor(random() * students.length)].studentId;
  if (a === b && students.length > 1) b = students[(students.findIndex((student) => student.studentId === a) + 1) % students.length].studentId;
  const seatA = result.get(a);
  const seatB = result.get(b);
  if (seatA && seatB) { result.set(a, seatB); result.set(b, seatA); }
  return result;
}

export function generateCandidates(input: AllocationInput): AllocationCandidate[] {
  const settings = mergeSettings(input.settings);
  const students = activeStudents(input.students);
  const seats = input.seats.filter((seat) => seat.isActive);
  if (seats.length < students.length) return [];
  // Explicit seeds keep tests and investigations reproducible. Interactive generation
  // receives a fresh seed so pressing "후보 생성" does not repeat the same candidates.
  const baseSeed = input.seed ?? Date.now() + generatedSeedOffset++;
  const candidates: AllocationCandidate[] = [];
  for (let restart = 0; restart < settings.restartCount; restart += 1) {
    const seed = baseSeed + restart;
    const random = seededRandom(seed);
    let current = randomInitialAssignment(students, seats, random);
    let currentEvaluation = evaluateAllocation(input, mapToAssignments(current));
    for (let iteration = 0; iteration < settings.maxIterations; iteration += 1) {
      const next = swapRandom(current, students, random);
      const nextEvaluation = evaluateAllocation(input, mapToAssignments(next));
      if (nextEvaluation.hardViolations.length < currentEvaluation.hardViolations.length || (nextEvaluation.hardViolations.length === currentEvaluation.hardViolations.length && nextEvaluation.totalPenalty <= currentEvaluation.totalPenalty)) {
        current = next;
        currentEvaluation = nextEvaluation;
      }
    }
    if (currentEvaluation.hardViolations.length === 0) candidates.push({ assignments: mapToAssignments(current), evaluation: currentEvaluation, seed, algorithmVersion: "random-restart-swap-v1" });
  }
  candidates.sort((a, b) => b.evaluation.score - a.evaluation.score);
  const selected: AllocationCandidate[] = [];
  for (const candidate of candidates) {
    const isTooSimilar = selected.some((existing) => {
      const existingMap = assignmentToMap(existing.assignments);
      const same = candidate.assignments.filter((item) => existingMap.get(item.studentId) === item.seatId).length;
      return same / students.length > 1 - settings.diversityThreshold;
    });
    if (!isTooSimilar) selected.push(candidate);
    if (selected.length === 3) break;
  }
  return selected;
}
