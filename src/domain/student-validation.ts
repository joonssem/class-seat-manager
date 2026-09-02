import type { Gender, Student } from "./models";

export interface StudentInput {
  studentNumber: number;
  name: string;
  gender: Gender;
  enrollmentStatus?: "재학" | "전출";
  transferInDate?: string;
  transferOutDate?: string;
}

export function validateStudentInput(input: StudentInput, existing: Student[] = [], ignoreStudentId?: string): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(input.studentNumber) || input.studentNumber < 1) errors.push("출석번호는 1 이상의 정수여야 합니다.");
  if (!input.name.trim()) errors.push("이름을 입력해야 합니다.");
  if (existing.some((student) => student.studentId !== ignoreStudentId && student.studentNumber === input.studentNumber && student.enrollmentStatus === "재학")) {
    errors.push("재학 중인 학생의 출석번호가 중복됩니다.");
  }
  if (input.enrollmentStatus === "전출" && !input.transferOutDate) errors.push("전출 학생은 전출일이 필요합니다.");
  if (input.transferInDate && input.transferOutDate && input.transferInDate > input.transferOutDate) errors.push("전입일은 전출일보다 늦을 수 없습니다.");
  return errors;
}

export function parseStudentLines(text: string): StudentInput[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [number, name, gender = ""] = line.split(/[\t,]/).map((part) => part.trim());
    const studentNumber = Number(number);
    if (!Number.isInteger(studentNumber) || !name || (gender !== "남" && gender !== "여")) {
      throw new Error(`${index + 1}번째 줄은 '출석번호, 이름, 성별(남/여)' 형식이어야 합니다.`);
    }
    return { studentNumber, name, gender };
  });
}
