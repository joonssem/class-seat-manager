import type { ConfirmedSeatingSession, ProximitySettings, Seat } from "./models";
import { DEFAULT_PROXIMITY, seatProximity } from "./seat-proximity";

export interface PairProximityStat {
  studentAId: string;
  studentBId: string;
  /** 시선이 닿기 쉬운 가까운 자리(위험도 nearRisk 이상)였던 회차 수 */
  nearCount: number;
  /** 그중 옆자리였던 회차 수 */
  sideCount: number;
}

/** 확정 이력에서 학생 쌍이 서로 가까이 앉았던 횟수를 센다. 옆자리가 많은 쌍이 위로 온다. */
export function pairProximityStats(history: ConfirmedSeatingSession[], seats: Seat[], settings: ProximitySettings = DEFAULT_PROXIMITY): PairProximityStat[] {
  const bySeat = new Map(seats.map((seat) => [seat.seatId, seat]));
  const stats = new Map<string, PairProximityStat>();
  for (const session of history) {
    const placed = session.assignments.filter((assignment) => bySeat.has(assignment.seatId));
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const proximity = seatProximity(bySeat.get(placed[i].seatId)!, bySeat.get(placed[j].seatId)!, settings);
        if (proximity.risk < settings.nearRisk) continue;
        const [a, b] = [placed[i].studentId, placed[j].studentId].sort();
        const key = `${a}::${b}`;
        const stat = stats.get(key) ?? { studentAId: a, studentBId: b, nearCount: 0, sideCount: 0 };
        stat.nearCount += 1;
        if (proximity.relation === "옆자리") stat.sideCount += 1;
        stats.set(key, stat);
      }
    }
  }
  return [...stats.values()].sort((x, y) => y.sideCount - x.sideCount || y.nearCount - x.nearCount);
}
