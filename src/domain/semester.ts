export type Semester = 1 | 2;

/** 한국 학사 기준: 3월~8월은 1학기, 9월~다음 해 2월은 2학기. 형식이 맞지 않으면 undefined. */
export function semesterOf(date: string): Semester | undefined {
  const match = /^\d{4}-(\d{2})-\d{2}$/.exec(date);
  if (!match) return undefined;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return undefined;
  return month >= 3 && month <= 8 ? 1 : 2;
}
