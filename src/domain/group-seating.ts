import { calculateSeatPosition, type LayoutItem } from "./classroom-layout";
import type { Student, StudentPairConstraint, StudentSeatConstraint, SeatingAssignment, Seat } from "./models";
import { gridDistance, gridSpacing } from "./seat-grid";
import { DEFAULT_PROXIMITY, seatProximity } from "./seat-proximity";

export interface GroupInput {
  students: Student[];
  sizes: number[];
  pairs: StudentPairConstraint[];
  positions: StudentSeatConstraint[];
  spreadIds: string[];
  fixtures: LayoutItem[];
  namespace: string;
}
export interface GroupReview { hard: string[]; warnings: string[]; penalty: number }
export interface GroupPlan { groups: string[][]; review: GroupReview }

/** Rotate each group's desks, keeping text rendering independent of the geometry. Also upgrades legacy layouts. */
export function orientGroupLayout(items: LayoutItem[]): LayoutItem[] {
  const groups = new Map<number, LayoutItem[]>();
  for (const item of items) {
    const match = item.type === "desk" && /^group-.+-(\d+)-(\d+)$/.exec(item.id);
    if (match) { const number = Number(match[1]); groups.set(number, [...(groups.get(number) ?? []), item]); }
  }
  const replacements = new Map<string, LayoutItem>();
  for (const members of groups.values()) {
    // In legacy layouts seat 2 is right of seat 1; after rotation it is below it.
    const first = members.find((item) => item.id.endsWith("-1"));
    const second = members.find((item) => item.id.endsWith("-2"));
    const rotate = Boolean(first && second && second.x > first.x + 1e-8 && Math.abs(second.y - first.y) < 1e-8);
    const minX = Math.min(...members.map((i) => i.x));
    const maxX = Math.max(...members.map((i) => i.x + i.width));
    const minY = Math.min(...members.map((i) => i.y));
    const maxY = Math.max(...members.map((i) => i.y + i.height));
    const cx = (minX + maxX) / 2; const cy = (minY + maxY) / 2;
    for (const item of members) replacements.set(item.id, rotate ? { ...item, x: cx - (item.y + item.height - cy), y: cy + (item.x - cx), width: item.height, height: item.width } : { ...item });
  }
  const fifth = groups.get(5);
  const others = [...groups.entries()].filter(([number]) => number !== 5).flatMap(([, members]) => members).map((i) => replacements.get(i.id)!);
  if (fifth?.length === 5 && others.length) {
    const center = (Math.min(...others.map((i) => i.x)) + Math.max(...others.map((i) => i.x + i.width))) / 2;
    const members = fifth.map((i) => replacements.get(i.id)!);
    const current = (Math.min(...members.map((i) => i.x)) + Math.max(...members.map((i) => i.x + i.width))) / 2;
    members.forEach((i) => { i.x += center - current; });
  }
  return items.map((item) => replacements.get(item.id) ?? item);
}

/** Two facing pairs rotated clockwise; the fifth desk is the rear end seat. */
export function groupLayout(sizes: number[], namespace: string, fixtures: LayoutItem[] = []): LayoutItem[] {
  const columns = Math.min(2, sizes.length);
  const rows = Math.ceil(sizes.length / columns);
  const width = 0.085;
  const height = Math.min(0.09, 0.6 / rows / 3);
  const offsets = [[0, 0], [width, 0], [0, height], [width, height], [width * 2, height / 2]];
  return orientGroupLayout([...fixtures.filter((item) => item.type !== "desk"), ...sizes.flatMap((size, group) => {
    const x = 0.055 + (group % columns) * (0.9 / columns);
    const y = 0.18 + Math.floor(group / columns) * (0.62 / Math.max(1, rows - 1));
    return Array.from({ length: size }, (_, index): LayoutItem => ({ id: `group-${namespace}-${group + 1}-${index + 1}`, type: "desk", x: x + offsets[index][0], y: y + offsets[index][1], width, height }));
  })]);
}

export function groupAssignments(groups: string[][], items: LayoutItem[]): SeatingAssignment[] {
  const desks = items.filter((item) => item.type === "desk");
  return groups.flat().map((studentId, index) => ({ studentId, seatId: desks[index].id }));
}

function validateInput(input: GroupInput): Student[] {
  const students = input.students.filter((student) => student.enrollmentStatus === "재학");
  if (!input.sizes.length || input.sizes.length > 8 || input.sizes.some((n) => !Number.isInteger(n) || n < 3 || n > 5)) throw new Error("모둠은 3~5명씩, 최대 8개까지 구성할 수 있습니다.");
  if (input.sizes.reduce((a, b) => a + b, 0) !== students.length) throw new Error("모둠 인원 합계가 재학생 수와 같아야 합니다.");
  const ids = new Set(students.map((s) => s.studentId));
  if (ids.size !== students.length) throw new Error("학생 목록이 중복되었습니다.");
  if (input.spreadIds.some((id) => !ids.has(id)) || new Set(input.spreadIds).size !== input.spreadIds.length) throw new Error("분산할 학생 목록을 확인하세요.");
  if (input.spreadIds.length > input.sizes.length) throw new Error("분산할 학생 수는 모둠 수 이하여야 합니다.");
  return students;
}

