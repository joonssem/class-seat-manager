import type { Seat } from "./models";

function clusterCenters(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const value of sorted) {
    const last = clusters[clusters.length - 1];
    const mean = last ? last.reduce((sum, item) => sum + item, 0) / last.length : 0;
    if (last && Math.abs(value - mean) <= tolerance) last.push(value);
    else clusters.push([value]);
  }
  return clusters.map((cluster) => cluster.reduce((sum, item) => sum + item, 0) / cluster.length);
}

function medianGap(centers: number[], fallback: number): number {
  const gaps = centers.slice(1).map((value, index) => value - centers[index]).sort((a, b) => a - b);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)] : fallback;
}

export interface GridSpacing { column: number; row: number }

/** 교실의 줄(가로)·행(세로) 간격. 책상이 놓인 격자 한 칸의 크기로 쓴다. */
export function gridSpacing(seats: Seat[]): GridSpacing {
  const avgWidth = seats.reduce((sum, seat) => sum + seat.width, 0) / Math.max(seats.length, 1) || 0.1;
  const avgHeight = seats.reduce((sum, seat) => sum + seat.height, 0) / Math.max(seats.length, 1) || 0.1;
  return {
    column: medianGap(clusterCenters(seats.map((seat) => seat.x + seat.width / 2), avgWidth * 0.5), avgWidth * 2),
    row: medianGap(clusterCenters(seats.map((seat) => seat.y + seat.height / 2), avgHeight * 0.5), avgHeight * 1.2)
  };
}

/** 두 좌석 사이 거리를 "자리 칸 수"로 잰다(옆자리·앞뒤 = 1, 한 자리 건너뛴 자리 = 2). */
export function gridDistance(a: Seat, b: Seat, spacing: GridSpacing): number {
  return Math.hypot((a.x + a.width / 2 - (b.x + b.width / 2)) / spacing.column, (a.y + a.height / 2 - (b.y + b.height / 2)) / spacing.row);
}
