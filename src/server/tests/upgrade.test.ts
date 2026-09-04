import express from "express";
import http from "http";
import { authenticate } from "../middleware/auth";
import { authRouter } from "../routes/auth";
import { searchRouter } from "../routes/search";
import { notificationsRouter } from "../routes/notifications";
import { feedbackRouter } from "../routes/feedback";
import { faqRouter } from "../routes/faq";

async function runUpgradeTests() {
  console.log("\n==================================================");
  console.log("🔍 U-GOV WORKSPACE UPGRADE INTEGRATION TESTS");
  console.log("==================================================\n");

  const app = express();
  app.use(express.json());
  app.use(authenticate as any);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  app.use("/api/v1/feedback", feedbackRouter);
  app.use("/api/v1/faq", faqRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const base = `http://localhost:${port}/api/v1`;

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
      failed++;
    }
  }

  // ─── Helper: Register + Login ─────────────────────────────────────────────
  const email = `upgrade_test_${Date.now()}@test.gov.in`;
  const password = "TestPass@1234";

  const regRes = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: email,
      password,
      confirmPassword: password,
      displayName: "Upgrade Test Citizen",
      state: "Maharashtra",
      district: "Pune",
      termsAccepted: true,
    }),
  });
  const regData = await regRes.json();
  assert(regData.success === true, "Citizen registration succeeds");

  // Extract session cookie
  const cookieHeader = regRes.headers.get("set-cookie") || "";
  const sessionMatch = cookieHeader.match(/ugov_session=([^;]+)/);
  const sessionToken = sessionMatch ? sessionMatch[1] : "";
  assert(!!sessionToken, "Session cookie is set on registration");

  const authHeader = { Cookie: `ugov_session=${sessionToken}` };

  // ─── SEARCH TESTS ─────────────────────────────────────────────────────────
  console.log("\n🔍 Search Endpoint Tests");

  // 1. Unauthenticated search → 401
  const unauthedSearch = await fetch(`${base}/search?q=scholarship`);
  assert(unauthedSearch.status === 401, "GET /search returns 401 when unauthenticated");

  // 2. Search too short → empty results, not error
  const shortSearch = await fetch(`${base}/search?q=a`, { headers: authHeader });
  const shortData = await shortSearch.json();
  assert(shortSearch.status === 200, "Short query returns 200 not 500");
  assert(shortData.totalCount === 0, "Short query returns 0 results (min 2 chars)");

  // 3. Search for known service
  const svcSearch = await fetch(`${base}/search?q=scholarship`, { headers: authHeader });
  const svcData = await svcSearch.json();
  assert(svcSearch.status === 200, "Service search returns 200");
  assert(svcData.success === true, "Service search returns success=true");
  assert(Array.isArray(svcData.results), "Search returns results array");
  const serviceHit = svcData.results.find((r: any) => r.type === "service");
  assert(!!serviceHit, "Search finds service result for 'scholarship'");

  // 4. Search with category filter → only services
  const catSearch = await fetch(`${base}/search?q=scholarship&category=services`, { headers: authHeader });
  const catData = await catSearch.json();
  assert(catData.success === true, "Category-filtered search succeeds");
  const nonServiceHit = catData.results.find((r: any) => r.type !== "service");
  assert(!nonServiceHit, "Category filter 'services' returns only service results");

  // 5. FAQ search
  const faqSearch = await fetch(`${base}/search?q=consent&category=faq`, { headers: authHeader });
  const faqData = await faqSearch.json();
  assert(faqData.success === true, "FAQ search returns success");
  const faqHit = faqData.results.find((r: any) => r.type === "faq");
  assert(!!faqHit, "FAQ search returns faq type result for 'consent'");

  // 6. XSS query string — should not crash
  const xssSearch = await fetch(`${base}/search?q=${encodeURIComponent("<script>alert(1)</script>")}`, { headers: authHeader });
  assert(xssSearch.status === 200, "XSS-like query doesn't crash search endpoint");

  // 7. Cross-citizen IDOR: search returns only own documents (0 other user docs)
  //    The new citizen has no documents so doc results should be 0
  const iodorSearch = await fetch(`${base}/search?q=aadhaar&category=documents`, { headers: authHeader });
  const idorData = await iodorSearch.json();
  assert(idorData.success === true, "IDOR-isolated document search returns success");
  const docHits = idorData.results.filter((r: any) => r.type === "document");
  assert(docHits.length === 0, "New citizen gets 0 document results (no cross-citizen data leak)");

  // ─── NOTIFICATIONS TESTS ──────────────────────────────────────────────────
  console.log("\n🔔 Notifications Endpoint Tests");

  // 1. Unauthenticated notifications → 401
  const unauthedNotifs = await fetch(`${base}/notifications`);
  assert(unauthedNotifs.status === 401, "GET /notifications returns 401 when unauthenticated");

  // 2. Get notifications (authenticated)
  const notifsRes = await fetch(`${base}/notifications`, { headers: authHeader });
  const notifsData = await notifsRes.json();
  assert(notifsRes.status === 200, "GET /notifications returns 200 when authenticated");
  assert(notifsData.success === true, "Notifications response has success=true");
  assert(Array.isArray(notifsData.notifications), "Notifications field is an array");
  assert(typeof notifsData.unreadCount === "number", "unreadCount is a number");

  // 3. Count endpoint
  const countRes = await fetch(`${base}/notifications/count`, { headers: authHeader });
  const countData = await countRes.json();
  assert(countRes.status === 200, "GET /notifications/count returns 200");
  assert(typeof countData.unreadCount === "number", "count endpoint returns unreadCount number");

  // 4. Mark-all-read
  const marAllRes = await fetch(`${base}/notifications/read-all`, {
    method: "PATCH",
    headers: authHeader,
  });
  assert(marAllRes.status === 200, "PATCH /notifications/read-all returns 200");

  // 5. After mark-all-read, unread count = 0
  const afterMarkRes = await fetch(`${base}/notifications/count`, { headers: authHeader });
  const afterMarkData = await afterMarkRes.json();
  assert(afterMarkData.unreadCount === 0, "After mark-all-read, unread count is 0");

  // 6. Mark unknown notification → 404
  const markBadRes = await fetch(`${base}/notifications/notif-nonexistent/read`, {
    method: "PATCH",
    headers: authHeader,
  });
  assert(markBadRes.status === 404, "PATCH unknown notification ID returns 404");

  // 7. Delete unknown notification → 404
  const delBadRes = await fetch(`${base}/notifications/nonexistent`, {
    method: "DELETE",
    headers: authHeader,
  });
  assert(delBadRes.status === 404, "DELETE unknown notification returns 404");

  // 8. IDOR: Register second user, get their token, try to mark first user's notification
  const email2 = `upgrade_test2_${Date.now()}@test.gov.in`;
  const reg2Res = await fetch(`${base}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: email2,
      password,
      confirmPassword: password,
      displayName: "Second Citizen",
      state: "Maharashtra",
      district: "Mumbai",
      termsAccepted: true,
    }),
  });
  const cookie2 = (reg2Res.headers.get("set-cookie") || "").match(/ugov_session=([^;]+)/)?.[1] || "";
  // Get first user's notification id
  const notifList = notifsData.notifications as any[];
  if (notifList.length > 0) {
    const victimNotifId = notifList[0].id;
    const idorMarkRes = await fetch(`${base}/notifications/${victimNotifId}/read`, {
      method: "PATCH",
      headers: { Cookie: `ugov_session=${cookie2}` },
    });
    // Should be 404 (not found for this user) not 200
    assert(idorMarkRes.status === 404, "IDOR: Second user cannot mark first user's notification (returns 404)");
  } else {
    console.log("  ⚠️  SKIP: IDOR notification test (no seed notifications)");
  }

  // ─── FEEDBACK TESTS ───────────────────────────────────────────────────────
  console.log("\n💬 Feedback Endpoint Tests");

  // 1. Unauthenticated → 401
  const unauthedFb = await fetch(`${base}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert(unauthedFb.status === 401, "POST /feedback returns 401 when unauthenticated");

  // 2. Valid feedback submission
  const fbRes = await fetch(`${base}/feedback`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      category: "general",
      subject: "Test feedback subject",
      message: "This is a test feedback message with sufficient length.",
      rating: 5,
    }),
  });
  const fbData = await fbRes.json();
  assert(fbRes.status === 201, "POST /feedback returns 201 on success");
  assert(fbData.success === true, "Feedback submission returns success=true");
  assert(typeof fbData.id === "string", "Feedback response includes ID");

  // 3. Invalid category → 400
  const fbBadCat = await fetch(`${base}/feedback`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ category: "hacked", subject: "Bad category test input", message: "Message long enough to pass validation check" }),
  });
  assert(fbBadCat.status === 400, "Invalid feedback category returns 400");

  // 4. Subject too short → 400
  const fbShortSubj = await fetch(`${base}/feedback`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ category: "general", subject: "hi", message: "Message long enough to pass the minimum length check required" }),
  });
  assert(fbShortSubj.status === 400, "Too-short subject returns 400");

  // 5. GET /feedback/my returns own submissions only
  const myFbRes = await fetch(`${base}/feedback/my`, { headers: authHeader });
  const myFbData = await myFbRes.json();
  assert(myFbRes.status === 200, "GET /feedback/my returns 200");
  assert(myFbData.success === true, "My feedback returns success=true");
  assert(Array.isArray(myFbData.feedback), "My feedback is an array");
  assert(myFbData.feedback.length >= 1, "My feedback includes submitted item");

  // 6. Admin analytics requires ADMIN role → citizen gets 403
  const adminFbRes = await fetch(`${base}/feedback/admin/analytics`, { headers: authHeader });
  assert(adminFbRes.status === 403, "Citizen cannot access admin feedback analytics (403)");

  // ─── FAQ TESTS ────────────────────────────────────────────────────────────
  console.log("\n📖 FAQ Endpoint Tests");

  // 1. Unauthenticated → 401
  const unauthedFaq = await fetch(`${base}/faq`);
  assert(unauthedFaq.status === 401, "GET /faq returns 401 when unauthenticated");

  // 2. Get FAQ list
  const faqRes = await fetch(`${base}/faq`, { headers: authHeader });
  const faqRespData = await faqRes.json();
  assert(faqRes.status === 200, "GET /faq returns 200 when authenticated");
  assert(faqRespData.success === true, "FAQ returns success=true");
  assert(Array.isArray(faqRespData.faq), "FAQ is an array");
  assert(faqRespData.faq.length >= 5, "FAQ has at least 5 items");

  // 3. Check required fields
  const firstItem = faqRespData.faq[0];
  assert(typeof firstItem.question === "string", "FAQ item has question field");
  assert(typeof firstItem.answer === "string", "FAQ item has answer field");
  assert(typeof firstItem.category === "string", "FAQ item has category field");
  assert(typeof firstItem.helpful === "number", "FAQ item has helpful count");

  // 4. GET /faq/categories
  const catRes = await fetch(`${base}/faq/categories`, { headers: authHeader });
  const catRespData = await catRes.json();
  assert(catRes.status === 200, "GET /faq/categories returns 200");
  assert(Array.isArray(catRespData.categories), "Categories is an array");
  assert(catRespData.categories.length > 0, "At least one category exists");

  // 5. Vote on FAQ item
  const faqId = firstItem.id;
  const voteRes = await fetch(`${base}/faq/${faqId}/vote`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ vote: "helpful" }),
  });
  const voteData = await voteRes.json();
  assert(voteRes.status === 200, "POST /faq/:id/vote returns 200");
  assert(voteData.success === true, "Vote returns success=true");
  assert(voteData.votes.helpful >= 1, "Helpful count incremented after vote");

  // 6. Invalid vote value → 400
  const badVoteRes = await fetch(`${base}/faq/${faqId}/vote`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ vote: "love" }),
  });
  assert(badVoteRes.status === 400, "Invalid vote value returns 400");

  // 7. Unknown FAQ ID → 404
  const unknownFaqVote = await fetch(`${base}/faq/faq-nonexistent/vote`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ vote: "helpful" }),
  });
  assert(unknownFaqVote.status === 404, "Vote on unknown FAQ ID returns 404");

  // ─── SUMMARY ──────────────────────────────────────────────────────────────
  server.close();

  console.log("\n==================================================");
  console.log(`U-GOV WORKSPACE UPGRADE TEST RESULTS`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runUpgradeTests().catch((err) => {
  console.error("FATAL: Upgrade test suite crashed:", err);
  process.exitCode = 1;
});
