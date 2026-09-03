import { useEffect, useState } from "react";
import { evaluateCafeteriaPairs, generateCafeteriaResult, type CafeteriaAssignment, type CafeteriaResult } from "../../domain/cafeteria-engine";
import type { Student, StudentPairConstraint } from "../../domain/models";

const seatId = (number: number): string => `CAF-${String(number).padStart(2, "0")}`;

export function Cafeteria({ schoolYearId, onBack }: { schoolYearId: string; onBack: () => void }): JSX.Element {
  const [students, setStudents] = useState<Student[]>([]);
  const [result, setResult] = useState<CafeteriaResult | null>(null);
  const [marshalIds, setMarshalIds] = useState<string[]>([]);
  const [pairConstraints, setPairConstraints] = useState<StudentPairConstraint[]>([]);
  const [semester, setSemester] = useState<1 | 2>(1);
  const [message, setMessage] = useState("");
  const [isMarshalMoving, setIsMarshalMoving] = useState(false);

  useEffect(() => {
    void Promise.all([window.appApi.students.list(schoolYearId), window.appApi.leadership.list(schoolYearId, semester)]).then(([rows, savedMarshalIds]) => {
      setStudents(rows.filter((student) => student.enrollmentStatus === "재학"));
      setMarshalIds(savedMarshalIds);
      setResult(null);
    });
  }, [schoolYearId, semester]);

  const toggleMarshal = (studentId: string): void => setMarshalIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : current.length < 4 ? [...current, studentId] : current);

  const generate = (): void => {
    if (marshalIds.length !== 4) {
      setMessage("인솔 후보 학생 4명을 먼저 선택하세요.");
      return;
    }
    void Promise.all([window.appApi.leadership.save(schoolYearId, semester, marshalIds), window.appApi.constraints.get(schoolYearId)]).then(([, constraints]) => {
      setPairConstraints(constraints.pairs);
      // 평소 줄서기는 인솔 후보도 다른 학생과 함께 무작위로 배치한다.
      setResult(generateCafeteriaResult(students, marshalIds, Date.now(), constraints.pairs));
      setMessage("");
    }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : "급식실 배치 생성에 실패했습니다."));
  };

  const confirm = (): void => {
    if (!result) {
      setMessage("먼저 줄서기를 생성하세요.");
      return;
    }
    void window.appApi.cafeteria.confirm(schoolYearId, semester, result.assignments).then((sequence) => {
      setMessage(`${semester}학기 ${sequence}회차 급식실 배치를 저장했습니다.`);
      window.print();
    }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : "급식실 배치 저장에 실패했습니다."));
  };

  const move = (studentId: string, direction: -1 | 1): void => {
    if (!result || isMarshalMoving) return;
    const hasMarshal = result.assignments.some((item) => item.role === "marshal");
    const queue = result.assignments.filter((item) => !item.role).sort((a, b) => a.queueOrder - b.queueOrder);
    const index = queue.findIndex((item) => item.studentId === studentId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= queue.length) return;
    [queue[index], queue[target]] = [queue[target], queue[index]];
    const studentSeatNumbers = hasMarshal ? Array.from({ length: 19 }, (_, seatIndex) => seatIndex + 3) : Array.from({ length: 21 }, (_, seatIndex) => seatIndex + 2);
    const marshals = result.assignments.filter((item) => item.role).sort((a, b) => a.cafeteriaSeatId.localeCompare(b.cafeteriaSeatId));
    const assignments: CafeteriaAssignment[] = [
      ...queue.map((item, itemIndex) => ({ ...item, queueOrder: itemIndex + 1, cafeteriaSeatId: seatId(studentSeatNumbers[itemIndex]) })),
      ...marshals.map((item, itemIndex) => ({ ...item, queueOrder: queue.length + itemIndex + 1 })),
    ];
    setResult({ ...result, assignments, evaluation: evaluateCafeteriaPairs(assignments, pairConstraints, students) });
  };

  const randomizeMarshals = (): void => {
    if (!result || marshalIds.length !== 4 || isMarshalMoving) return;
    const availableMarshalIds = marshalIds.filter((studentId) => result.assignments.some((item) => item.studentId === studentId));
    if (availableMarshalIds.length < 2) {
      setMessage("인솔 후보 중 현재 재학생이 2명 이상 필요합니다.");
      return;
    }
    const currentMarshalIds = result.assignments.filter((item) => item.role).map((item) => item.studentId).sort().join("::");
    let shuffled = [...availableMarshalIds].sort(() => Math.random() - 0.5).slice(0, 2);
    let attempts = 0;
    while (shuffled.slice().sort().join("::") === currentMarshalIds && attempts < 8) {
      shuffled = [...availableMarshalIds].sort(() => Math.random() - 0.5).slice(0, 2);
      attempts += 1;
    }
    const selected = new Set(shuffled);
    const queue = result.assignments.filter((item) => !selected.has(item.studentId)).sort((a, b) => a.queueOrder - b.queueOrder);
    const queueAssignments: CafeteriaAssignment[] = queue.map((item, itemIndex) => ({ studentId: item.studentId, queueOrder: itemIndex + 1, cafeteriaSeatId: seatId(itemIndex + 3) }));
    const marshalAssignments: CafeteriaAssignment[] = shuffled.map((studentId, index) => ({ studentId, queueOrder: queue.length + index + 1, cafeteriaSeatId: index === 0 ? "CAF-02" : "CAF-22", role: "marshal" }));
    const emptyAssignments = [...queueAssignments];
    const firstMarshalAssignments = [...queueAssignments, marshalAssignments[0]];
    const assignments = [...queueAssignments, ...marshalAssignments];
    const nextResult: CafeteriaResult = { ...result, marshalIds: shuffled, assignments, evaluation: evaluateCafeteriaPairs(assignments, pairConstraints, students) };

    setIsMarshalMoving(true);
    setMessage("인솔자가 이전 자리에서 빠지고 2번, 22번 자리로 순서대로 이동 중입니다.");
    setResult({ ...result, assignments: emptyAssignments, evaluation: evaluateCafeteriaPairs(emptyAssignments, pairConstraints, students) });
    window.setTimeout(() => setResult((current) => current ? { ...current, assignments: firstMarshalAssignments, evaluation: evaluateCafeteriaPairs(firstMarshalAssignments, pairConstraints, students) } : current), 220);
    window.setTimeout(() => {
      setResult(nextResult);
      setIsMarshalMoving(false);
      setMessage("인솔 후보 4명 중 새 조합을 무작위로 확인했습니다. 현재 줄 순서는 유지하고, 인솔자는 2번과 22번 자리에 배치됩니다.");
    }, 440);
  };

  const byId = new Map(students.map((student) => [student.studentId, student]));
  const seatStudent = (seatNumber: number): { name: string; marshal: boolean } | undefined => {
    const assignment = result?.assignments.find((item) => item.cafeteriaSeatId === seatId(seatNumber));
    const student = assignment ? byId.get(assignment.studentId) : undefined;
    return student ? { name: student.name, marshal: Boolean(assignment?.role) } : undefined;
  };

  return <main className="app-shell">
    <header className="topbar"><div><button type="button" className="back-button" onClick={onBack}>← 대시보드</button><h1>급식실 줄서기</h1></div><div className="year-badge"><select value={semester} onChange={(event) => setSemester(Number(event.target.value) as 1 | 2)}><option value="1">1학기</option><option value="2">2학기</option></select> · 교사 1번 · 인솔 후보 {marshalIds.length}/4명</div></header>
    <section className="cafeteria-marshal"><h2>인솔 후보 선택</h2><p className="muted">평소에는 후보 4명도 다른 학생들과 함께 무작위로 줄을 섭니다. 아래 버튼을 누르면 후보 중 2명을 무작위로 골라 2번·22번 자리로 순서대로 이동합니다.</p><div className="marshal-list">{students.map((student) => <button type="button" key={student.studentId} className={marshalIds.includes(student.studentId) ? "marshal selected" : "marshal"} onClick={() => toggleMarshal(student.studentId)}>{student.studentNumber}. {student.name}</button>)}</div></section>
    <section className="manual-toolbar"><div><strong>줄서기·착석</strong><span className="muted">오른쪽 줄은 1번부터, 왼쪽 줄은 12번부터 시작합니다. 1번은 담임교사 자리이며 학생은 2~22번에 앉습니다.</span></div><button type="button" onClick={generate}>새 줄서기 생성</button></section>
    {message && <p className="error-message">{message}</p>}
    {result && <section className="cafeteria-result"><div className="result-heading"><div><h2>줄서기 결과</h2><p className="muted">위에서 아래로 오른쪽 줄 1~11번, 왼쪽 줄 12~22번입니다. 같은 행의 두 자리가 서로 마주봅니다.</p></div><button type="button" className="secondary" disabled={isMarshalMoving} onClick={randomizeMarshals}>{isMarshalMoving ? "인솔자 이동 중…" : "인솔자 랜덤 위치 확인"}</button></div>
      <div className="cafeteria-result-layout"><div><div className="cafeteria-seat-table-wrap"><table className="cafeteria-seat-table"><thead><tr><th scope="col">왼쪽 줄 (12~22번)</th><th scope="col">마주보는 자리</th><th scope="col">오른쪽 줄 (1~11번)</th></tr></thead><tbody>{Array.from({ length: 11 }, (_, index) => index + 1).map((rightSeat) => { const leftSeat = rightSeat + 11; const left = seatStudent(leftSeat); const right = rightSeat === 1 ? { name: "담임교사", marshal: false } : seatStudent(rightSeat); return <tr key={rightSeat}><td className={left?.marshal ? "marshal-seat" : ""}><span>{leftSeat}번</span><strong>{left?.name ?? "빈 자리"}</strong></td><td className="facing-label">↔<br /><small>{leftSeat}번 · {rightSeat}번</small></td><td className={`${rightSeat === 1 ? "teacher" : ""}${right?.marshal ? " marshal-seat" : ""}`}><span>{rightSeat}번</span><strong>{right?.name ?? "빈 자리"}</strong></td></tr>; })}</tbody></table></div></div>
        <aside className="cafeteria-score"><div className="cafeteria-score-grid"><div className="candidate-score"><span>짝 조건 점수</span><strong>{result.evaluation.score}점</strong></div><div className="candidate-score"><span>성별 인접 점수</span><strong>{result.evaluation.genderScore}점</strong></div></div><p className="muted">같은 줄에서 같은 성별이 연속한 자리: {result.evaluation.genderAdjacencyPenalty}쌍</p><p className="muted">현재 짝 조건 {result.evaluation.pairDetails.length}개를 줄서기와 급식실 자리 모두에서 평가했습니다. 마주보는 자리는 추가 가까움 패널티를 반영합니다.</p>{result.evaluation.pairDetails.length ? <div className="cafeteria-pair-list">{result.evaluation.pairDetails.map((pair) => <div className={`cafeteria-pair ${pair.status}`} key={`${pair.studentAId}-${pair.studentBId}-${pair.type}`}><span>{pair.status === "satisfied" ? "✓" : pair.status === "warning" ? "!" : "×"}</span><div><strong>{byId.get(pair.studentAId)?.name} · {byId.get(pair.studentBId)?.name}</strong><small>{pair.type} · 줄 거리 {pair.queueDistance} · 자리 거리 {pair.seatDistance}{pair.facing ? " · 마주봄(추가 반영)" : ""}</small></div><em>{pair.penalty.toFixed(2)}</em></div>)}</div> : <p className="muted">설정된 짝 조건이 없습니다.</p>}</aside></div>
      <div className="cafeteria-table">{result.assignments.map((assignment) => <div className="cafeteria-row" key={assignment.studentId}><strong>{assignment.role ? "인솔" : `${assignment.queueOrder}번`}</strong><span>{byId.get(assignment.studentId)?.name}</span><span>{assignment.cafeteriaSeatId.replace("CAF-", "급식실 ")}</span>{assignment.role && <span className="tag">인솔</span>}<span>{!assignment.role && <><button type="button" className="text-button" onClick={() => move(assignment.studentId, -1)}>위</button> <button type="button" className="text-button" onClick={() => move(assignment.studentId, 1)}>아래</button></>}</span></div>)}</div><button type="button" className="secondary" disabled={isMarshalMoving} onClick={confirm}>급식실 배치 확정 저장</button>
    </section>}
  </main>;
}
