import express from "express";
import http from "http";
import crypto from "crypto";
import { authenticate } from "../middleware/auth";
import { authRouter } from "../routes/auth";
import { documentsRouter } from "../routes/documents";
import { servicesRouter } from "../routes/services";
import { applicationsRouter } from "../routes/applications";
import { db } from "../database/db";
import { documentService } from "../services/documentService";

async function runApplicationUiFlowTests() {
  console.log("\n==================================================");
  console.log("🖥️  U-APPLICATIONS CITIZEN UI & E2E FLOW TESTS");
  console.log("==================================================\n");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(authenticate as any);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/documents", documentsRouter);
  app.use("/api/v1/services", servicesRouter);
  app.use("/api/v1/applications", applicationsRouter);

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
    // TEST SUITE 1: Citizen Discovery to Application Initiation
    // ----------------------------------------------------
    console.log("[Test Suite 1: Services Directory Discovery & Prerequisite Evaluation]");

    // 1. Citizen registers
    const citizenEmail = `citizen_ui_${Date.now()}@test.gov.in`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenEmail,
        password: "PassUiTest123!",
        confirmPassword: "PassUiTest123!",
        displayName: "Pooja Deshmukh",
        phone: "+91 95555 66666",
        state: "Maharashtra",
        district: "Nashik",
        termsAccepted: true,
      }),
    });
    const citizenCookie = (regRes.headers.get("set-cookie") || "").split(";")[0];
    const citizenData = await regRes.json();
    const citizenId = citizenData.user?.id;
    assert(regRes.status === 201 && Boolean(citizenId), "Citizen registers and receives session cookie");

    // 2. Discover National Scholarship Portal (NSP)
    const resSvc = await fetch(`${baseUrl}/services/serv-nsp`);
    const dataSvc = await resSvc.json();
    assert(resSvc.status === 200 && dataSvc.service.serviceCode === "NSP", "Citizen discovers National Scholarship Portal (NSP) service");

    // 3. Evaluate prerequisites on empty vault -> 0% readiness
    const resReqEmpty = await fetch(`${baseUrl}/services/serv-nsp/requirements`, {
      headers: { Cookie: citizenCookie },
    });
    const dataReqEmpty = await resReqEmpty.json();
    assert(dataReqEmpty.evaluation.readinessPercentage === 0, "Initial requirement evaluation reflects 0% readiness with empty vault");
    assert(dataReqEmpty.evaluation.missingCount === 3, "All 3 required credentials marked missing");

    // 4. Citizen initiates application from service details
    const resCreateApp = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        serviceId: "serv-nsp",
        formData: {
          course: "M.Sc Mathematics",
          appliedFrom: "ServicesDirectory",
          institutionName: "Pune University",
        },
      }),
    });
    const dataCreateApp = await resCreateApp.json();
    const appRecord = dataCreateApp.application;
    assert(resCreateApp.status === 201 && Boolean(appRecord.id), "Application created via POST /api/v1/applications");
    assert(appRecord.status === "DOCUMENTS_REQUIRED", "Application starts in DOCUMENTS_REQUIRED state");
    assert(appRecord.applicationNumber.startsWith("UGOV-2026-NSP-"), "Application number assigned with UGOV-2026-NSP prefix");

    // ----------------------------------------------------
    // TEST SUITE 2: Sovereign Credential Selection & Dynamic Readiness
    // ----------------------------------------------------
    console.log("\n[Test Suite 2: Sovereign Credential Selection & Dynamic Readiness]");

    // Deposit credentials for Pooja
    const docAadhaar = await documentService.depositDocument(citizenId, {
      documentTypeId: "AADHAAR",
      title: "Aadhaar of Pooja",
      documentNumber: "XXXX-XXXX-1122",
      fileName: "pooja_aadhaar.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.4 simulated aadhaar payload"),
    });

    const docIncome = await documentService.depositDocument(citizenId, {
      documentTypeId: "INCOME_CERT",
      title: "Income Certificate of Pooja",
      documentNumber: "INC-2026-3344",
      fileName: "pooja_income.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.4 simulated income payload"),
    });

    const docMarksheet = await documentService.depositDocument(citizenId, {
      documentTypeId: "MARKSHEET",
      title: "Class 12 Marksheet of Pooja",
      documentNumber: "HSC-2023-5566",
      fileName: "pooja_marksheet.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.4 simulated marksheet payload"),
    });

    // 1. Attach Aadhaar
    const resAttach1 = await fetch(`${baseUrl}/applications/${appRecord.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ documentId: docAadhaar.id }),
    });
    const dataAttach1 = await resAttach1.json();
    assert(resAttach1.status === 200 && dataAttach1.application.status === "DOCUMENTS_REQUIRED", "Attaching 1/3 credentials keeps status DOCUMENTS_REQUIRED");

    // 2. Attach Income
    const resAttach2 = await fetch(`${baseUrl}/applications/${appRecord.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ documentId: docIncome.id }),
    });
    const dataAttach2 = await resAttach2.json();
    assert(resAttach2.status === 200 && dataAttach2.application.status === "DOCUMENTS_REQUIRED", "Attaching 2/3 credentials keeps status DOCUMENTS_REQUIRED");

    // 3. Attach Marksheet -> Transitions to READY!
    const resAttach3 = await fetch(`${baseUrl}/applications/${appRecord.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ documentId: docMarksheet.id }),
    });
    const dataAttach3 = await resAttach3.json();
    assert(resAttach3.status === 200 && dataAttach3.application.status === "READY", "Attaching all 3 mandatory credentials transitions application to READY");

    // 4. Detach credential -> reverts to DOCUMENTS_REQUIRED
    const resDetach = await fetch(`${baseUrl}/applications/${appRecord.id}/documents/${docMarksheet.id}`, {
      method: "DELETE",
      headers: { Cookie: citizenCookie },
    });
    const dataDetach = await resDetach.json();
    assert(dataDetach.application.status === "DOCUMENTS_REQUIRED", "Detaching credential reverts application to DOCUMENTS_REQUIRED");

    // 5. Re-attach Marksheet -> returns to READY
    const resReattach = await fetch(`${baseUrl}/applications/${appRecord.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ documentId: docMarksheet.id }),
    });
    const dataReattach = await resReattach.json();
    assert(dataReattach.application.status === "READY", "Re-attaching Marksheet returns status to READY");

    // ----------------------------------------------------
    // TEST SUITE 3: Statutory Review Disclosures & Explicit Consent
    // ----------------------------------------------------
    console.log("\n[Test Suite 3: Statutory Review Disclosures & Explicit Consent]");

    const resReview = await fetch(`${baseUrl}/applications/${appRecord.id}/review`, {
      headers: { Cookie: citizenCookie },
    });
    const dataReview = await resReview.json();
    assert(resReview.status === 200 && dataReview.success, "GET /review returns 200 OK");
    const review = dataReview.review;
    assert(review.dataSharingDisclosure.recipientEntity === "Department of Higher Education", "Recipient department accurately identified in disclosure");
    assert(review.dataSharingDisclosure.validityDays === 30, "Consent duration specified as statutory 30 days");
    assert(review.dataSharingDisclosure.documentsToShare.length === 3, "Exact 3 documents with SHA-256 hashes listed in disclosure");

    // Submit application with consent
    const resSubmit = await fetch(`${baseUrl}/applications/${appRecord.id}/submit`, {
      method: "POST",
      headers: { Cookie: citizenCookie },
    });
    const dataSubmit = await resSubmit.json();
    assert(resSubmit.status === 200 && dataSubmit.success, "POST /submit succeeds with 200 OK");
    assert(dataSubmit.consentsGrantedCount === 3, "U-CONSENT tokens generated for all 3 attached credentials");
    assert(dataSubmit.application.status === "SUBMITTED", "Application status updated to SUBMITTED");
    assert(Boolean(dataSubmit.submission.trackingToken), "Sandbox tracking token returned to citizen");
    assert(dataSubmit.submission.trackingToken.startsWith("SBX-ACK-NSP-"), "Tracking token format matches SBX-ACK-NSP-XXXX");

    // Post-submission lockdown
    const resLockAttach = await fetch(`${baseUrl}/applications/${appRecord.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ documentId: docAadhaar.id }),
    });
    assert(resLockAttach.status === 400, "Lockdown: Cannot attach credentials to a SUBMITTED application");

    const resLockDetach = await fetch(`${baseUrl}/applications/${appRecord.id}/documents/${docAadhaar.id}`, {
      method: "DELETE",
      headers: { Cookie: citizenCookie },
    });
    assert(resLockDetach.status === 400, "Lockdown: Cannot detach credentials from a SUBMITTED application");

    // ----------------------------------------------------
    // TEST SUITE 4: Two-Citizen IDOR & Cross-Citizen Security
    // ----------------------------------------------------
    console.log("\n[Test Suite 4: Two-Citizen IDOR & Boundary Isolation]");

    // Register Citizen B (Attacker)
    const citizenBEmail = `attacker_ui_${Date.now()}@test.gov.in`;
    const regBRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenBEmail,
        password: "PassAttacker123!",
        confirmPassword: "PassAttacker123!",
        displayName: "Malicious User",
        phone: "+91 97777 88888",
        termsAccepted: true,
      }),
    });
    const citizenBCookie = (regBRes.headers.get("set-cookie") || "").split(";")[0];

    // Citizen B tries to access Citizen A's application
    const resIdorGet = await fetch(`${baseUrl}/applications/${appRecord.id}`, {
      headers: { Cookie: citizenBCookie },
    });
    assert(resIdorGet.status === 403, "Citizen B cannot view Citizen A's application (403 Forbidden)");

    const resIdorReview = await fetch(`${baseUrl}/applications/${appRecord.id}/review`, {
      headers: { Cookie: citizenBCookie },
    });
    assert(resIdorReview.status === 403, "Citizen B cannot access disclosures of Citizen A's application (403 Forbidden)");

    const resIdorSubmit = await fetch(`${baseUrl}/applications/${appRecord.id}/submit`, {
      method: "POST",
      headers: { Cookie: citizenBCookie },
    });
    assert(resIdorSubmit.status === 403, "Citizen B cannot submit Citizen A's application (403 Forbidden)");

    const resIdorCancel = await fetch(`${baseUrl}/applications/${appRecord.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenBCookie },
      body: JSON.stringify({ reason: "Unauthorized cancellation attempt" }),
    });
    assert(resIdorCancel.status === 403, "Citizen B cannot cancel Citizen A's application (403 Forbidden)");

    // ----------------------------------------------------
    // TEST SUITE 5: Cancellation Flow & Personal Audit Ledger
    // ----------------------------------------------------
    console.log("\n[Test Suite 5: Application Cancellation & Audit Ledger Verification]");

    // Citizen A creates second application for Ayushman Bharat
    const resApp2 = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ serviceId: "serv-ayushman" }),
    });
    const dataApp2 = await resApp2.json();
    const app2Id = dataApp2.application.id;

    // Citizen cancels application 2
    const resCancel = await fetch(`${baseUrl}/applications/${app2Id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ reason: "Family already covered under employee health scheme" }),
    });
    const dataCancel = await resCancel.json();
    assert(resCancel.status === 200 && dataCancel.application.status === "CANCELLED", "Citizen cancels in-flight application with 200 OK");
    assert(dataCancel.application.cancellationReason === "Family already covered under employee health scheme", "Cancellation reason persisted accurately");

    // Cannot re-cancel cancelled application
    const resRecancel = await fetch(`${baseUrl}/applications/${app2Id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ reason: "Duplicate cancel attempt" }),
    });
    assert(resRecancel.status === 400, "Cannot re-cancel an already CANCELLED application (400 Bad Request)");

    // Audit Trail Integrity Verification
    const verifyAuditRes = await fetch(`${baseUrl}/auth/audit/verify`, {
      headers: { Cookie: citizenCookie },
    });
    const auditVerifyData = await verifyAuditRes.json();
    assert(Boolean(auditVerifyData.success && auditVerifyData.verification?.valid), "Entire U-AUDIT SHA-256 hash-chain remains unbroken throughout all citizen journeys");
    assert(auditVerifyData.verification?.algorithm === "SHA-256 Hash-Chained Append-Only Ledger", "Audit ledger confirms SHA-256 Hash-Chained Append-Only Ledger");

  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`U-APPLICATIONS UI Tests: ${passed} Passed | ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runApplicationUiFlowTests().catch((err) => {
  console.error("Fatal error during applications UI test run:", err);
  process.exit(1);
});
