import { groupAssignments, groupLayout, reviewGroups, type GroupInput } from "../domain/group-seating";
import { semesterOf } from "../domain/semester";
import type { ClassroomService } from "./classroom-service";
import type { SeatingService } from "./seating-service";

/** The caller provides a database transaction so layout and history commit together. */
export function confirmGroupSeating(input: GroupInput, groups: string[][], occurredOn: string, classroom: ClassroomService, seating: SeatingService, transaction: <T>(work: () => T) => T): number {
  const date = new Date(`${occurredOn}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== occurredOn) throw new Error("유효한 배치일을 입력하세요.");
  const review = reviewGroups(input, groups);
  if (review.hard.length) throw new Error(review.hard.join("\n"));
  const items = groupLayout(input.sizes, input.namespace, input.fixtures);
  const assignments = groupAssignments(groups, items);
  return transaction(() => {
    const layout = classroom.save(input.namespace, items);
    return seating.confirm(input.namespace, layout.classroomLayoutId, input.students, items, assignments, semesterOf(occurredOn)!, occurredOn);
  });
}
