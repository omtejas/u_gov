import { AIChatMessage } from "./AIProvider";

export type AIIntent =
  | "GREETING"
  | "GENERAL_KNOWLEDGE"
  | "GOVERNMENT_SERVICE"
  | "APPLICATION_GUIDANCE"
  | "DOCUMENT_ASSISTANCE"
  | "PRIVATE_CITIZEN_WORKFLOW"
  | "UGOV_NAVIGATION"
  | "DEVELOPER_GUIDANCE";

const GREETING_ONLY =
  /^(?:hi+|hello+|hey+|namaste|namaskar|good\s+(?:morning|afternoon|evening)|greetings|howdy|thanks?|thank\s+you|bye|goodbye)(?:[\s,!.-]*(?:there|bharat\s*g-?bot|g-?bot|bot|sir|ma'?am|team|everyone))?[\s!.,?]*$/i;
const GREETING_WHO_ARE_YOU = /^(?:who are you|help me|what are you)[?!.\s]*$/i;

const PRIVATE_REQUEST =
  /\b(where is my application|show my application|(?:what is my|check my|show my|tell me my) application status|check (?:my )?application status|application status (?:for|of) my|track (?:my )?application|tracking token|my application number|my documents|document readiness|am i ready(?: for| to)?|what am i missing|what documents am i missing|missing documents|check my readiness|readiness score)\b|\b(?:ugov-\d{4}-[a-z0-9-]+|app-\d+-[a-f0-9]+)\b/i;

const DEVELOPER_REQUEST =
  /\b(as a developer|developer|developers|dev setup|tech(?:nology)? stack|system architecture|codebase|repository|repo|contribute|contributing|pull request|open source|api endpoints?|api routes?|rest api|backend architecture|frontend architecture|how does (?:bharat )?g-?bot work|how (?:is|was) u-?gov built|typescript|vite|express|node\.?js|npm test|run locally|database schema|tool gateway)\b/i;

const DOCUMENT_ASSISTANCE_REQUEST =
  /\b((?:what is|about|use|how to use) (?:u-?gov )?(?:digital vault|digivault)|how (?:do i|can i|to) upload (?:a )?documents?|supported document formats?|allowed file formats?|maximum file size|sha-?256 checksum|how does consent work|how (?:do i|can i|to) (?:grant|revoke) consent|consent center)\b/i;

const APPLICATION_GUIDANCE_REQUEST =
  /\b(how (?:do i|can i|to) track (?:an|my|the)?\s*application|how (?:does )?(?:the )?tracker work|how (?:do i|can i|to) apply for (?:a )?government service|how (?:do i|can i|to) cancel (?:an )?application|application lifecycle)\b/i;

const SERVICE_ACTION_REQUEST =
  /\b(scholarships?|nsp|sarathi|rto|pm-?kisan|ayushman bharat|pm-?jay|mahadbt|passport seva|voter id|government services?|government schemes?|education services|health services|agriculture services|transport services|revenue services|public services?)\b|\b(?:apply(?:ing)? for|renew(?:ing)?|eligibility for|documents? (?:are )?required for|check requirements for|tell me about)\s+(?:a |an |the )?(?:driving licen[cs]e|learner'?s licen[cs]e|domicile certificate|income certificate|caste certificate|ration card|pan card|aadhaar|passport|scholarship|pm-?kisan|ayushman)\b|\b(?:driving licen[cs]e|domicile certificate|income certificate)\b(?<!^what is (?:a |an )?(?:driving licen[cs]e|domicile certificate|income certificate)[?!.\s]*$)/i;

const NAVIGATION_REQUEST =
  /\b(what is u-?gov|tell me about u-?gov|how does u-?gov work|what can u-?gov do|what can u-?gov help|how (?:do i|can i) use (?:u-?gov|bharat g-?bot)|where is (?:the )?(?:document )?vault|where can i find (?:the )?(?:document )?vault|how do i navigate u-?gov|u-gov features|government web hub|life bio)\b/i;

const PRIVATE_FOLLOWUP =
  /^(?:what does (?:this|that|it) mean|what does (?:this|that) status mean|explain (?:this|that) status|why is it pending|what is the next step|what should i do next|what does pending mean|what does ready mean)[?.! ]*$/i;

const CONTINUATION_FOLLOWUP =
  /^(?:and |what about |tell me more|can you explain more|elaborate|give an example|how does it work|what else|same question|repeat|why\??|how do i start|get started)[?.!\s]*$/i;

export function classifyAIIntent(message: string): AIIntent {
  const current = message.trim();
  if (!current) return "GENERAL_KNOWLEDGE";

  // 1. Greetings & social openers must never trigger service recommendations
  if (GREETING_ONLY.test(current) || GREETING_WHO_ARE_YOU.test(current)) {
    return "GREETING";
  }

  // 2. Private citizen workflow queries stay strictly inside local authenticated tools
  if (PRIVATE_REQUEST.test(current)) {
    return "PRIVATE_CITIZEN_WORKFLOW";
  }

  // 3. Developer & technical architecture queries before general U-GOV navigation or service search
  if (DEVELOPER_REQUEST.test(current)) {
    return "DEVELOPER_GUIDANCE";
  }

  // 4. U-GOV document vault & consent guidance (platform usage, not scheme lookup)
  if (DOCUMENT_ASSISTANCE_REQUEST.test(current)) {
    return "DOCUMENT_ASSISTANCE";
  }

  // 5. Generic U-GOV application tracking / submission workflow guidance
  if (APPLICATION_GUIDANCE_REQUEST.test(current)) {
    return "APPLICATION_GUIDANCE";
  }

  // 6. Specific government service discovery / actionable scheme questions
  // Note: conceptual questions like "What is Ration?" or "What is AI?" stay GENERAL_KNOWLEDGE
  if (SERVICE_ACTION_REQUEST.test(current) && !/^what is (?:a |an )?(?:ration|ration card|aadhaar|pan|sih|ai|cloud computing)[?!.\s]*$/i.test(current)) {
    return "GOVERNMENT_SERVICE";
  }

  // 7. General U-GOV product navigation & overview
  if (NAVIGATION_REQUEST.test(current)) {
    return "UGOV_NAVIGATION";
  }

  return "GENERAL_KNOWLEDGE";
}

/**
 * Classifies intent while supporting short conversational follow-ups in multi-turn sessions
 * without letting private citizen context bleed into unrelated general questions.
 */
export function classifyAIIntentWithHistory(
  message: string,
  history: AIChatMessage[] = []
): AIIntent {
  const direct = classifyAIIntent(message);
  if (direct !== "GENERAL_KNOWLEDGE") {
    return direct;
  }

  const trimmed = message.trim();
  const isAnaphoricFollowup =
    CONTINUATION_FOLLOWUP.test(trimmed) ||
    (trimmed.split(/\s+/).length <= 5 && /\b(it|this|that|they|more|same)\b/i.test(trimmed));

  if (!isAnaphoricFollowup) {
    return direct;
  }

  const prevUserMessages = history.filter((item) => item.role === "user").slice(-3).reverse();
  for (const prev of prevUserMessages) {
    const prevIntent = classifyAIIntent(prev.text);
    if (prevIntent !== "GREETING" && prevIntent !== "PRIVATE_CITIZEN_WORKFLOW") {
      return prevIntent;
    }
  }

  return direct;
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
  return /\b(application status|current lifecycle state|tracking token|my application|my documents|document readiness|readiness score|missing documents|verified in vault|consent_required|documents_required|ugov-\d{4}-[a-z0-9-]+|app-\d+-[a-f0-9]+)\b/i.test(
    message
  );
}

export function safeGeminiHistory(history: AIChatMessage[] = []): AIChatMessage[] {
  return history
    .filter((item) => !isPrivateHistoryMessage(item.text))
    .slice(-8)
    .map((item) => ({ role: item.role, text: item.text.slice(0, 1200) }));
}
