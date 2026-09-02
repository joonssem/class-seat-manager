import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import Database from "better-sqlite3";

export interface BackupDatabase { pragma(statement: string): unknown; }
export class BackupService {
  constructor(private readonly database: BackupDatabase, private readonly databasePath: string) {}
  export(targetPath: string): string { const target = resolve(targetPath); if (target === resolve(this.databasePath)) throw new Error("현재 사용 중인 DB 파일에는 백업할 수 없습니다."); this.database.pragma("wal_checkpoint(TRUNCATE)"); mkdirSync(dirname(target), { recursive: true }); copyFileSync(this.databasePath, target); return target; }
  validate(sourcePath: string): boolean { return existsSync(resolve(sourcePath)); }
  restore(sourcePath: string): string { const source = resolve(sourcePath); const target = resolve(this.databasePath); if (source === target) throw new Error("현재 사용 중인 DB 파일 자체는 복원할 수 없습니다."); if (!existsSync(source)) throw new Error("백업 파일을 찾을 수 없습니다."); const check = new Database(source, { readonly: true }); const result = check.pragma("integrity_check") as Array<{ integrity_check: string }>; check.close(); if (!result.some((row) => row.integrity_check === "ok")) throw new Error("백업 파일의 SQLite 무결성 검사에 실패했습니다."); copyFileSync(source, target); return source; }
  createRestoreSafetyBackup(): string { const target = join(dirname(this.databasePath), `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`); return this.export(target); }
}
