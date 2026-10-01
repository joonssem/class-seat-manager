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
import { columnGroups } from "./seat-groups";
import { gridDistance, gridSpacing, type GridSpacing } from "./seat-grid";
import { DEFAULT_PROXIMITY, seatProximity, type SeatProximity } from "./seat-proximity";

const DEFAULT_SETTINGS: EngineSettings = {
  proximity: DEFAULT_PROXIMITY,
  timeDecayLambda: 0.15,
  newcomerRelaxedSessions: 3,
  weights: {
    sameSeat: 30,
    repeatProximity: 25,
    genderAdjacency: 40,
    positionExperience: 15,
    studentPosition: 10,
    pairDistance: 15,
    groupActivity: 25
  },
  groupActivity: false,
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
    proximity: { ...DEFAULT_PROXIMITY, ...(input?.proximity ?? {}) },
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

// 같은 입력(seats 배열)으로 수천 번 평가하므로 좌석 쌍별 근접도를 캐시한다.
const proximityCache = new WeakMap<Seat[], { signature: string; pairs: Map<string, SeatProximity> }>();

function createProximityLookup(seats: Seat[], settings: EngineSettings): (a: Seat, b: Seat) => SeatProximity {
  const signature = JSON.stringify(settings.proximity);
  let entry = proximityCache.get(seats);
  if (!entry || entry.signature !== signature) {
    entry = { signature, pairs: new Map() };
    proximityCache.set(seats, entry);
  }
  const pairs = entry.pairs;
  return (a, b) => {
    const key = a.seatId < b.seatId ? `${a.seatId}|${b.seatId}` : `${b.seatId}|${a.seatId}`;
    let value = pairs.get(key);
    if (!value) {
      value = seatProximity(a, b, settings.proximity);
      pairs.set(key, value);
    }
    return value;
  };
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

function historyNearPairs(history: ConfirmedSeatingSession[], seats: Seat[], proximity: (a: Seat, b: Seat) => SeatProximity, lambda: number): Map<string, number> {
  const result = new Map<string, number>();
  const bySeat = seatById(seats);
  for (const [sessionIndex, session] of history.entries()) {
    for (let i = 0; i < session.assignments.length; i += 1) {
      for (let j = i + 1; j < session.assignments.length; j += 1) {
        const left = session.assignments[i];
        const right = session.assignments[j];
        const leftSeat = bySeat.get(left.seatId);
        const rightSeat = bySeat.get(right.seatId);
        if (!leftSeat || !rightSeat) continue;
        const { risk } = proximity(leftSeat, rightSeat);
        if (risk === 0) continue;
        const key = pairKey(left.studentId, right.studentId);
        result.set(key, (result.get(key) ?? 0) + risk * historyWeight(sessionIndex, history.length, lambda));
      }
    }
  }
  return result;
}

function historyGroupmates(history: ConfirmedSeatingSession[], groupOfSeat: Map<string, number>, lambda: number): Map<string, number> {
  const result = new Map<string, number>();
  for (const [sessionIndex, session] of history.entries()) {
    const members = new Map<number, string[]>();
    for (const assignment of session.assignments) {
      const group = groupOfSeat.get(assignment.seatId);
      if (group !== undefined) members.set(group, [...(members.get(group) ?? []), assignment.studentId]);
    }
    for (const ids of members.values()) {
      for (let i = 0; i < ids.length; i += 1) {
        for (let j = i + 1; j < ids.length; j += 1) {
          const key = pairKey(ids[i], ids[j]);
          result.set(key, (result.get(key) ?? 0) + historyWeight(sessionIndex, history.length, lambda) * 0.5);
        }
      }
    }
  }
  return result;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
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

interface EvalContext {
  settings: EngineSettings;
  students: Student[];
  seats: Seat[];
  byStudent: Map<string, Student>;
  bySeat: Map<string, Seat>;
  maxSeatDistance: number;
  proximityOf: (a: Seat, b: Seat) => SeatProximity;
  nearPairs: Map<string, number>;
  pairIndex: Map<string, NonNullable<AllocationInput["pairConstraints"]>>;
  spacing: GridSpacing;
  seatCounts: Map<string, number>;
  positionHistory: Map<string, Array<{ seat: Seat; weight: number }>>;
  groups: string[][];
  pastGroupmates: Map<string, number>;
  genderTotals: Record<Student["gender"], number>;
}

const contextCache = new WeakMap<AllocationInput, EvalContext>();

/** 한 번의 후보 생성 동안 바뀌지 않는 값(이력 집계, 좌석 간 관계 등)을 입력당 한 번만 계산한다. */
function getContext(input: AllocationInput): EvalContext {
  const cached = contextCache.get(input);
  if (cached) return cached;
  const settings = mergeSettings(input.settings);
  const students = activeStudents(input.students);
  const seats = input.seats.filter((seat) => seat.isActive);
  const bySeat = seatById(seats);
  const proximityOf = createProximityLookup(seats, settings);
  const pairIndex: EvalContext["pairIndex"] = new Map();
  for (const constraint of input.pairConstraints ?? []) {
    const key = pairKey(constraint.studentAId, constraint.studentBId);
    pairIndex.set(key, [...(pairIndex.get(key) ?? []), constraint]);
  }
  const seatCounts = new Map<string, number>();
  const positionHistory: EvalContext["positionHistory"] = new Map();
  for (const [sessionIndex, session] of input.history.entries()) {
    const weight = historyWeight(sessionIndex, input.history.length, settings.timeDecayLambda);
    for (const assignment of session.assignments) {
      const key = `${assignment.studentId}|${assignment.seatId}`;
      seatCounts.set(key, (seatCounts.get(key) ?? 0) + weight);
      const seat = bySeat.get(assignment.seatId);
      if (seat) positionHistory.set(assignment.studentId, [...(positionHistory.get(assignment.studentId) ?? []), { seat, weight }]);
    }
  }
  const groups = settings.groupActivity ? columnGroups(seats) : [];
  const groupOfSeat = new Map<string, number>(groups.flatMap((group, index) => group.map((seatId) => [seatId, index] as const)));
  const context: EvalContext = {
    settings, students, seats,
    byStudent: new Map(students.map((student) => [student.studentId, student])),
    bySeat,
    maxSeatDistance: maximumSeatDistance(seats),
    proximityOf,
    nearPairs: historyNearPairs(input.history, seats, proximityOf, settings.timeDecayLambda),
    pairIndex,
    spacing: gridSpacing(seats),
    seatCounts,
    positionHistory,
    groups,
    pastGroupmates: settings.groupActivity ? historyGroupmates(input.history, groupOfSeat, settings.timeDecayLambda) : new Map(),
    genderTotals: { 남: students.filter((student) => student.gender === "남").length, 여: students.filter((student) => student.gender === "여").length }
  };
  contextCache.set(input, context);
  return context;
}

function evaluateRaw(input: AllocationInput, assignments: SeatingAssignment[]): Evaluation {
  const { settings, students, seats, byStudent, bySeat, maxSeatDistance, proximityOf, nearPairs, pairIndex, spacing, seatCounts, positionHistory } = getContext(input);
  const assignmentMap = assignmentToMap(assignments);
  const breakdown = { sameSeat: 0, repeatProximity: 0, genderAdjacency: 0, positionExperience: 0, studentPosition: 0, pairDistance: 0, groupActivity: 0 };
  const reasonCodes: string[] = [];
  const hardViolations = validateAllocation(input, assignments);
  const pairDetails: Evaluation["pairDetails"] = [];
  const historyLength = Math.max(input.history.length, 1);

  for (const student of students) {
    const seat = bySeat.get(assignmentMap.get(student.studentId) ?? "");
    if (!seat) continue;
    const same = seatCounts.get(`${student.studentId}|${seat.seatId}`) ?? 0;
    breakdown.sameSeat += same / historyLength;
    const newcomer = input.history.length < settings.newcomerRelaxedSessions && !positionHistory.has(student.studentId);
    if (!newcomer) {
      breakdown.positionExperience += samePositionPenalty(seat, positionHistory.get(student.studentId) ?? []);
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
      const closeness = proximityOf(seatA, seatB);
      if (closeness.risk > 0 && studentA.gender === studentB.gender) {
        breakdown.genderAdjacency += closeness.risk;
        if (closeness.risk >= settings.proximity.nearRisk) reasonCodes.push(`${studentA.name}·${studentB.name}: 같은 성별이 ${closeness.relation}에 배치됨`);
      }
      const pair = pairKey(a.studentId, b.studentId);
      const oldNear = nearPairs.get(pair) ?? 0;
      if (closeness.risk > 0 && oldNear > 0) breakdown.repeatProximity += oldNear * closeness.risk;
      for (const constraint of pairIndex.get(pair) ?? []) {
        const currentDistance = constraint.type === "최소 거리" ? gridDistance(seatA, seatB, spacing) : distance(seatA, seatB);
        if (constraint.type === "가능한 한 멀리") {
          const normalizedShortfall = closeness.risk;
          const multiplier = constraint.strength === "필수" ? 10 : constraint.strength === "가급적" ? 3 : 1;
          breakdown.pairDistance += normalizedShortfall * multiplier;
          pairDetails.push({ studentAId: studentA.studentId, studentAName: studentA.name, studentBId: studentB.studentId, studentBName: studentB.name, seatAId: seatA.seatId, seatBId: seatB.seatId, type: constraint.type, strength: constraint.strength, currentDistance, targetDistance: maxSeatDistance, relation: closeness.relation, risk: closeness.risk, status: normalizedShortfall === 0 ? "satisfied" : "warning" });
          continue;
        }
        const violated = constraint.type === "바로 인접 금지" ? closeness.distanceFactor >= 1 : constraint.minDistance !== undefined && currentDistance < constraint.minDistance;
        pairDetails.push({ studentAId: studentA.studentId, studentAName: studentA.name, studentBId: studentB.studentId, studentBName: studentB.name, seatAId: seatA.seatId, seatBId: seatB.seatId, type: constraint.type, strength: constraint.strength, currentDistance, targetDistance: constraint.type === "바로 인접 금지" ? settings.proximity.adjacentGap : constraint.minDistance, relation: closeness.relation, risk: closeness.risk, status: violated ? constraint.strength === "필수" ? "violation" : "warning" : "satisfied" });
        if (violated) {
          const multiplier = constraint.strength === "필수" ? 10 : constraint.strength === "가급적" ? 3 : 1;
          breakdown.pairDistance += multiplier;
          reasonCodes.push(`${studentA.name}·${studentB.name}: 거리 조건 미충족`);
          if (constraint.strength === "필수") hardViolations.push(`${studentA.name}과 ${studentB.name}의 필수 거리 조건을 만족하지 못했습니다.`);
        }
      }
    }
  }

  if (settings.groupActivity) {
    const { groups, pastGroupmates, genderTotals } = getContext(input);
    const studentBySeat = new Map([...assignmentMap].map(([studentId, seatId]) => [seatId, byStudent.get(studentId)]));
    for (const group of groups) {
      const members = group.map((seatId) => studentBySeat.get(seatId)).filter((student): student is Student => Boolean(student));
      for (const gender of ["남", "여"] as const) {
        // 해당 성별 학생 수가 모둠 수 이상일 때만 "모든 모둠에 있어야 한다"가 가능하다.
        const total = genderTotals[gender];
        if (members.length < 3 || total < groups.length) continue;
        const count = members.filter((student) => student.gender === gender).length;
        const expected = Math.floor((members.length * total) / students.length);
        breakdown.groupActivity += Math.max(0, expected - count);
        if (count === 0) {
          breakdown.groupActivity += 3;
          reasonCodes.push(`세로 모둠(${members.map((student) => student.name).join("·")})에 ${gender}학생이 없음`);
        }
      }
      for (let i = 0; i < members.length; i += 1) {
        for (let j = i + 1; j < members.length; j += 1) {
          const key = pairKey(members[i].studentId, members[j].studentId);
          breakdown.groupActivity += pastGroupmates.get(key) ?? 0;
          for (const constraint of pairIndex.get(key) ?? []) {
            breakdown.groupActivity += constraint.strength === "필수" ? 3 : constraint.strength === "가급적" ? 2 : 1;
            reasonCodes.push(`${members[i].name}·${members[j].name}: 같은 세로 모둠에 배치됨`);
          }
        }
      }
    }
  }

  const weighted = settings.weights;
  const totalPenalty = breakdown.sameSeat * weighted.sameSeat + breakdown.repeatProximity * weighted.repeatProximity + breakdown.genderAdjacency * weighted.genderAdjacency + breakdown.positionExperience * weighted.positionExperience + breakdown.studentPosition * weighted.studentPosition + breakdown.pairDistance * weighted.pairDistance + breakdown.groupActivity * weighted.groupActivity;
  const conditionSummary = [
    { group: "자리 이력", label: "같은 자리 반복", status: breakdown.sameSeat === 0 ? "satisfied" as const : "warning" as const, detail: breakdown.sameSeat === 0 ? "반복된 자리가 없습니다." : "과거에 사용한 자리와 겹치는 정도를 반영했습니다.", penalty: breakdown.sameSeat },
    { group: "자리 이력", label: "과거 근접 반복", status: breakdown.repeatProximity === 0 ? "satisfied" as const : "warning" as const, detail: breakdown.repeatProximity === 0 ? "과거 근접 pair 반복이 없습니다." : "과거에 가까웠던 학생 pair의 반복을 반영했습니다.", penalty: breakdown.repeatProximity },
    { group: "성별 균형", label: "성별 인접", status: breakdown.genderAdjacency === 0 ? "satisfied" as const : "warning" as const, detail: breakdown.genderAdjacency === 0 ? "성별 인접 패널티가 없습니다." : "가까운 좌석의 같은 성별 인접을 반영했습니다.", penalty: breakdown.genderAdjacency },
    { group: "학생 조건", label: "학생 위치 조건", status: breakdown.studentPosition === 0 ? "satisfied" as const : "violation" as const, detail: `${input.seatConstraints?.length ?? 0}개 조건을 평가했습니다.`, penalty: breakdown.studentPosition },
    { group: "학생 간 짝", label: "학생 간 짝 거리", status: breakdown.pairDistance === 0 ? "satisfied" as const : "warning" as const, detail: `${input.pairConstraints?.length ?? 0}개 짝 조건을 평가했습니다.`, penalty: breakdown.pairDistance },
    ...(settings.groupActivity ? [{ group: "모둠 활동", label: "세로 모둠 구성", status: breakdown.groupActivity === 0 ? "satisfied" as const : "warning" as const, detail: breakdown.groupActivity === 0 ? "세로 모둠의 성별 구성·이전 모둠 반복·짝 조건에 문제가 없습니다." : "세로 모둠의 성별 구성, 이전 모둠 반복, 짝 조건을 반영했습니다.", penalty: breakdown.groupActivity }] : []),
    { group: "자리 이력", label: "위치 경험", status: breakdown.positionExperience === 0 ? "satisfied" as const : "warning" as const, detail: "과거 앞·중간·뒤 및 좌·중·우 경험을 반영했습니다.", penalty: breakdown.positionExperience }
  ];
  return { totalPenalty, score: 0, hardViolations: [...new Set(hardViolations)], breakdown, relative: { ...breakdown }, reasonCodes: [...new Set(reasonCodes)], conditionSummary, pairDetails };
}

type BreakdownKey = keyof Evaluation["breakdown"];
const BREAKDOWN_KEYS: BreakdownKey[] = ["sameSeat", "repeatProximity", "genderAdjacency", "positionExperience", "studentPosition", "pairDistance", "groupActivity"];
const BASELINE_SAMPLES = 24;
const baselineCache = new WeakMap<AllocationInput, Evaluation["breakdown"]>();

/** 무작위 배치의 항목별 평균 감점. 항목마다 단위가 달라 이 값으로 나눠 "무작위 대비" 비율로 맞춘다. */
function randomBaseline(input: AllocationInput): Evaluation["breakdown"] {
  const cached = baselineCache.get(input);
  if (cached) return cached;
  const students = activeStudents(input.students);
  const seats = input.seats.filter((seat) => seat.isActive);
  const sum = { sameSeat: 0, repeatProximity: 0, genderAdjacency: 0, positionExperience: 0, studentPosition: 0, pairDistance: 0, groupActivity: 0 };
  if (students.length && seats.length >= students.length) {
    const random = seededRandom(20261001);
    for (let sample = 0; sample < BASELINE_SAMPLES; sample += 1) {
      const { breakdown } = evaluateRaw(input, mapToAssignments(randomInitialAssignment(students, seats, random)));
      for (const key of BREAKDOWN_KEYS) sum[key] += breakdown[key] / BASELINE_SAMPLES;
    }
  }
  baselineCache.set(input, sum);
  return sum;
}

/**
 * 총점은 항목별 감점을 무작위 배치 대비 비율로 바꾼 뒤 가중합한다.
 * 점수 = 100 - 100 * (가중 부담 합 / 적용 가능한 가중치 합). 무작위 수준이면 0점, 감점이 없으면 100점.
 * 이력·조건이 없어 기준이 0인 항목은 점수에서 제외한다.
 */
export function evaluateAllocation(input: AllocationInput, assignments: SeatingAssignment[]): Evaluation {
  const settings = mergeSettings(input.settings);
  const raw = evaluateRaw(input, assignments);
  const baseline = randomBaseline(input);
  const relative = { ...raw.breakdown };
  let weightedLoad = 0;
  let applicableWeight = 0;
  for (const key of BREAKDOWN_KEYS) {
    const weight = settings.weights[key];
    if (baseline[key] > 1e-9) {
      relative[key] = raw.breakdown[key] / baseline[key];
      applicableWeight += weight;
    } else {
      relative[key] = 0;
    }
    weightedLoad += weight * relative[key];
  }
  const score = applicableWeight > 0 ? Math.max(0, Math.min(100, Math.round(100 - (weightedLoad / applicableWeight) * 100))) : 100;
  const labelKey: Record<string, BreakdownKey> = { "같은 자리 반복": "sameSeat", "과거 근접 반복": "repeatProximity", "성별 인접": "genderAdjacency", "학생 위치 조건": "studentPosition", "학생 간 짝 거리": "pairDistance", "위치 경험": "positionExperience", "세로 모둠 구성": "groupActivity" };
  const conditionSummary = raw.conditionSummary.map((row) => ({ ...row, penalty: relative[labelKey[row.label]] ?? row.penalty }));
  return { ...raw, totalPenalty: weightedLoad, score, relative, conditionSummary };
}

function samePositionPenalty(seat: Seat, past: Array<{ seat: Seat; weight: number }>): number {
  const tags: Array<keyof Seat["position"]> = ["vertical", "horizontal", "nearFrontDoor", "nearBackDoor"];
  let penalty = 0;
  for (const tag of tags) {
    const value = positionValue(seat, tag);
    // 문 근처 여부는 "문 근처였던 경험"만 반복으로 센다. 문 근처가 아닌 자리끼리 같다고 세면 거의 모든 자리가 겹쳐 상수가 된다.
    if (value === false) continue;
    for (const entry of past) if (positionValue(entry.seat, tag) === value) penalty += entry.weight;
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

export interface GenerationHooks {
  onProgress?: (completed: number, total: number) => void;
  isCancelled?: () => boolean;
}

function runRestart(input: AllocationInput, settings: EngineSettings, students: Student[], seats: Seat[], seed: number): AllocationCandidate | undefined {
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
  return currentEvaluation.hardViolations.length === 0 ? { assignments: mapToAssignments(current), evaluation: currentEvaluation, seed, algorithmVersion: "random-restart-swap-v1" } : undefined;
}

function selectDiverse(candidates: AllocationCandidate[], studentCount: number, diversityThreshold: number): AllocationCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.evaluation.score - a.evaluation.score);
  const selected: AllocationCandidate[] = [];
  for (const candidate of sorted) {
    const isTooSimilar = selected.some((existing) => {
      const existingMap = assignmentToMap(existing.assignments);
      const same = candidate.assignments.filter((item) => existingMap.get(item.studentId) === item.seatId).length;
      return same / studentCount > 1 - diversityThreshold;
    });
    if (!isTooSimilar) selected.push(candidate);
    if (selected.length === 3) break;
  }
  return selected;
}

function prepareGeneration(input: AllocationInput): { settings: EngineSettings; students: Student[]; seats: Seat[]; baseSeed: number } | undefined {
  const settings = mergeSettings(input.settings);
  const students = activeStudents(input.students);
  const seats = input.seats.filter((seat) => seat.isActive);
  if (seats.length < students.length) return undefined;
  // Explicit seeds keep tests and investigations reproducible. Interactive generation
  // receives a fresh seed so pressing "후보 생성" does not repeat the same candidates.
  return { settings, students, seats, baseSeed: input.seed ?? Date.now() + generatedSeedOffset++ };
}

export function generateCandidates(input: AllocationInput): AllocationCandidate[] {
  const prepared = prepareGeneration(input);
  if (!prepared) return [];
  const { settings, students, seats, baseSeed } = prepared;
  const candidates: AllocationCandidate[] = [];
  for (let restart = 0; restart < settings.restartCount; restart += 1) {
    const candidate = runRestart(input, settings, students, seats, baseSeed + restart);
    if (candidate) candidates.push(candidate);
  }
  return selectDiverse(candidates, students.length, settings.diversityThreshold);
}

/** 재시작 사이마다 이벤트 루프에 양보해 UI/IPC가 멈추지 않게 하고, 진행 보고와 취소를 지원한다. 취소하면 빈 배열을 반환한다. */
export async function generateCandidatesAsync(input: AllocationInput, hooks: GenerationHooks = {}): Promise<AllocationCandidate[]> {
  const prepared = prepareGeneration(input);
  if (!prepared) return [];
  const { settings, students, seats, baseSeed } = prepared;
  const candidates: AllocationCandidate[] = [];
  hooks.onProgress?.(0, settings.restartCount);
  for (let restart = 0; restart < settings.restartCount; restart += 1) {
    if (hooks.isCancelled?.()) return [];
    const candidate = runRestart(input, settings, students, seats, baseSeed + restart);
    if (candidate) candidates.push(candidate);
    hooks.onProgress?.(restart + 1, settings.restartCount);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  if (hooks.isCancelled?.()) return [];
  return selectDiverse(candidates, students.length, settings.diversityThreshold);
}
