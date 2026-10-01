// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeatChart } from "../../src/renderer/src/seat-chart";
import { desks, students } from "./helpers";

afterEach(cleanup);
const assignments = [{ studentId: "s1", seatId: "seat-1" }, { studentId: "s2", seatId: "seat-2" }];

describe("자리표 화면", () => {
  it("돌아가기 버튼을 누르면 onBack이 한 번 호출된다 (docs/17 회귀)", async () => {
    const onBack = vi.fn();
    render(<SeatChart items={desks} students={students} assignments={assignments} mode="student" onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: /돌아가기/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("키보드(Enter)로도 돌아갈 수 있다", async () => {
    const onBack = vi.fn();
    render(<SeatChart items={desks} students={students} assignments={assignments} mode="student" onBack={onBack} />);
    screen.getByRole("button", { name: /돌아가기/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("교사용 자리표는 좌표를 점대칭으로 표시하되 이름은 그대로 표시한다", () => {
    render(<SeatChart items={desks} students={students} assignments={assignments} mode="teacher" onBack={() => undefined} />);
    const cell = screen.getByText("1. 김하나");
    expect(cell.style.left).toBe(`${(1 - 0.05 - 0.1) * 100}%`);
    expect(cell.style.top).toBe(`${(1 - 0.2 - 0.12) * 100}%`);
  });
});
