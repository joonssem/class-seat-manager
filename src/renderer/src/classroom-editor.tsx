import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { calculateSeatPosition, type LayoutItem } from "../../domain/classroom-layout";
import type { SeatPosition } from "../../domain/models";
import { Button, ConfirmDialog, StatusBanner } from "./ui";

const referenceItems: LayoutItem[] = [
  { id: "chalkboard", type: "chalkboard", x: 0.11, y: 0.02, width: 0.64, height: 0.06 },
  { id: "front-door", type: "front-door", x: 0.86, y: 0.15, width: 0.11, height: 0.08 },
  { id: "back-door", type: "back-door", x: 0.86, y: 0.80, width: 0.11, height: 0.08 },
  ...[[2, 0.05, 0.25], [3, 0.24, 0.25], [4, 0.45, 0.25], [1, 0.65, 0.10], [5, 0.65, 0.25], [6, 0.05, 0.39], [7, 0.24, 0.39], [8, 0.45, 0.39], [9, 0.65, 0.39], [10, 0.05, 0.52], [11, 0.24, 0.52], [12, 0.45, 0.52], [13, 0.65, 0.52], [14, 0.05, 0.66], [15, 0.24, 0.66], [16, 0.45, 0.66], [17, 0.65, 0.66], [18, 0.05, 0.80], [19, 0.24, 0.80], [20, 0.45, 0.80], [21, 0.65, 0.80]].map(([number, x, y]) => ({ id: `seat-${number}`, type: "desk" as const, x, y, width: 0.105, height: 0.12 }))
];

const cloneReference = (): LayoutItem[] => referenceItems.map((item) => ({ ...item }));
const itemLabel = (item: LayoutItem): string => item.type === "desk" ? item.id.replace("seat-", "좌석 ") : item.type === "chalkboard" ? "칠판" : item.type === "front-door" ? "앞문" : "뒷문";

