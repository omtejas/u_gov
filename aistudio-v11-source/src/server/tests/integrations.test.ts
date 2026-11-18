import express from "express";
import http from "http";
import crypto from "crypto";
import { authenticate } from "../middleware/auth";
import { authRouter } from "../routes/auth";
import { documentsRouter } from "../routes/documents";
import { servicesRouter } from "../routes/services";
import { applicationsRouter } from "../routes/applications";
import { integrationsRouter } from "../routes/integrations";
import {
  integrationRegistry,
  SandboxIntegrationAdapter,
  ReliabilityEngine,
  OutboundDestinationBoundary,
  IntegrationError,
} from "../integrations";
import { db } from "../database/db";

async function runIntegrationsTests() {
  console.log("\n==================================================");
  console.log("🌐  U-INTEGRATIONS SECURE ADAPTER & RELIABILITY TESTS");
  console.log("==================================================\n");

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(authenticate as any);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/documents", documentsRouter);
  app.use("/api/v1/services", servicesRouter);
  app.use("/api/v1/applications", applicationsRouter);
  app.use("/api/v1/integrations", integrationsRouter);

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
    // TEST SUITE 1: Provider Registry & Capability Discovery
    // ----------------------------------------------------
    console.log("[Test Suite 1: Provider Registry & Capability Discovery]");

    const providers = integrationRegistry.listProviders();
    assert(providers.length >= 4, "Registry initializes at least 4 standard sandbox adapters");

    const nspProvider = providers.find((p) => p.providerCode === "SANDBOX_NSP");
    assert(!!nspProvider, "Registry contains SANDBOX_NSP provider");
    assert(nspProvider?.environment === "SANDBOX", "SANDBOX_NSP environment is marked SANDBOX");
    assert(nspProvider?.capabilities.canSubmit === true, "SANDBOX_NSP declares submit capability");
    assert(nspProvider?.capabilities.canPollStatus === true, "SANDBOX_NSP declares status polling capability");
    assert(nspProvider?.capabilities.canCancel === true, "SANDBOX_NSP declares cancellation capability");

    const nspAdapter = integrationRegistry.getAdapterForService("NSP");
    assert(nspAdapter.getProviderInfo().providerCode === "SANDBOX_NSP", "Resolves SANDBOX_NSP for serviceCode 'NSP'");

    const sarathiAdapter = integrationRegistry.getAdapterForService("SARATHI-DL");
    assert(sarathiAdapter.getProviderInfo().providerCode === "SANDBOX_SARATHI", "Resolves SANDBOX_SARATHI for serviceCode 'SARATHI-DL'");

    const mahadbtAdapter = integrationRegistry.getAdapterForService("DOMICILE-CERT");
    assert(mahadbtAdapter.getProviderInfo().providerCode === "SANDBOX_MAHADBT", "Resolves SANDBOX_MAHADBT for serviceCode 'DOMICILE-CERT'");

    const defaultAdapter = integrationRegistry.getAdapterForService("UNKNOWN-SERVICE-CODE");
    assert(defaultAdapter.getProviderInfo().providerCode === "SANDBOX_DEFAULT", "Falls back to SANDBOX_DEFAULT for unknown service code");

    // ----------------------------------------------------
    // TEST SUITE 2: Outbound Boundary & SSRF Protection
    // ----------------------------------------------------
    console.log("\n[Test Suite 2: Outbound Boundary & SSRF Protection]");

    assert(
      OutboundDestinationBoundary.validateDestination("mock://bharat-bus.internal/nsp", true) === true,
      "Permits approved internal mock destination"
    );
    assert(
      OutboundDestinationBoundary.validateDestination("https://evil.com/api", true) === false,
      "Rejects arbitrary external HTTPS URL in sandbox"
    );
    assert(
      OutboundDestinationBoundary.validateDestination("http://127.0.0.1:8080", false) === false,
      "Blocks SSRF attempt to 127.0.0.1"
    );
    assert(
      OutboundDestinationBoundary.validateDestination("http://169.254.169.254/latest/meta-data", false) === false,
      "Blocks SSRF attempt to cloud metadata IP 169.254.169.254"
    );
    assert(
      OutboundDestinationBoundary.validateDestination("file:///etc/passwd", false) === false,
      "Blocks file:// URL scheme"
    );

    // ----------------------------------------------------
    // TEST SUITE 3: Reliability Engine (Idempotency, Timeouts & Retries)
    // ----------------------------------------------------
    console.log("\n[Test Suite 3: Reliability Engine (Idempotency, Timeouts & Retries)]");

    ReliabilityEngine.clearIdempotency();
    const testKey = "test-idempotency-key-01";
    assert(ReliabilityEngine.checkIdempotency(testKey) === null, "Idempotency key initially absent");

    const mockResponse: any = {
      success: true,
      providerCode: "SANDBOX_NSP",
      trackingToken: "SBX-ACK-TEST-01",
      status: "SUBMITTED",
      submittedAt: new Date().toISOString(),
    };
    ReliabilityEngine.recordIdempotency(testKey, mockResponse);
    assert(ReliabilityEngine.checkIdempotency(testKey)?.trackingToken === "SBX-ACK-TEST-01", "Idempotency record cached successfully");

    // Timeout Verification
    let timeoutCaught = false;
    try {
      await ReliabilityEngine.withTimeout(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return "too-late";
        },
        50,
        "SANDBOX_TEST",
        "UGOV-INT-TIMEOUT-TEST"
      );
    } catch (err: any) {
      if (err instanceof IntegrationError && err.code === "INTEGRATION_TIMEOUT") {
        timeoutCaught = true;
      }
    }
    assert(timeoutCaught, "ReliabilityEngine.withTimeout aborts with INTEGRATION_TIMEOUT when duration exceeded");

    // Retry Verification with Transient Error
    let attemptCount = 0;
    const retryResult = await ReliabilityEngine.withRetry(
      async (attempt) => {
        attemptCount = attempt;
        if (attempt < 2) {
          throw new IntegrationError("Transient network blip", "INTEGRATION_TIMEOUT", "SANDBOX_TEST", "UGOV-INT-RETRY", 504, true);
        }
        return "success-after-retry";
      },
      "SANDBOX_TEST",
      "UGOV-INT-RETRY",
      { maxRetries: 3, initialDelayMs: 20 }
    );
    assert(retryResult.attempts === 2, "ReliabilityEngine retries transient errors (succeeded on attempt 2)");
    assert(retryResult.result === "success-after-retry", "ReliabilityEngine returns successful payload after retry");

    // Non-retryable error validation
    let nonRetryableCaught = false;
    try {
      await ReliabilityEngine.withRetry(
        async () => {
          throw new IntegrationError("Bad Request Schema", "INTEGRATION_VALIDATION_ERROR", "SANDBOX_TEST", "UGOV-INT-FAIL", 400, false);
        },
        "SANDBOX_TEST",
        "UGOV-INT-FAIL",
        { maxRetries: 3 }
      );
    } catch (err: any) {
      if (err instanceof IntegrationError && err.code === "INTEGRATION_VALIDATION_ERROR") {
        nonRetryableCaught = true;
      }
    }
    assert(nonRetryableCaught, "ReliabilityEngine immediately fails non-retryable validation errors without retry storms");

    // ----------------------------------------------------
    // TEST SUITE 4: End-to-End Application Integration Flow
    // ----------------------------------------------------
    console.log("\n[Test Suite 4: End-to-End Application Integration Flow]");

    // Setup Citizen A & Credentials
    const citizenEmail = `citizen-int-${Date.now()}@u-gov.gov.in`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: citizenEmail,
        password: "Citizen@UGov2026",
        confirmPassword: "Citizen@UGov2026",
        displayName: "Sovereign Integration Citizen",
        termsAccepted: true,
      }),
    });
    const regCookie = regRes.headers.get("set-cookie") || "";
    const citizenA = (await regRes.json()).user;

    // Deposit Required Credentials for NSP (AADHAAR, INCOME_CERT, MARKSHEET)
    const dummyPdf = Buffer.from("%PDF-1.4\nTest Certificate Credential\n%%EOF").toString("base64");
    const docAadhaarRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: regCookie },
      body: JSON.stringify({
        title: "Integration Aadhaar",
        documentTypeId: "AADHAAR",
        documentNumber: "XXXX-XXXX-1122",
        fileName: "aadhaar.pdf",
        mimeType: "application/pdf",
        fileData: dummyPdf,
      }),
    });
    const docAadhaar = (await docAadhaarRes.json()).document;

    const docIncomeRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: regCookie },
      body: JSON.stringify({
        title: "Integration Income Cert",
        documentTypeId: "INCOME_CERT",
        documentNumber: "INC-2026-9900",
        fileName: "income.pdf",
        mimeType: "application/pdf",
        fileData: dummyPdf,
      }),
    });
    const docIncome = (await docIncomeRes.json()).document;

    const docMarksheetRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: regCookie },
      body: JSON.stringify({
        title: "Integration Marksheet",
        documentTypeId: "MARKSHEET",
        documentNumber: "MS-12-8877",
        fileName: "marksheet.pdf",
        mimeType: "application/pdf",
        fileData: dummyPdf,
      }),
    });
    const docMarksheet = (await docMarksheetRes.json()).document;

    // Create Application
    const createRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: regCookie },
      body: JSON.stringify({
        serviceId: "serv-nsp",
        attachedDocumentIds: [docAadhaar.id, docIncome.id, docMarksheet.id],
      }),
    });
    const appRecord = (await createRes.json()).application;
    assert(appRecord.status === "READY", "Application with all credentials initialized as READY");

    // Submit Application through Integration Engine
    const submitRes = await fetch(`${baseUrl}/applications/${appRecord.id}/submit`, {
      method: "POST",
      headers: { Cookie: regCookie },
    });
    assert(submitRes.status === 200, "POST /applications/:id/submit succeeds with 200 OK");
    const submitData = await submitRes.json();
    assert(submitData.application.status === "SUBMITTED", "Application transitioned to SUBMITTED");
    assert(!!submitData.submission.trackingToken, "Sandbox tracking token returned to caller");
    assert(submitData.submission.trackingToken.startsWith("SBX-ACK-NSP-"), "Token generated by SANDBOX_NSP adapter");

    // Check Database Telemetry Record
    const integrationRecord = db.findIntegrationByApplicationId(appRecord.id);
    assert(!!integrationRecord, "Database persisted application_integrations record");
    assert(integrationRecord?.providerCode === "SANDBOX_NSP", "Persisted providerCode matches SANDBOX_NSP");
    assert(integrationRecord?.status === "SUBMITTED", "Integration record reflects SUBMITTED status");
    assert(!!integrationRecord?.correlationId, "Integration record contains valid correlation ID");

    // Verify Idempotency on Duplicate Submission Attempt
    const dupRes = await fetch(`${baseUrl}/applications/${appRecord.id}/submit`, {
      method: "POST",
      headers: { Cookie: regCookie },
    });
    assert(dupRes.status === 400, "Duplicate submission of already SUBMITTED application properly rejected by state machine (400)");

    // ----------------------------------------------------
    // TEST SUITE 5: Integration Telemetry API & IDOR Defense
    // ----------------------------------------------------
    console.log("\n[Test Suite 5: Integration Telemetry API & IDOR Defense]");

    // Owner checks integration details
    const getIntRes = await fetch(`${baseUrl}/integrations/applications/${appRecord.id}`, {
      headers: { Cookie: regCookie },
    });
    assert(getIntRes.status === 200, "Citizen A can query own integration telemetry (200 OK)");
    const intData = await getIntRes.json();
    assert(intData.environment === "SANDBOX", "Telemetry explicitly confirms SANDBOX environment");
    assert(intData.disclaimer.includes("Sandbox Integration"), "Telemetry contains prototype simulation disclaimer");
    assert(intData.provider.providerCode === "SANDBOX_NSP", "Provider info accurately indicates SANDBOX_NSP");

    // Setup Citizen B to test IDOR
    const citizenBRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: `citizen-b-int-${Date.now()}@u-gov.gov.in`,
        password: "Citizen@UGov2026",
        confirmPassword: "Citizen@UGov2026",
        displayName: "Citizen B",
        termsAccepted: true,
      }),
    });
    const citizenBCookie = citizenBRes.headers.get("set-cookie") || "";

    // Citizen B tries to access Citizen A's integration telemetry
    const idorGetRes = await fetch(`${baseUrl}/integrations/applications/${appRecord.id}`, {
      headers: { Cookie: citizenBCookie },
    });
    assert(idorGetRes.status === 403, "Citizen B cannot view Citizen A's integration telemetry (403 Forbidden)");

    // Citizen B tries to poll status for Citizen A's application
    const idorPollRes = await fetch(`${baseUrl}/integrations/applications/${appRecord.id}/status`, {
      method: "POST",
      headers: { Cookie: citizenBCookie },
    });
    assert(idorPollRes.status === 403, "Citizen B cannot poll status for Citizen A's application (403 Forbidden)");

    // ----------------------------------------------------
    // TEST SUITE 6: Upstream Status Polling & State Transition
    // ----------------------------------------------------
    console.log("\n[Test Suite 6: Upstream Status Polling & State Transition]");

    const pollRes = await fetch(`${baseUrl}/integrations/applications/${appRecord.id}/status`, {
      method: "POST",
      headers: { Cookie: regCookie },
    });
    assert(pollRes.status === 200, "Citizen A polls integration status with 200 OK");
    const pollData = await pollRes.json();
    assert(pollData.status.status === "PROCESSING", "Provider returns normalized PROCESSING status");

    // Verify application state transitioned to PROCESSING in database
    const refreshedApp = db.findApplicationById(appRecord.id);
    assert(refreshedApp?.status === "PROCESSING", "Application status updated to PROCESSING in database");

    // ----------------------------------------------------
    // TEST SUITE 7: Provider Health Probing & Unauthenticated Route Guards
    // ----------------------------------------------------
    console.log("\n[Test Suite 7: Provider Health Probing & Unauthenticated Route Guards]");

    const providersListRes = await fetch(`${baseUrl}/integrations/providers`, {
      headers: { Cookie: regCookie },
    });
    assert(providersListRes.status === 200, "GET /api/v1/integrations/providers returns 200 OK");
    const provListData = await providersListRes.json();
    assert(provListData.total >= 4, "Providers list reflects all registered adapters");

    const healthRes = await fetch(`${baseUrl}/integrations/providers/SANDBOX_NSP/health`, {
      headers: { Cookie: regCookie },
    });
    assert(healthRes.status === 200, "GET /providers/:code/health returns 200 OK");
    const healthData = await healthRes.json();
    assert(healthData.health.status === "HEALTHY", "Health check reports HEALTHY");
    assert(healthData.health.providerCode === "SANDBOX_NSP", "Health check reports correct providerCode");

    const badHealthRes = await fetch(`${baseUrl}/integrations/providers/NON_EXISTENT/health`, {
      headers: { Cookie: regCookie },
    });
    assert(badHealthRes.status === 404, "GET health check for non-existent provider returns 404 Not Found");

    // Unauthenticated protection
    const unauthProvidersRes = await fetch(`${baseUrl}/integrations/providers`);
    assert(unauthProvidersRes.status === 401, "GET /api/v1/integrations/providers rejects unauthenticated requests with 401");

    const unauthAppIntRes = await fetch(`${baseUrl}/integrations/applications/${appRecord.id}`);
    assert(unauthAppIntRes.status === 401, "GET /api/v1/integrations/applications/:id rejects unauthenticated requests with 401");

    // ----------------------------------------------------
    // TEST SUITE 8: Cryptographic U-AUDIT Hash-Chain Integrity
    // ----------------------------------------------------
    console.log("\n[Test Suite 8: Cryptographic U-AUDIT Hash-Chain Integrity]");

    const auditVerifyRes = await fetch(`${baseUrl}/auth/audit/verify`, {
      headers: { Cookie: regCookie },
    });
    assert(auditVerifyRes.status === 200, "GET /api/v1/auth/audit/verify returns 200 OK");
    const auditData = await auditVerifyRes.json();
    if (!auditData.verification?.valid) {
      console.error("DEBUG AUDIT VERIFICATION FAILURE:", JSON.stringify(auditData.verification));
    }
    assert(auditData.verification.valid === true, "Entire U-AUDIT ledger remains cryptographically unbroken");
    assert(
      auditData.verification.algorithm === "SHA-256 Hash-Chained Append-Only Ledger",
      "Audit ledger maintains official 'SHA-256 Hash-Chained Append-Only Ledger' algorithm designation"
    );

    // Verify integration audit actions occurred
    const auditEvents = db.getAuditEvents(50);
    const hasIntStart = auditEvents.some((e) => e.action === "INTEGRATION_SUBMISSION_STARTED");
    const hasIntSucc = auditEvents.some((e) => e.action === "INTEGRATION_SUBMISSION_SUCCEEDED");
    const hasIntPoll = auditEvents.some((e) => e.action === "INTEGRATION_STATUS_CHECKED");
    const hasIntStateChange = auditEvents.some((e) => e.action === "INTEGRATION_STATUS_CHANGED");

    assert(hasIntStart, "INTEGRATION_SUBMISSION_STARTED audit event recorded in ledger");
    assert(hasIntSucc, "INTEGRATION_SUBMISSION_SUCCEEDED audit event recorded in ledger");
    assert(hasIntPoll, "INTEGRATION_STATUS_CHECKED audit event recorded in ledger");
    assert(hasIntStateChange, "INTEGRATION_STATUS_CHANGED audit event recorded in ledger");
  } catch (err: any) {
    console.error("Critical test runner error:", err);
    failed++;
  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`U-INTEGRATIONS Test Results: ${passed} Passed | ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrationsTests();
