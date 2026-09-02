export interface SeatingHistoryRow { seatingSessionId: string; semester: number; sequenceNo: number; occurredOn: string; note?: string; assignmentCount: number; }
export interface StudentExperienceRow { studentId: string; name: string; front: number; middle: number; back: number; left: number; center: number; right: number; }
import type { ConfirmedSeatingSession } from "../domain/models";
export interface SeatingHistoryRepository { list(schoolYearId: string, semester?: number): SeatingHistoryRow[]; experience(schoolYearId: string, semester?: number): StudentExperienceRow[]; confirmedSessions(schoolYearId: string): ConfirmedSeatingSession[]; assignments(sessionId: string): { studentId: string; seatId: string }[]; latestAssignments(schoolYearId: string): { studentId: string; seatId: string }[]; }
export class SeatingHistoryService {
  constructor(private readonly repository: SeatingHistoryRepository) {}
  list(schoolYearId: string, semester?: number): SeatingHistoryRow[] { return this.repository.list(schoolYearId, semester); }
  experience(schoolYearId: string, semester?: number): StudentExperienceRow[] { return this.repository.experience(schoolYearId, semester); }
  confirmedSessions(schoolYearId: string): ConfirmedSeatingSession[] { return this.repository.confirmedSessions(schoolYearId); }
  assignments(sessionId: string): { studentId: string; seatId: string }[] { return this.repository.assignments(sessionId); }
  latestAssignments(schoolYearId: string): { studentId: string; seatId: string }[] { return this.repository.latestAssignments(schoolYearId); }
}
