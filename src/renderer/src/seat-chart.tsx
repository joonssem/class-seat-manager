import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createSeatChart, type SeatChartMode } from "../../domain/seat-chart";
import type { LayoutItem } from "../../domain/classroom-layout";
import type { SeatingAssignment, Student } from "../../domain/models";

export function SeatChart({ items, students, assignments, mode, onBack }: { items: LayoutItem[]; students: Student[]; assignments: SeatingAssignment[]; mode: SeatChartMode; onBack: () => void }): JSX.Element {
  const cells = useMemo(() => createSeatChart(items, students, assignments, mode), [items, students, assignments, mode]);
  const teacherView = mode === "teacher";
  const handleBack = (event: MouseEvent<HTMLButtonElement>): void => { event.preventDefault(); event.stopPropagation(); onBack(); };
  return <main className="app-shell print-page"><header className="topbar no-print"><div><button type="button" className="back-button" onClick={handleBack}>← 돌아가기</button><h1>{teacherView ? "교사용 자리표" : "학생용 자리표"}</h1></div><div className="year-badge">{teacherView ? "교실 반대편에서 바라보는 방향" : "칠판을 바라보는 방향"}</div></header><section className="chart-toolbar no-print"><button type="button" onClick={() => window.print()}>인쇄 / PDF 저장</button></section><section className="seat-chart"><div className={`chart-board${teacherView ? " teacher-board" : ""}`}>칠판</div>{cells.map((cell) => <div className="chart-cell" key={cell.seatId} style={{ left: `${cell.x * 100}%`, top: `${cell.y * 100}%`, width: `${cell.width * 100}%`, height: `${cell.height * 100}%` }}>{cell.label}</div>)}</section><p className="muted no-print">학생 이름은 정상 방향으로 표시하고, 교사용 좌석 배열은 교실 중심 기준 180도 점대칭으로 표시합니다.</p></main>;
}

export function SeatChartScreen({ schoolYearId, assignments, onBack }: { schoolYearId: string; assignments: SeatingAssignment[]; onBack: () => void }): JSX.Element {
  const [students, setStudents] = useState<Student[]>([]); const [items, setItems] = useState<LayoutItem[]>([]); const [mode, setMode] = useState<SeatChartMode>("student");
  useEffect(() => { void Promise.all([window.appApi.students.list(schoolYearId), window.appApi.classroom.get(schoolYearId)]).then(([rows, layout]) => { setStudents(rows); setItems(layout?.items ?? []); }); }, [schoolYearId]);
  return <><div className="chart-mode-switch no-print"><button type="button" className={mode === "student" ? "active" : "secondary"} onClick={() => setMode("student")}>학생용</button><button type="button" className={mode === "teacher" ? "active" : "secondary"} onClick={() => setMode("teacher")}>교사용</button></div><SeatChart items={items} students={students} assignments={assignments} mode={mode} onBack={onBack} /></>;
}
