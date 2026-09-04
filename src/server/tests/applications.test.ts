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

async function runApplicationsTests() {
  console.log("\n==================================================");
  console.log("📑  U-APPLICATIONS ENGINE & LIFECYCLE TESTS");
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
    // TEST SUITE 1: Authentication & Route Guard Enforcement
    // ----------------------------------------------------
    console.log("[Test Suite 1: Authentication & Route Guard Enforcement]");

    const resUnauthPost = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: "serv-nsp" }),
    });
    assert(resUnauthPost.status === 401, "POST /api/v1/applications rejects unauthenticated requests with 401");

    const resUnauthList = await fetch(`${baseUrl}/applications`);
    assert(resUnauthList.status === 401, "GET /api/v1/applications rejects unauthenticated requests with 401");

    const resUnauthGet = await fetch(`${baseUrl}/applications/app-dummy`);
    assert(resUnauthGet.status === 401, "GET /api/v1/applications/:id rejects unauthenticated requests with 401");

    const resUnauthAttach = await fetch(`${baseUrl}/applications/app-dummy/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: "doc-dummy" }),
    });
    assert(resUnauthAttach.status === 401, "POST /api/v1/applications/:id/documents rejects unauthenticated requests with 401");

    const resUnauthDetach = await fetch(`${baseUrl}/applications/app-dummy/documents/doc-dummy`, {
      method: "DELETE",
    });
    assert(resUnauthDetach.status === 401, "DELETE /api/v1/applications/:id/documents/:docId rejects unauthenticated requests with 401");

    const resUnauthReview = await fetch(`${baseUrl}/applications/app-dummy/review`);
    assert(resUnauthReview.status === 401, "GET /api/v1/applications/:id/review rejects unauthenticated requests with 401");

    const resUnauthSubmit = await fetch(`${baseUrl}/applications/app-dummy/submit`, {
      method: "POST",
    });
    assert(resUnauthSubmit.status === 401, "POST /api/v1/applications/:id/submit rejects unauthenticated requests with 401");

    const resUnauthCancel = await fetch(`${baseUrl}/applications/app-dummy/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "No longer needed" }),
    });
    assert(resUnauthCancel.status === 401, "POST /api/v1/applications/:id/cancel rejects unauthenticated requests with 401");

    // ----------------------------------------------------
    // User Provisioning: Citizen A and Citizen B
    // ----------------------------------------------------
    const citizenAEmail = `citizen_app_a_${Date.now()}@test.gov.in`;
    const regARes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenAEmail,
        password: "PassAppTest123!",
        confirmPassword: "PassAppTest123!",
        displayName: "Aarav Sharma",
        phone: "+91 91111 22222",
        state: "Maharashtra",
        district: "Pune",
        termsAccepted: true,
      }),
    });
    const citizenACookie = (regARes.headers.get("set-cookie") || "").split(";")[0];
    const citizenAData = await regARes.json();
    const citizenAId = citizenAData.user?.id;

    const citizenBEmail = `citizen_app_b_${Date.now()}@test.gov.in`;
    const regBRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenBEmail,
        password: "PassAppTest123!",
        confirmPassword: "PassAppTest123!",
        displayName: "Bhavna Patel",
        phone: "+91 92222 33333",
        state: "Gujarat",
        district: "Ahmedabad",
        termsAccepted: true,
      }),
    });
    const citizenBCookie = (regBRes.headers.get("set-cookie") || "").split(";")[0];
    const citizenBData = await regBRes.json();
    const citizenBId = citizenBData.user?.id;

    // Deposit credentials for Citizen A
    const docAadhaarA = await documentService.depositDocument(citizenAId, {
      documentTypeId: "AADHAAR",
      title: "Aadhaar Card of Aarav",
      documentNumber: "XXXX-XXXX-9871",
      fileName: "aarav_aadhaar.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.4 simulated aadhaar payload for aarav"),
    });

    const docIncomeA = await documentService.depositDocument(citizenAId, {
      documentTypeId: "INCOME_CERT",
      title: "Tehsildar Income Certificate",
      documentNumber: "INC-2026-9812",
      fileName: "aarav_income.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.4 simulated income cert payload for aarav"),
    });

    const docMarksheetA = await documentService.depositDocument(citizenAId, {
      documentTypeId: "MARKSHEET",
      title: "Class 12th Secondary Marksheet",
      documentNumber: "HSC-2024-8712",
      fileName: "aarav_marksheet.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.4 simulated marksheet payload for aarav"),
    });

    // Deposit credential for Citizen B
    const docAadhaarB = await documentService.depositDocument(citizenBId, {
      documentTypeId: "AADHAAR",
      title: "Aadhaar Card of Bhavna",
      documentNumber: "XXXX-XXXX-4567",
      fileName: "bhavna_aadhaar.pdf",
      mimeType: "application/pdf",
      fileBuffer: Buffer.from("%PDF-1.4 simulated aadhaar payload for bhavna"),
    });

    // ----------------------------------------------------
    // TEST SUITE 2: Application Creation & Lifecycle Init
    // ----------------------------------------------------
    console.log("\n[Test Suite 2: Application Creation & Requirements Evaluation]");

    // 1. Validation: Missing serviceId
    const resBadCreate = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({}),
    });
    assert(resBadCreate.status === 400, "POST /applications without serviceId rejected with 400");

    // 2. Validation: Non-existent serviceId
    const resNotFoundService = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ serviceId: "serv-unknown-999" }),
    });
    assert(resNotFoundService.status === 404, "POST /applications with unknown serviceId rejected with 404");

    // 3. Create valid application for NSP without attached documents -> DOCUMENTS_REQUIRED
    const resCreateApp = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({
        serviceId: "serv-nsp",
        formData: {
          course: "B.Tech Computer Science",
          annualFamilyIncome: "180000",
          institutionName: "National Institute of Technology",
        },
      }),
    });
    const dataCreateApp = await resCreateApp.json();
    assert(resCreateApp.status === 201 && dataCreateApp.success, "Citizen A creates NSP application with 201 Created");
    const appA = dataCreateApp.application;
    assert(appA.status === "DOCUMENTS_REQUIRED", "Initial application status is DOCUMENTS_REQUIRED when missing credentials");
    assert(appA.applicationNumber.startsWith("UGOV-2026-NSP-"), "Application number follows deterministic UGOV-2026-NSP-XXXXXX format");
    assert(Array.isArray(appA.attachedDocumentIds) && appA.attachedDocumentIds.length === 0, "Initial application has 0 attached documents");

    // 4. List applications for Citizen A
    const resListA = await fetch(`${baseUrl}/applications`, {
      headers: { Cookie: citizenACookie },
    });
    const dataListA = await resListA.json();
    assert(resListA.status === 200 && dataListA.total >= 1, "GET /applications returns list of citizen's applications");
    assert(dataListA.applications.some((a: any) => a.id === appA.id), "Created application is present in citizen's list");
    assert(Boolean(dataListA.applications[0].service), "Application list includes embedded service metadata");

    // ----------------------------------------------------
    // TEST SUITE 3: Strict Ownership & IDOR Protection
    // ----------------------------------------------------
    console.log("\n[Test Suite 3: Strict Ownership & IDOR Protection]");

    // 1. Citizen A can view own application
    const resGetAppA = await fetch(`${baseUrl}/applications/${appA.id}`, {
      headers: { Cookie: citizenACookie },
    });
    assert(resGetAppA.status === 200, "Owner (Citizen A) can view own application");

    // 2. Citizen B cannot view Citizen A's application -> 403
    const resGetAppB = await fetch(`${baseUrl}/applications/${appA.id}`, {
      headers: { Cookie: citizenBCookie },
    });
    assert(resGetAppB.status === 403, "Citizen B cannot view Citizen A's application (403 Forbidden)");

    // 3. Citizen B cannot attach document to Citizen A's application -> 403
    const resAttachB = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenBCookie },
      body: JSON.stringify({ documentId: docAadhaarB.id }),
    });
    assert(resAttachB.status === 403, "Citizen B cannot attach document to Citizen A's application (403 Forbidden)");

    // 4. Citizen B cannot detach document from Citizen A's application -> 403
    const resDetachB = await fetch(`${baseUrl}/applications/${appA.id}/documents/${docAadhaarA.id}`, {
      method: "DELETE",
      headers: { Cookie: citizenBCookie },
    });
    assert(resDetachB.status === 403, "Citizen B cannot detach document from Citizen A's application (403 Forbidden)");

    // 5. Citizen B cannot review Citizen A's application -> 403
    const resReviewB = await fetch(`${baseUrl}/applications/${appA.id}/review`, {
      headers: { Cookie: citizenBCookie },
    });
    assert(resReviewB.status === 403, "Citizen B cannot access review/disclosures of Citizen A's application (403 Forbidden)");

    // 6. Citizen B cannot submit Citizen A's application -> 403
    const resSubmitB = await fetch(`${baseUrl}/applications/${appA.id}/submit`, {
      method: "POST",
      headers: { Cookie: citizenBCookie },
    });
    assert(resSubmitB.status === 403, "Citizen B cannot submit Citizen A's application (403 Forbidden)");

    // 7. Citizen B cannot cancel Citizen A's application -> 403
    const resCancelB = await fetch(`${baseUrl}/applications/${appA.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenBCookie },
      body: JSON.stringify({ reason: "Malicious cancellation attempt" }),
    });
    assert(resCancelB.status === 403, "Citizen B cannot cancel Citizen A's application (403 Forbidden)");

    // 8. 404 for non-existent application
    const resNotFoundApp = await fetch(`${baseUrl}/applications/app-does-not-exist`, {
      headers: { Cookie: citizenACookie },
    });
    assert(resNotFoundApp.status === 404, "Non-existent application ID returns 404 Not Found");

    // ----------------------------------------------------
    // TEST SUITE 4: Sovereign Document Selection & Readiness Machine
    // ----------------------------------------------------
    console.log("\n[Test Suite 4: Sovereign Document Selection & Readiness Machine]");

    // 1. Citizen A cannot attach Citizen B's document to Citizen A's application -> 403
    const resAttachForeignDoc = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ documentId: docAadhaarB.id }),
    });
    assert(resAttachForeignDoc.status === 403, "Citizen cannot attach credentials belonging to another citizen (403 Forbidden)");

    // 2. Citizen A cannot attach non-existent document -> 403
    const resAttachFakeDoc = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ documentId: "doc-nonexistent-123" }),
    });
    assert(resAttachFakeDoc.status === 403, "Cannot attach non-existent document ID (403 Forbidden)");

    // 3. Citizen A attaches Aadhaar -> 200, status remains DOCUMENTS_REQUIRED (still needs Income & Marksheet)
    const resAttachAadhaar = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ documentId: docAadhaarA.id }),
    });
    const dataAttachAadhaar = await resAttachAadhaar.json();
    assert(resAttachAadhaar.status === 200 && dataAttachAadhaar.success, "Citizen A attaches Aadhaar credential to application");
    assert(dataAttachAadhaar.application.status === "DOCUMENTS_REQUIRED", "Status remains DOCUMENTS_REQUIRED (2 prerequisites still missing)");

    // 4. Citizen A attaches Income Certificate -> 200, status remains DOCUMENTS_REQUIRED (still needs Marksheet)
    const resAttachIncome = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ documentId: docIncomeA.id }),
    });
    const dataAttachIncome = await resAttachIncome.json();
    assert(resAttachIncome.status === 200, "Citizen A attaches Income Certificate");
    assert(dataAttachIncome.application.status === "DOCUMENTS_REQUIRED", "Status remains DOCUMENTS_REQUIRED (1 prerequisite still missing)");

    // 5. Citizen A attaches Marksheet -> 200, all 3 prerequisites met -> Status transitions to READY!
    const resAttachMarksheet = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ documentId: docMarksheetA.id }),
    });
    const dataAttachMarksheet = await resAttachMarksheet.json();
    assert(resAttachMarksheet.status === 200, "Citizen A attaches Marksheet");
    assert(dataAttachMarksheet.application.status === "READY", "Application transitions to READY when all 3 prerequisites are satisfied");

    // 6. Citizen A detaches Marksheet -> Status drops back to DOCUMENTS_REQUIRED
    const resDetachMarksheet = await fetch(`${baseUrl}/applications/${appA.id}/documents/${docMarksheetA.id}`, {
      method: "DELETE",
      headers: { Cookie: citizenACookie },
    });
    const dataDetachMarksheet = await resDetachMarksheet.json();
    assert(resDetachMarksheet.status === 200, "Citizen A detaches Marksheet credential");
    assert(dataDetachMarksheet.application.status === "DOCUMENTS_REQUIRED", "Status transitions back to DOCUMENTS_REQUIRED upon credential removal");

    // 7. Citizen A re-attaches Marksheet -> Status returns to READY
    const resReattachMarksheet = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ documentId: docMarksheetA.id }),
    });
    const dataReattachMarksheet = await resReattachMarksheet.json();
    assert(dataReattachMarksheet.application.status === "READY", "Re-attaching Marksheet returns status to READY");

    // ----------------------------------------------------
    // TEST SUITE 5: Pre-Submission Review & Data Sharing Disclosures
    // ----------------------------------------------------
    console.log("\n[Test Suite 5: Pre-Submission Review & Data Sharing Disclosures]");

    const resReview = await fetch(`${baseUrl}/applications/${appA.id}/review`, {
      headers: { Cookie: citizenACookie },
    });
    const dataReview = await resReview.json();
    assert(resReview.status === 200 && dataReview.success, "GET /api/v1/applications/:id/review returns 200 OK");
    const review = dataReview.review;
    assert(review.requirements.satisfied === true, "Review confirms all mandatory requirements are satisfied");
    assert(review.requirements.attachedCount === 3, "Review reflects exactly 3 attached credentials");
    assert(review.dataSharingDisclosure.recipientEntity === "Department of Higher Education", "Disclosure identifies statutory recipient entity");
    assert(review.dataSharingDisclosure.validityDays === 30, "Disclosure specifies standard 30-day time-bound consent duration");
    assert(review.dataSharingDisclosure.documentsToShare.length === 3, "Disclosure enumerates exact documents to be shared with cryptographic hashes");

    // ----------------------------------------------------
    // TEST SUITE 6: U-CONSENT Grant & Submission Lifecycle
    // ----------------------------------------------------
    console.log("\n[Test Suite 6: U-CONSENT Grant & Application Submission]");

    // 1. Verify incomplete application cannot be submitted
    // Create an incomplete application to test submission blockage
    const resIncomplete = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ serviceId: "serv-nsp" }),
    });
    const dataIncomplete = await resIncomplete.json();
    const incompleteAppId = dataIncomplete.application.id;

    const resBlockSubmit = await fetch(`${baseUrl}/applications/${incompleteAppId}/submit`, {
      method: "POST",
      headers: { Cookie: citizenACookie },
    });
    assert(resBlockSubmit.status === 400, "Incomplete application submission rejected with 400 Bad Request");

    // 2. Submit READY application -> generates real U-CONSENT records and marks SUBMITTED
    const resSubmit = await fetch(`${baseUrl}/applications/${appA.id}/submit`, {
      method: "POST",
      headers: { Cookie: citizenACookie },
    });
    const dataSubmit = await resSubmit.json();
    assert(resSubmit.status === 200 && dataSubmit.success, "POST /api/v1/applications/:id/submit succeeds with 200 OK");
    assert(dataSubmit.consentsGrantedCount === 3, "Explicit U-CONSENT granted for all 3 attached credentials upon submission");
    assert(dataSubmit.application.status === "SUBMITTED", "Application status transitioned to SUBMITTED");
    assert(Boolean(dataSubmit.submission?.trackingToken), "Sandbox integration generated tracking token");
    assert(dataSubmit.submission.trackingToken.startsWith("SBX-ACK-NSP-"), "Tracking token format matches SBX-ACK-NSP-XXXX");

    // 3. Verify actual U-CONSENT records exist in database
    const consents = db.getConsentsByOwner(citizenAId);
    assert(consents.length >= 3, `Citizen has active U-CONSENT records (found ${consents.length})`);
    const appConsents = consents.filter((c) => dataSubmit.application.consentIds.includes(c.id));
    assert(appConsents.length === 3, "All 3 application consents exist in U-CONSENT storage");

    // 4. Cannot re-submit already SUBMITTED application -> 400
    const resResubmit = await fetch(`${baseUrl}/applications/${appA.id}/submit`, {
      method: "POST",
      headers: { Cookie: citizenACookie },
    });
    assert(resResubmit.status === 400, "Submitting already submitted application rejected with 400 Bad Request");

    // 5. Cannot modify documents on a SUBMITTED application
    const resPostSubmitAttach = await fetch(`${baseUrl}/applications/${appA.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ documentId: docAadhaarA.id }),
    });
    assert(resPostSubmitAttach.status === 400, "Cannot attach documents to a SUBMITTED application (400 Bad Request)");

    const resPostSubmitDetach = await fetch(`${baseUrl}/applications/${appA.id}/documents/${docAadhaarA.id}`, {
      method: "DELETE",
      headers: { Cookie: citizenACookie },
    });
    assert(resPostSubmitDetach.status === 400, "Cannot detach documents from a SUBMITTED application (400 Bad Request)");

    // ----------------------------------------------------
    // TEST SUITE 7: Application Cancellation
    // ----------------------------------------------------
    console.log("\n[Test Suite 7: Application Cancellation Lifecycle]");

    // 1. Citizen A creates a new draft application
    const resAppToCancel = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ serviceId: "serv-ayushman" }),
    });
    const dataAppToCancel = await resAppToCancel.json();
    const appToCancelId = dataAppToCancel.application.id;

    // 2. Citizen cancels the application with a reason
    const resCancel = await fetch(`${baseUrl}/applications/${appToCancelId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ reason: "Family income exceeded threshold" }),
    });
    const dataCancel = await resCancel.json();
    assert(resCancel.status === 200 && dataCancel.success, "Citizen can cancel application with 200 OK");
    assert(dataCancel.application.status === "CANCELLED", "Status updated to CANCELLED");
    assert(dataCancel.application.cancellationReason === "Family income exceeded threshold", "Cancellation reason recorded");

    // 3. Cannot cancel already CANCELLED application -> 400
    const resRecancel = await fetch(`${baseUrl}/applications/${appToCancelId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenACookie },
      body: JSON.stringify({ reason: "Attempting duplicate cancel" }),
    });
    assert(resRecancel.status === 400, "Cannot cancel an already CANCELLED application (400 Bad Request)");

    // ----------------------------------------------------
    // TEST SUITE 8: Cryptographic U-AUDIT Hash-Chain Integrity
    // ----------------------------------------------------
    console.log("\n[Test Suite 8: Cryptographic U-AUDIT Hash-Chain Verification]");

    const personalEvents = db.getAuditEvents(300).filter((e) => e.actorId === citizenAId);

    const hasCreated = personalEvents.some((e) => e.action === "APPLICATION_CREATED");
    assert(hasCreated, "APPLICATION_CREATED audit event successfully recorded");

    const hasAttached = personalEvents.some((e) => e.action === "APPLICATION_DOCUMENT_ATTACHED");
    assert(hasAttached, "APPLICATION_DOCUMENT_ATTACHED audit event successfully recorded");

    const hasRemoved = personalEvents.some((e) => e.action === "APPLICATION_DOCUMENT_REMOVED");
    assert(hasRemoved, "APPLICATION_DOCUMENT_REMOVED audit event successfully recorded");

    const hasReady = personalEvents.some((e) => e.action === "APPLICATION_READY");
    assert(hasReady, "APPLICATION_READY audit event successfully recorded");

    const hasConsentReq = personalEvents.some((e) => e.action === "APPLICATION_CONSENT_REQUESTED");
    assert(hasConsentReq, "APPLICATION_CONSENT_REQUESTED audit event successfully recorded");

    const hasConsentGranted = personalEvents.some((e) => e.action === "APPLICATION_CONSENT_GRANTED");
    assert(hasConsentGranted, "APPLICATION_CONSENT_GRANTED audit event successfully recorded");

    const hasSubmitted = personalEvents.some((e) => e.action === "APPLICATION_SUBMITTED");
    assert(hasSubmitted, "APPLICATION_SUBMITTED audit event successfully recorded");

    const hasCancelled = personalEvents.some((e) => e.action === "APPLICATION_CANCELLED");
    assert(hasCancelled, "APPLICATION_CANCELLED audit event successfully recorded");

    // Verify unbroken SHA-256 hash-chain integrity
    const verifyAuditRes = await fetch(`${baseUrl}/auth/audit/verify`, {
      headers: { Cookie: citizenACookie },
    });
    const auditVerifyData = await verifyAuditRes.json();
    assert(Boolean(auditVerifyData.success && auditVerifyData.verification?.valid), "Entire U-AUDIT SHA-256 hash-chain remains cryptographically valid");
    assert(auditVerifyData.verification?.algorithm === "SHA-256 Hash-Chained Append-Only Ledger", "Audit ledger algorithm confirms SHA-256 Hash-Chained Append-Only Ledger");

  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`U-APPLICATIONS Test Results: ${passed} Passed | ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runApplicationsTests().catch((err) => {
  console.error("Fatal error during applications test run:", err);
  process.exit(1);
});
