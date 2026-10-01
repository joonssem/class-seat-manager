// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManualSeating } from "../../src/renderer/src/manual-seating";
import { desks, installAppApi } from "./helpers";

afterEach(cleanup);
const initial = [{ studentId: "s1", seatId: "seat-1" }, { studentId: "s2", seatId: "seat-2" }];

describe("수동 자리배치 화면", () => {
  it("모둠 옵션을 평가 호출에 전달하고 처음 진입 시 점수를 표시한다", async () => {
    const api = installAppApi();
    render(<ManualSeating schoolYearId="sy" onBack={() => undefined} onPreview={() => undefined} initialAssignments={initial} options={{ groupActivity: true }} />);
    await waitFor(() => expect(api.seating.evaluate).toHaveBeenCalled());
    expect(api.seating.evaluate.mock.calls[api.seating.evaluate.mock.calls.length - 1][4]).toEqual({ groupActivity: true });
    expect(await screen.findByText(/현재 점수 55점/)).toBeTruthy();
  });

  it("배치일에 따라 학기가 자동 분류되고 확정 저장에 그 학기가 전달된다", async () => {
    const api = installAppApi();
    const confirm = vi.fn().mockResolvedValue(6);
    (api.seating as unknown as { confirm: unknown }).confirm = confirm;
    (api.classroom.get as ReturnType<typeof vi.fn>).mockResolvedValue({ classroomLayoutId: "layout", schoolYearId: "sy", items: desks });
    const { container } = render(<ManualSeating schoolYearId="sy" onBack={() => undefined} onPreview={() => undefined} initialAssignments={initial} />);
    const date = await waitFor(() => { const input = container.querySelector('input[type="date"]'); if (!input) throw new Error("no date"); return input as HTMLInputElement; });
    fireEvent.change(date, { target: { value: "2026-04-14" } });
    expect(await screen.findByText("1학기로 자동 분류")).toBeTruthy();
    fireEvent.change(date, { target: { value: "2026-10-05" } });
    expect(await screen.findByText("2학기로 자동 분류")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "자리 배치 확정" }));
    await userEvent.click(await screen.findByRole("button", { name: "확정 저장" }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(confirm.mock.calls[0][5]).toBe(2);
    expect(confirm.mock.calls[0][6]).toBe("2026-10-05");
  });
});
