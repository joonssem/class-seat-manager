import type { LayoutItem } from "./classroom-layout";
import type { SeatingAssignment, Student } from "./models";
import { orientGroupLayout } from "./group-seating";
export type SeatChartMode = "student" | "teacher";
export interface SeatChartCell { seatId: string; label: string; studentNumber?: number; studentName?: string; x: number; y: number; width: number; height: number; }
export function createSeatChart(items: LayoutItem[], students: Student[], assignments: SeatingAssignment[], mode: SeatChartMode): SeatChartCell[] {
  const byStudent = new Map(students.map((student) => [student.studentId, student])); const bySeat = new Map(assignments.map((assignment) => [assignment.seatId, assignment.studentId]));
  return orientGroupLayout(items).filter((item) => item.type === "desk").map((item) => { const student = byStudent.get(bySeat.get(item.id) ?? ""); return { seatId: item.id, label: student ? `${student.studentNumber}. ${student.name}` : "빈 자리", studentNumber: student?.studentNumber, studentName: student?.name, x: mode === "teacher" ? 1 - item.x - item.width : item.x, y: mode === "teacher" ? 1 - item.y - item.height : item.y, width: item.width, height: item.height }; });
}

export interface FitOptions {
  /** 가장자리 여백(비율). */
  padding?: number;
  /** 가로·세로 확대율 차이 상한. 좁은 교실이 지나치게 넓은 책상으로 늘어나지 않게 한다. */
  maxStretch?: number;
}

/**
 * 좌석 전체의 외곽 상자를 구해 표시 영역(0~1)에 맞춰 가운데 정렬·확대한다.
 * 교실 캔버스에서 책상이 한쪽에 몰려 있어도 인쇄 결과가 치우치지 않는다.
 */
export function fitSeatChart(cells: SeatChartCell[], { padding = 0.03, maxStretch = 1.3 }: FitOptions = {}): SeatChartCell[] {
  if (!cells.length) return cells;
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x + cell.width));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y + cell.height));
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  let scaleX = (1 - 2 * padding) / spanX;
  let scaleY = (1 - 2 * padding) / spanY;
  if (scaleX > scaleY * maxStretch) scaleX = scaleY * maxStretch;
  if (scaleY > scaleX * maxStretch) scaleY = scaleX * maxStretch;
  const offsetX = (1 - spanX * scaleX) / 2 - minX * scaleX;
  const offsetY = (1 - spanY * scaleY) / 2 - minY * scaleY;
  return cells.map((cell) => ({ ...cell, x: cell.x * scaleX + offsetX, y: cell.y * scaleY + offsetY, width: cell.width * scaleX, height: cell.height * scaleY }));
}

function clusterAxis(centers: number[], tolerance: number): number[][] {
  const order = centers.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const clusters: Array<{ mean: number; indexes: number[] }> = [];
  for (const entry of order) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(entry.value - last.mean) <= tolerance) {
      last.indexes.push(entry.index);
      last.mean = last.indexes.reduce((sum, index) => sum + centers[index], 0) / last.indexes.length;
    } else clusters.push({ mean: entry.value, indexes: [entry.index] });
  }
  return clusters.map((cluster) => cluster.indexes);
}

/** 같은 줄(행/열)의 좌석을 한 선에 맞추고, 줄 간격이 거의 일정하면 완전히 균등하게 펴 준다. 복도처럼 의도적으로 넓힌 간격은 유지한다. */
function regularizeAxis(centers: number[], tolerance: number): number[] {
  const groups = clusterAxis(centers, tolerance);
  const means = groups.map((indexes) => indexes.reduce((sum, index) => sum + centers[index], 0) / indexes.length);
  let targets = means;
  if (means.length >= 3) {
    const gaps = means.slice(1).map((value, index) => value - means[index]);
    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    if (gaps.every((gap) => Math.abs(gap - median) <= median * 0.25)) {
      const step = (means[means.length - 1] - means[0]) / (means.length - 1);
      targets = means.map((_, index) => means[0] + step * index);
    }
  }
  const result = [...centers];
  groups.forEach((indexes, groupIndex) => indexes.forEach((index) => { result[index] = targets[groupIndex]; }));
  return result;
}

export function regularizeSeatChart(cells: SeatChartCell[]): SeatChartCell[] {
  // Group desks deliberately touch and the rear group's center must remain exact.
  if (cells.some((cell) => /^group-.+-\d+-\d+$/.test(cell.seatId))) return cells;
  if (cells.length < 2) return cells;
  const avgWidth = cells.reduce((sum, cell) => sum + cell.width, 0) / cells.length;
  const avgHeight = cells.reduce((sum, cell) => sum + cell.height, 0) / cells.length;
  const xs = regularizeAxis(cells.map((cell) => cell.x + cell.width / 2), avgWidth * 0.5);
  const ys = regularizeAxis(cells.map((cell) => cell.y + cell.height / 2), avgHeight * 0.5);
  return cells.map((cell, index) => ({ ...cell, x: xs[index] - cell.width / 2, y: ys[index] - cell.height / 2 }));
}
