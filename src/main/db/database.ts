import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app } from "electron";
import { runMigrations, type Migration } from "./migration-runner";

function loadInitialSchema(): string {
  const migrationPath = app.isPackaged
    ? join(process.resourcesPath, "migrations/001-initial.sql")
    : join(process.cwd(), "src/main/db/migrations/001-initial.sql");
  return readFileSync(migrationPath, "utf8");
}

function loadConstraintsSchema(): string {
  const migrationPath = app.isPackaged ? join(process.resourcesPath, "migrations/002-constraints.sql") : join(process.cwd(), "src/main/db/migrations/002-constraints.sql");
  return readFileSync(migrationPath, "utf8");
}
function loadCafeteriaSchema(): string { const migrationPath = app.isPackaged ? join(process.resourcesPath, "migrations/003-cafeteria.sql") : join(process.cwd(), "src/main/db/migrations/003-cafeteria.sql"); return readFileSync(migrationPath, "utf8"); }
function loadSeatingSemesterSchema(): string { const migrationPath = app.isPackaged ? join(process.resourcesPath, "migrations/004-seating-semester.sql") : join(process.cwd(), "src/main/db/migrations/004-seating-semester.sql"); return readFileSync(migrationPath, "utf8"); }
function loadSeatSyncSchema(): string { const migrationPath = app.isPackaged ? join(process.resourcesPath, "migrations/005-seat-sync.sql") : join(process.cwd(), "src/main/db/migrations/005-seat-sync.sql"); return readFileSync(migrationPath, "utf8"); }

export function openDatabase(databasePath: string): Database.Database {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  try {
    database.pragma("journal_mode = WAL");
    runMigrations({
      exec: (sql) => database.exec(sql),
      getAppliedMigrationVersions: () => database.prepare("SELECT version FROM schema_migration ORDER BY version").all().map((row) => Number((row as { version: number }).version))
    }, [{ version: 1, name: "initial-schema", sql: loadInitialSchema() }, { version: 2, name: "student-constraints", sql: loadConstraintsSchema() }, { version: 3, name: "cafeteria", sql: loadCafeteriaSchema() }, { version: 4, name: "seating-semester", sql: loadSeatingSemesterSchema() }, { version: 5, name: "seat-sync", sql: loadSeatSyncSchema() }] satisfies Migration[]);
    return database;
  } catch (error) {
    database.close();
    if (existsSync(databasePath)) copyFileSync(databasePath, `${databasePath}.migration-failed-${Date.now()}.sqlite`);
    throw new Error("로컬 데이터베이스 업데이트에 실패했습니다. migration 실패 백업을 보존했습니다.", { cause: error });
  }
}
