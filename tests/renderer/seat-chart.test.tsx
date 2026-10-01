// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeatChart } from "../../src/renderer/src/seat-chart";
import { desks, installAppApi, students } from "./helpers";

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

  it("교사용 자리표는 학생용과 위치가 점대칭(좌우·상하 반대)이고 이름은 그대로 표시한다", () => {
    const pos = (mode: "student" | "teacher") => {
      const { container, unmount } = render(<SeatChart items={desks} students={students} assignments={assignments} mode={mode} onBack={() => undefined} />);
      const cell = (name: string) => screen.getByText(name).closest(".chart-cell") as HTMLElement;
      const result = { a: [parseFloat(cell("김하나").style.left), parseFloat(cell("김하나").style.top)], b: [parseFloat(cell("이두리").style.left), parseFloat(cell("이두리").style.top)] };
      expect(container.querySelector(".chart-name")?.textContent).toBeTruthy();
      unmount();
      return result;
    };
    const student = pos("student"); const teacher = pos("teacher");
    // 학생용에서 1번이 왼쪽 위, 2번이 오른쪽 아래라면 교사용에서는 반대가 된다.
    expect(student.a[0]).toBeLessThan(student.b[0]); expect(student.a[1]).toBeLessThan(student.b[1]);
    expect(teacher.a[0]).toBeGreaterThan(teacher.b[0]); expect(teacher.a[1]).toBeGreaterThan(teacher.b[1]);
  });

  it("칠판은 학생용에서 위, 교사용에서 아래에 있다", () => {
    const order = (mode: "student" | "teacher") => { const { container, unmount } = render(<SeatChart items={desks} students={students} assignments={assignments} mode={mode} onBack={() => undefined} />); const frame = container.querySelector(".chart-frame")!; const first = frame.firstElementChild!.className; unmount(); return first; };
    expect(order("student")).toBe("chart-board");
    expect(order("teacher")).toBe("chart-stage");
  });

  it("인쇄는 메인 프로세스의 가로 인쇄를, PDF 저장은 파일 이름과 함께 요청한다", async () => {
    const api = installAppApi();
    render(<SeatChart items={desks} students={students} assignments={assignments} mode="teacher" onBack={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: /인쇄/ }));
    expect(api.print.page).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "PDF로 저장" }));
    expect(api.print.savePdf).toHaveBeenCalledWith("교사용 자리표");
  });
});
