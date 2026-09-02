import type { LayoutItem } from "./classroom-layout";
import type { Student } from "./models";

export interface HistoricalAssignmentInput { name: string; seatNumber: string; }
export interface HistoricalSessionInput { sessionNumber: number; occurredOn?: string; assignments: HistoricalAssignmentInput[]; }
export interface HistoricalAssignmentMatch extends HistoricalAssignmentInput { studentId?: string; seatId?: string; error?: string; }
export interface HistoricalSessionValidation { sessionNumber: number; assignments: HistoricalAssignmentMatch[]; errors: string[]; valid: boolean; }

const headerPattern = /^(학생\s*이름|이름)\s*[\t, ]\s*(자리\s*번호|자리)$/i;

export function parseHistoricalSession(text: string, sessionNumber: number): HistoricalSessionInput {
  const assignments = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !headerPattern.test(line)).map((line, index) => {
    const parts = line.split(/[\t,]/).map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2) throw new Error(`${index + 1}행은 학생 이름과 자리 번호 2개 값이 필요합니다.`);
    return { name: parts[0], seatNumber: parts[1] };
  });
  if (!assignments.length) throw new Error(`${sessionNumber}회차 입력이 비어 있습니다.`);
  return { sessionNumber, assignments };
}

function normalizeName(name: string): string { return name.trim().replace(/\s+/g, " "); }
function normalizeSeatNumber(value: string): string { return value.trim().toLowerCase().replace(/^좌석\s*/, "").replace(/^seat[-_ ]*/, "").replace(/^0+(?=\d)/, ""); }

export function validateHistoricalSession(input: HistoricalSessionInput, students: Student[], desks: LayoutItem[]): HistoricalSessionValidation {
  const matches = input.assignments.map((assignment) => {
    const name = normalizeName(assignment.name);
    const studentMatches = students.filter((student) => normalizeName(student.name) === name);
    const seatNumber = normalizeSeatNumber(assignment.seatNumber);
    const seatMatches = desks.filter((desk) => desk.type === "desk" && normalizeSeatNumber(desk.id) === seatNumber);
    const errors: string[] = [];
    if (studentMatches.length === 0) errors.push("등록되지 않은 학생");
    if (studentMatches.length > 1) errors.push("동명이인 학생");
    if (seatMatches.length === 0) errors.push("존재하지 않는 자리");
    return { ...assignment, studentId: studentMatches.length === 1 ? studentMatches[0].studentId : undefined, seatId: seatMatches.length === 1 ? seatMatches[0].id : undefined, error: errors.length ? errors.join(", ") : undefined };
  });
  const errors: string[] = [];
  const studentIds = matches.map((match) => match.studentId).filter(Boolean);
  const seatIds = matches.map((match) => match.seatId).filter(Boolean);
  if (studentIds.some((id, index) => studentIds.indexOf(id) !== index)) errors.push("학생이 중복 배정되었습니다.");
  if (seatIds.some((id, index) => seatIds.indexOf(id) !== index)) errors.push("자리가 중복 배정되었습니다.");
  matches.forEach((match, index) => { if (match.error) errors.push(`${index + 1}행: ${match.error}`); });
  return { sessionNumber: input.sessionNumber, assignments: matches, errors, valid: errors.length === 0 };
}
