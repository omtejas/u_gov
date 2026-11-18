import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GeminiProvider, classifyGeminiError } from "../ai/GeminiProvider";
import { AIToolGateway } from "../ai/AIToolGateway";
import { lookupGlossaryTerm, searchGlossaryEntries } from "../ai/localKnowledge";
import { searchFaqKnowledge } from "../routes/faq";
import { tokenizeSearchQuery, hasWholeWordMatch } from "../ai/retrieval";

const gateway = new AIToolGateway();
const baseContext = { userId: "test-citizen-1", citizenName: "Test Citizen", ip: "127.0.0.1" };

describe("Bharat G-Bot Grounding, Intent Gating, Retrieval Scoring & Resilience Suite", () => {
  it("tokenizes queries with word-boundary precision and eliminates substring false positives", async () => {
    // Substring traps observed in production
    assert.equal(hasWholeWordMatch("Department of Higher Education", "hi"), false);
    assert.equal(hasWholeWordMatch("mParivahan credential integration", "ration"), false);
    assert.equal(hasWholeWordMatch("annual household income", "use"), false);
    assert.equal(hasWholeWordMatch("AI-powered", "ai"), true);

    assert.deepEqual(tokenizeSearchQuery("What is AI?"), ["ai"]);
    assert.deepEqual(tokenizeSearchQuery("How can I use U-GOV as a developer?"), [
      "u-gov",
      "ugov",
      "gov",
      "developer",
    ]);

    // Retrieval checks on service catalogue & FAQ
    assert.deepEqual(await gateway.searchServices("hi"), []);
    assert.deepEqual(await gateway.searchServices("What is Ration?"), []);
    assert.deepEqual(await gateway.searchServices("What is AI?"), []);
    assert.deepEqual(await gateway.searchServices("How can I use U-GOV as a developer?"), []);
    assert.deepEqual(await gateway.searchServices("What documents are required for a ration card?"), []);

    const nsp = await gateway.searchServices("Find scholarships for college students.");
    assert.equal(nsp[0]?.serviceCode, "NSP");

    const dl = await gateway.searchServices("How do I renew a driving licence?");
    assert.equal(dl[0]?.serviceCode, "SARATHI-DL");

    const income = await gateway.searchServices("How do I apply for an income certificate?");
    assert.equal(income[0]?.serviceCode, "INCOME-CERT");

    assert.deepEqual(searchFaqKnowledge("What is AI?"), []);
  });

  it("distinguishes quota, rate-limit, authentication, invalid-model, timeout, and network errors cleanly", () => {
    assert.equal(classifyGeminiError({ message: "RESOURCE_EXHAUSTED: Quota exceeded for quota metric" }).category, "quota_exhausted");
    assert.equal(classifyGeminiError({ status: 429, message: "Too Many Requests rate limit" }).category, "rate_limit");
    assert.equal(classifyGeminiError({ status: 401, message: "API key invalid" }).category, "authentication");
    assert.equal(classifyGeminiError({ status: 404, message: "Model gemini-x not found" }).category, "invalid_model");
    assert.equal(classifyGeminiError(new Error("Gemini API call timed out")).category, "timeout");
    assert.equal(classifyGeminiError(new Error("fetch failed ECONNREFUSED")).category, "network_error");
  });

  it("resolves primary Gemini model cleanly with telemetry across the full Section C matrix", async () => {
    const capturedPrompts: Array<{ message: string; systemInstruction: string }> = [];
    const fakeClient = {
      models: {
        generateContent: async ({ model, contents, config }: any) => {
          const userMsg = contents[contents.length - 1]?.parts?.[0]?.text || "";
          capturedPrompts.push({ message: userMsg, systemInstruction: config?.systemInstruction || "" });
          assert.equal(model, "gemini-4-hydrogen");

          if (/^hi$/i.test(userMsg) || /^hello$/i.test(userMsg) || /^namaste$/i.test(userMsg) || /^good morning$/i.test(userMsg)) {
            return { text: "Namaste! How can I assist you with U-GOV today?" };
          }
          if (/what is ai/i.test(userMsg)) {
            return { text: "Artificial Intelligence (AI) is the simulation of human intelligence processes by computer systems." };
          }
          if (/what is ration/i.test(userMsg)) {
            return { text: "A Ration Card is an official household document issued under NFSA for subsidized foodgrains." };
          }
          if (/what is sih/i.test(userMsg)) {
            return { text: "Smart India Hackathon (SIH) is a nationwide innovation initiative led by AICTE and Ministry of Education." };
          }
          if (/developer/i.test(userMsg)) {
            return { text: "As a developer, run npm run dev for Express + React on port 3000 and integrate via /api/v1/*." };
          }
          return { text: `Grounded live response for: ${userMsg}` };
        },
      },
    } as any;

    const provider = new GeminiProvider(fakeClient);

    // Greetings must never trigger service recommendations or FAQs
    for (const greeting of ["hi", "Hello", "Namaste", "Good morning"]) {
      const res = await provider.generateResponse(
        { message: greeting, language: "en", conversationHistory: [], context: baseContext },
        gateway
      );
      assert.equal(res.intent, "GREETING");
      assert.equal(res.offlineFallback, false);
      assert.equal(res.retrieval?.serviceMatches.length, 0);
      assert.equal(res.retrieval?.faqMatches.length, 0);
      assert.equal(res.citations?.length, 0);
      assert.ok(!res.reply.includes("National Scholarship Portal"));
    }

    // "What is AI?" must not receive unrelated U-GOV FAQs or citizen services
    const aiRes = await provider.generateResponse(
      { message: "What is AI?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(aiRes.intent, "GENERAL_KNOWLEDGE");
    assert.equal(aiRes.retrieval?.serviceMatches.length, 0);
    assert.equal(aiRes.retrieval?.faqMatches.length, 0);
    assert.equal(aiRes.citations?.length, 0);

    // "What is Ration?" must not retrieve Driving Licence / SARATHI-DL
    const rationRes = await provider.generateResponse(
      { message: "What is Ration?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(rationRes.intent, "GENERAL_KNOWLEDGE");
    assert.equal(rationRes.retrieval?.serviceMatches.length, 0);
    assert.ok(!rationRes.reply.includes("Driving Licence"));
    assert.ok(!rationRes.reply.includes("SARATHI-DL"));

    // Developer query must not pull Income Certificate
    const devRes = await provider.generateResponse(
      { message: "How can I use U-GOV as a developer?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(devRes.intent, "DEVELOPER_GUIDANCE");
    assert.equal(devRes.retrieval?.serviceMatches.length, 0);
    assert.ok(!devRes.reply.includes("Income Certificate"));
  });

  it("falls back from gemini-4-hydrogen to gemini-3.1-flash-lite on model-level upstream error", async () => {
    const calls: string[] = [];
    const fakeClient = {
      models: {
        generateContent: async ({ model }: { model: string }) => {
          calls.push(model);
          if (model === "gemini-4-hydrogen") {
            const err: any = new Error("Model overloaded temporarily");
            err.status = 503;
            throw err;
          }
          return { text: "Ration cards under NFSA entitle eligible households to subsidized foodgrains." };
        },
      },
    } as any;

    const provider = new GeminiProvider(fakeClient);
    const res = await provider.generateResponse(
      { message: "What IS Ration", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );

    assert.deepEqual(calls, ["gemini-4-hydrogen", "gemini-3.1-flash-lite"]);
    assert.equal(res.model, "gemini-3.1-flash-lite");
    assert.equal(res.fallbackAttempted, true);
    assert.equal(res.offlineFallback, false);
    assert.ok(res.source.startsWith("Google Gemini"));
  });

  it("handles full Section C matrix accurately in offline fallback mode without unrelated services or FAQs", async () => {
    const fakeClient = {
      models: {
        generateContent: async () => {
          const err: any = new Error("RESOURCE_EXHAUSTED: Quota exceeded");
          err.status = 429;
          throw err;
        },
      },
    } as any;

    const provider = new GeminiProvider(fakeClient);

    // 1. Greetings ("hi", "Hello", "Namaste", "Good morning")
    for (const greeting of ["hi", "Hello", "Namaste", "Good morning"]) {
      const res = await provider.generateResponse(
        { message: greeting, language: "en", conversationHistory: [], context: baseContext },
        gateway
      );
      assert.equal(res.offlineFallback, true);
      assert.equal(res.errorCategory, "quota_exhausted");
      assert.equal(res.intent, "GREETING");
      assert.ok(res.reply.includes("Namaste!"), `Expected greeting reply for "${greeting}"`);
      assert.ok(!res.reply.includes("National Scholarship Portal"), `"${greeting}" leaked NSP`);
      assert.equal(res.retrieval?.serviceMatches.length, 0);
      assert.equal(res.citations?.length, 0);
    }

    // 2. General Knowledge ("What is AI?", "What is Ration?", "What is SIH?", "Explain cloud computing")
    const aiOffline = await provider.generateResponse(
      { message: "What is AI?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(aiOffline.intent, "GENERAL_KNOWLEDGE");
    assert.ok(aiOffline.reply.includes("Artificial Intelligence (AI)"));
    assert.ok(!aiOffline.reply.includes("Relevant U-GOV Help & FAQ"), "What is AI leaked unrelated U-GOV FAQs");
    assert.equal(aiOffline.retrieval?.serviceMatches.length, 0);
    assert.equal(aiOffline.retrieval?.faqMatches.length, 0);

    const rationOffline = await provider.generateResponse(
      { message: "What is Ration?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(rationOffline.intent, "GENERAL_KNOWLEDGE");
    assert.ok(rationOffline.reply.includes("National Food Security Act"));
    assert.ok(!rationOffline.reply.includes("Driving Licence"), "What is Ration leaked Driving Licence");
    assert.ok(!rationOffline.reply.includes("SARATHI-DL"), "What is Ration leaked SARATHI-DL");

    const sihOffline = await provider.generateResponse(
      { message: "What is SIH?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.ok(sihOffline.reply.includes("Smart India Hackathon"));
    assert.equal(sihOffline.retrieval?.serviceMatches.length, 0);

    const cloudOffline = await provider.generateResponse(
      { message: "Explain cloud computing", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.ok(cloudOffline.reply.includes("Cloud computing"));
    assert.equal(cloudOffline.retrieval?.serviceMatches.length, 0);

    // 3. Developer & Technical Queries (first ask + repeated ask in continuing conversation)
    const dev1 = await provider.generateResponse(
      { message: "How can I use U-GOV as a developer?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(dev1.intent, "DEVELOPER_GUIDANCE");
    assert.ok(dev1.reply.includes("npm run dev") && dev1.reply.includes("/api/v1/*"));
    assert.ok(!dev1.reply.includes("INCOME-CERT") && !dev1.reply.includes("Annual Income Certificate Issuance"));
    assert.equal(dev1.retrieval?.serviceMatches.length, 0);

    const devRepeat = await provider.generateResponse(
      {
        message: "How can I use U-GOV as a developer?",
        language: "en",
        conversationHistory: [
          { role: "user", text: "How can I use U-GOV as a developer?" },
          { role: "model", text: dev1.reply },
        ],
        context: baseContext,
      },
      gateway
    );
    assert.equal(devRepeat.intent, "DEVELOPER_GUIDANCE");
    assert.ok(devRepeat.reply.includes("npm run dev"));
    assert.ok(!devRepeat.reply.includes("INCOME-CERT"));

    // 4. Service Discovery & Requirement Queries
    const nspRes = await provider.generateResponse(
      { message: "Find scholarships for college students.", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(nspRes.intent, "GOVERNMENT_SERVICE");
    assert.equal(nspRes.retrieval?.serviceMatches[0]?.serviceCode, "NSP");
    assert.ok(nspRes.reply.includes("National Scholarship Portal"));

    const dlRes = await provider.generateResponse(
      { message: "How do I renew a driving licence?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(dlRes.intent, "GOVERNMENT_SERVICE");
    assert.equal(dlRes.retrieval?.serviceMatches[0]?.serviceCode, "SARATHI-DL");
    assert.ok(dlRes.reply.includes("SARATHI-DL"));

    const incRes = await provider.generateResponse(
      { message: "How do I apply for an income certificate?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(incRes.intent, "GOVERNMENT_SERVICE");
    assert.equal(incRes.retrieval?.serviceMatches[0]?.serviceCode, "INCOME-CERT");
    assert.ok(incRes.reply.includes("Annual Income Certificate Issuance"));

    const rationDocsRes = await provider.generateResponse(
      { message: "What documents are required for a ration card?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(rationDocsRes.intent, "GOVERNMENT_SERVICE");
    assert.equal(rationDocsRes.retrieval?.serviceMatches.length, 0);
    assert.ok(rationDocsRes.reply.includes("Aadhaar Cards of all family members"));
    assert.ok(!rationDocsRes.reply.includes("Ayushman") && !rationDocsRes.reply.includes("SARATHI-DL"));

    // 5. Original civic queries + offline source honesty + multilingual notice
    const legacyOfflineChecks = [
      ["What is Aadhaar?", "UIDAI"],
      ["What IS SIH", "Smart India Hackathon"],
      ["What IS Ration", "National Food Security Act"],
      ["What is U-GOV?", "Unified Governance"],
      ["What is DigiLocker?", "MeitY"],
      ["What is PM-KISAN?", "6,000"],
      ["What is the difference between Aadhaar and PAN?", "Permanent Account Number"],
    ] as const;

    for (const [message, expectedSubstring] of legacyOfflineChecks) {
      const res = await provider.generateResponse(
        { message, language: "en", conversationHistory: [], context: baseContext },
        gateway
      );
      assert.equal(res.offlineFallback, true);
      assert.equal(res.model, "local-verified-knowledge");
      assert.equal(
        res.source,
        "U-GOV Verified Local Knowledge (Offline — Live Gemini unavailable)"
      );
      assert.ok(res.reply.includes(expectedSubstring));
    }

    const hiRes = await provider.generateResponse(
      { message: "What is Ration?", language: "hi", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(hiRes.offlineFallback, true);
    assert.ok(hiRes.reply.includes("Offline language notice"));
    assert.ok(hiRes.reply.includes("Ration Card"));
  });

  it("handles unconfigured Gemini client gracefully with verified local knowledge and unavailable live probe", async () => {
    const provider = new GeminiProvider(null);
    const probe = await provider.probeHealth();
    assert.equal(probe.verified, false);
    assert.equal(probe.status, "UNAVAILABLE");
    assert.equal(probe.errorCategory, "not_configured");

    const res = await provider.generateResponse(
      { message: "What is the difference between Aadhaar and PAN?", language: "en", conversationHistory: [], context: baseContext },
      gateway
    );
    assert.equal(res.offlineFallback, true);
    assert.ok(res.reply.includes("Aadhaar"));
    assert.ok(res.reply.includes("Permanent Account Number"));
  });

  it("supports multi-term glossary matching and explainer lookup cleanly", () => {
    const comp = searchGlossaryEntries("What is the difference between Aadhaar and PAN?");
    const keys = comp.map((m) => m.key);
    assert.ok(keys.includes("aadhaar") && keys.includes("pan"));

    assert.equal(lookupGlossaryTerm("ration")?.matchedKey, "ration card");
    assert.equal(lookupGlossaryTerm("sih")?.matchedKey, "sih");
    assert.equal(lookupGlossaryTerm("domicile")?.matchedKey, "domicile");
  });
});
