import assert from "node:assert/strict";
import {
  classifyAIIntent,
  classifyAIIntentWithHistory,
  isPrivateContextualFollowup,
  safeGeminiHistory,
} from "../ai/AIIntentRouter";

const cases: Array<[string, string]> = [
  ["hi", "GREETING"],
  ["Hello", "GREETING"],
  ["Namaste", "GREETING"],
  ["Good morning", "GREETING"],
  ["Explain Aadhaar in simple terms", "GENERAL_KNOWLEDGE"],
  ["What is SIH?", "GENERAL_KNOWLEDGE"],
  ["What is Smart India Hackathon?", "GENERAL_KNOWLEDGE"],
  ["Explain cloud computing", "GENERAL_KNOWLEDGE"],
  ["What is AI?", "GENERAL_KNOWLEDGE"],
  ["What is Ration?", "GENERAL_KNOWLEDGE"],
  ["What is a ration card?", "GENERAL_KNOWLEDGE"],
  ["What scholarships can I apply for?", "GOVERNMENT_SERVICE"],
  ["Find scholarships for college students.", "GOVERNMENT_SERVICE"],
  ["Tell me about NSP", "GOVERNMENT_SERVICE"],
  ["Show me education services", "GOVERNMENT_SERVICE"],
  ["How do I renew a driving licence?", "GOVERNMENT_SERVICE"],
  ["What documents are required for a domicile certificate?", "GOVERNMENT_SERVICE"],
  ["What documents are required for a ration card?", "GOVERNMENT_SERVICE"],
  ["How do I apply for an income certificate?", "GOVERNMENT_SERVICE"],
  ["Where is my application?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["Check my application status", "PRIVATE_CITIZEN_WORKFLOW"],
  ["What is my application status?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["What documents am I missing for scholarship?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["Am I ready for scholarship?", "PRIVATE_CITIZEN_WORKFLOW"],
  ["What can U-GOV help me do?", "UGOV_NAVIGATION"],
  ["How can I use U-GOV as a developer?", "DEVELOPER_GUIDANCE"],
  ["What technology stack does U-GOV use?", "DEVELOPER_GUIDANCE"],
  ["How does Bharat G-Bot work?", "DEVELOPER_GUIDANCE"],
  ["How do I upload a document to DigiVault?", "DOCUMENT_ASSISTANCE"],
  ["How do I track an application?", "APPLICATION_GUIDANCE"],
];

for (const [message, expected] of cases) {
  assert.equal(classifyAIIntent(message), expected, `Intent mismatch for "${message}"`);
}

// Multi-turn continuation without cross-turn leakage
assert.equal(
  classifyAIIntentWithHistory("Tell me more", [
    { role: "user", text: "How can I use U-GOV as a developer?" },
    { role: "model", text: "Developers can run U-GOV locally using npm run dev." },
  ]),
  "DEVELOPER_GUIDANCE"
);

// Private citizen context must never bleed into subsequent general/developer prompts
const contaminatedHistory = [
  { role: "user" as const, text: "Where is my application?" },
  { role: "model" as const, text: "Application status and tracking token: DOCUMENTS_REQUIRED." },
];
assert.equal(classifyAIIntent("What is Smart India Hackathon?"), "GENERAL_KNOWLEDGE");
assert.equal(isPrivateContextualFollowup("What is Smart India Hackathon?", contaminatedHistory), false);
assert.equal(
  classifyAIIntentWithHistory("Tell me more", contaminatedHistory),
  "GENERAL_KNOWLEDGE"
);
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
