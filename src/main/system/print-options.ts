/** 자리표는 A4 가로로 출력한다. 화면의 window.print()는 용지 방향을 보장하지 못해 메인 프로세스에서 명시한다. */
export const LANDSCAPE_PRINT_OPTIONS = {
  landscape: true,
  printBackground: true,
  pageSize: "A4" as const
};

export function chartPdfFileName(label: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const safe = label.replace(/[\\/:*?"<>|]/g, "").trim() || "자리표";
  return `${safe}-${stamp}.pdf`;
}
