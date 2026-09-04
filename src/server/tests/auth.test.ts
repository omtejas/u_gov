import { db } from "../database/db";
import { hashPassword, verifyPassword, generateSessionToken, hashToken } from "../auth/crypto";

async function runTestSuite() {
  console.log("==================================================");
  console.log("🧪 U-IDENTITY & U-AUDIT SECURITY & FUNCTIONAL TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Password Hashing & Constant-Time Verification
  console.log("[Test Suite 1: Cryptographic Password Security]");
  const password = "TestPassword@2026";
  const { hash, salt } = hashPassword(password);
  assert(hash.length === 128, "Password hash is 64-byte hex (scrypt)");
  assert(salt.length === 32, "Salt is 16-byte cryptographically secure random hex");
  assert(verifyPassword(password, hash, salt), "Valid password verifies correctly");
  assert(!verifyPassword("WrongPassword123", hash, salt), "Invalid password is rejected");

  // 2. Token Generation and Hashing
  console.log("\n[Test Suite 2: Session Token Security]");
  const token = generateSessionToken();
  assert(token.length === 64, "Session token has 256-bit entropy (64 hex chars)");
  const tokenHash = hashToken(token);
  assert(tokenHash.length === 64, "Token hash is SHA-256 (64 hex chars)");
  assert(tokenHash !== token, "Token is not stored in plaintext");

  // 3. User & Profile Database Entities
  console.log("\n[Test Suite 3: Database Entity Persistence & Seeding]");
  const defaultCitizen = db.findUserByIdentifier("citizen@u-gov.gov.in");
  assert(Boolean(defaultCitizen), "Pre-seeded citizen account exists");
  if (defaultCitizen) {
    const profile = db.getProfileByUserId(defaultCitizen.id);
    assert(Boolean(profile), "Citizen profile linked to user entity");
    assert(profile?.displayName === "Ganesh Ramesh Gite", "Profile displays correct full name");
    const roles = db.getUserRoles(defaultCitizen.id);
    assert(roles.some((r) => r.id === "CITIZEN"), "Citizen has CITIZEN role");
    const perms = db.getUserPermissions(defaultCitizen.id);
    assert(perms.includes("services:apply"), "Citizen has 'services:apply' permission");
    assert(!perms.includes("system:admin"), "Citizen lacks 'system:admin' permission (least privilege)");
  }

  // 4. Session Creation & Revocation
  console.log("\n[Test Suite 4: Stateful Session Management]");
  const testUserId = "usr-test-session";
  const testToken = generateSessionToken();
  const testHash = hashToken(testToken);
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 3600000).toISOString();

  const testSessionId = `sess-test-${Date.now()}`;
  db.createSession({
    id: testSessionId,
    userId: testUserId,
    tokenHash: testHash,
    createdAt: now,
    expiresAt: expires,
  });

  const activeSession = db.findSessionByHash(testHash);
  assert(Boolean(activeSession), "Active session found by token hash");
  assert(activeSession?.userId === testUserId, "Session correctly maps to user ID");

  db.revokeSession(testSessionId);
  const revokedSession = db.findSessionByHash(testHash);
  assert(!revokedSession, "Revoked session cannot be used (fails lookup)");

  // 5. Audit Logging & Cryptographic Integrity Verification
  console.log("\n[Test Suite 5: Cryptographic Audit Ledger Integrity]");
  const initialAuditCount = db.getAuditEvents().length;
  db.recordAuditEvent({
    id: `aud-test-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actorName: "Test Suite Actor",
    actorRole: "Test Runner",
    action: "SECURITY_TEST_EXECUTION",
    resource: "Auth Test Suite",
    result: "SUCCESS",
    context: "Automated verification of Phase 2 security contracts",
  });
  const updatedAuditCount = db.getAuditEvents().length;
  assert(updatedAuditCount === initialAuditCount + 1, "Audit event append-only recorded");
  const latestEvent = db.getAuditEvents(1)[0];
  assert(latestEvent.action === "SECURITY_TEST_EXECUTION", "Audit event contains exact action");
  assert(Boolean(latestEvent.hash && latestEvent.prevHash), "Audit event has SHA-256 hash and prevHash chained");

  const ledgerVerification = db.verifyAuditLedger();
  assert(ledgerVerification.valid, "Untampered audit ledger passes cryptographic integrity verification");

  // 6. Expired Session Invalidation
  console.log("\n[Test Suite 6: Session Expiration & Global Invalidation]");
  const expiredToken = generateSessionToken();
  const expiredHash = hashToken(expiredToken);
  const pastTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  db.createSession({
    id: `sess-expired-${Date.now()}`,
    userId: testUserId,
    tokenHash: expiredHash,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    expiresAt: pastTime,
  });
  const foundExpired = db.findSessionByHash(expiredHash);
  assert(!foundExpired, "Expired session is automatically rejected on lookup");

  // 7. Revoke All Sessions
  const bulkToken1 = generateSessionToken();
  const bulkHash1 = hashToken(bulkToken1);
  const bulkToken2 = generateSessionToken();
  const bulkHash2 = hashToken(bulkToken2);
  db.createSession({
    id: `sess-bulk-1-${Date.now()}`,
    userId: "usr-bulk-test",
    tokenHash: bulkHash1,
    createdAt: now,
    expiresAt: expires,
  });
  db.createSession({
    id: `sess-bulk-2-${Date.now()}`,
    userId: "usr-bulk-test",
    tokenHash: bulkHash2,
    createdAt: now,
    expiresAt: expires,
  });
  assert(Boolean(db.findSessionByHash(bulkHash1)), "First active session valid");
  assert(Boolean(db.findSessionByHash(bulkHash2)), "Second active session valid");

  db.revokeAllUserSessions("usr-bulk-test");
  assert(!db.findSessionByHash(bulkHash1), "First session revoked by global invalidation");
  assert(!db.findSessionByHash(bulkHash2), "Second session revoked by global invalidation");

  // Summary
  console.log("\n==================================================");
  console.log(`Test Results: ${passed} Passed | ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
