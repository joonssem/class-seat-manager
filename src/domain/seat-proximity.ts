import type { ProximitySettings, Seat } from "./models";

// 좌표는 교실 캔버스(0~1) 기준이며 y가 작을수록 칠판(앞)에 가깝다.
export const DEFAULT_PROXIMITY: ProximitySettings = {
  focusX: 0.5,
  focusY: 0,
  adjacentGap: 0.1,
  reachGap: 0.25,
  comfortableTurnDeg: 90,
  easierSideWeight: 0.4,
  nearRisk: 0.5
};

export type SeatRelation = "옆자리" | "앞뒤" | "대각선" | "먼 자리";

export interface SeatProximity {
  /** 0~1. 수업 중 서로 시선을 주고받고 장난치기 쉬운 정도. */
  risk: number;
  /** 책상 가장자리 사이 간격에 따른 감쇠(1이면 바로 이웃). */
  distanceFactor: number;
  /** 두 학생 중 고개를 덜 돌려도 되는 쪽의 용이성과 더 돌려야 하는 쪽의 용이성을 섞은 값. */
  turnEase: number;
  turnAngleA: number;
  turnAngleB: number;
  relation: SeatRelation;
}

function center(seat: Seat): { x: number; y: number } {
  return { x: seat.x + seat.width / 2, y: seat.y + seat.height / 2 };
}

function turnAngle(from: { x: number; y: number }, to: { x: number; y: number }, settings: ProximitySettings): number {
  const gaze = { x: settings.focusX - from.x, y: settings.focusY - from.y };
  const target = { x: to.x - from.x, y: to.y - from.y };
  const gazeLength = Math.hypot(gaze.x, gaze.y);
  const targetLength = Math.hypot(target.x, target.y);
  if (targetLength === 0) return 0;
  const g = gazeLength === 0 ? { x: 0, y: -1 } : { x: gaze.x / gazeLength, y: gaze.y / gazeLength };
  const cos = Math.max(-1, Math.min(1, (g.x * target.x + g.y * target.y) / targetLength));
  return (Math.acos(cos) * 180) / Math.PI;
}

function turnComfort(angle: number, settings: ProximitySettings): number {
  if (angle <= settings.comfortableTurnDeg) return 1;
  return Math.max(0, (180 - angle) / (180 - settings.comfortableTurnDeg));
}

export function seatProximity(a: Seat, b: Seat, settings: ProximitySettings = DEFAULT_PROXIMITY): SeatProximity {
  const ca = center(a);
  const cb = center(b);
  const dx = Math.abs(ca.x - cb.x);
  const dy = Math.abs(ca.y - cb.y);
  const gapX = Math.max(0, dx - (a.width + b.width) / 2);
  const gapY = Math.max(0, dy - (a.height + b.height) / 2);
  const gap = Math.hypot(gapX, gapY);
  const distanceFactor = gap <= settings.adjacentGap ? 1 : Math.max(0, 1 - (gap - settings.adjacentGap) / (settings.reachGap - settings.adjacentGap));
  const turnAngleA = turnAngle(ca, cb, settings);
  const turnAngleB = turnAngle(cb, ca, settings);
  const comfortA = turnComfort(turnAngleA, settings);
  const comfortB = turnComfort(turnAngleB, settings);
  const turnEase = settings.easierSideWeight * Math.max(comfortA, comfortB) + (1 - settings.easierSideWeight) * Math.min(comfortA, comfortB);
  const avgWidth = (a.width + b.width) / 2;
  const avgHeight = (a.height + b.height) / 2;
  const relation: SeatRelation = distanceFactor === 0 ? "먼 자리" : dy < avgHeight * 0.5 ? "옆자리" : dx < avgWidth * 0.5 ? "앞뒤" : "대각선";
  return { risk: distanceFactor * turnEase, distanceFactor, turnEase, turnAngleA, turnAngleB, relation };
}
