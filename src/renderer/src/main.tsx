import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AppInfo, AppApi } from "../../shared/contracts/app";
import type { SchoolYear } from "../../domain/school-year";
import type { Student } from "../../domain/models";
import type { StudentInput } from "../../domain/student-validation";
import type { LayoutItem } from "../../domain/classroom-layout";
import type { ConstraintSet } from "../../application/constraint-service";
import type { SeatingHistoryRow } from "../../application/seating-history-service";
import { ClassroomEditor } from "./classroom-editor";
import { ManualSeating } from "./manual-seating";
import { SeatingHistory } from "./seating-history";
import { Constraints } from "./constraints";
import { SeatChartScreen } from "./seat-chart";
import { Cafeteria } from "./cafeteria";
import { CafeteriaHistory } from "./cafeteria-history";
import { Backup } from "./backup";
import { NewSeating } from "./new-seating";
import { Button, ConfirmDialog, StatusBanner } from "./ui";
import "./styles.css";

declare global {
  interface Window { appApi: AppApi; }
}

const demoStudents: Student[] = [];

function StudentManager({ students, onChange, schoolYearId, schoolYearLabel }: { students: Student[]; onChange: (students: Student[]) => void; schoolYearId: string; schoolYearLabel: string }): JSX.Element {
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Student["gender"]>("남");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  const [transferTarget, setTransferTarget] = useState<Student | null>(null);

  const addStudent = (): void => {
    const studentNumber = Number(number);
    if (!Number.isInteger(studentNumber) || studentNumber < 1 || !name.trim()) { setError("출석번호와 이름을 입력하세요."); return; }
    if (students.some((student) => student.studentNumber === studentNumber && student.enrollmentStatus === "재학")) { setError("재학 중인 출석번호가 중복됩니다."); return; }
    const input: StudentInput = { studentNumber, name: name.trim(), gender };
    void window.appApi.students.add(schoolYearId, input).then(() => window.appApi.students.list(schoolYearId)).then((next) => { onChange(next); setNumber(""); setName(""); setError(""); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "학생을 추가하지 못했습니다."));
  };

  const importPaste = (): void => {
    const rows = paste.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const imported: StudentInput[] = [];
    for (const [index, row] of rows.entries()) {
      const [rawNumber, rawName, rawGender] = row.split(/[\t,]/).map((part) => part.trim());
      const studentNumber = Number(rawNumber);
      if (!Number.isInteger(studentNumber) || !rawName || (rawGender !== "남" && rawGender !== "여")) { setError(`${index + 1}번째 줄 형식을 확인하세요.`); return; }
      const parsedGender = rawGender as Student["gender"];
      imported.push({ studentNumber, name: rawName, gender: parsedGender });
    }
    void Promise.all(imported.map((item) => window.appApi.students.add(schoolYearId, { studentNumber: item.studentNumber, name: item.name, gender: item.gender }))).then(() => window.appApi.students.list(schoolYearId)).then((next) => { onChange(next); setPaste(""); setError(""); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "명단을 가져오지 못했습니다."));
  };

  const transferOut = (): void => {
    if (!transferTarget) return;
    void window.appApi.students.transferOut(transferTarget.studentId, new Date().toISOString().slice(0, 10)).then(() => window.appApi.students.list(schoolYearId)).then(onChange).then(() => setTransferTarget(null)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "전출 처리에 실패했습니다."));
  };

  return <section className="student-panel">
     <div className="panel-heading"><div><span className="eyebrow">{schoolYearLabel}</span><h2>학생 관리</h2></div><span className="count-badge">재학 {students.filter((student) => student.enrollmentStatus === "재학").length}명</span></div>
     <div className="student-tools"><div className="student-entry-card"><h3>학생 한 명 추가</h3><p className="muted">출석번호, 이름, 성별을 입력합니다.</p><div className="form-row"><input aria-label="출석번호" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="번호" /><input aria-label="이름" value={name} onChange={(event) => setName(event.target.value)} placeholder="이름" /><select aria-label="성별" value={gender} onChange={(event) => setGender(event.target.value as Student["gender"])}><option>남</option><option>여</option></select><Button onClick={addStudent}>학생 추가</Button></div></div><div className="student-entry-card"><h3>명단 붙여넣기</h3><p className="muted">한 줄에 번호, 이름, 성별을 탭 또는 쉼표로 구분합니다.</p><textarea aria-label="학생 명단 붙여넣기" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={'예시\n1\t홍길동\t남'} /><Button variant="secondary" className="import-button" onClick={importPaste}>붙여넣기 명단 가져오기</Button></div></div>
     {error && <p className="error-message" role="alert">{error}</p>}
     <p className="table-caption">총 {students.length}명 등록됨 · 재학 {students.filter((student) => student.enrollmentStatus === "재학").length}명</p>
     <div className="student-table"><div className="table-row table-head"><span>번호</span><span>이름</span><span>성별</span><span>상태</span><span>행동</span></div>{students.map((student) => <div className="table-row" key={student.studentId}><span>{student.studentNumber}</span><span>{student.name}</span><span>{student.gender}</span><span>{student.enrollmentStatus}</span><span>{student.enrollmentStatus === "재학" ? <button type="button" className="text-button danger-text-button" onClick={() => setTransferTarget(student)}>전출 처리</button> : "과거 기록 보존"}</span></div>)}</div>
     {transferTarget && <ConfirmDialog title={`${transferTarget.name} 학생을 전출 처리할까요?`} confirmLabel="전출 처리" onCancel={() => setTransferTarget(null)} onConfirm={transferOut}>전출 처리하면 앞으로의 자리배치에서 제외됩니다. 과거 자리 기록은 보존됩니다.</ConfirmDialog>}
   </section>;
}

