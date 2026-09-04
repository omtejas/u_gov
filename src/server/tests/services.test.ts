import express from "express";
import http from "http";
import crypto from "crypto";
import { authenticate } from "../middleware/auth";
import { authRouter } from "../routes/auth";
import { documentsRouter } from "../routes/documents";
import { servicesRouter } from "../routes/services";
import { db } from "../database/db";

async function runServicesTests() {
  console.log("\n==================================================");
  console.log("🏛️  U-SERVICES CATALOGUE & REQUIREMENT ENGINE TESTS");
  console.log("==================================================\n");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(authenticate as any);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/documents", documentsRouter);
  app.use("/api/v1/services", servicesRouter);

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
    // TEST SUITE 1: Service Catalogue Discovery & Searching
    // ----------------------------------------------------
    console.log("[Test Suite 1: Public Service Catalogue Discovery]");

    // 1. List all services
    const resAll = await fetch(`${baseUrl}/services`);
    const dataAll = await resAll.json();
    assert(resAll.status === 200 && dataAll.success, "GET /api/v1/services returns 200 Success");
    assert(Array.isArray(dataAll.services) && dataAll.services.length >= 5, `Catalogue returns seeded national services (found ${dataAll.services.length})`);

    // 2. Filter by category: Education
    const resEdu = await fetch(`${baseUrl}/services?category=education`);
    const dataEdu = await resEdu.json();
    assert(dataEdu.success && dataEdu.services.every((s: any) => s.category === "education"), "Category filter '?category=education' returns only education services");
    assert(dataEdu.services.some((s: any) => s.serviceCode === "NSP"), "National Scholarship Portal is listed under education");

    // 3. Filter by category: Transport
    const resTrans = await fetch(`${baseUrl}/services?category=transport`);
    const dataTrans = await resTrans.json();
    assert(dataTrans.success && dataTrans.services.some((s: any) => s.serviceCode === "SARATHI-DL"), "Sarathi Driving Licence is listed under transport");

    // 4. Keyword text search
    const resSearch = await fetch(`${baseUrl}/services?q=scholarship`);
    const dataSearch = await resSearch.json();
    assert(dataSearch.success && dataSearch.services.length >= 1, "Keyword search '?q=scholarship' returns relevant results");
    assert(dataSearch.services[0].serviceCode === "NSP", "Top search result for 'scholarship' matches NSP");

    // 5. Category aggregation statistics
    const resCats = await fetch(`${baseUrl}/services/categories`);
    const dataCats = await resCats.json();
    assert(resCats.status === 200 && dataCats.success, "GET /api/v1/services/categories returns 200");
    assert(Array.isArray(dataCats.categories) && dataCats.categories.length >= 4, "Category breakdown includes education, transport, revenue, agriculture");

    // 6. Retrieve service by ID
    const resSingle = await fetch(`${baseUrl}/services/serv-nsp`);
    const dataSingle = await resSingle.json();
    assert(resSingle.status === 200 && dataSingle.success, "GET /api/v1/services/serv-nsp returns 200");
    assert(dataSingle.service.name.includes("National Scholarship"), "Service specification contains correct display name");
    assert(Array.isArray(dataSingle.service.requiredDocumentTypeIds), "Service specification defines required document type IDs");

    // 7. Retrieve service by short code
    const resByCode = await fetch(`${baseUrl}/services/SARATHI-DL`);
    const dataByCode = await resByCode.json();
    assert(resByCode.status === 200 && dataByCode.service.id === "serv-parivahan", "Lookup by short code /services/SARATHI-DL resolves to serv-parivahan");

    // 8. 404 for non-existent service
    const resNotFound = await fetch(`${baseUrl}/services/serv-does-not-exist`);
    assert(resNotFound.status === 404, "Non-existent service ID returns 404 Not Found");

    // ----------------------------------------------------
    // TEST SUITE 2: Service Requirement Engine (with U-DOCS Vault)
    // ----------------------------------------------------
    console.log("\n[Test Suite 2: Service Requirement Engine & Vault Prerequisite Matching]");

    // 1. Unauthenticated requirement check -> 401
    const resUnauthReq = await fetch(`${baseUrl}/services/serv-parivahan/requirements`);
    assert(resUnauthReq.status === 401, "Unauthenticated /requirements check rejected with 401");

    // 2. Register Citizen for requirement testing
    const citizenEmail = `citizen_services_${Date.now()}@test.gov.in`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenEmail,
        password: "StrongPassSvc123!",
        confirmPassword: "StrongPassSvc123!",
        displayName: "Sushant V. Patil",
        phone: "+91 94444 55555",
        state: "Maharashtra",
        district: "Kolhapur",
        termsAccepted: true,
      }),
    });
    const cookieHeader = regRes.headers.get("set-cookie") || "";
    const citizenCookie = cookieHeader.split(";")[0];
    const citizenData = await regRes.json();
    const citizenId = citizenData.user?.id;

    // 3. Initially, new citizen has empty vault -> 0 requirements satisfied for Sarathi-DL (requires AADHAAR + DOMICILE)
    const resReqEmpty = await fetch(`${baseUrl}/services/serv-parivahan/requirements`, {
      headers: { Cookie: citizenCookie },
    });
    const dataReqEmpty = await resReqEmpty.json();
    assert(resReqEmpty.status === 200 && dataReqEmpty.success, "Requirement evaluation returns 200 OK");
    const evalEmpty = dataReqEmpty.evaluation;
    assert(evalEmpty.totalRequired === 2, "Sarathi-DL requires exactly 2 prerequisite credentials");
    assert(evalEmpty.satisfiedCount === 0, "Empty vault starts with 0 satisfied requirements");
    assert(evalEmpty.missingCount === 2, "2 requirements are missing in vault");
    assert(evalEmpty.isApplicationReady === false, "Application readiness evaluates to false when prerequisites are missing");
    assert(evalEmpty.readinessPercentage === 0, "Readiness percentage is 0%");

    // 4. Citizen deposits Aadhaar card to private vault
    const aadhaarBuffer = Buffer.from("%PDF-1.4 Official Aadhaar Credential for Requirement Engine Test");
    const aadhaarBase64 = aadhaarBuffer.toString("base64");
    const depositAadhaarRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        title: "Aadhaar Card",
        documentTypeId: "AADHAAR",
        documentNumber: "4455-6677-8899",
        fileName: "my_aadhaar.pdf",
        mimeType: "application/pdf",
        fileData: aadhaarBase64,
      }),
    });
    assert(depositAadhaarRes.status === 201, "Citizen successfully deposits Aadhaar card to private vault");

    // 5. Re-evaluate requirements for Sarathi-DL -> now 1 of 2 satisfied (50%)
    const resReqPartial = await fetch(`${baseUrl}/services/serv-parivahan/requirements`, {
      headers: { Cookie: citizenCookie },
    });
    const dataReqPartial = await resReqPartial.json();
    const evalPartial = dataReqPartial.evaluation;
    assert(evalPartial.satisfiedCount === 1, "After deposit, exactly 1 requirement (Aadhaar) is satisfied");
    assert(evalPartial.missingCount === 1, "1 requirement (Domicile) remains missing");
    assert(evalPartial.readinessPercentage === 50, "Readiness percentage dynamically recalculates to 50%");
    assert(evalPartial.isApplicationReady === false, "Application is not yet ready (1 requirement pending)");

    // Verify matched item details
    const aadhaarReqItem = evalPartial.requirements.find((r: any) => r.documentTypeId === "AADHAAR");
    assert(aadhaarReqItem && aadhaarReqItem.satisfied === true, "Aadhaar requirement marked satisfied");
    assert(Boolean(aadhaarReqItem.matchedDocument?.sha256Checksum), "Matched document includes cryptographic SHA-256 checksum from vault");

    const domicileReqItem = evalPartial.requirements.find((r: any) => r.documentTypeId === "DOMICILE");
    assert(domicileReqItem && domicileReqItem.satisfied === false, "Domicile requirement accurately marked not satisfied");

    // 6. Citizen deposits missing Domicile Certificate
    const domicileBuffer = Buffer.from("%PDF-1.4 Official Maharashtra State Domicile Certificate Test");
    const domicileBase64 = domicileBuffer.toString("base64");
    const depositDomRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        title: "State Domicile Certificate",
        documentTypeId: "DOMICILE",
        documentNumber: "DOM-2026-99120",
        fileName: "domicile_certificate.pdf",
        mimeType: "application/pdf",
        fileData: domicileBase64,
      }),
    });
    assert(depositDomRes.status === 201, "Citizen successfully deposits Domicile Certificate");

    // 7. Re-evaluate requirements -> 100% satisfied (2 of 2 ready!)
    const resReqFull = await fetch(`${baseUrl}/services/serv-parivahan/requirements`, {
      headers: { Cookie: citizenCookie },
    });
    const dataReqFull = await resReqFull.json();
    const evalFull = dataReqFull.evaluation;
    assert(evalFull.satisfiedCount === 2, "All 2 requirements satisfied");
    assert(evalFull.missingCount === 0, "0 missing requirements");
    assert(evalFull.readinessPercentage === 100, "Readiness percentage reaches 100%");
    assert(evalFull.isApplicationReady === true, "Application readiness evaluates to TRUE: Citizen is ready to apply!");

    // ----------------------------------------------------
    // TEST SUITE 3: Cryptographic U-AUDIT Event Logging
    // ----------------------------------------------------
    console.log("\n[Test Suite 3: Cryptographic U-AUDIT Event Logging]");

    const personalEvents = db.getAuditEvents(200).filter((e) => e.actorId === citizenId);
    const reqAuditEvents = personalEvents.filter((e) => e.action === "SERVICE_REQUIREMENTS_CHECKED");
    assert(reqAuditEvents.length >= 2, "SERVICE_REQUIREMENTS_CHECKED events recorded in citizen's personal audit trail");

    // Verify unbroken Merkle hash chain
    const verifyAuditRes = await fetch(`${baseUrl}/auth/audit/verify`, {
      headers: { Cookie: citizenCookie },
    });
    const auditVerifyData = await verifyAuditRes.json();
    assert(Boolean(auditVerifyData.success && auditVerifyData.verification?.valid), "Entire U-AUDIT SHA-256 hash-chain remains mathematically valid");

  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`U-SERVICES Test Results: ${passed} Passed | ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runServicesTests().catch((err) => {
  console.error("Fatal error during services test run:", err);
  process.exit(1);
});
