import { describe, expect, it } from "vitest";
import { StudentService, type StudentRepository } from "../../src/application/student-service";
import { createSchoolYear } from "../../src/domain/school-year";
import { parseStudentLines, validateStudentInput } from "../../src/domain/student-validation";
import type { Student } from "../../src/domain/models";

class MemoryStudentRepository implements StudentRepository {
  constructor(private readonly rows: Student[] = []) {}
  list(schoolYearId: string): Student[] { return this.rows.filter((row) => row.schoolYearId === schoolYearId); }
  getById(studentId: string): Student | undefined { return this.rows.find((row) => row.studentId === studentId); }
  insert(student: Student): void { this.rows.push(student); }
  update(student: Student): void { const index = this.rows.findIndex((row) => row.studentId === student.studentId); this.rows[index] = student; }
}

describe("학년도·학생 도메인", () => {
  it("한국 학년도의 시작일과 윤년 종료일을 만든다", () => {
    expect(createSchoolYear(2027, "2026-09-01T00:00:00.000Z")).toMatchObject({ startsOn: "2027-03-01", endsOn: "2028-02-29", label: "2027학년도" });
  });

  it("붙여넣기 명단을 학생 입력으로 파싱한다", () => {
    expect(parseStudentLines("1\t홍길동\t남\n2,김하늘,여")).toEqual([
      { studentNumber: 1, name: "홍길동", gender: "남" },
      { studentNumber: 2, name: "김하늘", gender: "여" }
    ]);
  });

  it("재학 중인 출석번호 중복을 거부한다", () => {
    const existing: Student = { studentId: "stu-1", schoolYearId: "sy_2026", studentNumber: 1, name: "기존학생", gender: "남", enrollmentStatus: "재학", createdAt: "x", updatedAt: "x" };
    expect(validateStudentInput({ studentNumber: 1, name: "새학생", gender: "여" }, [existing])).toContain("재학 중인 학생의 출석번호가 중복됩니다.");
  });

  it("학생을 추가하고 전출 시 이력을 삭제하지 않는다", () => {
    const repository = new MemoryStudentRepository();
    const service = new StudentService(repository, () => "stu-fixed");
    const student = service.add("sy_2026", { studentNumber: 1, name: " 홍길동 ", gender: "남" }, "2026-03-01T00:00:00.000Z");
    const transferred = service.transferOut(student.studentId, "2026-09-01");
    expect(transferred.enrollmentStatus).toBe("전출");
    expect(service.list("sy_2026")).toHaveLength(1);
    expect(service.list("sy_2026")[0].name).toBe("홍길동");
  });
});
