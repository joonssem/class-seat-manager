try {
  const Database = require("better-sqlite3");
  const database = new Database(":memory:");
  const result = database.prepare("SELECT 1 AS value").get();
  database.close();

  if (!result || result.value !== 1) {
    throw new Error("SQLite 기본 쿼리 결과가 올바르지 않습니다.");
  }

  console.log("better-sqlite3 native binding OK");
} catch (error) {
  console.error("better-sqlite3 native binding을 로드할 수 없습니다.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
