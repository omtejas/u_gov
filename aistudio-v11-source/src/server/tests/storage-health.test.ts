import assert from "node:assert/strict";
import { inspectStorageDirectory, isEphemeralDataPath } from "../storage/storageHealth";

function runStorageHealthTests(): void {
  assert.equal(isEphemeralDataPath("/tmp/ugov-data"), true, "temporary data paths are classified as ephemeral");
  assert.equal(isEphemeralDataPath("/var/tmp/ugov-data"), true, "var/tmp data paths are classified as ephemeral");
  assert.equal(isEphemeralDataPath("/var/data/ugov-data"), false, "a mounted data directory is not rejected by its path name alone");

  const temporaryStorage = inspectStorageDirectory("/tmp");
  assert.equal(temporaryStorage.ephemeralPath, true, "temporary storage readiness reports ephemeral path");
  assert.equal(temporaryStorage.persistentMountVerified, false, "temporary storage can never pass the persistent mount check");

  console.log("U-GOV V4 storage readiness tests passed.");
}

runStorageHealthTests();


async function runBackendHealthTests(): Promise<void> {
  const { LocalStorageDriver } = await import("../storage/LocalStorageDriver");
  const { S3CompatibleStorageDriver } = await import("../storage/S3CompatibleStorageDriver");
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ugov-storage-health-"));
  try {
    const local = new LocalStorageDriver(temp);
    const localHealth = await local.checkHealth();
    assert.equal(localHealth.healthy, true, "local private vault health check creates and removes a write probe");
    assert.equal(localHealth.provider, "local");
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }

  const envKeys = ["UGOV_S3_ENDPOINT", "UGOV_S3_BUCKET", "UGOV_S3_REGION", "UGOV_S3_ACCESS_KEY_ID", "UGOV_S3_SECRET_ACCESS_KEY"];
  const previous = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.UGOV_S3_ENDPOINT;
    delete process.env.UGOV_S3_BUCKET;
    delete process.env.UGOV_S3_REGION;
    delete process.env.UGOV_S3_ACCESS_KEY_ID;
    delete process.env.UGOV_S3_SECRET_ACCESS_KEY;
    assert.throws(() => new S3CompatibleStorageDriver(), /requires endpoint, bucket, region, access key and secret key/, "S3 driver fails closed when credentials are incomplete");

    process.env.UGOV_S3_ENDPOINT = "https://objects.example.test";
    process.env.UGOV_S3_BUCKET = "ugov-private";
    process.env.UGOV_S3_REGION = "ap-south-1";
    process.env.UGOV_S3_ACCESS_KEY_ID = "test-access";
    process.env.UGOV_S3_SECRET_ACCESS_KEY = "test-secret";
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(init?.method, "HEAD", "S3 health check uses a non-mutating HEAD request");
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const s3Health = await new S3CompatibleStorageDriver().checkHealth();
    assert.equal(s3Health.healthy, true, "S3 health check reports a reachable private bucket");
    assert.equal(s3Health.provider, "s3");
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }

  console.log("U-GOV private storage backend health tests passed.");
}

runBackendHealthTests().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
