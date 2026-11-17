import assert from "node:assert/strict";
import {
  classifyAIIntent,
  isPrivateContextualFollowup,
  safeGeminiHistory,
} from "../ai/AIIntentRouter";

const cases: Array<[string, string]> = [
  ["Explain Aadhaar in simple terms", "GENERAL_KNOWLEDGE"],
  ["What is SIH?", "GENERAL_KNOWLEDGE"],
  ["What is Smart India Hackathon?", "GENERAL_KNOWLEDGE"],
  ["Explain cloud computing", "GENERAL_KNOWLEDGE"],
  ["What scholarships can I apply for?", "GOVERNMENT_SERVICE"],
  ["Tell me about NSP", "GOVERNMENT_SERVICE"],
  ["Show me education services", "GOVERNMENT_SERVICE"],
  ["How do I renew a driving licence?", "GOVERNMENT_SERVICE"],
  ["What documents are required for a domicile certificate?", "GOVERNMENT_SERVICE"],
  ["Where is my application?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["Check my application status", "PRIVATE_CITIZEN_WORKFLOW"],
  ["What is my application status?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["What documents am I missing for scholarship?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["Am I ready for scholarship?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["What can U-GOV help me do?", "UGOV_NAVIGATION"],
];

for (const [message, expected] of cases) {
  assert.equal(classifyAIIntent(message), expected, message);
}

const contaminatedHistory = [
  { role: "user" as const, text: "Where is my application?" },
  { role: "model" as const, text: "Application status and tracking token: DOCUMENTS_REQUIRED." },
];
assert.equal(classifyAIIntent("What is Smart India Hackathon?"), "GENERAL_KNOWLEDGE");
assert.equal(isPrivateContextualFollowup("What is Smart India Hackathon?", contaminatedHistory), false);
assert.equal(
  isPrivateContextualFollowup("What does this status mean?", [
    { role: "user", text: "Where is my application?" },
  ]),
  true
);
assert.deepEqual(
  safeGeminiHistory(contaminatedHistory).map((item) => item.text),
  []
);

console.log("AI intent router tests passed.");
