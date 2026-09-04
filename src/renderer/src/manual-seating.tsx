import { useEffect, useMemo, useState, type DragEvent } from "react";
import type { LayoutItem } from "../../domain/classroom-layout";
import type { SeatingAssignment, Student } from "../../domain/models";
import { Button, ConfirmDialog, StatusBanner, Toast } from "./ui";

interface Props { schoolYearId: string; onBack: () => void; initialAssignments?: SeatingAssignment[]; onPreview: (assignments: SeatingAssignment[]) => void; onConfirmed?: (assignments: SeatingAssignment[]) => void; }

export function ManualSeating({ schoolYearId, onBack, initialAssignments = [], onPreview, onConfirmed }: Props): JSX.Element {
  const [students, setStudents] = useState<Student[]>([]);
  const [desks, setDesks] = useState<LayoutItem[]>([]);
  const [layoutId, setLayoutId] = useState("");
  const [semester, setSemester] = useState<1 | 2>(2);
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [assignments, setAssignments] = useState<Record<string, string>>(() => Object.fromEntries(initialAssignments.map((item) => [item.seatId, item.studentId])));
  const [score, setScore] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => { void Promise.all([window.appApi.students.list(schoolYearId), window.appApi.classroom.get(schoolYearId)]).then(([rows, layout]) => { setStudents(rows.filter((student) => student.enrollmentStatus === "재학")); setLayoutId(layout?.classroomLayoutId ?? ""); setDesks((layout?.items ?? []).filter((item) => item.type === "desk")); }); }, [schoolYearId]);
  useEffect(() => { const onBeforeUnload = (event: BeforeUnloadEvent): void => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, [dirty]);

  const assignedIds = useMemo(() => new Set(Object.values(assignments).filter(Boolean)), [assignments]);
  const unassigned = students.filter((student) => !assignedIds.has(student.studentId));
  const duplicateCount = Object.values(assignments).filter(Boolean).length - assignedIds.size;
  const rows = (): SeatingAssignment[] => Object.entries(assignments).filter(([, studentId]) => studentId).map(([seatId, studentId]) => ({ seatId, studentId }));
  const applyAssignments = (next: Record<string, string>): void => {
    setAssignments(next); setDirty(true);
    void window.appApi.seating.evaluate(schoolYearId, students, desks, Object.entries(next).filter(([, id]) => id).map(([id, studentId]) => ({ seatId: id, studentId }))).then((evaluation) => setScore(evaluation.score)).catch(() => setScore(null));
  };
  const update = (seatId: string, studentId: string): void => {
    const next = { ...assignments }; const previousSeat = Object.entries(next).find(([, assignedStudentId]) => assignedStudentId === studentId)?.[0]; const displacedStudent = next[seatId];
    if (previousSeat && previousSeat !== seatId) next[previousSeat] = displacedStudent ?? "";
    next[seatId] = studentId; applyAssignments(next);
  };
  const dropStudent = (event: DragEvent<HTMLElement>, seatId: string): void => { event.preventDefault(); const studentId = event.dataTransfer.getData("text/student-id"); if (studentId) update(seatId, studentId); };
  const confirm = (): void => {
    if (unassigned.length || duplicateCount || !layoutId) { setMessage("모든 학생을 서로 다른 좌석에 배정한 뒤 확정하세요."); return; }
    const semesterInput = window.prompt("몇 학기 자리 기록인가요? (1 또는 2)", String(semester)); const selectedSemester = Number(semesterInput);
    if (![1, 2].includes(selectedSemester)) { setMessage("학기는 1 또는 2로 입력하세요."); return; }
    const dateInput = window.prompt("자리배치 날짜를 입력하세요. (YYYY-MM-DD)", occurredOn); if (!dateInput) return;
    setSemester(selectedSemester as 1 | 2); setOccurredOn(dateInput);
    const currentRows = rows();
    void window.appApi.seating.confirm(schoolYearId, layoutId, students, desks, currentRows, selectedSemester, dateInput).then((sequence) => { const savedMessage = `${selectedSemester}학기 ${sequence}차 자리배치로 확정 저장했습니다.`; setMessage(savedMessage); setToast(savedMessage); setDirty(false); onConfirmed?.(currentRows); onPreview(currentRows); }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : "자리배치 확정에 실패했습니다."));
  };
  const requestBack = (): void => { if (dirty) setShowExitConfirm(true); else onBack(); };
  const reset = (): void => { setAssignments({}); setScore(null); setDirty(true); setMessage("배치를 초기화했습니다. 저장하려면 자리 배치 확정을 선택하세요."); setShowResetConfirm(false); };

  return <main className="app-shell">
    <header className="topbar"><div><button type="button" className="back-button" onClick={requestBack}>← 대시보드</button><h1>수동 자리배치</h1></div><div className="year-badge">학생 {students.length}명 · 좌석 {desks.length}개</div></header>
    <section className="manual-toolbar"><div><strong>배치 상태</strong><span className={unassigned.length || duplicateCount ? "warning-text" : "success-text"}>{dirty ? "저장되지 않은 변경사항 · " : "모든 변경사항이 저장됨 · "}{unassigned.length ? `미배정 ${unassigned.length}명` : "모든 학생 배정 완료"}{duplicateCount ? ` · 중복 ${duplicateCount}건` : ""}{score !== null ? ` · 현재 점수 ${score}점` : ""}</span></div><span className="muted">학생을 자리 카드로 끌어 놓으면 서로 교환됩니다.</span><Button variant="secondary" onClick={() => setShowResetConfirm(true)}>배치 초기화</Button></section>
    {message && <StatusBanner tone={message.includes("확정 저장") ? "success" : "warning"} title={message.includes("확정 저장") ? "자리배치가 저장되었습니다" : message.includes("초기화") ? "저장되지 않은 변경사항" : "확인해 주세요"}>{message}</StatusBanner>}
    <section className="manual-grid">{desks.map((desk) => { const assignedStudent = students.find((student) => student.studentId === assignments[desk.id]); return <article className="manual-seat" key={desk.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropStudent(event, desk.id)}><div className="seat-label">{desk.id.replace("seat-", "좌석 ")}</div>{assignedStudent && <div className="assigned-student" draggable onDragStart={(event) => { event.dataTransfer.setData("text/student-id", assignedStudent.studentId); }}><strong>{assignedStudent.studentNumber}. {assignedStudent.name}</strong></div>}<select aria-label={`${desk.id} 학생`} value={assignments[desk.id] ?? ""} onChange={(event) => update(desk.id, event.target.value)}><option value="">학생 선택</option>{students.map((student) => <option key={student.studentId} value={student.studentId}>{student.studentNumber}. {student.name}{assignedIds.has(student.studentId) && assignments[desk.id] !== student.studentId ? " (자리 이동)" : ""}</option>)}</select></article>; })}</section>
    {!desks.length && <section className="welcome-card"><div><h2>저장된 책상이 없습니다</h2><p>교실 배치 편집에서 책상을 추가하고 저장하세요.</p></div></section>}
    <section className="manual-footer"><span className="muted">미배정 학생: {unassigned.length ? unassigned.map((student) => <span key={student.studentId} draggable onDragStart={(event) => { event.dataTransfer.setData("text/student-id", student.studentId); }}>{student.studentNumber}. {student.name} </span>) : "없음"}</span><Button variant="secondary" onClick={() => onPreview(rows())}>자리표 미리보기</Button><Button onClick={confirm} disabled={Boolean(unassigned.length || duplicateCount || !layoutId)}>자리 배치 확정</Button></section>
    {showResetConfirm && <ConfirmDialog title="배치를 초기화할까요?" confirmLabel="배치 초기화" onCancel={() => setShowResetConfirm(false)} onConfirm={reset}>현재 화면에서 수정한 배치가 모두 사라집니다. 저장된 자리 기록은 삭제되지 않습니다.</ConfirmDialog>}
    {showExitConfirm && <ConfirmDialog title="저장하지 않고 나갈까요?" confirmLabel="나가기" onCancel={() => setShowExitConfirm(false)} onConfirm={onBack}>저장하지 않은 수정 사항이 있습니다. 나가면 변경 내용이 사라집니다.</ConfirmDialog>}
    {toast && <Toast onDismiss={() => setToast("")}>{toast}</Toast>}
  </main>;
}
