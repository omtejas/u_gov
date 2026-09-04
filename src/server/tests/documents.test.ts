import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { authenticate } from "../middleware/auth";
import { authRouter } from "../routes/auth";
import { documentsRouter } from "../routes/documents";
import { db } from "../database/db";

async function runDocumentsTests() {
  console.log("\n==================================================");
  console.log("🔒 U-DOCS & U-CONSENT SECURITY & FUNCTIONAL TESTS");
  console.log("==================================================\n");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(authenticate as any);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/documents", documentsRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1`;

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

  try {
    // ----------------------------------------------------
    // TEST SUITE 1: Authentication & Authorization Checks
    // ----------------------------------------------------
    console.log("[Test Suite 1: Authentication & Protection]");
    const unauthGet = await fetch(`${baseUrl}/documents`);
    assert(unauthGet.status === 401, "Unauthenticated GET /api/v1/documents rejected with 401");

    const unauthDeposit = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hack" }),
    });
    assert(unauthDeposit.status === 401, "Unauthenticated POST /api/v1/documents/deposit rejected with 401");

    // Setup: Register Citizen A
    const citizenAEmail = `citizen_a_${Date.now()}@test.gov.in`;
    const regResA = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenAEmail,
        password: "StrongPassA123!",
        confirmPassword: "StrongPassA123!",
        displayName: "Citizen Alpha",
        phone: "+91 91111 22222",
        termsAccepted: true,
      }),
    });
    const cookieHeaderA = regResA.headers.get("set-cookie") || "";
    const cookieA = cookieHeaderA.split(";")[0];
    const dataRegA = await regResA.json();
    const citizenAId = dataRegA.user?.id;

    // Setup: Register Citizen B
    const citizenBEmail = `citizen_b_${Date.now()}@test.gov.in`;
    const regResB = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenBEmail,
        password: "StrongPassB123!",
        confirmPassword: "StrongPassB123!",
        displayName: "Citizen Beta",
        phone: "+91 93333 44444",
        termsAccepted: true,
      }),
    });
    const cookieHeaderB = regResB.headers.get("set-cookie") || "";
    const cookieB = cookieHeaderB.split(";")[0];

    // ----------------------------------------------------
    // TEST SUITE 2: Secure Deposit & Storage Key Isolation
    // ----------------------------------------------------
    console.log("\n[Test Suite 2: Secure Document Upload & Private Storage]");
    const sampleContent = Buffer.from("%PDF-1.4 U-GOV Official Test Citizen Identity Credential Payload");
    const sampleBase64 = sampleContent.toString("base64");
    const expectedSha256 = crypto.createHash("sha256").update(sampleContent).digest("hex");

    // Test rejection of invalid MIME
    const badMimeRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        title: "Malicious File",
        documentTypeId: "dt-aadhaar",
        fileName: "virus.exe",
        mimeType: "application/x-msdownload",
        fileData: sampleBase64,
      }),
    });
    assert(badMimeRes.status === 400, "Deposit with unauthorized MIME type is rejected (400)");

    // Test successful deposit
    const depositRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        title: "Aadhaar Card",
        documentTypeId: "dt-aadhaar",
        documentNumber: "1234-5678-9012",
        fileName: "aadhaar_sample.pdf",
        mimeType: "application/pdf",
        fileData: sampleBase64,
      }),
    });
    const depositData = await depositRes.json();
    assert(depositRes.status === 201 && depositData.success, "Valid document deposit succeeds (201 Created)");
    const docA = depositData.document;
    assert(Boolean(docA && docA.id), "Document assigned unique identifier");
    assert(docA.sha256Checksum === expectedSha256, "Cryptographic SHA-256 checksum matches input bytes exactly");

    // Storage Key must be random UUID, not citizen name or original file name
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    assert(uuidRegex.test(docA.storageKey), `Storage key is a random UUID (${docA.storageKey})`);
    assert(!docA.storageKey.includes("Alpha") && !docA.storageKey.includes("aadhaar"), "Storage key contains zero sensitive citizen or file names");

    // Verify binary is placed inside private vault directory
    const vaultPath = path.resolve(process.cwd(), "storage", "vault", docA.storageKey);
    assert(fs.existsSync(vaultPath), "Binary exists in private vault directory");

    // ----------------------------------------------------
    // TEST SUITE 3: IDOR Protection & Access Control
    // ----------------------------------------------------
    console.log("\n[Test Suite 3: Strict Ownership & IDOR Protection]");

    // Citizen A (owner) can retrieve document
    const ownerGetRes = await fetch(`${baseUrl}/documents/${docA.id}`, {
      headers: { Cookie: cookieA },
    });
    assert(ownerGetRes.status === 200, "Citizen A (owner) can access own document metadata (200)");

    // Citizen B (attacker) attempts to retrieve Citizen A's document -> 403
    const idorGetRes = await fetch(`${baseUrl}/documents/${docA.id}`, {
      headers: { Cookie: cookieB },
    });
    assert(idorGetRes.status === 403, "Citizen B is blocked with 403 when accessing Citizen A's document (IDOR Guard)");

    // Citizen B attempts to download Citizen A's document -> 403
    const idorDlRes = await fetch(`${baseUrl}/documents/${docA.id}/download`, {
      headers: { Cookie: cookieB },
    });
    assert(idorDlRes.status === 403, "Citizen B is blocked with 403 when attempting to download Citizen A's document");

    // Citizen B attempts to delete Citizen A's document -> 403
    const idorDelRes = await fetch(`${baseUrl}/documents/${docA.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieB },
    });
    assert(idorDelRes.status === 403, "Citizen B is blocked with 403 when attempting to delete Citizen A's document");

    // Citizen B attempts to grant consent on Citizen A's document -> 403
    const idorCstRes = await fetch(`${baseUrl}/documents/${docA.id}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({
        recipientEntity: "Rogue Dept",
        purpose: "Unauthorized Snooping",
      }),
    });
    assert(idorCstRes.status === 403, "Citizen B cannot grant consent on Citizen A's document (403)");

    // ----------------------------------------------------
    // TEST SUITE 4: SHA-256 Integrity Verification & Tamper Detection
    // ----------------------------------------------------
    console.log("\n[Test Suite 4: Real-time SHA-256 Integrity & Tamper Detection]");

    // 1. Untampered check
    const verifyRes = await fetch(`${baseUrl}/documents/${docA.id}/verify-integrity`, {
      headers: { Cookie: cookieA },
    });
    const verifyData = await verifyRes.json();
    assert(verifyRes.status === 200 && verifyData.integrity === "VALID", "Unaltered document verifies as VALID with matching SHA-256");

    // 2. Download untampered document
    const dlRes = await fetch(`${baseUrl}/documents/${docA.id}/download`, {
      headers: { Cookie: cookieA },
    });
    assert(dlRes.status === 200, "Owner download succeeds with 200 OK");
    const downloadedBytes = Buffer.from(await dlRes.arrayBuffer());
    assert(downloadedBytes.equals(sampleContent), "Downloaded binary content matches uploaded bytes identically");
    assert(dlRes.headers.get("x-content-type-options") === "nosniff", "Download enforces X-Content-Type-Options: nosniff header");

    // 3. Simulate file tampering / silent corruption in vault
    const originalVaultBytes = fs.readFileSync(vaultPath);
    const tamperedBytes = Buffer.concat([originalVaultBytes, Buffer.from(" [CORRUPTED_BYTES]")]);
    fs.writeFileSync(vaultPath, tamperedBytes);

    // Call verify-integrity on corrupted file
    const tamperVerifyRes = await fetch(`${baseUrl}/documents/${docA.id}/verify-integrity`, {
      headers: { Cookie: cookieA },
    });
    const tamperVerifyData = await tamperVerifyRes.json();
    assert(tamperVerifyData.integrity === "FAILED", "Corrupted file is detected as FAILED integrity");

    // Call download on corrupted file -> must be blocked
    const tamperDlRes = await fetch(`${baseUrl}/documents/${docA.id}/download`, {
      headers: { Cookie: cookieA },
    });
    assert(tamperDlRes.status === 409, "Download of corrupted file is blocked with 409 Conflict");

    // Verify audit recorded security alert for tampering
    const auditEvents = db.getAuditEvents(200).filter((e) => e.actorId === citizenAId);
    const integrityFailEvent = auditEvents.find((e) => e.action === "DOCUMENT_INTEGRITY_FAILED");
    assert(Boolean(integrityFailEvent && integrityFailEvent.result === "BLOCKED"), "Security alert event DOCUMENT_INTEGRITY_FAILED recorded in U-AUDIT");

    // Restore original bytes
    fs.writeFileSync(vaultPath, originalVaultBytes);

    // ----------------------------------------------------
    // TEST SUITE 5: Consent Engine & Unilateral Instant Revocation
    // ----------------------------------------------------
    console.log("\n[Test Suite 5: Time-Bound Consent & Instant Revocation]");

    const recipientDept = "Department of Higher Education";
    const grantRes = await fetch(`${baseUrl}/documents/${docA.id}/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        recipientEntity: recipientDept,
        purpose: "National Scholarship Portal KYC Verification",
        durationDays: 14,
      }),
    });
    const grantData = await grantRes.json();
    assert(grantRes.status === 201 && grantData.success, "Citizen A successfully grants 14-day consent to Higher Ed Dept");
    const consentRecord = grantData.consent;
    assert(consentRecord.status === "ACTIVE", "New consent is ACTIVE");

    // Authorized recipient access with consent query parameter
    const recipientAccessRes = await fetch(`${baseUrl}/documents/${docA.id}?recipient=${encodeURIComponent(recipientDept)}`, {
      headers: { Cookie: cookieB },
    });
    assert(recipientAccessRes.status === 200, "Authorized recipient can view document with active consent");

    // Unauthorized recipient query parameter
    const fakeRecipientRes = await fetch(`${baseUrl}/documents/${docA.id}?recipient=FakeDepartment`, {
      headers: { Cookie: cookieB },
    });
    assert(fakeRecipientRes.status === 403, "Unauthorized recipient entity is denied (403)");

    // Citizen B cannot revoke Citizen A's consent
    const idorRevokeRes = await fetch(`${baseUrl}/documents/consent/${consentRecord.id}/revoke`, {
      method: "POST",
      headers: { Cookie: cookieB },
    });
    assert(idorRevokeRes.status === 403, "Citizen B cannot revoke Citizen A's consent (403)");

    // Citizen A revokes consent unilaterally
    const revokeRes = await fetch(`${baseUrl}/documents/consent/${consentRecord.id}/revoke`, {
      method: "POST",
      headers: { Cookie: cookieA },
    });
    assert(revokeRes.status === 200, "Citizen A successfully revokes consent (200 OK)");

    // Immediate effect: Previously authorized recipient is instantly blocked
    const postRevokeAccessRes = await fetch(`${baseUrl}/documents/${docA.id}?recipient=${encodeURIComponent(recipientDept)}`, {
      headers: { Cookie: cookieB },
    });
    assert(postRevokeAccessRes.status === 403, "Recipient access is immediately blocked with 403 post-revocation (zero delay)");

    // ----------------------------------------------------
    // TEST SUITE 6: Document Deletion & Binary Purge
    // ----------------------------------------------------
    console.log("\n[Test Suite 6: Safe Deletion & Binary Purge]");

    const deleteRes = await fetch(`${baseUrl}/documents/${docA.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieA },
    });
    assert(deleteRes.status === 200, "Document deletion succeeds with 200 OK");
    assert(!fs.existsSync(vaultPath), "Private binary file is purged from disk vault upon deletion");

    const postDeleteGet = await fetch(`${baseUrl}/documents/${docA.id}`, {
      headers: { Cookie: cookieA },
    });
    assert(postDeleteGet.status === 404, "Subsequent document lookup returns 404 Not Found");

    // ----------------------------------------------------
    // TEST SUITE 7: U-AUDIT Ledger Chain Verification
    // ----------------------------------------------------
    console.log("\n[Test Suite 7: Cryptographic U-AUDIT Ledger Integrity]");
    const verifyAuditRes = await fetch(`${baseUrl}/auth/audit/verify`, {
      headers: { Cookie: cookieA },
    });
    const auditVerifyData = await verifyAuditRes.json();
    assert(Boolean(auditVerifyData.success && auditVerifyData.verification?.valid), "Entire audit chain remains unbroken and mathematically verified");

  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`Document Test Results: ${passed} Passed | ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDocumentsTests().catch((err) => {
  console.error("Fatal error during document test run:", err);
  process.exit(1);
});
