import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("electron", () => ({ app: { isPackaged: false } }));

const temporaryDirectories: string[] = [];
let nativeBindingAvailable = false;
try {
  const Database = require("better-sqlite3");
  const database = new Database(":memory:");
  database.close();
  nativeBindingAvailable = true;
} catch {
  nativeBindingAvailable = false;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
  }
});

describe("SQLite database integration", () => {
  it.skipIf(!nativeBindingAvailable)("creates the database and applies all migrations", async () => {
    const directory = mkdtempSync(join(tmpdir(), "class-seat-manager-"));
    temporaryDirectories.push(directory);
    const { openDatabase } = await import("../../src/main/db/database");
    const database = openDatabase(join(directory, "class-seat-manager.sqlite"));

    const migrations = database.prepare("SELECT version FROM schema_migration ORDER BY version").all() as Array<{ version: number }>;
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;

    expect(migrations.map((row) => row.version)).toEqual([1, 2, 3]);
    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining(["school_year", "student", "seat", "seating_session", "cafeteria_session"]));
    database.close();
  });
});
