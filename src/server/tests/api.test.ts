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
    assert(Boolean(data2.token), "Registration returns session token");
    const cookieHeader = res2.headers.get("set-cookie");
    assert(Boolean(cookieHeader && cookieHeader.includes("ugov_session")), "Registration sets HttpOnly ugov_session cookie");

    const sessionToken = data2.token;

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

    // 4. Access /me with Authorization header
    const res4 = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data4 = await res4.json();
    assert(res4.status === 200 && data4.success, "GET /api/v1/auth/me returns 200 with valid session");
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

    // 6. Login with valid password returns 200
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
    assert(Boolean(data6.token), "Login response contains session token");

    // 7. Update profile
    const res7 = await fetch(`${baseUrl}/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        displayName: "Anjali Kadam (Updated)",
        district: "Satara",
      }),
    });
    const data7 = await res7.json();
    assert(res7.status === 200 && data7.profile.displayName === "Anjali Kadam (Updated)", "PATCH /api/v1/auth/profile updates profile");

    // 8. Logout revokes session
    const res8 = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(res8.status === 200, "POST /api/v1/auth/logout returns 200");

    // 9. Subsequent request with revoked token should return 401
    const res9 = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(res9.status === 401, "Request with revoked session rejected with 401");

    // 10. Verify live audit trail contains events
    const res10 = await fetch(`${baseUrl}/audit/events`);
    const data10 = await res10.json();
    assert(res10.status === 200 && Array.isArray(data10.events), "GET /api/v1/auth/audit/events returns live audit events");
    const actions = data10.events.map((e: any) => e.action);
    assert(actions.includes("USER_REGISTRATION"), "Audit trail recorded USER_REGISTRATION");
    assert(actions.includes("CITIZEN_LOGIN"), "Audit trail recorded CITIZEN_LOGIN");
    assert(actions.includes("FAILED_LOGIN_ATTEMPT"), "Audit trail recorded FAILED_LOGIN_ATTEMPT");
    assert(actions.includes("CITIZEN_LOGOUT"), "Audit trail recorded CITIZEN_LOGOUT");
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
