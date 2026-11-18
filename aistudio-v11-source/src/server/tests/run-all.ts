import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const testFiles = [
  "src/server/tests/gemini-model-config.test.ts",
  "src/server/tests/ai-intent-router.test.ts",
  "src/server/tests/gbot-resilience.test.ts",
  "src/server/tests/storage-health.test.ts",
  "src/server/tests/auth.test.ts",
  "src/server/tests/google-auth.test.ts",
  "src/server/tests/api.test.ts",
  "src/server/tests/documents.test.ts",
  "src/server/tests/services.test.ts",
  "src/server/tests/applications.test.ts",
  "src/server/tests/applications_ui.test.ts",
  "src/server/tests/integrations.test.ts",
  "src/server/tests/ai.test.ts",
  "src/server/tests/upgrade.test.ts",
  "src/server/tests/v10-hardening.test.ts",
  "src/server/tests/m1-local-cloud-config.test.ts",
];

const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ugov-test-data-"));

try {
  for (const file of testFiles) {
    console.log(`\n▶ Running ${file}`);
    const result = spawnSync("npx", ["tsx", file], {
      stdio: "inherit",
      env: {
        ...process.env,
        UGOV_DATA_DIR: tempDataDir,
        UGOV_STORAGE_MODE: "ephemeral-demo",
      },
    });
    if (result.status !== 0) {
      console.error(`✖ Test suite failed: ${file} (exit ${result.status ?? 1})`);
      process.exit(result.status ?? 1);
    }
  }
  console.log(`\n✓ All ${testFiles.length} server test suites passed with isolated UGOV_DATA_DIR.`);
} finally {
  try {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup error
  }
}
