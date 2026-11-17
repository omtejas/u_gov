import { AIChatMessage } from "./AIProvider";

export type AIIntent =
  | "GENERAL_KNOWLEDGE"
  | "GOVERNMENT_SERVICE"
  | "PRIVATE_CITIZEN_WORKFLOW"
  | "UGOV_NAVIGATION";

const PRIVATE_REQUEST = /\b(where is my application|show my application|check (?:my )?application status|application status (?:for|of) my|track (?:my )?application|tracking token|my application number|my documents|document readiness|am i ready(?: for| to)?|what am i missing|what documents am i missing|check my readiness|readiness score)\b|\b(?:ugov-\d{4}-[a-z0-9-]+|app-\d+-[a-f0-9]+)\b/i;
const SERVICE_REQUEST = /\b(scholarship|nsp|driving licence|driving license|learner'?s licence|sarathi|rto|domicile certificate|domicile|income certificate|caste certificate|non.?creamy layer|pm.?kisan|ayushman bharat|passport seva|voter id|pan card service|government service|service code)\b/i;
const NAVIGATION_REQUEST = /\b(what can u.?gov do|what can u.?gov help|how (?:do i|can i) use (?:u.?gov|bharat g.?bot)|where is (?:the )?(?:document )?vault|where can i find (?:the )?(?:document )?vault|how do i navigate u.?gov|u.?gov features)\b/i;
const PRIVATE_FOLLOWUP = /^(?:what does (?:this|that|it) mean|what does (?:this|that) status mean|explain (?:this|that) status|why is it pending|what is the next step|what should i do next|what does pending mean|what does ready mean)[?.! ]*$/i;

export function classifyAIIntent(message: string): AIIntent {
  const current = message.trim();
  if (PRIVATE_REQUEST.test(current)) return "PRIVATE_CITIZEN_WORKFLOW";
  if (NAVIGATION_REQUEST.test(current)) return "UGOV_NAVIGATION";
  if (SERVICE_REQUEST.test(current)) return "GOVERNMENT_SERVICE";
  return "GENERAL_KNOWLEDGE";
}

export function isPrivateContextualFollowup(
  message: string,
  history: AIChatMessage[] = []
): boolean {
  if (classifyAIIntent(message) !== "GENERAL_KNOWLEDGE" || !PRIVATE_FOLLOWUP.test(message.trim())) {
    return false;
  }
  const previousUserMessage = history.filter((item) => item.role === "user").slice(-1)[0]?.text || "";
  return PRIVATE_REQUEST.test(previousUserMessage);
}

export function isPrivateHistoryMessage(message: string): boolean {
  return /\b(application status|current lifecycle state|tracking token|my application|my documents|document readiness|readiness score|missing documents|verified in vault|consent_required|documents_required|ugov-\d{4}-[a-z0-9-]+|app-\d+-[a-f0-9]+)\b/i.test(message);
}

export function safeGeminiHistory(history: AIChatMessage[] = []): AIChatMessage[] {
  return history
    .filter((item) => !isPrivateHistoryMessage(item.text))
    .slice(-8)
    .map((item) => ({ role: item.role, text: item.text.slice(0, 1200) }));
}
