import { describe, expect, it, vi } from "vitest";

vi.mock("better-sqlite3", () => ({ default: class MockDatabase {} }));

import { BackupService } from "../../src/main/system/backup-service";

describe("BackupService", () => {
  it("현재 사용 중인 DB 파일 자체로 복원하지 않는다", () => {
    const service = new BackupService({
      pragma: vi.fn(),
    } as never, "D:/data/class.sqlite");

    expect(() => service.restore("D:/data/class.sqlite")).toThrow("현재 사용 중인 DB 파일 자체는 복원할 수 없습니다.");
  });
});
