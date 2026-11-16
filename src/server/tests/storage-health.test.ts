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
