import express from "express";
import http from "http";
import crypto from "crypto";
import { authenticate } from "../middleware/auth";
import { authRouter } from "../routes/auth";
import { documentsRouter } from "../routes/documents";
import { servicesRouter } from "../routes/services";
import { applicationsRouter } from "../routes/applications";
import { integrationsRouter } from "../routes/integrations";
import { aiRouter } from "../routes/ai";
import { aiFactory, MockAIProvider, AIToolGateway } from "../ai";
import { db } from "../database/db";

async function runAITests() {
  console.log("\n==================================================");
  console.log("🤖  U-AI SECURE ASSISTANCE & INTELLIGENCE TESTS");
  console.log("==================================================\n");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(authenticate as any);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/documents", documentsRouter);
  app.use("/api/v1/services", servicesRouter);
  app.use("/api/v1/applications", applicationsRouter);
  app.use("/api/v1/integrations", integrationsRouter);
  app.use("/api/v1/ai", aiRouter);

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
    // Force MockAIProvider for deterministic local testing
    aiFactory.setAIProvider(new MockAIProvider());

    // ----------------------------------------------------
    // TEST SUITE 1: AI Health & Unauthenticated Gate
    // ----------------------------------------------------
    console.log("[Test Suite 1: AI Health & Unauthenticated Gate]");

    // 1. Health Telemetry
    const healthRes = await fetch(`${baseUrl}/ai/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, "GET /api/v1/ai/health returns 200 OK");
    assert(healthData.status === "HEALTHY", "Health status is HEALTHY");
    assert(healthData.mode === "SOVEREIGN_GROUNDED_ASSISTANT", "Mode indicates SOVEREIGN_GROUNDED_ASSISTANT");
    assert(healthData.provider === "MockAIProvider", "Active provider is MockAIProvider");

    // 2. Unauthenticated chat call must be blocked
    const unauthRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What schemes am I eligible for?" }),
    });
    assert(unauthRes.status === 401, "POST /api/v1/ai/chat rejects unauthenticated requests with 401");
    const unauthData = await unauthRes.json();
    assert(unauthData.error === "Authentication required", "Unauthenticated response indicates Authentication required");

    // ----------------------------------------------------
    // SETUP: Register Citizen A and Citizen B
    // ----------------------------------------------------
    const citizenAEmail = `citizen_ai_a_${Date.now()}@example.gov.in`;
    const regResA = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenAEmail,
        password: "SovereignPassword@2026",
        confirmPassword: "SovereignPassword@2026",
        displayName: "Aarav Sharma",
        termsAccepted: true,
      }),
    });
    const regDataA = await regResA.json();
    const cookieA = regResA.headers.get("set-cookie")?.split(";")[0] || "";
    const citizenAId = regDataA.user?.id;

    const citizenBEmail = `citizen_ai_b_${Date.now()}@example.gov.in`;
    const regResB = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenBEmail,
        password: "SovereignPassword@2026",
        confirmPassword: "SovereignPassword@2026",
        displayName: "Priya Patel",
        termsAccepted: true,
      }),
    });
    const regDataB = await regResB.json();
    const cookieB = regResB.headers.get("set-cookie")?.split(";")[0] || "";
    const citizenBId = regDataB.user?.id;

    // ----------------------------------------------------
    // TEST SUITE 2: Input Validation & Payload Safeguards
    // ----------------------------------------------------
    console.log("\n[Test Suite 2: Input Validation & Payload Safeguards]");

    // Empty message
    const emptyRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "" }),
    });
    assert(emptyRes.status === 400, "Rejects empty message with 400 Bad Request");

    // Whitespace message
    const wsRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "    " }),
    });
    assert(wsRes.status === 400, "Rejects whitespace-only message with 400 Bad Request");

    // Missing message property
    const missingRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({}),
    });
    assert(missingRes.status === 400, "Rejects missing message property with 400 Bad Request");

    // Oversized message (> 1000 chars)
    const longMessage = "A".repeat(1001);
    const longRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: longMessage }),
    });
    assert(longRes.status === 400, "Rejects oversized message (>1000 chars) with 400 Bad Request");

    // Oversized conversation history (> 20 items)
    const longHistory = Array(25).fill({ role: "user", text: "Hello" });
    const historyRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "Hello", conversationHistory: longHistory }),
    });
    assert(historyRes.status === 400, "Rejects oversized conversation history (>20 items) with 400 Bad Request");

    // ----------------------------------------------------
    // TEST SUITE 3: Provider Abstraction & Grounded Responses
    // ----------------------------------------------------
    console.log("\n[Test Suite 3: Provider Abstraction & Grounded Responses]");

    const validChatRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "Hello Bharat G-Bot" }),
    });
    assert(validChatRes.status === 200, "Valid message succeeds with 200 OK");
    const validChatData = await validChatRes.json();
    assert(validChatData.success === true, "Response reports success: true");
    assert(typeof validChatData.reply === "string" && validChatData.reply.length > 20, "Response contains non-empty reply text");
    assert(validChatData.source.includes("MockAIProvider"), "Response source identifies MockAIProvider");
    assert(
      validChatData.disclaimer === "AI-generated guidance. Verify important information before submission.",
      "Response attaches official legal AI disclaimer"
    );
    assert(Array.isArray(validChatData.suggestions) && validChatData.suggestions.length > 0, "Response includes suggestions array");

    // ----------------------------------------------------
    // TEST SUITE 4: Controlled Tool Gateway Service Discovery
    // ----------------------------------------------------
    console.log("\n[Test Suite 4: Controlled Tool Gateway Service Discovery]");

    // Query scholarship
    const scholarRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "I want to apply for a scholarship" }),
    });
    const scholarData = await scholarRes.json();
    assert(scholarRes.status === 200, "Scholarship inquiry succeeds with 200 OK");
    assert(scholarData.reply.includes("National Scholarship Portal"), "Grounded in National Scholarship Portal (NSP)");
    assert(scholarData.reply.includes("Ministry of Education"), "Accurately references Ministry of Education");
    assert(scholarData.reply.includes("21 working days"), "Cites statutory 21-day SLA");
    assert(scholarData.source.includes("U-SERVICES National Catalogue"), "Source identifies U-SERVICES National Catalogue");

    // Query driving licence
    const dlRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "What documents for driving licence?" }),
    });
    const dlData = await dlRes.json();
    assert(dlRes.status === 200, "Driving licence inquiry succeeds with 200 OK");
    assert(dlData.reply.includes("Driving Licence Renewal"), "Grounded in Driving Licence Renewal (SARATHI-DL)");
    assert(dlData.reply.includes("Sarathi MoRTH"), "Accurately references Sarathi MoRTH");

    // Query domicile certificate
    const domRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "Tell me about domicile certificate" }),
    });
    const domData = await domRes.json();
    assert(domRes.status === 200, "Domicile inquiry succeeds with 200 OK");
    assert(domData.reply.includes("State Domicile"), "Grounded in State Domicile Certificate");

    // Generic search query
    const searchRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "Show me education services" }),
    });
    const searchData = await searchRes.json();
    assert(searchRes.status === 200, "Education search query succeeds with 200 OK");
    assert(searchData.reply.includes("Matched Government Services"), "Returns matched services from catalogue");

    // ----------------------------------------------------
    // TEST SUITE 5: Citizen-Scoped Vault Readiness Tool
    // ----------------------------------------------------
    console.log("\n[Test Suite 5: Citizen-Scoped Vault Readiness Tool]");

    // Citizen A has empty vault initially
    const readinessEmptyRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "Check my document readiness for scholarship" }),
    });
    const readinessEmptyData = await readinessEmptyRes.json();
    assert(readinessEmptyRes.status === 200, "Readiness query succeeds with 200 OK");
    assert(readinessEmptyData.reply.includes("Sovereign Vault Readiness"), "Response evaluates Sovereign Vault Readiness");
    assert(readinessEmptyData.reply.includes("Readiness Score**: **0%**"), "Accurately computes 0% readiness for empty vault");
    assert(readinessEmptyData.reply.includes("NO — Action required"), "Indicates action required");
    assert(readinessEmptyData.source.includes("U-DOCS Requirement Evaluator"), "Source indicates U-DOCS Requirement Evaluator");

    // Add Aadhaar document to Citizen A vault
    const aadhaarBuffer = Buffer.from("%PDF-1.4 Mock Aadhaar Document Payload for AI Testing");
    const docRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        documentTypeId: "AADHAAR",
        documentNumber: "9988-7766-5544",
        title: "Aadhaar Card",
        fileName: "aadhaar.pdf",
        mimeType: "application/pdf",
        fileData: aadhaarBuffer.toString("base64"),
      }),
    });
    assert(docRes.status === 201, "Uploaded Aadhaar to Citizen A vault");

    // Re-check readiness: now 1 of 3 (33%)
    const readinessPartialRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "What documents am I missing for scholarship?" }),
    });
    const readinessPartialData = await readinessPartialRes.json();
    assert(readinessPartialRes.status === 200, "Second readiness query succeeds with 200 OK");
    assert(readinessPartialData.reply.includes("Readiness Score**: **33%**"), "Accurately computes updated 33% readiness");
    assert(readinessPartialData.reply.includes("Aadhaar Identity Document** (Verified in Vault)"), "Lists Aadhaar as verified");
    assert(readinessPartialData.reply.includes("Annual Income Certificate"), "Identifies Income Certificate as missing");
    assert(readinessPartialData.reply.includes("Secondary School Marksheet"), "Identifies Marksheet as missing");

    // Privacy assertion: No raw filesystem paths or vault hashes exposed
    assert(!readinessPartialData.reply.includes("c:\\") && !readinessPartialData.reply.includes("/vault/"), "Zero raw filesystem paths leaked");

    // ----------------------------------------------------
    // TEST SUITE 6: Citizen-Scoped Application Status & IDOR Defense
    // ----------------------------------------------------
    console.log("\n[Test Suite 6: Citizen-Scoped Application Status & IDOR Defense]");

    // Query when Citizen A has no applications
    const noAppRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: "Where is my application?" }),
    });
    const noAppData = await noAppRes.json();
    assert(noAppRes.status === 200, "Empty application query returns 200 OK");
    assert(noAppData.reply.includes("No matching application found"), "Informs citizen that no matching records exist");

    // Create an application for Citizen A
    const appCreateRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ serviceId: "serv-nsp" }),
    });
    const appCreateData = await appCreateRes.json();
    assert(appCreateRes.status === 201, "Created application for Citizen A");
    const appAId = appCreateData.application.id;
    const appANumber = appCreateData.application.applicationNumber;

    // Citizen A asks for status using application number
    const appStatusRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ message: `Check status of application ${appANumber}` }),
    });
    const appStatusData = await appStatusRes.json();
    assert(appStatusRes.status === 200, "Citizen A checks own application status (200 OK)");
    assert(appStatusData.reply.includes(appANumber), "Response includes correct application number");
    assert(appStatusData.reply.includes("`DOCUMENTS_REQUIRED`"), "Reflects current DOCUMENTS_REQUIRED state");
    assert(appStatusData.source.includes("Application Tracking Engine"), "Identifies Application Tracking Engine source");

    // IDOR TEST: Citizen B attempts to query Citizen A's application number via AI
    const idorAiRes = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieB },
      body: JSON.stringify({ message: `Check status of application ${appANumber}` }),
    });
    const idorAiData = await idorAiRes.json();
    assert(idorAiRes.status === 200, "IDOR inquiry handled safely without server crash (200 OK)");
    assert(
      idorAiData.reply.includes("do not have permission") || idorAiData.reply.includes("not found"),
      "AI refuses to reveal Citizen A's application details to Citizen B (IDOR blocked)"
    );
    assert(!idorAiData.reply.includes("Aarav Sharma"), "Citizen A's identity is not leaked to Citizen B");

    // ----------------------------------------------------
    // TEST SUITE 7: Terminology Explainer Endpoint
    // ----------------------------------------------------
    console.log("\n[Test Suite 7: Terminology Explainer Endpoint]");

    // 1. Explain domicile
    const expDomRes = await fetch(`${baseUrl}/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "domicile" }),
    });
    assert(expDomRes.status === 200, "POST /api/v1/ai/explain for 'domicile' returns 200 OK");
    const expDomData = await expDomRes.json();
    assert(expDomData.success === true, "Explain response indicates success: true");
    assert(expDomData.explanation.simpleExplanation.includes("continuously"), "Explains continuous residence");
    assert(expDomData.explanation.issuingAuthority.includes("Tehsildar"), "Specifies Tehsildar issuing authority");

    // 2. Explain non-creamy layer
    const expNclRes = await fetch(`${baseUrl}/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "non-creamy layer" }),
    });
    assert(expNclRes.status === 200, "POST /api/v1/ai/explain for 'non-creamy layer' returns 200 OK");
    const expNclData = await expNclRes.json();
    assert(expNclData.explanation.simpleExplanation.includes("₹8 Lakh"), "Cites ₹8 Lakh income threshold");

    // 3. Explain mutation
    const expMutRes = await fetch(`${baseUrl}/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "mutation" }),
    });
    assert(expMutRes.status === 200, "POST /api/v1/ai/explain for 'mutation' returns 200 OK");
    const expMutData = await expMutRes.json();
    assert(expMutData.explanation.simpleExplanation.includes("transfer of ownership"), "Explains transfer of ownership");

    // 4. Invalid term validation
    const invalidTermRes = await fetch(`${baseUrl}/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "" }),
    });
    assert(invalidTermRes.status === 400, "Rejects empty term with 400 Bad Request");

    const longTermRes = await fetch(`${baseUrl}/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: "X".repeat(101) }),
    });
    assert(longTermRes.status === 400, "Rejects term > 100 chars with 400 Bad Request");

    // ----------------------------------------------------
    // TEST SUITE 8: Cryptographic U-AUDIT Integration
    // ----------------------------------------------------
    console.log("\n[Test Suite 8: Cryptographic U-AUDIT Integration]");

    const verifyAuditRes = await fetch(`${baseUrl}/auth/audit/verify`, {
      headers: { Cookie: cookieA },
    });
    assert(verifyAuditRes.status === 200, "GET /api/v1/auth/audit/verify returns 200 OK");
    const verifyAuditData = await verifyAuditRes.json();
    assert(verifyAuditData.verification?.valid === true, "Entire U-AUDIT ledger remains cryptographically unbroken");
    assert(
      verifyAuditData.verification?.algorithm === "SHA-256 Hash-Chained Append-Only Ledger",
      "Audit algorithm conforms to official SHA-256 Hash-Chained Append-Only Ledger designation"
    );

    // Verify AI audit events were written
    const events = db.getAuditEvents(500);
    const querySubmitted = events.find((e) => e.action === "AI_QUERY_SUBMITTED");
    const toolCalled = events.find((e) => e.action === "AI_TOOL_CALLED");
    const respGenerated = events.find((e) => e.action === "AI_RESPONSE_GENERATED");
    const idorBlocked = events.find((e) => e.action === "AI_TOOL_DENIED");

    assert(Boolean(querySubmitted), "AI_QUERY_SUBMITTED audit event recorded in ledger");
    assert(Boolean(toolCalled), "AI_TOOL_CALLED audit event recorded in ledger");
    assert(Boolean(respGenerated), "AI_RESPONSE_GENERATED audit event recorded in ledger");
    assert(Boolean(idorBlocked), "AI_TOOL_DENIED audit event recorded for IDOR attempt");

    // ----------------------------------------------------
    // TEST SUITE 9: Privacy & Secret Leakage Prevention
    // ----------------------------------------------------
    console.log("\n[Test Suite 9: Privacy & Secret Leakage Prevention]");

    // Verify no secrets or passwords in AI audit events
    let secretsFound = false;
    for (const ev of events.filter((e) => e.action.startsWith("AI_"))) {
      if (
        ev.context.includes("password") ||
        ev.context.includes("ugov_session") ||
        ev.context.includes("tokenHash") ||
        ev.context.includes("GEMINI_API_KEY")
      ) {
        secretsFound = true;
      }
    }
    assert(!secretsFound, "Zero credentials, session hashes, or API keys found in AI audit contexts");

    // Verify AI cannot autonomously submit an application
    const appAAfter = db.findApplicationById(appAId);
    assert(appAAfter?.status === "DOCUMENTS_REQUIRED", "Application state remained unchanged (AI cannot autonomously submit)");

  } catch (err: any) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("\n==================================================");
    console.log(`U-AI Test Results: ${passed} Passed | ${failed} Failed`);
    console.log("==================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runAITests();