function evaluator(input: GroupInput) {
  const students = validateInput(input);
  const byId = new Map(students.map((s) => [s.studentId, s]));
  const items = groupLayout(input.sizes, input.namespace, input.fixtures);
  const front = items.find((i) => i.type === "front-door");
  const back = items.find((i) => i.type === "back-door");
  const seats: Seat[] = items.filter((i) => i.type === "desk").map((i) => ({ ...i, seatId: i.id, seatCode: i.id, isActive: true, position: calculateSeatPosition(i, front, back) }));
  const spacing = gridSpacing(seats);
  const distances = seats.map((a) => seats.map((b) => gridDistance(a, b, spacing)));
  const adjacent = seats.map((a) => seats.map((b) => seatProximity(a, b, DEFAULT_PROXIMITY).distanceFactor === 1));
  const maxDistance = Math.max(1, ...distances.flat());
  const maleRatio = students.filter((s) => s.gender === "남").length / students.length;
  const name = (id: string) => byId.get(id)?.name ?? id;
  return (groups: string[][]): GroupReview => {
    const flat = groups.flat();
    if (groups.length !== input.sizes.length || groups.some((g, i) => g.length !== input.sizes[i]) || flat.length !== students.length || new Set(flat).size !== students.length || flat.some((id) => !byId.has(id))) {
      return { hard: ["모든 재학생을 정해진 모둠 인원에 맞춰 한 번씩 배정하세요."], warnings: [], penalty: 0 };
    }
    const hard: string[] = []; const warnings: string[] = []; let penalty = 0;
    if (input.sizes.length === 5 && input.sizes[4] === 5 && students.some((s) => s.gender === "남") && byId.get(groups[4][4])?.gender !== "남") {
      hard.push("5모둠의 가장 뒷자리(5번 자리)는 남학생으로 배정하세요.");
    }
    const slot = new Map(flat.map((id, i) => [id, i]));
    const groupOf = new Map(groups.flatMap((g, i) => g.map((id) => [id, i] as const)));
    const add = (required: boolean, message: string, weight: number) => { if (required) hard.push(message); else { warnings.push(message); penalty += weight; } };
    groups.forEach((group, i) => {
      const males = group.filter((id) => byId.get(id)?.gender === "남").length;
      penalty += 4 * (males - group.length * maleRatio) ** 2;
      if (maleRatio > 0 && maleRatio < 1 && (males === 0 || males === group.length)) { warnings.push(`${i + 1}모둠은 한 성별로만 구성되어 있습니다.`); penalty += 20; }
      const spread = group.filter((id) => input.spreadIds.includes(id));
      if (spread.length > 1) hard.push(`${i + 1}모둠: 분산 지정 학생 ${spread.map(name).join(", ")}이 같은 모둠입니다.`);
    });
    for (const pair of input.pairs) {
      const a = slot.get(pair.studentAId); const b = slot.get(pair.studentBId);
      if (a === undefined || b === undefined) continue;
      const same = groupOf.get(pair.studentAId) === groupOf.get(pair.studentBId);
      const required = pair.strength === "필수";
      const weight = pair.strength === "가급적" ? 40 : 15;
      const label = `${name(pair.studentAId)} · ${name(pair.studentBId)}`;
      // In cooperative work every member interacts; separation conditions also apply to membership.
      if (same) add(required, `${label}: ${pair.strength} 관계 조건의 두 학생이 같은 모둠입니다.`, weight * 2);
      if (pair.type === "바로 인접 금지" && adjacent[a][b]) add(required, `${label}: 바로 인접 금지 조건을 충족하지 못했습니다.`, weight);
      if (pair.type === "최소 거리" && distances[a][b] < (pair.minDistance ?? 1)) add(required, `${label}: 최소 거리 ${pair.minDistance ?? 1}칸 미달입니다.`, weight);
      if (pair.type === "가능한 한 멀리") penalty += weight * (1 - distances[a][b] / maxDistance);
    }
    for (const condition of input.positions) {
      const index = slot.get(condition.studentId);
      if (index === undefined) continue;
      if (seats[index].position[condition.tag] !== (condition.expected ?? true)) add(condition.strength === "필수", `${name(condition.studentId)}: 위치 조건 ${String(condition.expected ?? condition.tag)} 불충족입니다.`, condition.strength === "가급적" ? 30 : 10);
    }
    return { hard, warnings, penalty };
  };
}

export function reviewGroups(input: GroupInput, groups: string[][]): GroupReview { return evaluator(input)(groups); }

export function generateGroups(input: GroupInput, seed = Date.now()): GroupPlan {
  const students = validateInput(input);
  const evaluate = evaluator(input);
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const split = (ids: string[]) => { let offset = 0; return input.sizes.map((size) => { const group = ids.slice(offset, offset + size); offset += size; return group; }); };
  const cost = (r: GroupReview) => r.hard.length * 1000000 + r.penalty;
  let best: GroupPlan | undefined;
  for (let restart = 0; restart < 12; restart++) {
    const ids = students.map((s) => s.studentId);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    let current = evaluate(split(ids));
    if (!best || cost(current) < cost(best.review)) best = { groups: split(ids), review: current };
    for (let step = 0; step < 1200; step++) {
      const a = Math.floor(random() * ids.length); const b = Math.floor(random() * ids.length);
      [ids[a], ids[b]] = [ids[b], ids[a]];
      const next = evaluate(split(ids));
      const delta = cost(next) - cost(current);
      const temperature = 25 * (1 - step / 1200) + 0.1;
      if (delta <= 0 || random() < Math.exp(-delta / temperature)) current = next;
      else [ids[a], ids[b]] = [ids[b], ids[a]];
      if (cost(current) < cost(best.review)) best = { groups: split(ids), review: current };
    }
  }
  return best!;
}
