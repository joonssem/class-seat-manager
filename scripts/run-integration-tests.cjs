// better-sqlite3 바인딩은 앱 실행용(Electron ABI)으로 빌드되어 있어 시스템 Node에서는 로드되지 않는다.
// Electron을 Node 모드로 실행하면 같은 ABI이므로 재빌드 없이 통합 테스트를 실행할 수 있다.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const electron = require("electron");
const vitest = path.join(__dirname, "..", "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(electron, [vitest, "run", "tests/integration", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", REQUIRE_SQLITE: "1" }
});
process.exit(result.status ?? 1);
