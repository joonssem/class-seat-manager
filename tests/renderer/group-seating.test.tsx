// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GroupSeating } from "../../src/renderer/src/group-seating";
import type { Student } from "../../src/domain/models";

afterEach(cleanup);
const students: Student[] = Array.from({ length: 21 }, (_, i) => ({ studentId: `s${i + 1}`, schoolYearId: "sy", studentNumber: i + 1, name: `학생${i + 1}`, gender: i < 9 ? "남" : "여", enrollmentStatus: "재학", createdAt: "", updatedAt: "" }));

it("loads stored relations, generates groups, exchanges members and saves through the atomic API", async () => {
  const confirmGroups = vi.fn().mockResolvedValue(3);
  const getConstraints = vi.fn().mockResolvedValue({ pairs: [{ studentAId: "s1", studentBId: "s2", type: "바로 인접 금지", strength: "필수" }], seat: [] });
  Object.assign(window, { appApi: { students: { list: vi.fn().mockResolvedValue(students) }, constraints: { get: getConstraints }, classroom: { get: vi.fn().mockResolvedValue(undefined) }, seating: { confirmGroups } } });
  render(<GroupSeating schoolYearId="sy" onBack={vi.fn()} />);
  await screen.findByText(/저장된 학생 간 관계 조건 1개/);
  fireEvent.click(screen.getByRole("button", { name: "모둠 구성 만들기" }));
  await screen.findByText("필수 조건을 충족했습니다", {}, { timeout: 10000 });
  expect(getConstraints).toHaveBeenCalledWith("sy");
  expect(screen.getAllByRole("combobox")).toHaveLength(21);
  const selectors = screen.getAllByRole("combobox") as HTMLSelectElement[];
  const first = selectors[0].value; const second = selectors[1].value;
  fireEvent.change(selectors[0], { target: { value: second } });
  expect(selectors[0].value).toBe(second); expect(selectors[1].value).toBe(first);
  fireEvent.click(screen.getByRole("button", { name: "모둠 자리배치 확정" }));
  fireEvent.click(screen.getByRole("button", { name: "확정 저장" }));
  await screen.findByText(/모둠 자리배치를 확정 저장했습니다/);
  expect(confirmGroups).toHaveBeenCalledTimes(1);
  expect(confirmGroups.mock.calls[0][1].map((g: string[]) => g.length)).toEqual([4, 4, 4, 4, 5]);
  fireEvent.change(screen.getByRole("textbox", { name: "모둠별 인원" }), { target: { value: "4,4" } });
  expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "모둠 구성 만들기" }));
  await screen.findByText("모둠 인원 합계가 재학생 수와 같아야 합니다.");
});

it("shows loading failures and blocks generation", async () => {
  Object.assign(window, { appApi: { students: { list: vi.fn().mockRejectedValue(new Error("불러오기 실패")) }, constraints: { get: vi.fn().mockResolvedValue({ pairs: [], seat: [] }) }, classroom: { get: vi.fn().mockResolvedValue(undefined) } } });
  render(<GroupSeating schoolYearId="sy" onBack={vi.fn()} />);
  await screen.findByText("불러오기 실패");
  await waitFor(() => expect((screen.getByRole("button", { name: "모둠 구성 만들기" }) as HTMLButtonElement).disabled).toBe(true));
});
