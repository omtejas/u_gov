import express from "express";
import http from "http";
import { authenticate } from "../middleware/auth";
import { authRouter } from "../routes/auth";

async function runApiTests() {
  console.log("\n==================================================");
  console.log("🌐 U-IDENTITY REST API INTEGRATION TESTS");
  console.log("==================================================\n");

  const app = express();
  app.use(express.json());
  app.use(authenticate as any);
  app.use("/api/v1/auth", authRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api/v1/auth`;

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
    // 1. Unauthenticated /me should return 401
    const res1 = await fetch(`${baseUrl}/me`);
    assert(res1.status === 401, "GET /api/v1/auth/me returns 401 when unauthenticated");

    // 2. Register a new citizen
    const newCitizenEmail = `citizen_${Date.now()}@domain.com`;
    const res2 = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: newCitizenEmail,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
        displayName: "Anjali Ramesh Kadam",
        phone: "+91 99887 76655",
        state: "Maharashtra",
        district: "Pune",
        termsAccepted: true,
      }),
    });
    const data2 = await res2.json();
    assert(res2.status === 201 && data2.success, "POST /api/v1/auth/register returns 201 Created");
    assert(!("token" in data2), "Raw session token is NOT exposed in registration JSON (HttpOnly cookie only)");
    const cookieHeader = res2.headers.get("set-cookie");
    assert(Boolean(cookieHeader && cookieHeader.includes("ugov_session")), "Registration sets HttpOnly ugov_session cookie");
    const sessionCookie = cookieHeader ? cookieHeader.split(";")[0] : "";

    // 3. Duplicate registration should return 409 Conflict
    const res3 = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: newCitizenEmail,
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
        displayName: "Duplicate Attempt",
        termsAccepted: true,
      }),
    });
    assert(res3.status === 409, "Duplicate registration rejected with 409 Conflict");

    // 4. Access /me with HttpOnly session cookie
    const res4 = await fetch(`${baseUrl}/me`, {
      headers: { Cookie: sessionCookie },
    });
    const data4 = await res4.json();
    assert(res4.status === 200 && data4.success, "GET /api/v1/auth/me returns 200 with valid session cookie");
    assert(data4.user.identifier === newCitizenEmail, "Current user identifier matches registered citizen");
    assert(data4.user.profile.displayName === "Anjali Ramesh Kadam", "Profile display name matches");

    // 5. Login with invalid password returns 401
    const res5 = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: newCitizenEmail,
        password: "IncorrectPassword123",
      }),
    });
    assert(res5.status === 401, "Login with invalid password rejected with 401");

    // 6. Login with valid password returns 200 and sets cookie
    const res6 = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: newCitizenEmail,
        password: "StrongPassword123!",
      }),
    });
    const data6 = await res6.json();
    assert(res6.status === 200 && data6.success, "POST /api/v1/auth/login returns 200 Success");
    assert(!("token" in data6), "Login response does NOT expose raw session token in JSON");
    const loginCookieHeader = res6.headers.get("set-cookie");
    const loginCookie = loginCookieHeader ? loginCookieHeader.split(";")[0] : "";
    assert(Boolean(loginCookie.includes("ugov_session")), "Login returns updated session cookie");

    // 7. CSRF Defense: Cross-origin mutating requests must be rejected
    const resCsrf = await fetch(`${baseUrl}/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: loginCookie,
        Origin: "http://malicious-third-party.evil",
      },
      body: JSON.stringify({ displayName: "Hacked Name" }),
    });
    assert(resCsrf.status === 403, "Mutating request from rogue Origin blocked by CSRF guard");

    // 8. Update profile with legitimate same-origin request
    const res7 = await fetch(`${baseUrl}/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: loginCookie,
      },
      body: JSON.stringify({
        displayName: "Anjali Kadam (Updated)",
        district: "Satara",
      }),
    });
    const data7 = await res7.json();
    assert(res7.status === 200 && data7.profile.displayName === "Anjali Kadam (Updated)", "PATCH /api/v1/auth/profile updates profile");

    // 9. Unauthenticated access to audit events rejected
    const resUnauthAudit = await fetch(`${baseUrl}/audit/events`);
    assert(resUnauthAudit.status === 401, "GET /api/v1/auth/audit/events returns 401 when unauthenticated");

    // 10. Citizen access to audit events is scoped to personal activity (IDOR Protection)
    const resCitizenAudit = await fetch(`${baseUrl}/audit/events`, {
      headers: { Cookie: loginCookie },
    });
    const dataCitizenAudit = await resCitizenAudit.json();
    assert(resCitizenAudit.status === 200 && dataCitizenAudit.scope === "personal", "Citizen audit access is scoped to 'personal' events");
    assert(
      dataCitizenAudit.events.every((e: any) => e.actorId === data4.user.id),
      "Citizen cannot access other users' audit events (zero cross-user audit leakage)"
    );

    // 11. Cryptographic audit ledger verification
    const resVerify = await fetch(`${baseUrl}/audit/verify`, {
      headers: { Cookie: loginCookie },
    });
    const dataVerify = await resVerify.json();
    assert(resVerify.status === 200 && dataVerify.verification.valid, "GET /api/v1/auth/audit/verify confirms unbroken SHA-256 chain");

    // 12. Global session invalidation ("Sign out of all devices")
    const resRevokeAll = await fetch(`${baseUrl}/revoke-all`, {
      method: "POST",
      headers: { Cookie: loginCookie },
    });
    assert(resRevokeAll.status === 200, "POST /api/v1/auth/revoke-all returns 200");

    // 13. Subsequent request with revoked cookie should return 401
    const resPostRevoke = await fetch(`${baseUrl}/me`, {
      headers: { Cookie: loginCookie },
    });
    assert(resPostRevoke.status === 401, "Request with revoked session rejected with 401");
  } finally {
    server.close();
  }

  console.log("\n==================================================");
  console.log(`API Integration Results: ${passed} Passed | ${failed} Failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runApiTests();