export function ClassroomEditor({ onBack, schoolYearId }: { onBack: () => void; schoolYearId: string }): JSX.Element {
  const [items, setItems] = useState<LayoutItem[]>(cloneReference());
  const [selectedId, setSelectedId] = useState("seat-1");
  const [drag, setDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const selected = items.find((item) => item.id === selectedId);
  const frontDoor = items.find((item) => item.type === "front-door");
  const backDoor = items.find((item) => item.type === "back-door");
  const selectedPosition = useMemo(() => selected?.type === "desk" ? calculateSeatPosition(selected, frontDoor, backDoor) : null, [selected, frontDoor, backDoor]);

  useEffect(() => { void window.appApi.classroom.get(schoolYearId).then((saved) => { if (saved?.items.length) setItems(saved.items.map((item) => ({ ...item }))); }); }, [schoolYearId]);
  useEffect(() => { const onBeforeUnload = (event: BeforeUnloadEvent): void => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", onBeforeUnload); return () => window.removeEventListener("beforeunload", onBeforeUnload); }, [dirty]);
  const markDirty = (): void => { setDirty(true); setSaveMessage(""); setSaveError(""); };
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect(); const moving = items.find((item) => item.id === drag.id);
    const x = Math.max(0, Math.min(1 - (moving?.width ?? 0.1), (event.clientX - bounds.left) / bounds.width - drag.offsetX)); const y = Math.max(0, Math.min(1 - (moving?.height ?? 0.1), (event.clientY - bounds.top) / bounds.height - drag.offsetY));
    setItems((current) => current.map((item) => item.id === drag.id ? { ...item, x, y } : item)); markDirty();
  };
  const addDesk = (): void => { const usedIds = new Set(items.map((item) => item.id)); let number = 1; while (usedIds.has(`seat-${number}`)) number += 1; const newId = `seat-${number}`; setItems((current) => [...current, { id: newId, type: "desk", x: 0.45, y: 0.45, width: 0.1, height: 0.12 }]); setSelectedId(newId); markDirty(); };
  const applyReferenceLayout = (): void => { setItems(cloneReference()); setSelectedId("seat-10"); markDirty(); };
  const deleteSelectedDesk = (): void => { if (selected?.type !== "desk") return; setItems((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(""); markDirty(); setShowDeleteConfirm(false); };
  const save = (): void => { setIsSaving(true); setSaveMessage(""); setSaveError(""); void window.appApi.classroom.save(schoolYearId, items).then(() => { setSaveMessage("교실 배치가 저장되었습니다."); setDirty(false); }).catch((reason: unknown) => setSaveError(reason instanceof Error ? reason.message : "교실 배치를 저장하지 못했습니다.")).finally(() => setIsSaving(false)); };
  const setOverride = (key: keyof SeatPosition, value: string | boolean): void => { setItems((current) => current.map((item) => item.id === selectedId ? { ...item, positionOverride: { ...item.positionOverride, [key]: value } } : item)); markDirty(); };
  const requestBack = (): void => { if (dirty) setShowExitConfirm(true); else onBack(); };

  return <main className="app-shell"><header className="topbar"><div><button type="button" className="back-button" onClick={requestBack}>← 대시보드</button><h1>교실 배치 편집</h1></div><div className="year-badge">{dirty ? "저장되지 않은 변경사항" : "모든 변경사항이 저장됨"}</div></header>
    <StatusBanner tone={dirty ? "warning" : "info"} title={dirty ? "저장되지 않은 변경사항이 있습니다" : "교실 배치가 저장되어 있습니다"}>책상·칠판·문을 드래그해 배치한 뒤 배치 저장을 선택하세요. 좌석 번호는 과거 자리 기록과 연결됩니다.</StatusBanner>
    <section className="layout-legend" aria-label="교실 배치 범례"><span><i className="legend-swatch legend-desk" />책상</span><span><i className="legend-swatch legend-board" />칠판</span><span><i className="legend-swatch legend-door" />문</span></section>
    <section className="editor-layout"><div className="classroom-canvas" aria-label="교실 배치 편집 영역" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>{items.map((item) => <div key={item.id} role="button" tabIndex={0} aria-label={`${itemLabel(item)} 선택`} className={`layout-item ${item.type} ${selectedId === item.id ? "selected" : ""}`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%` }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(item.id); } }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(item.id); setDrag({ id: item.id, offsetX: (event.nativeEvent.offsetX / event.currentTarget.parentElement!.clientWidth), offsetY: (event.nativeEvent.offsetY / event.currentTarget.parentElement!.clientHeight) }); }}>{itemLabel(item)}</div>)}</div><aside className="editor-sidebar"><div className="editor-actions"><Button variant="secondary" onClick={addDesk}>책상 추가</Button><Button variant="secondary" onClick={applyReferenceLayout}>기준 배치 적용</Button></div>{selected?.type === "desk" && <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>선택 책상 삭제</Button>}<h3>선택 요소</h3>{selected ? <><p className="selected-name">{itemLabel(selected)}</p><p>좌표: {selected.x.toFixed(2)}, {selected.y.toFixed(2)}</p>{selectedPosition && <><div className="tag-list"><span>{selectedPosition.vertical}</span><span>{selectedPosition.horizontal}</span>{selectedPosition.nearFrontDoor && <span>앞문 가까움</span>}{selectedPosition.nearBackDoor && <span>뒷문 가까움</span>}</div>{selected.type === "desk" && <div className="override-controls"><label>세로<select value={String(selected.positionOverride?.vertical ?? selectedPosition.vertical)} onChange={(event) => setOverride("vertical", event.target.value)}><option>앞</option><option>중간</option><option>뒤</option></select></label><label>가로<select value={String(selected.positionOverride?.horizontal ?? selectedPosition.horizontal)} onChange={(event) => setOverride("horizontal", event.target.value)}><option>왼쪽</option><option>가운데</option><option>오른쪽</option></select></label><label><input type="checkbox" checked={Boolean(selected.positionOverride?.nearFrontDoor ?? selectedPosition.nearFrontDoor)} onChange={(event) => setOverride("nearFrontDoor", event.target.checked)} /> 앞문 가까움</label><label><input type="checkbox" checked={Boolean(selected.positionOverride?.nearBackDoor ?? selectedPosition.nearBackDoor)} onChange={(event) => setOverride("nearBackDoor", event.target.checked)} /> 뒷문 가까움</label></div>}</>}<p className="muted">자동 계산값을 교사가 수정할 수 있습니다.</p></> : <p className="muted">요소를 선택하세요.</p>}<Button variant="primary" disabled={isSaving} onClick={save}>{isSaving ? "저장 중…" : "배치 저장"}</Button>{saveMessage && <p className="save-message" role="status">{saveMessage}</p>}{saveError && <p className="error-message" role="alert">{saveError}</p>}</aside></section>
    {showDeleteConfirm && <ConfirmDialog title="선택한 책상을 삭제할까요?" confirmLabel="책상 삭제" onCancel={() => setShowDeleteConfirm(false)} onConfirm={deleteSelectedDesk}>이 좌석 번호가 과거 자리 기록에 사용되었다면 과거 기록과의 연결에 영향을 줄 수 있습니다.</ConfirmDialog>}
    {showExitConfirm && <ConfirmDialog title="저장하지 않고 나갈까요?" confirmLabel="나가기" onCancel={() => setShowExitConfirm(false)} onConfirm={onBack}>저장하지 않은 교실 배치 변경사항이 사라집니다.</ConfirmDialog>}
  </main>;
}
