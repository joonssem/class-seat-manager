import { useEffect, useMemo, useState } from "react";
import { generateGroups, groupAssignments, groupLayout, reviewGroups, type GroupInput } from "../../domain/group-seating";
import type { Student } from "../../domain/models";
import { SeatChart } from "./seat-chart";
import { Button, ConfirmDialog, StatusBanner } from "./ui";

export function GroupSeating({ schoolYearId, onBack }: { schoolYearId: string; onBack: () => void }): JSX.Element {
  const [input, setInput] = useState<GroupInput | null>(null);
  const [sizesText, setSizesText] = useState("4,4,4,4,5");
  const [spreadIds, setSpreadIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[][] | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [occurredOn, setOccurredOn] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; });
  useEffect(() => {
    let alive = true;
    void Promise.all([window.appApi.students.list(schoolYearId), window.appApi.constraints.get(schoolYearId), window.appApi.classroom.get(schoolYearId)])
      .then(([students, conditions, layout]) => { if (alive) setInput({ students: students.filter((s) => s.enrollmentStatus === "재학"), sizes: [], pairs: conditions.pairs, positions: conditions.seat, spreadIds: [], namespace: schoolYearId, fixtures: layout?.items ?? [] }); })
      .catch((error: unknown) => { if (alive) setMessage(error instanceof Error ? error.message : "조건을 불러오지 못했습니다."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [schoolYearId]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (groups && !saved) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [groups, saved]);
  const sizes = useMemo(() => sizesText.split(/[,，\s]+/).filter(Boolean).map(Number), [sizesText]);
  const configured = useMemo(() => input ? { ...input, sizes, spreadIds } : null, [input, sizes, spreadIds]);
  const review = useMemo(() => configured && groups ? reviewGroups(configured, groups) : null, [configured, groups]);
  const items = useMemo(() => configured && groups ? groupLayout(sizes, schoolYearId, configured.fixtures) : [], [configured, groups, sizes, schoolYearId]);
  const students = input?.students ?? [];
  const studentById = new Map(students.map((s) => [s.studentId, s]));
  const invalidate = () => { setGroups(null); setSaved(false); setMessage(""); };
  const generate = () => {
    if (!configured) return;
    setGenerating(true); setMessage(""); setSaved(false);
    // Give the browser a frame to show progress before the bounded local search.
    setTimeout(() => {
      try { const plan = generateGroups(configured); setGroups(plan.groups); }
      catch (error: unknown) { setGroups(null); setMessage(error instanceof Error ? error.message : "모둠을 구성하지 못했습니다."); }
      finally { setGenerating(false); }
    }, 30);
  };
  const exchange = (groupIndex: number, memberIndex: number, targetId: string) => {
    if (!groups) return;
    const next = groups.map((g) => [...g]);
    const sourceId = next[groupIndex][memberIndex];
    for (const group of next) { const index = group.indexOf(targetId); if (index >= 0) { group[index] = sourceId; break; } }
    next[groupIndex][memberIndex] = targetId;
    setGroups(next); setSaved(false); setMessage("");
  };
  const save = async () => {
    if (!groups || !review || review.hard.length || saving) return;
    setSaving(true); setMessage("");
    try { const sequence = await window.appApi.seating.confirmGroups(schoolYearId, groups, spreadIds, occurredOn); setSaved(true); setConfirming(false); setMessage(`모둠 자리배치를 확정 저장했습니다. (전체 ${sequence}번째 기록)`); }
    catch (error: unknown) { setConfirming(false); setMessage(error instanceof Error ? error.message : "모둠 자리배치를 저장하지 못했습니다."); }
    finally { setSaving(false); }
  };
  const back = () => { if (groups && !saved) setExitConfirm(true); else onBack(); };
  if (preview && groups) return <SeatChart items={items} students={students} assignments={groupAssignments(groups, items)} mode="student" onBack={() => setPreview(false)} />;
  return <main className="app-shell">
    <header className="topbar"><div><button className="back-button" type="button" disabled={saving || generating} onClick={back}>← 대시보드</button><h1>모둠 자리 만들기</h1></div><div className="year-badge">재학생 {students.length}명 · 남 {students.filter((s) => s.gender === "남").length}명 · 여 {students.filter((s) => s.gender === "여").length}명</div></header>
    <section className="group-settings">
      <h2>모둠 구성 조건</h2>
      <p>저장된 학생 간 관계 조건 {input?.pairs.length ?? 0}개와 위치 조건 {input?.positions.length ?? 0}개를 반영합니다. 모둠별 성비를 고르게 맞추고, 관계 조건이 있는 학생들은 서로 다른 모둠을 우선합니다.</p>
      <p>학생용 자리표는 책상 배치를 시계방향으로 90도 돌리고 이름은 바르게 표시합니다. 5명인 5모둠은 맨 뒤 중앙에 배치하며, 맨 뒤 단독 자리에는 남학생을 배정합니다.</p>
      <p className="muted">필수 관계 조건은 같은 모둠 배정을 금지하며, 인접·최소 거리도 확인합니다. 가급적·선호 조건은 경고와 함께 조정할 수 있습니다. 과거 배치 이력에 따른 반복 감점은 이번 모둠 구성에 적용하지 않습니다.</p>
      <label>모둠별 인원<input aria-label="모둠별 인원" value={sizesText} disabled={generating || saving} onChange={(e) => { invalidate(); setSizesText(e.target.value); }} /></label><p className="muted">예: 4,4,4,4,5 — 합계 {sizes.reduce((a, b) => a + b, 0)}명. 모둠당 3~5명, 최대 8개.</p>
      <fieldset disabled={generating || saving}><legend>서로 다른 모둠에 배치할 학생 (선택)</legend><p className="muted">선택한 학생은 모둠당 한 명씩 배치합니다. 최대 모둠 수만큼 선택하세요.</p><div className="group-student-picker">{students.map((s) => <label key={s.studentId}><input type="checkbox" checked={spreadIds.includes(s.studentId)} onChange={(e) => { invalidate(); setSpreadIds(e.target.checked ? [...spreadIds, s.studentId] : spreadIds.filter((id) => id !== s.studentId)); }} />{s.studentNumber}. {s.name}</label>)}</div></fieldset>
      <Button disabled={loading || !input || generating || saving} onClick={generate}>{loading ? "조건 불러오는 중…" : generating ? "모둠 구성 중…" : groups ? "다른 모둠 구성 만들기" : "모둠 구성 만들기"}</Button>
    </section>
    {message && <StatusBanner tone={saved ? "success" : "warning"} title={saved ? "저장 완료" : "확인해 주세요"}>{message}</StatusBanner>}
    {groups && review && <>
      <StatusBanner tone={review.hard.length ? "warning" : "success"} title={review.hard.length ? `필수 조건 충돌 ${review.hard.length}건 · 확정할 수 없습니다` : "필수 조건을 충족했습니다"}>학생을 선택하면 두 학생의 자리가 교환되고 조건을 다시 확인합니다. 자동 탐색 결과이므로 다른 구성을 만들거나 직접 조정할 수 있습니다.</StatusBanner>
      <div className="group-review" aria-live="polite">{review.hard.length > 0 && <ul>{review.hard.map((text, i) => <li key={i} className="error-message">{text}</li>)}</ul>}{review.warnings.length > 0 && <details><summary>권장 조건 확인 {review.warnings.length}건</summary><ul>{review.warnings.map((text, i) => <li key={i}>{text}</li>)}</ul></details>}</div>
      <section className="group-cards">{groups.map((members, groupIndex) => <article className="group-card" key={groupIndex}><h2>{groupIndex + 1}모둠</h2><p>{members.length}명 · 남 {members.filter((id) => studentById.get(id)?.gender === "남").length}명 · 여 {members.filter((id) => studentById.get(id)?.gender === "여").length}명</p><div className="group-desks">{members.map((id, memberIndex) => <label className={`group-desk group-desk-${memberIndex + 1}`} key={memberIndex}><span>{memberIndex + 1}번 자리</span><select aria-label={`${groupIndex + 1}모둠 ${memberIndex + 1}번 자리`} disabled={saving || generating} value={id} onChange={(e) => exchange(groupIndex, memberIndex, e.target.value)}>{students.map((s: Student) => <option key={s.studentId} value={s.studentId}>{s.studentNumber}. {s.name}</option>)}</select></label>)}</div></article>)}</section>
      <section className="manual-footer"><label>배치일<input type="date" value={occurredOn} disabled={saving} onChange={(e) => { setOccurredOn(e.target.value); setSaved(false); setMessage(""); }} /></label><Button variant="secondary" disabled={saving || generating} onClick={() => setPreview(true)}>자리표 미리보기·인쇄</Button><Button disabled={Boolean(review.hard.length) || saved || saving || generating || !occurredOn} onClick={() => setConfirming(true)}>{saved ? "확정 저장됨" : "모둠 자리배치 확정"}</Button></section>
    </>}
    {confirming && <ConfirmDialog title="모둠 자리배치를 확정할까요?" confirmLabel={saving ? "저장 중…" : "확정 저장"} tone="primary" onCancel={() => { if (!saving) setConfirming(false); }} onConfirm={() => { void save(); }}>교실 책상을 모둠 형태로 변경하고 {occurredOn}의 자리 기록을 저장합니다. 기존 자리 기록은 보존됩니다.{review?.warnings.length ? ` 권장 조건 경고 ${review.warnings.length}건이 있습니다.` : ""}</ConfirmDialog>}
    {exitConfirm && <ConfirmDialog title="저장하지 않고 나갈까요?" confirmLabel="나가기" onCancel={() => setExitConfirm(false)} onConfirm={onBack}>생성한 모둠 구성과 수정 내용은 저장되지 않습니다.</ConfirmDialog>}
  </main>;
}
