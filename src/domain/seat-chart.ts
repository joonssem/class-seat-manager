import type { LayoutItem } from "./classroom-layout";
import type { SeatingAssignment, Student } from "./models";
export type SeatChartMode = "student" | "teacher";
export interface SeatChartCell { seatId: string; label: string; x: number; y: number; width: number; height: number; }
export function createSeatChart(items: LayoutItem[], students: Student[], assignments: SeatingAssignment[], mode: SeatChartMode): SeatChartCell[] {
  const byStudent = new Map(students.map((student) => [student.studentId, student])); const bySeat = new Map(assignments.map((assignment) => [assignment.seatId, assignment.studentId]));
  return items.filter((item) => item.type === "desk").map((item) => { const student = byStudent.get(bySeat.get(item.id) ?? ""); return { seatId: item.id, label: student ? `${student.studentNumber}. ${student.name}` : "빈 자리", x: mode === "teacher" ? 1 - item.x - item.width : item.x, y: mode === "teacher" ? 1 - item.y - item.height : item.y, width: item.width, height: item.height }; });
}
