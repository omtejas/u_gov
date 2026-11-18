import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import { authenticate, requireAuth, csrfProtection } from "../middleware/auth";
import { authRouter } from "../routes/auth";
import { documentsRouter } from "../routes/documents";
import { servicesRouter } from "../routes/services";
import { applicationsRouter } from "../routes/applications";
import { integrationsRouter } from "../routes/integrations";
import { officerRouter } from "../routes/officer";
import { grievancesRouter } from "../routes/grievances";
import { webhubRouter } from "../routes/webhub";
import { db } from "../database/db";
import type { AuthenticatedRequest } from "../middleware/auth";

describe("U-GOV V10 Security Hardening & Persistence Suite", () => {
  let server: http.Server;
  let baseUrl: string;
  let citizenCookie = "";
  let citizenId = "";
  let adminCookie = "";
  let uploadedDocId = "";

  before(async () => {
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json({ limit: "10mb" }));
    app.use(authenticate as any);
    app.use("/api/v1/auth", authRouter);
    app.use("/api/v1/documents", documentsRouter);
    app.use("/api/v1/services", servicesRouter);
    app.use("/api/v1/applications", applicationsRouter);
    app.use("/api/v1/integrations", integrationsRouter);
    app.use("/api/v1/officer", officerRouter);
    app.use("/api/v1/grievances", grievancesRouter);
    app.use("/api/v1/webhub", webhubRouter);

    app.get("/api/v1/preferences", requireAuth as any, (req: AuthenticatedRequest, res) => {
      return res.json({ success: true, preferences: db.getUserPreferences(req.user!.id) });
    });
    app.patch("/api/v1/preferences", requireAuth as any, csrfProtection, (req: AuthenticatedRequest, res) => {
      const { preferredLanguage, notificationsEnabled, dashboardLayout, theme } = req.body || {};
      const updates: Record<string, unknown> = {};
      if (preferredLanguage !== undefined) updates.preferredLanguage = String(preferredLanguage);
      if (notificationsEnabled !== undefined) updates.notificationsEnabled = Boolean(notificationsEnabled);
      if (dashboardLayout !== undefined) updates.dashboardLayout = String(dashboardLayout);
      if (theme !== undefined) updates.theme = String(theme);
      return res.json({ success: true, preferences: db.updateUserPreferences(req.user!.id, updates) });
    });

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    baseUrl = `http://localhost:${port}/api/v1`;

    // Register fresh citizen
    const email = `v10_citizen_${Date.now()}@test.gov.in`;
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: email,
        password: "StrongPassword#2026",
        confirmPassword: "StrongPassword#2026",
        displayName: "V10 Test Citizen",
        termsAccepted: true,
      }),
    });
    const regData = await reg.json();
    assert.equal(reg.status, 201);
    citizenId = regData.user.id;
    citizenCookie = reg.headers.get("set-cookie")?.split(";")[0] || "";

    // Seed an Admin login using seeded demo administrator
    const adminLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "admin@u-gov.gov.in",
        password: "Admin@UGov2026",
      }),
    });
    assert.equal(adminLogin.status, 200);
    adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0] || "";
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("blocks cross-origin and Sec-Fetch-Site: cross-site CSRF browser mutations", async () => {
    const crossOriginRes = await fetch(`${baseUrl}/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: citizenCookie,
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ preferredLanguage: "hi" }),
    });
    assert.equal(crossOriginRes.status, 403);

    const secFetchRes = await fetch(`${baseUrl}/grievances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: citizenCookie,
        "Sec-Fetch-Site": "cross-site",
      },
      body: JSON.stringify({
        title: "Cross-site forged issue",
        category: "Municipal Services",
        department: "PMC",
        location: "Pune",
        description: "Must be blocked by Sec-Fetch-Site",
      }),
    });
    assert.equal(secFetchRes.status, 403);

    const browserWithoutOriginRes = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: citizenCookie,
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ displayName: "Forged Name" }),
    });
    assert.equal(browserWithoutOriginRes.status, 403);

    // Reverse-proxied HTTPS request where nginx forwards Host: localhost and X-Forwarded-Proto: http
    const proxiedLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://ais-dev-proxy.asia-southeast1.run.app",
        "X-Forwarded-Host": "ais-dev-proxy.asia-southeast1.run.app",
        "X-Forwarded-Proto": "http",
      },
      body: JSON.stringify({
        identifier: "citizen@u-gov.gov.in",
        password: "Citizen@UGov2026",
      }),
    });
    assert.equal(proxiedLogin.status, 200);
    const cookieHeader = proxiedLogin.headers.get("set-cookie") || "";
    assert.ok(cookieHeader.includes("SameSite=None"), "Proxied HTTPS origin receives SameSite=None");
    assert.ok(cookieHeader.includes("Secure"), "Proxied HTTPS origin receives Secure");
    assert.ok(cookieHeader.includes("Partitioned"), "Proxied HTTPS origin receives Partitioned");
  });

  it("manages citizen sessions without leaking tokenHash, validates profile, and rotates password", async () => {
    const sessRes = await fetch(`${baseUrl}/auth/sessions`, {
      headers: { Cookie: citizenCookie },
    });
    assert.equal(sessRes.status, 200);
    const sessData = await sessRes.json();
    assert.equal(sessData.success, true);
    assert.ok(Array.isArray(sessData.sessions) && sessData.sessions.length >= 1);
    assert.equal("tokenHash" in sessData.sessions[0], false);
    assert.equal(sessData.sessions[0].isCurrent, true);

    // Profile validation rejects empty displayName and invalid language
    const badProf = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ displayName: "", preferredLanguage: "xx" }),
    });
    assert.equal(badProf.status, 400);

    const goodProf = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ displayName: "Aarav Updated", district: "Nagpur" }),
    });
    assert.equal(goodProf.status, 200);
    const profData = await goodProf.json();
    assert.equal(profData.profile.displayName, "Aarav Updated");
    assert.equal(profData.profile.district, "Nagpur");

    // Change password
    const pwRes = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        currentPassword: "StrongPassword#2026",
        newPassword: "RotatedPassword#2026",
        confirmNewPassword: "RotatedPassword#2026",
      }),
    });
    assert.equal(pwRes.status, 200);

    // Individual session revocation works cleanly
    const targetId = sessData.sessions[0].id;
    const revRes = await fetch(`${baseUrl}/auth/sessions/${targetId}`, {
      method: "DELETE",
      headers: { Cookie: citizenCookie },
    });
    assert.equal(revRes.status, 200);

    // Old session should now be unauthorized; re-login with rotated password
    const afterRev = await fetch(`${baseUrl}/auth/me`, { headers: { Cookie: citizenCookie } });
    assert.equal(afterRev.status, 401);

    const relogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: db.findUserById(citizenId)!.identifier,
        password: "RotatedPassword#2026",
      }),
    });
    assert.equal(relogin.status, 200);
    citizenCookie = relogin.headers.get("set-cookie")?.split(";")[0] || "";
  });

  it("supports U-DOCS inline preview, immutable version history, and integrity checks", async () => {
    const v1Payload = Buffer.from("%PDF-1.4\nInitial V1 Document Binary").toString("base64");
    const depRes = await fetch(`${baseUrl}/documents/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        title: "Domicile Proof",
        documentTypeId: "DOMICILE",
        documentNumber: "DOM-2026-009",
        fileName: "domicile_v1.pdf",
        mimeType: "application/pdf",
        fileData: v1Payload,
      }),
    });
    assert.equal(depRes.status, 201);
    const depData = await depRes.json();
    uploadedDocId = depData.document.id;
    assert.equal(depData.document.currentVersion, 1);

    // Preview returns inline + nosniff + private no-store
    const previewRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/preview`, {
      headers: { Cookie: citizenCookie },
    });
    assert.equal(previewRes.status, 200);
    assert.ok((previewRes.headers.get("content-disposition") || "").startsWith("inline;"));
    assert.equal(previewRes.headers.get("x-content-type-options"), "nosniff");
    assert.equal(previewRes.headers.get("cache-control"), "private, no-store");

    // Upload v2 version
    const v2Payload = Buffer.from("%PDF-1.4\nRenewed V2 Document Binary With Seal").toString("base64");
    const v2Res = await fetch(`${baseUrl}/documents/${uploadedDocId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        fileName: "domicile_v2.pdf",
        mimeType: "application/pdf",
        fileData: v2Payload,
        notes: "Updated signed copy",
      }),
    });
    assert.equal(v2Res.status, 201);
    const v2Data = await v2Res.json();
    assert.equal(v2Data.version.versionNumber, 2);
    assert.equal(v2Data.document.currentVersion, 2);

    const listVerRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/versions`, {
      headers: { Cookie: citizenCookie },
    });
    assert.equal(listVerRes.status, 200);
    const listVerData = await listVerRes.json();
    assert.equal(listVerData.versions.length, 2);

    const integrityRes = await fetch(`${baseUrl}/documents/${uploadedDocId}/verify-integrity`, {
      headers: { Cookie: citizenCookie },
    });
    assert.equal(integrityRes.status, 200);
    const integrityData = await integrityRes.json();
    assert.equal(integrityData.integrity, "VALID");
  });

  it("blocks Officer verifying an unattached document ID (400 Bad Request)", async () => {
    // Citizen creates an application without attaching uploadedDocId
    const appRes = await fetch(`${baseUrl}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ serviceId: "serv-nsp" }),
    });
    assert.equal(appRes.status, 201);
    const appData = await appRes.json();

    const verifyUnattached = await fetch(
      `${baseUrl}/officer/applications/${appData.application.id}/verify-document`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ documentId: uploadedDocId }),
      }
    );
    assert.equal(verifyUnattached.status, 400);
  });

  it("persists preferences, grievances, webhub role checks, integrations health, and paginated audit logs", async () => {
    const intHealth = await fetch(`${baseUrl}/integrations/health`, {
      headers: { Cookie: citizenCookie },
    });
    assert.equal(intHealth.status, 200);
    const intData = await intHealth.json();
    assert.equal(intData.success, true);
    assert.ok(Array.isArray(intData.providers));

    // Grievances create + upvote toggle
    const grvCreate = await fetch(`${baseUrl}/grievances`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        title: "Damaged Storm Drain Cover",
        category: "Water & Sanitation",
        department: "Municipal Engineering",
        location: "Deccan Gymkhana, Pune",
        description: "Needs urgent replacement before monsoon.",
      }),
    });
    assert.equal(grvCreate.status, 201);
    const grvData = await grvCreate.json();

    const grvUpvote = await fetch(`${baseUrl}/grievances/${grvData.grievance.id}/upvote`, {
      method: "POST",
      headers: { Cookie: citizenCookie },
    });
    assert.equal(grvUpvote.status, 200);
    const upvoteData = await grvUpvote.json();
    assert.equal(upvoteData.upvotes, 0);
    assert.equal(upvoteData.upvotedByMe, false);

    // WebHub: citizen forbidden from publishing, admin succeeds
    const citizenPostHub = await fetch(`${baseUrl}/webhub`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({
        name: "Unauthorized Portal",
        category: "Finance",
        ministry: "Test",
        url: "https://example.gov.in",
        description: "Should be denied for Citizen role.",
      }),
    });
    assert.equal(citizenPostHub.status, 403);

    const adminPostHub = await fetch(`${baseUrl}/webhub`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        name: "Verified Income Tax Portal",
        category: "Tax & Revenue",
        ministry: "Ministry of Finance",
        url: "https://www.incometax.gov.in",
        description: "Official Government of India income tax e-filing portal.",
      }),
    });
    assert.equal(adminPostHub.status, 201);

    // Preferences persistence
    const patchPref = await fetch(`${baseUrl}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: citizenCookie },
      body: JSON.stringify({ preferredLanguage: "mr", dashboardLayout: "compact" }),
    });
    assert.equal(patchPref.status, 200);
    const getPref = await fetch(`${baseUrl}/preferences`, { headers: { Cookie: citizenCookie } });
    const getPrefData = await getPref.json();
    assert.equal(getPrefData.preferences.preferredLanguage, "mr");
    assert.equal(getPrefData.preferences.dashboardLayout, "compact");

    // Audit pagination
    const page1 = await fetch(`${baseUrl}/auth/audit/events?limit=2&offset=0`, {
      headers: { Cookie: adminCookie },
    });
    const page1Data = await page1.json();
    assert.equal(page1.status, 200);
    assert.equal(page1Data.events.length, 2);
    assert.ok(page1Data.total >= 2);
  });
});
