import { useState, type ChangeEvent } from "react";
import { parseHistoricalSession, validateHistoricalSession, type HistoricalSessionValidation } from "../../domain/historical-seating-import";
import { semesterOf } from "../../domain/semester";
import type { LayoutItem } from "../../domain/classroom-layout";
import type { Student } from "../../domain/models";
import { Button, StatusBanner } from "./ui";

const csvExample = "학생 이름,자리 번호\n홍길동,1\n김영희,2";
const sessionCount = 1;

interface SessionDraft {
  sessionNumber: number;
  occurredOn: string;
  input: string;
}

const createDrafts = (): SessionDraft[] => Array.from({ length: sessionCount }, (_, index) => ({ sessionNumber: index + 1, occurredOn: "", input: "" }));

function validateDraft(draft: SessionDraft, students: Student[], desks: LayoutItem[]): HistoricalSessionValidation {
  try {
    const parsed = parseHistoricalSession(draft.input, draft.sessionNumber);
    const validated = validateHistoricalSession(parsed, students, desks);
    const errors = [...validated.errors];
    if (!draft.occurredOn) errors.push("배치일을 입력하세요.");
    return { ...validated, errors: [...new Set(errors)], valid: validated.valid && Boolean(draft.occurredOn) };
  } catch (error) {
    return { sessionNumber: draft.sessionNumber, assignments: [], errors: [error instanceof Error ? error.message : "입력 형식을 확인하세요."], valid: false };
  }
}

export function HistoricalImportPreview({ schoolYearId, classroomLayoutId, students, desks, onSaved }: { schoolYearId: string; classroomLayoutId: string; students: Student[]; desks: LayoutItem[]; onSaved: () => void }): JSX.Element {
  const [drafts, setDrafts] = useState<SessionDraft[]>(createDrafts);
  const [results, setResults] = useState<HistoricalSessionValidation[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const updateDraft = (index: number, patch: Partial<SessionDraft>): void => { setDrafts((current) => current.map((draft, draftIndex) => draftIndex === index ? { ...draft, ...patch } : draft)); setResults(null); setMessage(""); };
  const preview = (): void => { const nextResults = drafts.map((draft) => validateDraft(draft, students, desks)); setResults(nextResults); setMessage(nextResults.every((result) => result.valid) ? "저장할 수 있습니다." : "입력 내용을 확인한 뒤 다시 미리보기하세요."); };
  const readFile = (index: number, event: ChangeEvent<HTMLInputElement>): void => { const file = event.target.files?.[0]; if (!file) return; void file.text().then((text) => { updateDraft(index, { input: text.replace(/^\uFEFF/, "") }); setMessage("파일을 불러왔습니다."); }).catch(() => setMessage("파일을 읽지 못했습니다.")); };
  const save = (): void => {
    if (!results || !results.every((result) => result.valid) || !classroomLayoutId) return;
    const validatedResults = results;
    const sessions = drafts.map((draft, index) => ({ semester: semesterOf(draft.occurredOn) ?? 1, occurredOn: draft.occurredOn, assignments: validatedResults[index].assignments.map((assignment) => ({ studentId: assignment.studentId!, seatId: assignment.seatId! })) }));
    setSaving(true); setMessage("");
    void window.appApi.history.importHistorical(schoolYearId, classroomLayoutId, students, desks, sessions).then((sequenceNumbers) => { setMessage(`${sequenceNumbers.length}개 기록을 배치일 기준 ${semesterOf(drafts[0].occurredOn) ?? 1}학기로 저장했습니다.`); setDrafts(createDrafts()); setResults(null); onSaved(); }).catch((reason: unknown) => setMessage(reason instanceof Error ? reason.message : "자리 기록 저장에 실패했습니다.")).finally(() => setSaving(false));
  };
  const allValid = Boolean(results?.length === sessionCount && results.every((result) => result.valid));
  return <section className="history-section"><div className="section-heading"><div><h2>과거 자리 기록 1건 추가</h2><p className="muted">이미 지난 자리배치 1건을 학생 이름·자리 번호와 실제 배치일로 입력합니다. 학기는 배치일로 자동 분류됩니다(3~8월 1학기, 9~2월 2학기).</p></div></div><div className="csv-example"><strong>CSV 예시</strong><pre>{csvExample}</pre><span>첫 줄 제목은 선택 사항이며, 쉼표 또는 탭으로 구분할 수 있습니다.</span></div><div className="history-import-sessions">{drafts.map((draft, index) => { const result = results?.[index]; return <fieldset className="history-import-session" key={draft.sessionNumber}><legend>과거 자리 기록</legend><div className="history-import-controls"><label>배치일 <input type="date" value={draft.occurredOn} onChange={(event) => updateDraft(index, { occurredOn: event.target.value })} /></label><label>CSV 파일 선택 <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => readFile(index, event)} /></label></div><label className="history-input-label">CSV 내용 붙여넣기<textarea value={draft.input} onChange={(event) => updateDraft(index, { input: event.target.value })} placeholder={csvExample} rows={5} /></label>{result && <div className={result.valid ? "success-text" : "error-message"}>{result.valid ? `${result.assignments.length}명 매칭 완료` : result.errors.join(" · ")}</div>}</fieldset>; })}</div><div className="history-import-actions"><Button variant="secondary" onClick={preview}>매칭 미리보기</Button>{allValid && <Button onClick={save} disabled={saving}>{saving ? "기록 저장 중…" : "자리 기록 저장"}</Button>}</div>{results && <StatusBanner tone={allValid ? "success" : "warning"} title={allValid ? "검증 완료" : "입력 내용을 확인해 주세요"}>{allValid ? "학생·자리 매칭과 배치일을 확인했습니다." : "오류를 수정한 뒤 다시 미리보기하세요."}</StatusBanner>}{message && <p className="save-message" role="status">{message}</p>}</section>;
}