function DashboardCard({ title, description, action, onClick, disabled = false }: { title: string; description: string; action: string; onClick: () => void; disabled?: boolean }): JSX.Element {
  return <article className="dashboard-card compact-card"><h3>{title}</h3><p>{description}</p><Button variant="secondary" disabled={disabled} title={disabled ? "먼저 학생 명단과 교실 좌석을 설정하세요." : undefined} onClick={onClick}>{action}</Button></article>;
}

function App(): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [schoolYear, setSchoolYear] = useState<SchoolYear | null>(null);
  const [students, setStudents] = useState<Student[]>(demoStudents);
  const [screen, setScreen] = useState<"dashboard" | "students" | "classroom" | "manual-seating" | "history" | "new-seating" | "constraints" | "chart" | "cafeteria" | "cafeteria-history" | "backup">("dashboard");
  const [chartReturnScreen, setChartReturnScreen] = useState<"dashboard" | "manual-seating" | "history">("dashboard");
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()));
  const [yearError, setYearError] = useState("");
  const [draftAssignments, setDraftAssignments] = useState<import("../../domain/models").SeatingAssignment[]>([]);
  const [previewAssignments, setPreviewAssignments] = useState<import("../../domain/models").SeatingAssignment[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<import("../../domain/models").SeatingAssignment[]>([]);
  const [classroomItems, setClassroomItems] = useState<LayoutItem[]>([]);
  const [constraints, setConstraints] = useState<ConstraintSet>({ seat: [], pairs: [] });
  const [history, setHistory] = useState<SeatingHistoryRow[]>([]);
  useEffect(() => { void window.appApi.getInfo().then(setInfo); }, []);
  useEffect(() => { void window.appApi.schoolYears.list().then((years) => setSchoolYear(years.find((year) => year.status === "active") ?? null)); }, []);
  const refreshDashboard = useCallback((): void => {
    if (!schoolYear) {
      setStudents([]);
      setCurrentAssignments([]);
      setClassroomItems([]);
      setConstraints({ seat: [], pairs: [] });
      setHistory([]);
      return;
    }
    void Promise.all([
      window.appApi.students.list(schoolYear.schoolYearId),
      window.appApi.history.latestAssignments(schoolYear.schoolYearId),
      window.appApi.classroom.get(schoolYear.schoolYearId),
      window.appApi.constraints.get(schoolYear.schoolYearId),
      window.appApi.history.list(schoolYear.schoolYearId)
    ]).then(([nextStudents, nextAssignments, classroom, nextConstraints, nextHistory]) => {
      setStudents(nextStudents);
      setCurrentAssignments(nextAssignments);
      setClassroomItems(classroom?.items ?? []);
      setConstraints(nextConstraints);
      setHistory(nextHistory);
    });
  }, [schoolYear]);
  useEffect(() => { refreshDashboard(); }, [refreshDashboard]);

  const goDashboard = (): void => { refreshDashboard(); setScreen("dashboard"); };

  const createYear = (): void => {
    const year = Number(yearInput);
    void window.appApi.schoolYears.create(year).then(setSchoolYear).then(() => setYearError("")).catch((reason: unknown) => setYearError(reason instanceof Error ? reason.message : "학년도를 생성하지 못했습니다."));
  };

  if (screen === "students") return <main className="app-shell"><header className="topbar"><div><button type="button" className="back-button" onClick={goDashboard}>← 대시보드</button><h1>학생 관리</h1></div><div className="year-badge">{schoolYear?.label ?? "학년도 미설정"}</div></header>{schoolYear ? <StudentManager students={students} onChange={setStudents} schoolYearId={schoolYear.schoolYearId} schoolYearLabel={schoolYear.label} /> : <section className="welcome-card"><div><h2>먼저 학년도를 생성하세요</h2><p>학생 명단은 학년도에 연결되어 저장됩니다.</p></div></section>}<footer>{info ? `${info.name} · SQLite 연결` : "앱 정보를 불러오는 중입니다."}</footer></main>;
  if (screen === "classroom") return <ClassroomEditor onBack={goDashboard} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} />;
  if (screen === "manual-seating") return <ManualSeating onBack={goDashboard} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} initialAssignments={draftAssignments} onConfirmed={(assignments) => { setCurrentAssignments(assignments); setDraftAssignments(assignments); }} onPreview={(assignments) => { setPreviewAssignments(assignments); setDraftAssignments(assignments); setChartReturnScreen("manual-seating"); setScreen("chart"); }} />;
  if (screen === "history") return <SeatingHistory onBack={goDashboard} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} onOpenChart={(assignments) => { setPreviewAssignments(assignments); setChartReturnScreen("history"); setScreen("chart"); }} />;
  if (screen === "new-seating") return <NewSeating onBack={goDashboard} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} onChoose={(candidate) => { setDraftAssignments(candidate.assignments); setScreen("manual-seating"); }} />;
  if (screen === "constraints") return <Constraints onBack={goDashboard} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} schoolYearLabel={schoolYear?.label ?? "학년도 미설정"} />;
  if (screen === "chart") return <SeatChartScreen onBack={() => chartReturnScreen === "dashboard" ? goDashboard() : setScreen(chartReturnScreen)} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} assignments={previewAssignments} />;
  if (screen === "cafeteria") return <Cafeteria onBack={goDashboard} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} />;
  if (screen === "cafeteria-history") return <CafeteriaHistory onBack={goDashboard} schoolYearId={schoolYear?.schoolYearId ?? "sy_unknown"} />;
  if (screen === "backup") return <Backup onBack={goDashboard} />;

  const activeStudents = students.filter((student) => student.enrollmentStatus === "재학");
  const deskCount = classroomItems.filter((item) => item.type === "desk").length;
  const conditionCount = constraints.seat.length + constraints.pairs.length;
  const missingSetup = [
    activeStudents.length === 0 ? "학생 명단" : "",
    deskCount === 0 ? "교실 좌석" : ""
  ].filter(Boolean);
  const readyForSeating = missingSetup.length === 0;
  const latestHistory = history[0];
  const openCurrentChart = (): void => { setPreviewAssignments(currentAssignments); setChartReturnScreen("dashboard"); setScreen("chart"); };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><span className="eyebrow">담임교사용 로컬 앱</span><h1>학급 자리배치 도우미</h1></div>
        <div className="year-badge">{schoolYear?.label ?? "학년도 미설정"}</div>
      </header>
      {!schoolYear ? <section className="welcome-card setup-card">
        <span className="status-dot" />
        <div><h2>처음 설정을 시작하세요</h2><p>먼저 학년도를 만든 뒤 학생 명단과 교실 책상 배치를 등록합니다.</p><div className="year-form"><label htmlFor="school-year">학년도</label><input id="school-year" value={yearInput} onChange={(event) => setYearInput(event.target.value)} /><span>년</span><button type="button" onClick={createYear}>학년도 생성</button></div>{yearError && <p className="error-message">{yearError}</p>}</div>
      </section> : <>
        <StatusBanner tone={readyForSeating ? "success" : "warning"} title={readyForSeating ? "자리 생성 준비가 완료되었습니다" : "자리 생성을 위한 준비가 필요합니다"} action={readyForSeating ? <Button onClick={() => setScreen("new-seating")}>{currentAssignments.length ? "새 자리배치 만들기" : "첫 자리배치 만들기"}</Button> : <Button onClick={() => setScreen(activeStudents.length === 0 ? "students" : "classroom")}>{activeStudents.length === 0 ? "학생 명단 등록하기" : "교실 좌석 설정하기"}</Button>}>
          {readyForSeating ? `학생 ${activeStudents.length}명과 좌석 ${deskCount}개가 준비되었습니다. 새 자리배치를 만들 수 있습니다.` : `${missingSetup.join("과 ")}을(를) 먼저 설정해 주세요.`}
        </StatusBanner>
        <section className="setup-summary" aria-label="현재 준비 상태">
          <div><strong>{activeStudents.length}명</strong><span>{activeStudents.length ? "학생 등록 완료" : "학생 등록 필요"}</span></div>
          <div><strong>{deskCount}자리</strong><span>{deskCount ? "교실 좌석 설정 완료" : "교실 좌석 설정 필요"}</span></div>
          <div><strong>{conditionCount}개</strong><span>자리배치 조건 설정</span></div>
          <div><strong>{latestHistory?.occurredOn ?? "—"}</strong><span>{latestHistory ? "최근 자리 확정일" : "확정된 자리 없음"}</span></div>
        </section>
        <section className="dashboard-section"><div className="dashboard-section-heading"><h2>준비 설정</h2><p>자리배치에 필요한 정보를 확인하거나 수정합니다.</p></div><div className="dashboard-grid setup-grid">
          <DashboardCard title="학생 명단" description={`${activeStudents.length}명 ${activeStudents.length ? "등록 완료" : "등록 필요"}`} action="학생 명단 관리" onClick={() => setScreen("students")} />
          <DashboardCard title="교실 배치" description={`${deskCount}개 좌석 ${deskCount ? "설정 완료" : "설정 필요"}`} action="교실 편집" onClick={() => setScreen("classroom")} />
          <DashboardCard title="자리배치 조건" description={`학생 위치 및 짝 조건 ${conditionCount}개`} action="조건 설정" onClick={() => setScreen("constraints")} />
        </div></section>
        <section className="dashboard-section"><div className="dashboard-section-heading"><h2>현재 자리</h2><p>{currentAssignments.length ? `최근 확정 배치 · ${currentAssignments.length}명` : "아직 확정된 자리표가 없습니다."}</p></div><div className="dashboard-grid current-grid">
          <DashboardCard title="자리표 보기·인쇄" description={currentAssignments.length ? "현재 자리표를 열어 인쇄하거나 PDF로 저장합니다." : "첫 자리배치를 확정하면 자리표를 볼 수 있습니다."} action="현재 자리표 열기" disabled={!currentAssignments.length} onClick={openCurrentChart} />
          <DashboardCard title="자리 기록" description="확정 이력과 학생별 자리 경험을 확인합니다." action="기록 보기" onClick={() => setScreen("history")} />
        </div></section>
        <section className="dashboard-section secondary-section"><div className="dashboard-section-heading"><h2>기록 및 기타</h2></div><div className="dashboard-grid utility-grid">
          <DashboardCard title="급식실" description="줄서기와 22자리 배치" action="급식실 열기" onClick={() => setScreen("cafeteria")} />
          <DashboardCard title="급식실 기록" description="확정된 급식실 이력" action="기록 보기" onClick={() => setScreen("cafeteria-history")} />
          <DashboardCard title="백업 및 복원" description="로컬 데이터 보호" action="백업 관리" onClick={() => setScreen("backup")} />
        </div></section>
      </>}
      <footer>{info ? `${info.name} · ${info.version} · ${info.environment}` : "앱 정보를 불러오는 중입니다."}</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
