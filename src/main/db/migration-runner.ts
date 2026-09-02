export interface SqliteExecutor {
  exec(sql: string): void;
  getAppliedMigrationVersions(): number[];
}

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export class MigrationError extends Error { constructor(message: string, public readonly cause?: unknown) { super(message); this.name = "MigrationError"; } }

export function runMigrations(database: SqliteExecutor, migrations: Migration[]): number {
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("CREATE TABLE IF NOT EXISTS schema_migration (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  if (sorted.some((migration, index) => index > 0 && migration.version === sorted[index - 1].version)) throw new MigrationError("중복된 migration version입니다.");
  if (sorted.some((migration) => !Number.isInteger(migration.version) || migration.version < 1)) throw new MigrationError("잘못된 migration version입니다.");
  const applied = new Set(database.getAppliedMigrationVersions());
  for (const migration of sorted) {
    if (applied.has(migration.version)) continue;
    database.exec("BEGIN");
    try {
      database.exec(migration.sql);
      database.exec(`INSERT INTO schema_migration(version, name, applied_at) VALUES (${migration.version}, '${migration.name.replaceAll("'", "''")}', '${new Date().toISOString()}')`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw new MigrationError(`${migration.name} migration에 실패했습니다.`, error);
    }
  }
  return sorted.at(-1)?.version ?? 0;
}
