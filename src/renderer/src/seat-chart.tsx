import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createSeatChart, type SeatChartMode } from "../../domain/seat-chart";
import type { LayoutItem } from "../../domain/classroom-layout";
import type { SeatingAssignment, Student } from "../../domain/models";
import { Button, SegmentedControl } from "./ui";

export function SeatChart({ items, students, assignments, mode, onBack }: { items: LayoutItem[]; students: Student[]; assignments: SeatingAssignment[]; mode: SeatChartMode; onBack: () => void }): JSX.Element {
  const cells = useMemo(() => createSeatChart(items, students, assignments, mode), [items, students, assignments, mode]);
  const teacherView = mode === "teacher";
  const handleBack = (event: MouseEvent<HTMLButtonElement>): void => { event.preventDefault(); event.stopPropagation(); onBack(); };
  return <main className="app-shell print-page"><header className="topbar no-print"><div><button type="button" className="back-button" onClick={handleBack}>← 돌아가기</button><h1>{teacherView ? "교사용 자리표" : "학생용 자리표"}</h1></div><div className="year-badge">{teacherView ? "교실 뒤에서 학생을 바라보는 교사 기준" : "칠판을 바라보는 학생 기준"}</div></header><section className="chart-toolbar no-print"><Button onClick={() => window.print()}>인쇄 / PDF 저장</Button></section><section className="seat-chart"><div className={`chart-board${teacherView ? " teacher-board" : ""}`}>칠판</div>{cells.map((cell) => <div className="chart-cell" key={cell.seatId} style={{ left: `${cell.x * 100}%`, top: `${cell.y * 100}%`, width: `${cell.width * 100}%`, height: `${cell.height * 100}%` }}>{cell.label}</div>)}</section><p className="muted no-print">학생 이름은 정상 방향으로 표시합니다. 교사용 좌석 배열은 교실 중심 기준으로 반전됩니다.</p></main>;
}

export function SeatChartScreen({ schoolYearId, assignments, onBack }: { schoolYearId: string; assignments: SeatingAssignment[]; onBack: () => void }): JSX.Element {
  const [students, setStudents] = useState<Student[]>([]); const [items, setItems] = useState<LayoutItem[]>([]); const [mode, setMode] = useState<SeatChartMode>("student");
  useEffect(() => { void Promise.all([window.appApi.students.list(schoolYearId), window.appApi.classroom.get(schoolYearId)]).then(([rows, layout]) => { setStudents(rows); setItems(layout?.items ?? []); }); }, [schoolYearId]);
  return <><div className="chart-mode-switch no-print"><SegmentedControl label="자리표 보기 방향" value={mode} onChange={setMode} options={[{ value: "student", label: "학생용" }, { value: "teacher", label: "교사용" }]} /></div><SeatChart items={items} students={students} assignments={assignments} mode={mode} onBack={onBack} /></>;
}
