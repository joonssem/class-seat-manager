import type { LayoutItem } from "../domain/classroom-layout";
import { calculateSeatPosition } from "../domain/classroom-layout";
import type { SeatingAssignment, Student } from "../domain/models";

export interface SeatingRepository {
  nextSequence(schoolYearId: string, semester: number): number;
  saveConfirmed(input: { seatingSessionId: string; schoolYearId: string; classroomLayoutId: string; semester: number; sequenceNo: number; occurredOn: string; assignments: Array<SeatingAssignment & { positionSnapshot: object; displayNameSnapshot: string; studentNumberSnapshot: number }> }): void;
  saveConfirmedBatch(inputs: Array<{ seatingSessionId: string; schoolYearId: string; classroomLayoutId: string; semester: number; sequenceNo: number; occurredOn: string; assignments: Array<SeatingAssignment & { positionSnapshot: object; displayNameSnapshot: string; studentNumberSnapshot: number }> }>): void;
}

export class SeatingService {
  constructor(private readonly repository: SeatingRepository, private readonly idFactory: () => string = () => crypto.randomUUID()) {}

  private snapshot(desk: LayoutItem, allDesks: LayoutItem[]): object {
    const frontDoor = allDesks.find((item) => item.type === "front-door");
    const backDoor = allDesks.find((item) => item.type === "back-door");
    return { x: desk.x, y: desk.y, width: desk.width, height: desk.height, position: calculateSeatPosition(desk, frontDoor, backDoor), positionOverride: desk.positionOverride };
  }

  confirm(schoolYearId: string, classroomLayoutId: string, students: Student[], desks: LayoutItem[], assignments: SeatingAssignment[], semester = 2, occurredOn = new Date().toISOString().slice(0, 10)): number {
    if (![1, 2].includes(semester)) throw new Error("학기는 1 또는 2여야 합니다.");
    const active = students.filter((student) => student.enrollmentStatus === "재학");
    const assignedStudents = new Set(assignments.map((assignment) => assignment.studentId));
    const assignedSeats = new Set(assignments.map((assignment) => assignment.seatId));
    if (assignments.length !== active.length || assignedStudents.size !== active.length || assignedSeats.size !== assignments.length) throw new Error("모든 재학생을 서로 다른 좌석에 배정해야 합니다.");
    const studentById = new Map(active.map((student) => [student.studentId, student]));
    const deskById = new Map(desks.map((desk) => [desk.id, desk]));
    const snapshotAssignments = assignments.map((assignment) => {
      const student = studentById.get(assignment.studentId);
      const desk = deskById.get(assignment.seatId);
      if (!student || !desk) throw new Error("배치에 존재하지 않는 학생 또는 좌석이 포함되어 있습니다.");
      return { ...assignment, positionSnapshot: this.snapshot(desk, desks), displayNameSnapshot: student.name, studentNumberSnapshot: student.studentNumber };
    });
    const sequenceNo = this.repository.nextSequence(schoolYearId, semester);
    this.repository.saveConfirmed({ seatingSessionId: this.idFactory(), schoolYearId, classroomLayoutId, semester, sequenceNo, occurredOn, assignments: snapshotAssignments });
    return sequenceNo;
  }

  confirmBatch(schoolYearId: string, classroomLayoutId: string, students: Student[], desks: LayoutItem[], sessions: Array<{ semester: number; occurredOn: string; assignments: SeatingAssignment[] }>): number[] {
    if (!sessions.length) throw new Error("저장할 자리 기록이 없습니다.");
    const active = students.filter((student) => student.enrollmentStatus === "재학");
    const studentById = new Map(active.map((student) => [student.studentId, student])); const deskById = new Map(desks.map((desk) => [desk.id, desk]));
    const nextBySemester = new Map<number, number>();
    const inputs = sessions.map((session) => {
      if (![1, 2].includes(session.semester)) throw new Error("학기는 1 또는 2여야 합니다.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(session.occurredOn)) throw new Error("배치일은 YYYY-MM-DD 형식이어야 합니다.");
      const assignedStudents = new Set(session.assignments.map((assignment) => assignment.studentId)); const assignedSeats = new Set(session.assignments.map((assignment) => assignment.seatId));
      if (session.assignments.length !== active.length || assignedStudents.size !== active.length || assignedSeats.size !== session.assignments.length) throw new Error(`${session.semester}학기 기록의 학생·자리 배정을 확인하세요.`);
      const assignments = session.assignments.map((assignment) => { const student = studentById.get(assignment.studentId); const desk = deskById.get(assignment.seatId); if (!student || !desk) throw new Error("존재하지 않는 학생 또는 자리입니다."); return { ...assignment, positionSnapshot: this.snapshot(desk, desks), displayNameSnapshot: student.name, studentNumberSnapshot: student.studentNumber }; });
      const sequenceNo = nextBySemester.get(session.semester) ?? this.repository.nextSequence(schoolYearId, session.semester); nextBySemester.set(session.semester, sequenceNo + 1);
      return { seatingSessionId: crypto.randomUUID(), schoolYearId, classroomLayoutId, semester: session.semester, sequenceNo, occurredOn: session.occurredOn, assignments };
    });
    this.repository.saveConfirmedBatch(inputs); return inputs.map((input) => input.sequenceNo);
  }
}
