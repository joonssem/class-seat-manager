import type { Student } from "../domain/models";
import { validateStudentInput, type StudentInput } from "../domain/student-validation";

export interface StudentRepository {
  list(schoolYearId: string): Student[];
  getById(studentId: string): Student | undefined;
  insert(student: Student): void;
  update(student: Student): void;
}

export class StudentService {
  constructor(private readonly repository: StudentRepository, private readonly idFactory: () => string = () => crypto.randomUUID()) {}

  list(schoolYearId: string): Student[] {
    return this.repository.list(schoolYearId);
  }

  add(schoolYearId: string, input: StudentInput, now = new Date().toISOString()): Student {
    const existing = this.repository.list(schoolYearId);
    const errors = validateStudentInput(input, existing);
    if (errors.length > 0) throw new Error(errors.join(" "));
    const student: Student = {
      studentId: this.idFactory(),
      schoolYearId,
      ...input,
      name: input.name.trim(),
      enrollmentStatus: input.enrollmentStatus ?? "재학",
      createdAt: now,
      updatedAt: now
    };
    this.repository.insert(student);
    return student;
  }

  transferOut(studentId: string, date: string): Student {
    const student = this.find(studentId);
    if (!date) throw new Error("전출일을 입력해야 합니다.");
    const updated = { ...student, enrollmentStatus: "전출" as const, transferOutDate: date };
    this.repository.update(updated);
    return updated;
  }

  private find(studentId: string): Student {
    const student = this.repository.getById(studentId);
    if (!student) throw new Error("학생을 찾을 수 없습니다.");
    return student;
  }
}
