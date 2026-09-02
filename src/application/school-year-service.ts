import type { SchoolYear } from "../domain/school-year";
import { createSchoolYear } from "../domain/school-year";

export interface SchoolYearRepository {
  list(): SchoolYear[];
  insert(schoolYear: SchoolYear): void;
  archiveAll(): void;
}

export class SchoolYearService {
  constructor(private readonly repository: SchoolYearRepository) {}

  list(): SchoolYear[] { return this.repository.list().sort((a, b) => b.startsOn.localeCompare(a.startsOn)); }

  create(year: number): SchoolYear {
    if (this.repository.list().some((item) => item.schoolYearId === `sy_${year}`)) throw new Error("이미 존재하는 학년도입니다.");
    this.repository.archiveAll();
    const schoolYear = createSchoolYear(year);
    this.repository.insert(schoolYear);
    return schoolYear;
  }

  active(): SchoolYear | undefined { return this.repository.list().find((item) => item.status === "active"); }
}
