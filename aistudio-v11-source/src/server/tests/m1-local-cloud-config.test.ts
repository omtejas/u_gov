import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function readRoot(relPath: string): string {
  const fullPath = path.join(ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected M1 file to exist: ${relPath}`);
  return fs.readFileSync(fullPath, "utf8");
}

describe("U-GOV M1 Zero-Cost Local Cloud Configuration", () => {
  it("configures firebase.json and .firebaserc for strictly local demo-ugov-local emulators", () => {
    const rc = JSON.parse(readRoot(".firebaserc"));
    assert.equal(rc.projects?.default, "demo-ugov-local");
    assert.notEqual(rc.projects?.default, "gen-lang-client-0471340992");

    const fb = JSON.parse(readRoot("firebase.json"));
    assert.equal(fb.firestore?.rules, "firestore.rules");
    assert.equal(fb.firestore?.indexes, "firestore.indexes.json");
    assert.equal(fb.storage?.rules, "storage.rules");
    assert.equal(fb.emulators?.auth?.port, 9099);
    assert.equal(fb.emulators?.firestore?.port, 8080);
    assert.equal(fb.emulators?.storage?.port, 9199);
    assert.equal(fb.emulators?.ui?.enabled, true);
    assert.equal(fb.emulators?.ui?.port, 4000);
  });

  it("defines hardened storage.rules with default-deny, owner scoping, 5MB cap, and allowed MIME types", () => {
    const rules = readRoot("storage.rules");
    assert.ok(rules.includes("rules_version = '2'"));
    assert.ok(rules.includes("service firebase.storage"));
    assert.ok(rules.includes("allow read, write: if false;"));
    assert.ok(rules.includes("request.auth.token.email_verified == true"));
    assert.ok(rules.includes("5 * 1024 * 1024"));
    assert.ok(rules.includes("'application/pdf'"));
    assert.ok(rules.includes("'image/jpeg'"));
    assert.ok(rules.includes("'image/png'"));
    assert.ok(rules.includes("allow update: if false;"));
  });

  it("preserves valid firestore.indexes.json without speculative composite indexes", () => {
    const indexes = JSON.parse(readRoot("firestore.indexes.json"));
    assert.ok(Array.isArray(indexes.indexes));
    assert.ok(Array.isArray(indexes.fieldOverrides));
  });

  it("configures docker-compose.yml with PostgreSQL 16, healthchecks, persistent volumes, and isolated app profile", () => {
    const compose = readRoot("docker-compose.yml");
    assert.ok(compose.includes("image: postgres:16-alpine"));
    assert.ok(compose.includes("pg_isready"));
    assert.ok(compose.includes("127.0.0.1:${POSTGRES_PORT:-5432}:5432"));
    assert.ok(compose.includes("ugov_postgres_data:"));
    assert.ok(compose.includes("./src/server/database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro"));
    assert.ok(compose.includes("./src/server/database/migrations/001_v6_lifecycle_foundation.sql:/docker-entrypoint-initdb.d/02-migration-001.sql:ro"));
    assert.ok(compose.includes('profiles: ["app"]'));
    assert.ok(!compose.includes("cloudsql"));
  });

  it("documents local emulator endpoints in .env.example without real secrets", () => {
    const envExample = readRoot(".env.example");
    for (const requiredKey of [
      "DATABASE_URL=",
      "GEMINI_API_KEY=",
      "FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099",
      "FIRESTORE_EMULATOR_HOST=127.0.0.1:8080",
      "FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199",
      "VITE_FIREBASE_EMULATOR_PROJECT_ID=demo-ugov-local",
    ]) {
      assert.ok(envExample.includes(requiredKey), `.env.example missing ${requiredKey}`);
    }
    assert.ok(!/AIzaSy[A-Za-z0-9_-]{10,}/.test(envExample), ".env.example must not contain API keys");
    assert.ok(!/sk-[A-Za-z0-9_-]{10,}/.test(envExample), ".env.example must not contain OpenAI keys");
  });

  it("keeps render.yaml untouched for zero-cost baseline safety", () => {
    const renderYaml = readRoot("render.yaml");
    assert.ok(renderYaml.includes("plan: free"));
    assert.ok(renderYaml.includes("UGOV_STORAGE_MODE"));
  });
});
