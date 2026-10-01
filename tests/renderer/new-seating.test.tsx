// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewSeating } from "../../src/renderer/src/new-seating";
import { installAppApi } from "./helpers";

afterEach(cleanup);

async function renderAndGenerate(api = installAppApi()) {
  const onChoose = () => undefined;
  render(<NewSeating schoolYearId="sy" onBack={() => undefined} onChoose={onChoose} />);
  const button = await screen.findByRole("button", { name: "후보 생성" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  await userEvent.click(button);
  await screen.findByText("후보 A 배치표");
  return api;
}

describe("새 자리 만들기 화면", () => {
  it("후보 점수와 조건 요약, 짝 조건의 관계(옆자리)를 표시한다 (docs/24 회귀)", async () => {
    await renderAndGenerate();
    expect(screen.getAllByText("88점").length).toBeGreaterThan(0);
    expect(screen.getByText("70점")).toBeTruthy();
    expect(screen.getAllByText("성별 인접").length).toBeGreaterThan(0);
    expect(screen.getByText(/옆자리/)).toBeTruthy();
  });

  it("두 좌석을 차례로 누르면 학생이 교체되고 재평가 결과가 점수에 반영된다", async () => {
    const api = await renderAndGenerate();
    await userEvent.click(screen.getByRole("button", { name: /좌석 1 김하나/ }));
    await userEvent.click(screen.getByRole("button", { name: /좌석 2 이두리/ }));
    await waitFor(() => expect(api.seating.evaluate).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: /좌석 1 이두리/ })).toBeTruthy();
    const score = document.querySelector(".candidate-score") as HTMLElement;
    await waitFor(() => expect(within(score).getByText("55점")).toBeTruthy());
  });

  it("생성 실패 시 오류 메시지를 보여준다", async () => {
    installAppApi({ generate: () => Promise.reject(new Error("엔진 오류")) });
    render(<NewSeating schoolYearId="sy" onBack={() => undefined} onChoose={() => undefined} />);
    const button = await screen.findByRole("button", { name: "후보 생성" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(button);
    expect(await screen.findByText("엔진 오류")).toBeTruthy();
  });
});

describe("후보 생성 진행·취소", () => {
  it("생성 중 취소 버튼으로 취소하면 취소 안내를 표시한다", async () => {
    let finish: (value: never[]) => void = () => undefined;
    const api = installAppApi({ generate: () => new Promise<never[]>((resolve) => { finish = resolve; }) });
    render(<NewSeating schoolYearId="sy" onBack={() => undefined} onChoose={() => undefined} />);
    const button = await screen.findByRole("button", { name: "후보 생성" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    await userEvent.click(button);
    await userEvent.click(await screen.findByRole("button", { name: "취소" }));
    expect(api.seating.cancelGenerate).toHaveBeenCalledTimes(1);
    finish([]);
    expect(await screen.findByText("후보 생성을 취소했습니다.")).toBeTruthy();
  });
});
