export interface SchoolYear {
  schoolYearId: string;
  label: string;
  startsOn: string;
  endsOn: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export function createSchoolYear(year: number, now = new Date().toISOString()): SchoolYear {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("학년도는 2000년부터 2100년 사이의 정수여야 합니다.");
  }
  const leapNextYear = (year + 1) % 4 === 0 && ((year + 1) % 100 !== 0 || (year + 1) % 400 === 0);
  return {
    schoolYearId: `sy_${year}`,
    label: `${year}학년도`,
    startsOn: `${year}-03-01`,
    endsOn: `${year + 1}-02-${leapNextYear ? "29" : "28"}`,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}
