import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { calculateSeatPosition, type LayoutItem } from "../../domain/classroom-layout";
import type { SeatPosition } from "../../domain/models";

const referenceItems: LayoutItem[] = [
  { id: "chalkboard", type: "chalkboard", x: 0.11, y: 0.02, width: 0.64, height: 0.06 },
  { id: "front-door", type: "front-door", x: 0.86, y: 0.15, width: 0.11, height: 0.08 },
  { id: "back-door", type: "back-door", x: 0.86, y: 0.80, width: 0.11, height: 0.08 },
  ...[
    [2, 0.05, 0.25], [3, 0.24, 0.25], [4, 0.45, 0.25], [1, 0.65, 0.10], [5, 0.65, 0.25], [6, 0.05, 0.39], [7, 0.24, 0.39], [8, 0.45, 0.39], [9, 0.65, 0.39], [10, 0.05, 0.52], [11, 0.24, 0.52], [12, 0.45, 0.52], [13, 0.65, 0.52], [14, 0.05, 0.66], [15, 0.24, 0.66], [16, 0.45, 0.66], [17, 0.65, 0.66], [18, 0.05, 0.80], [19, 0.24, 0.80], [20, 0.45, 0.80], [21, 0.65, 0.80]
  ].map(([number, x, y]) => ({ id: `seat-${number}`, type: "desk" as const, x, y, width: 0.105, height: 0.12 }))
];
const initialItems = referenceItems;

export function ClassroomEditor({ onBack, schoolYearId }: { onBack: () => void; schoolYearId: string }): JSX.Element {
  const [items, setItems] = useState<LayoutItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState("seat-1");
  const [drag, setDrag] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const selected = items.find((item) => item.id === selectedId);
  const frontDoor = items.find((item) => item.type === "front-door");
  const backDoor = items.find((item) => item.type === "back-door");
  const selectedPosition = useMemo(() => selected?.type === "desk" ? calculateSeatPosition(selected, frontDoor, backDoor) : null, [selected, frontDoor, backDoor]);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => { void window.appApi.classroom.get(schoolYearId).then((saved) => { if (saved?.items.length) setItems(referenceItems.map((item) => ({ ...item }))); }); }, [schoolYearId]);

  const move = (event: PointerEvent<HTMLDivElement>): void => {
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1 - (selected?.width ?? 0.1), (event.clientX - bounds.left) / bounds.width - drag.offsetX));
    const y = Math.max(0, Math.min(1 - (selected?.height ?? 0.1), (event.clientY - bounds.top) / bounds.height - drag.offsetY));
    setItems((current) => current.map((item) => item.id === drag.id ? { ...item, x, y } : item));
  };

  const addDesk = (): void => setItems((current) => { const usedIds = new Set(current.map((item) => item.id)); let number = 1; while (usedIds.has(`seat-${number}`)) number += 1; return [...current, { id: `seat-${number}`, type: "desk", x: 0.45, y: 0.45, width: 0.1, height: 0.12 }]; });
  const applyReferenceLayout = (): void => { setItems(referenceItems.map((item) => ({ ...item }))); setSelectedId("seat-10"); setSaveMessage(""); setSaveError(""); };
  const deleteSelectedDesk = (): void => { if (selected?.type !== "desk") return; setItems((current) => current.filter((item) => item.id !== selected.id)); setSelectedId(""); setSaveMessage(""); };
  const save = (): void => { setIsSaving(true); setSaveMessage(""); setSaveError(""); void window.appApi.classroom.save(schoolYearId, items).then(() => setSaveMessage("저장되었습니다.")).catch((reason: unknown) => setSaveError(reason instanceof Error ? reason.message : "교실 배치를 저장하지 못했습니다.")).finally(() => setIsSaving(false)); };
  const setOverride = (key: keyof SeatPosition, value: string | boolean): void => setItems((current) => current.map((item) => item.id === selectedId ? { ...item, positionOverride: { ...item.positionOverride, [key]: value } } : item));

  return <main className="app-shell"><header className="topbar"><div><button type="button" className="back-button" onClick={onBack}>← 대시보드</button><h1>교실 배치 편집</h1></div><div className="year-badge">좌표 편집 중</div></header><section className="editor-layout"><div className="classroom-canvas" onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>{items.map((item) => <div key={item.id} className={`layout-item ${item.type} ${selectedId === item.id ? "selected" : ""}`} style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(item.id); setDrag({ id: item.id, offsetX: (event.nativeEvent.offsetX / event.currentTarget.parentElement!.clientWidth), offsetY: (event.nativeEvent.offsetY / event.currentTarget.parentElement!.clientHeight) }); }}>{item.type === "desk" ? item.id.replace("seat-", "좌석 ") : item.type === "chalkboard" ? "칠판" : item.type === "front-door" ? "앞문" : "뒷문"}</div>)}</div><aside className="editor-sidebar"><button type="button" onClick={addDesk}>책상 추가</button>{selected?.type === "desk" && <button type="button" className="secondary" onClick={deleteSelectedDesk}>선택 책상 삭제</button>}<h3>선택 요소</h3>{selected ? <><p className="selected-name">{selected.type === "desk" ? selected.id : selected.type === "chalkboard" ? "칠판" : selected.type === "front-door" ? "앞문" : "뒷문"}</p><p>좌표: {selected.x.toFixed(2)}, {selected.y.toFixed(2)}</p>{selectedPosition && <><div className="tag-list"><span>{selectedPosition.vertical}</span><span>{selectedPosition.horizontal}</span>{selectedPosition.nearFrontDoor && <span>앞문 가까움</span>}{selectedPosition.nearBackDoor && <span>뒷문 가까움</span>}</div>{selected.type === "desk" && <div className="override-controls"><label>세로<select value={String(selected.positionOverride?.vertical ?? selectedPosition.vertical)} onChange={(event) => setOverride("vertical", event.target.value)}><option>앞</option><option>중간</option><option>뒤</option></select></label><label>가로<select value={String(selected.positionOverride?.horizontal ?? selectedPosition.horizontal)} onChange={(event) => setOverride("horizontal", event.target.value)}><option>왼쪽</option><option>가운데</option><option>오른쪽</option></select></label><label><input type="checkbox" checked={Boolean(selected.positionOverride?.nearFrontDoor ?? selectedPosition.nearFrontDoor)} onChange={(event) => setOverride("nearFrontDoor", event.target.checked)} /> 앞문 가까움</label><label><input type="checkbox" checked={Boolean(selected.positionOverride?.nearBackDoor ?? selectedPosition.nearBackDoor)} onChange={(event) => setOverride("nearBackDoor", event.target.checked)} /> 뒷문 가까움</label></div>}</>}<p className="muted">자동 계산값을 교사가 수정할 수 있습니다.</p></> : <p className="muted">요소를 선택하세요.</p>}<button type="button" className="secondary" disabled={isSaving} onClick={save}>{isSaving ? "저장 중…" : "배치 저장"}</button>{saveMessage && <p className="save-message">{saveMessage}</p>}{saveError && <p className="error-message">{saveError}</p>}</aside></section></main>;
}
