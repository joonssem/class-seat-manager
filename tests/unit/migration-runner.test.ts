import { describe, expect, it } from "vitest";
import { MigrationError, runMigrations, type Migration } from "../../src/main/db/migration-runner";

describe("SQLite migration runner", () => {
  it("적용된 migration을 다시 실행하지 않는다", () => {
    const calls: string[] = []; const database = { exec: (sql: string) => calls.push(sql), getAppliedMigrationVersions: () => [1] }; const migrations: Migration[] = [{ version: 1, name: "one", sql: "ONE" }, { version: 2, name: "two", sql: "TWO" }];
    expect(runMigrations(database, migrations)).toBe(2); expect(calls).toContain("TWO"); expect(calls).not.toContain("ONE");
  });
  it("중복 version을 거부한다", () => { const database = { exec: () => undefined, getAppliedMigrationVersions: () => [] }; expect(() => runMigrations(database, [{ version: 1, name: "a", sql: "" }, { version: 1, name: "b", sql: "" }])).toThrow(MigrationError); });
});
