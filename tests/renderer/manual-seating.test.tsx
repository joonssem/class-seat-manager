// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ManualSeating } from "../../src/renderer/src/manual-seating";
import { installAppApi } from "./helpers";

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
});
