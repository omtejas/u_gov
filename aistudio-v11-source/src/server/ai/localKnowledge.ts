/**
 * U-AI — Verified Local Knowledge & Statutory Glossary
 *
 * Shared deterministic knowledge source backing:
 * 1. POST /api/v1/ai/explain
 * 2. GeminiProvider grounded context & verified offline fallback
 *    when the live Gemini API is unavailable.
 */

import { AIChatRequest, AIChatResponse, AIResponseCitation, AIRetrievalTrace } from "./AIProvider";
import { AIIntent } from "./AIIntentRouter";
import {
  MIN_KNOWLEDGE_RELEVANCE_SCORE,
  hasWholeWordMatch,
  scoreWeightedFields,
  tokenizeSearchQuery,
} from "./retrieval";

export type KnowledgeCategory = "civic" | "platform" | "developer" | "technology";

export interface GlossaryEntry {
  title: string;
  category: KnowledgeCategory;
  aliases?: string[];
  keywords?: string[];
  simpleExplanation: string;
  realLifeExample: string;
  whyGovernmentAsks?: string;
  whereToGetIt?: string;
  documentsNeeded?: string[];
  issuingAuthority?: string;
  keyHighlights?: string[];
  officialUrl?: string;
}

export const STATUTORY_GLOSSARY: Record<string, GlossaryEntry> = {
  domicile: {
    title: "Domicile / Residence Certificate",
    category: "civic",
    aliases: ["domicile certificate", "residence certificate"],
    simpleExplanation:
      "A Domicile Certificate is official proof that you have resided in a particular State continuously for 10-15 years.",
    realLifeExample:
      "Required when applying for state engineering/medical college seats under local state quota.",
    whyGovernmentAsks:
      "To ensure state benefits reach genuine residents of that state.",
    whereToGetIt: "Tehsildar Office, Citizen Service Center (CSC), or State Seva Portal.",
    documentsNeeded: [
      "Aadhaar Card",
      "Ration Card or Electricity Bill (10+ yrs)",
      "School Leaving Certificate",
      "Affidavit",
    ],
    issuingAuthority: "Sub-Divisional Magistrate (SDM) / Tehsildar",
    officialUrl: "https://aaplesarkar.mahaonline.gov.in",
  },
  "non-creamy layer": {
    title: "OBC Non-Creamy Layer (NCL) Certificate",
    category: "civic",
    aliases: ["ncl", "creamy layer"],
    simpleExplanation:
      "An official certificate showing your family's annual income is below the OBC Creamy Layer limit (currently ₹8 Lakh/year).",
    realLifeExample:
      "If your family earns ₹4.5 Lakh/year, this proves you qualify for OBC quota reservation benefits.",
    whyGovernmentAsks:
      "To ensure reservation benefits reach families in genuine financial need.",
    whereToGetIt: "Revenue Department or District Magistrate Office.",
    documentsNeeded: [
      "Caste Certificate",
      "Income Certificate for last 3 years",
      "Form 16 / ITR",
      "Aadhaar Card",
    ],
    issuingAuthority: "Revenue Officer / SDO",
  },
  mutation: {
    title: "Land Mutation (Ferfar / Dakhil Kharij)",
    category: "civic",
    aliases: ["ferfar", "dakhil kharij", "land mutation"],
    simpleExplanation:
      "Land Mutation (Ferfar / Dakhil Kharij) is the official transfer of ownership title in government revenue records after buying land.",
    realLifeExample:
      "Updates the government land ledger so property tax notices are billed to the new buyer.",
    whyGovernmentAsks:
      "To maintain an accurate public record of legal land ownership.",
    whereToGetIt: "Talathi / Patwari Office or State Bhulekh online portal.",
    documentsNeeded: [
      "Registered Sale Deed",
      "Previous 7/12 Extract",
      "Identity Proof",
      "Affidavit",
    ],
    issuingAuthority: "Tehsildar / Land Records Department",
  },
  aadhaar: {
    title: "Aadhaar (UIDAI 12-Digit Resident Identity)",
    category: "civic",
    aliases: ["aadhar", "uidai", "e-aadhaar"],
    simpleExplanation:
      "A 12-digit verifiable resident identity number issued by UIDAI linked to demographic and biometric records.",
    realLifeExample:
      "Used for e-KYC verification on scholarships, welfare DBT transfers, and citizen portals.",
    whyGovernmentAsks:
      "To verify unique identity and prevent duplicate benefit disbursements.",
    whereToGetIt: "UIDAI Aadhaar Seva Kendra or https://myaadhaar.uidai.gov.in.",
    documentsNeeded: ["Proof of Identity", "Proof of Address", "Date of Birth Proof"],
    issuingAuthority: "Unique Identification Authority of India (UIDAI)",
    officialUrl: "https://myaadhaar.uidai.gov.in",
  },
  pan: {
    title: "Permanent Account Number (PAN)",
    category: "civic",
    aliases: ["pan card", "permanent account number", "cbdt"],
    simpleExplanation:
      "Permanent Account Number (PAN) is a 10-character alphanumeric tax identity issued by the Income Tax Department.",
    realLifeExample:
      "Required for opening bank accounts, filing ITR, and verifying high-value financial transactions.",
    whyGovernmentAsks:
      "To link statutory financial and tax compliance records to a taxpayer.",
    whereToGetIt: "Income Tax e-Filing portal, Protean (NSDL), or UTIITSL portals.",
    documentsNeeded: ["Aadhaar Card", "Passport-size Photograph", "Date of Birth Proof"],
    issuingAuthority: "Central Board of Direct Taxes (CBDT)",
    officialUrl: "https://www.incometax.gov.in",
  },
  "income certificate": {
    title: "Annual Household Income Certificate",
    category: "civic",
    aliases: ["income proof", "family income certificate"],
    simpleExplanation:
      "An official revenue statement certifying total annual household income across all earning members.",
    realLifeExample:
      "Required when applying for National Scholarship Portal (NSP) fee waivers or EWS quota.",
    whyGovernmentAsks:
      "To target income-linked subsidies and educational fee concessions fairly.",
    whereToGetIt: "State Seva / e-District Portal or Tehsildar Office.",
    documentsNeeded: [
      "Aadhaar Card",
      "Salary Slip / ITR / Talathi Report",
      "Ration Card",
      "Self-Declaration",
    ],
    issuingAuthority: "Tehsildar / Sub-Divisional Officer",
  },
  "caste certificate": {
    title: "Community / Caste Certificate",
    category: "civic",
    aliases: ["jati praman patra", "category certificate"],
    simpleExplanation:
      "Official statutory verification certifying belonging to a scheduled or backward community category.",
    realLifeExample:
      "Used during public employment recruitment, scholarships, and college admissions.",
    whyGovernmentAsks:
      "To administer constitutional affirmative-action benefits accurately.",
    whereToGetIt: "District Social Welfare / Revenue Office or State e-District Portal.",
    documentsNeeded: [
      "Aadhaar Card",
      "School Leaving Certificate",
      "Family Genealogy / Revenue Proof",
    ],
    issuingAuthority: "Sub-Divisional Magistrate / Competent Authority",
  },
  "driving licence": {
    title: "Driving Licence (Sarathi / MoRTH)",
    category: "civic",
    aliases: ["driving license", "sarathi", "dl renewal", "learner licence"],
    simpleExplanation:
      "Official statutory authorization issued by the Regional Transport Office (RTO) to drive specific motor vehicle classes.",
    realLifeExample:
      "Validated digitally inside DigiLocker and mParivahan during traffic inspections.",
    whyGovernmentAsks:
      "To ensure road safety competence and lawful vehicle operation.",
    whereToGetIt: "Sarathi Parivahan portal (https://sarathi.parivahan.gov.in) or local RTO.",
    documentsNeeded: [
      "Learner's Licence",
      "Aadhaar Card",
      "Age & Address Proof",
      "Medical Form 1A (if applicable)",
    ],
    issuingAuthority: "Regional Transport Office (RTO) / MoRTH",
    officialUrl: "https://sarathi.parivahan.gov.in",
  },
  "ration card": {
    title: "Ration Card (Public Distribution System / NFSA)",
    category: "civic",
    aliases: ["ration", "pds", "nfsa", "one nation one ration card", "onorc"],
    simpleExplanation:
      "A Ration Card is an official household entitlement document issued by State Food & Civil Supplies departments under the National Food Security Act (NFSA) to distribute subsidized foodgrains through Fair Price Shops.",
    realLifeExample:
      "Used by eligible families to claim subsidized rice, wheat, and coarse grains via Aadhaar-authenticated e-POS ration shops under One Nation One Ration Card (ONORC) and as household address proof.",
    whyGovernmentAsks:
      "To verify household composition, income category (AAY/PHH), and prevent duplicate food subsidy claims.",
    whereToGetIt:
      "State Food & Civil Supplies portal, Mera Ration app, or https://nfsa.gov.in.",
    documentsNeeded: [
      "Aadhaar Cards of all family members",
      "Household Address Proof (Electricity/Water Bill or Rent Agreement)",
      "Family Income Certificate / Self-Declaration",
      "Head of Family Photograph",
    ],
    issuingAuthority: "State Department of Food & Civil Supplies / NFSA",
    officialUrl: "https://nfsa.gov.in",
  },
  digilocker: {
    title: "DigiLocker Digital Document Wallet",
    category: "civic",
    aliases: ["digi locker", "meri pehchaan", "digital locker"],
    simpleExplanation:
      "DigiLocker is a flagship Digital India cloud platform operated by MeitY that lets Indian citizens store and share authentic digital documents directly from government issuers.",
    realLifeExample:
      "Lets motorists present a legally valid digital Driving Licence and Vehicle RC retrieved from MoRTH without carrying paper originals.",
    whyGovernmentAsks:
      "To enable paperless, consent-driven verification across universities, employers, and citizen portals.",
    whereToGetIt: "https://www.digilocker.gov.in or the official DigiLocker mobile app.",
    documentsNeeded: ["Aadhaar Number or Mobile Number linked to Aadhaar"],
    issuingAuthority: "Ministry of Electronics and Information Technology (MeitY)",
    officialUrl: "https://www.digilocker.gov.in",
  },
  sih: {
    title: "Smart India Hackathon (SIH)",
    category: "civic",
    aliases: ["smart india hackathon", "sih26129"],
    simpleExplanation:
      "Smart India Hackathon (SIH) is a nationwide innovation initiative led by the Ministry of Education's Innovation Cell and AICTE where student teams build digital solutions for real government and industry problem statements.",
    realLifeExample:
      "U-GOV itself is structured around civic Digital Public Infrastructure problem statements (such as SIH26129) focused on unified citizen service access.",
    whyGovernmentAsks:
      "Encourages collaborative open innovation across universities to solve public-sector service delivery challenges.",
    whereToGetIt: "https://www.sih.gov.in",
    documentsNeeded: ["Student Team Registration via Institutional SPOC"],
    issuingAuthority: "Ministry of Education Innovation Cell & AICTE",
    officialUrl: "https://www.sih.gov.in",
  },
  "pm-kisan": {
    title: "PM-KISAN Samman Nidhi",
    category: "civic",
    aliases: ["pm kisan", "kisan samman", "kisan"],
    simpleExplanation:
      "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) is a Central Sector scheme providing ₹6,000 per year in three ₹2,000 Direct Benefit Transfer (DBT) installments to eligible landholding farmer families.",
    realLifeExample:
      "Registered farmers receive DBT support directly into their Aadhaar-seeded bank accounts after e-KYC verification.",
    whyGovernmentAsks:
      "To verify cultivable landholding records, Aadhaar e-KYC, and bank account seeding.",
    whereToGetIt: "https://pmkisan.gov.in or local CSC / Patwari office.",
    documentsNeeded: ["Aadhaar Card", "Landholding (7/12 or Khatauni) Record", "Aadhaar-seeded Bank Account"],
    issuingAuthority: "Ministry of Agriculture & Farmers Welfare",
    officialUrl: "https://pmkisan.gov.in",
  },
  "ayushman bharat": {
    title: "Ayushman Bharat PM-JAY",
    category: "civic",
    aliases: ["ayushman", "pm-jay", "pmjay", "abha"],
    simpleExplanation:
      "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY) provides up to ₹5 lakh per family per year in cashless secondary and tertiary hospitalization coverage at empanelled hospitals.",
    realLifeExample:
      "Eligible families present their Ayushman Card / ABHA ID at an empanelled hospital for cashless inpatient treatment.",
    whyGovernmentAsks:
      "To verify SECC/eligible household inclusion and prevent duplicate hospitalization claims.",
    whereToGetIt: "https://beneficiary.nha.gov.in or Ayushman Bharat CSC centre.",
    documentsNeeded: ["Aadhaar Card", "Ration Card / PM-JAY Family ID"],
    issuingAuthority: "National Health Authority (NHA)",
    officialUrl: "https://pmjay.gov.in",
  },
  "u-gov": {
    title: "U-GOV Unified Governance Platform",
    category: "platform",
    aliases: ["ugov", "u gov", "u-gov platform", "u-gov features"],
    simpleExplanation:
      "U-GOV is the Unified Governance & Citizen Services Platform prototype (SIH26129) combining a Service Directory (U-SERVICES), Citizen Document Vault (U-DOCS), Explicit Consent Center, Application Tracker, Verified Government Web Hub, Life Bio, and Bharat G-Bot.",
    realLifeExample:
      "A citizen stores an Aadhaar and Income Certificate in DigiVault with SHA-256 checksums, grants explicit department consent, and tracks a prototype scholarship application.",
    whyGovernmentAsks:
      "Demonstrates single-window consent-driven service delivery with a tamper-evident audit ledger.",
    whereToGetIt: "Available inside this U-GOV workspace across Services, DigiVault, Tracker, and Web Hub.",
    documentsNeeded: ["Aadhaar Identity Document", "Service-specific eligibility documents"],
    issuingAuthority: "U-GOV National Unified Governance Prototype (SIH26129)",
  },
  digivault: {
    title: "U-DOCS / DigiVault Sovereign Document Vault",
    category: "platform",
    aliases: ["u-docs", "digital vault", "document vault", "upload document", "consent center", "u-consent"],
    keywords: ["pdf", "jpeg", "png", "5 mb", "sha-256", "checksum", "revoke", "consent"],
    simpleExplanation:
      "U-GOV DigiVault (U-DOCS) is a private per-citizen document repository supporting PDF, JPEG, and PNG files up to 5 MB with magic-byte validation, SHA-256 checksums, and strict owner-only access. U-CONSENT binds explicit purpose and time-limited sharing permissions that citizens can revoke anytime.",
    realLifeExample:
      "Upload Aadhaar or Income Certificates once to DigiVault, evaluate service readiness automatically, and revoke consent immediately after submission.",
    keyHighlights: [
      "Supported formats: PDF (recommended), JPEG, PNG up to 5 MB with binary header checks",
      "Integrity: SHA-256 file checksum verified on download/attachment",
      "Privacy: Stored with 0o600 permissions outside static public routes; never shared without explicit consent",
    ],
  },
  "application tracker": {
    title: "U-APPLICATIONS Tracker & Lifecycle Engine",
    category: "platform",
    aliases: ["tracker", "application lifecycle", "track an application", "cancel application"],
    keywords: ["draft", "documents_required", "ready", "consent_required", "submitted", "processing"],
    simpleExplanation:
      "The U-GOV Application Tracker manages end-to-end prototype application states from creation through document attachment, consent authorization, sandbox submission, and cancellation.",
    realLifeExample:
      "Start a scholarship or domicile application, check missing documents automatically, grant consent, and inspect tracking tokens and status milestones in the Tracker tab.",
    keyHighlights: [
      "Lifecycle states: DRAFT → DOCUMENTS_REQUIRED → READY → CONSENT_REQUIRED → CONSENT_GRANTED → SUBMITTED → PROCESSING → APPROVED/REJECTED/CANCELLED",
      "Integrity lock prevents mutating documents or consents once submitted",
      "All transitions are written to the SHA-256 hash-chained U-AUDIT ledger",
    ],
  },
  "developer guide": {
    title: "Using & Developing with U-GOV (Developer Guide)",
    category: "developer",
    aliases: [
      "use u-gov as a developer",
      "how can i use u-gov as a developer",
      "developer",
      "developers",
      "run locally",
      "local setup",
      "contribute",
      "contributing",
      "api endpoints",
      "rest api",
    ],
    keywords: [
      "npm", "vite", "express", "typescript", "port 3000", "api/v1", "ugov_data_dir",
      "gemini_api_key", "firebase", "schema.sql", "audit", "test", "lint", "build",
    ],
    simpleExplanation:
      "Developers can run, inspect, extend, and integrate with U-GOV locally as a full-stack TypeScript web application powered by a Vite + React 19 frontend and an Express Node.js backend (`server.ts`) served on port 3000.",
    realLifeExample:
      "Run `npm run dev` to launch the unified Express + Vite middleware server on `http://localhost:3000`, interact with REST endpoints under `/api/v1/*`, run `npm test` across isolated `UGOV_DATA_DIR` test suites, or build production bundles via `npm run build`.",
    keyHighlights: [
      "Local Dev & Build: `npm install`, `npm run dev` (Express + Vite on port 3000), `npm run lint` (`tsc --noEmit`), `npm run build`, and `npm test` (`tsx src/server/tests/run-all.ts`).",
      "Backend REST APIs (`/api/v1/*`): `/auth` (scrypt + HttpOnly SHA-256 session cookies + Origin/Host CSRF protection), `/documents`, `/services`, `/applications`, `/consent`, `/integrations` (mock:// SSFR-guarded adapters), `/web-hub`, `/life-bio`, `/ai/chat`, `/ai/health`, `/ai/explain`, and `/admin`.",
      "Persistence & Config: Uses atomic JSON store (`ugov_store.json`) with optional `UGOV_DATA_DIR`, includes `src/server/database/schema.sql` PostgreSQL DDL reference and Firebase Auth/Firestore client integration, and configures Gemini via server-side `GEMINI_API_KEY` + `GEMINI_MODEL`.",
      "Extension Pattern: New public services are added in `src/server/database/db.ts` (`governmentServices`) and `AIToolGateway`, AI providers implement `AIProvider` in `src/server/ai/AIProvider.ts`, and private citizen lookups stay strictly inside citizen-scoped `AIToolGateway` methods.",
    ],
  },
  "tech stack": {
    title: "U-GOV Technical Architecture & Stack",
    category: "developer",
    aliases: [
      "technology stack",
      "tech stack",
      "system architecture",
      "backend architecture",
      "frontend architecture",
      "how is u-gov built",
      "database schema",
    ],
    keywords: ["react", "tailwind", "express", "node.js", "typescript", "scrypt", "sha-256", "genai"],
    simpleExplanation:
      "U-GOV is built with React 19, TypeScript, Vite 6, and Tailwind CSS v4 on the frontend, paired with an Express 4 + Node.js backend (`tsx` in dev, `esbuild` bundle in production) using `@google/genai` for Bharat G-Bot and a SHA-256 hash-chained append-only audit ledger (`U-AUDIT`).",
    realLifeExample:
      "UI views communicate exclusively via same-origin `/api/v1/*` JSON endpoints protected by HttpOnly cookies, Origin/Host CSRF verification, sliding-window rate limiting, and per-user IDOR ownership checks.",
    keyHighlights: [
      "Frontend: React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Lucide React + Motion.",
      "Backend & Security: Express 4 (`server.ts`), salted `scrypt` password hashing, 256-bit SHA-256 hashed session tokens, `X-Frame-Options: DENY` & CSP headers.",
      "AI Layer (`src/server/ai/`): Intent Router (`AIIntentRouter`), whole-word scored retrieval (`retrieval.ts`), IDOR-protected `AIToolGateway`, `GeminiProvider` failover (`gemini-4-hydrogen` → `gemini-3.1-flash-lite`), and verified offline local knowledge.",
    ],
  },
  "ai architecture": {
    title: "Bharat G-Bot (U-AI) Architecture & Retrieval Pipeline",
    category: "developer",
    aliases: [
      "how does bharat g-bot work",
      "bharat g-bot architecture",
      "g-bot architecture",
      "tool gateway",
    ],
    keywords: ["intent", "retrieval", "tokenization", "gemini", "fallback", "offline", "idor"],
    simpleExplanation:
      "Bharat G-Bot processes each prompt through a five-stage pipeline: (1) Intent Classification (`AIIntentRouter`), (2) Intent-gated whole-word retrieval (`retrieval.ts`), (3) IDOR-protected Tool Gateway (`AIToolGateway`) for private vault/application lookups, (4) PII-redacted live Gemini execution with bounded timeout & model failover, and (5) Verified Local Knowledge fallback when Gemini is unavailable.",
    realLifeExample:
      "Greetings (`GREETING`) and general questions (`GENERAL_KNOWLEDGE`) never trigger citizen service recommendations, whereas private vault or status requests execute locally without exposing citizen records to external LLMs.",
    keyHighlights: [
      "Intent gating strictly limits `searchServices` to `GOVERNMENT_SERVICE` intents and filters FAQ categories by intent.",
      "Word-boundary scoring prevents substring bugs (e.g. 'hi' matching 'Higher' or 'ration' matching 'integration').",
      "Offline responses always label their actual `local-verified-knowledge` source and never masquerade as live Gemini.",
    ],
  },
  "artificial intelligence": {
    title: "Artificial Intelligence (AI)",
    category: "technology",
    aliases: ["ai", "machine learning", "generative ai", "llm"],
    keywords: ["neural", "models", "reasoning", "nlp", "automation", "intelligence"],
    simpleExplanation:
      "Artificial Intelligence (AI) is a branch of computer science focused on building systems capable of performing tasks that typically require human intelligence — such as understanding natural language, recognizing patterns, reasoning over information, making predictions, and generating content.",
    realLifeExample:
      "Everyday examples include conversational assistants that answer citizen queries, document OCR/classification tools, fraud detection systems, language translation, and predictive analytics.",
    keyHighlights: [
      "Core Approaches: Machine Learning (learning patterns from data), Deep Learning (multi-layer neural networks), Natural Language Processing (NLP), and Computer Vision.",
      "Generative AI & LLMs: Modern Large Language Models predict and synthesize coherent text, code, and structured guidance, often paired with Retrieval-Augmented Generation (RAG) to stay grounded in verified facts.",
      "Responsible AI in Governance: Public-sector AI systems require transparency about model/offline sources, strict privacy & PII protection, human oversight, and verification against authoritative records.",
    ],
  },
  "cloud computing": {
    title: "Cloud Computing",
    category: "technology",
    aliases: ["cloud", "iaas", "paas", "saas"],
    keywords: ["servers", "storage", "virtualization", "scalability", "aws", "gcp"],
    simpleExplanation:
      "Cloud computing is the on-demand delivery of computing resources — including servers, storage, databases, networking, and AI services — over the internet with pay-as-you-go scalability instead of managing physical hardware locally.",
    realLifeExample:
      "Digital platforms host citizen portals, encrypted object vaults, and managed relational databases across redundant cloud regions for high availability.",
    keyHighlights: [
      "Service Models: IaaS (virtual machines & networking), PaaS (managed app runtimes & databases), and SaaS (ready-to-use web applications).",
      "Key Benefits: Elastic scaling for traffic spikes, automated backups, geographic redundancy, and centralized security controls.",
    ],
  },
};

export function lookupGlossaryTerm(term: string): { matchedKey: string; entry: GlossaryEntry } | null {
  const cleanTerm = term.toLowerCase().trim();
  if (!cleanTerm) return null;

  for (const [key, entry] of Object.entries(STATUTORY_GLOSSARY)) {
    const candidates = [key, ...(entry.aliases || [])];
    if (
      candidates.some(
        (candidate) =>
          cleanTerm === candidate ||
          hasWholeWordMatch(cleanTerm, candidate) ||
          (cleanTerm.length >= 3 && hasWholeWordMatch(candidate, cleanTerm))
      )
    ) {
      return { matchedKey: key, entry };
    }
  }
  return null;
}

export interface ScoredKnowledgeMatch {
  key: string;
  entry: GlossaryEntry;
  score: number;
  matchedTerms: string[];
}

function getAllowedKnowledgeCategories(intent?: AIIntent): KnowledgeCategory[] | null {
  if (!intent) return null;
  switch (intent) {
    case "GREETING":
      return [];
    case "DEVELOPER_GUIDANCE":
      return ["developer", "platform"];
    case "DOCUMENT_ASSISTANCE":
    case "APPLICATION_GUIDANCE":
      return ["platform", "civic"];
    case "UGOV_NAVIGATION":
      return ["platform", "developer"];
    case "GOVERNMENT_SERVICE":
      return ["civic"];
    case "GENERAL_KNOWLEDGE":
      return ["civic", "technology", "platform"];
    case "PRIVATE_CITIZEN_WORKFLOW":
      return ["platform", "civic"];
    default:
      return null;
  }
}

export function searchKnowledgeEntries(query: string, intent?: AIIntent): ScoredKnowledgeMatch[] {
  const clean = query.toLowerCase().trim();
  if (!clean) return [];

  const allowedCategories = getAllowedKnowledgeCategories(intent);
  if (allowedCategories && allowedCategories.length === 0) {
    return [];
  }

  const tokens = tokenizeSearchQuery(clean);
  if (!tokens.length) return [];

  const isComparison = /\b(difference|compare|versus|vs)\b/i.test(clean);
  const scored: ScoredKnowledgeMatch[] = [];

  for (const [key, entry] of Object.entries(STATUTORY_GLOSSARY)) {
    if (allowedCategories && !allowedCategories.includes(entry.category)) {
      continue;
    }

    const result = scoreWeightedFields(
      clean,
      tokens,
      key,
      [
        { text: entry.title, weight: 5 },
        { text: (entry.aliases || []).join(" "), weight: 5 },
        { text: (entry.keywords || []).join(" "), weight: 3 },
        { text: entry.simpleExplanation, weight: 2 },
        { text: entry.issuingAuthority || "", weight: 2 },
        { text: (entry.keyHighlights || []).join(" "), weight: 1 },
      ],
      entry.aliases || []
    );

    if (result.rawScore >= MIN_KNOWLEDGE_RELEVANCE_SCORE) {
      scored.push({
        key,
        entry,
        score: result.rawScore,
        matchedTerms: result.matchedTerms,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [];

  // Unless the citizen is explicitly comparing concepts, suppress weak tail entries
  // that fall far below a strong primary match (prevents unrelated tangents).
  const topScore = scored[0].score;
  const maxItems = isComparison ? 3 : 2;
  const minRelativeScore = isComparison
    ? MIN_KNOWLEDGE_RELEVANCE_SCORE
    : Math.max(MIN_KNOWLEDGE_RELEVANCE_SCORE, Math.floor(topScore * 0.55));

  return scored
    .filter((item, idx) => idx === 0 || item.score >= minRelativeScore)
    .slice(0, maxItems);
}

/**
 * Backward-compatible wrapper preserving previous signature.
 */
export function searchGlossaryEntries(query: string, intent?: AIIntent): ScoredKnowledgeMatch[] {
  return searchKnowledgeEntries(query, intent);
}

export interface OfflineFallbackContext {
  intent?: AIIntent;
  retrieval?: AIRetrievalTrace;
  serviceMatches: Array<{
    name: string;
    serviceCode: string;
    department?: string;
    ministry?: string;
    description?: string;
    fee?: number;
    slaDays?: number;
    officialPortal?: string;
    requiredDocuments?: string[];
  }>;
  knowledgeMatches: Array<{
    title: string;
    snippet: string;
    url: string;
    category?: string;
    sourceType: "u-gov";
  }>;
  glossaryMatches: Array<{ key: string; entry: GlossaryEntry; score?: number }>;
  errorCategory: string;
}

function describeOfflineReason(errorCategory: string): string {
  switch (errorCategory) {
    case "not_configured":
      return "Live Gemini AI is not configured on this server.";
    case "authentication":
      return "Live Gemini AI could not authenticate with the configured API key.";
    case "quota_exhausted":
      return "Live Gemini AI project quota is exhausted; waiting for quota reset or updated billing/key.";
    case "rate_limit":
      return "Live Gemini AI rate limit is temporarily throttled.";
    case "invalid_model":
      return "Configured Gemini model identifier was rejected or not found upstream.";
    case "timeout":
      return "Live Gemini AI timed out waiting for an upstream response.";
    case "network_error":
      return "Live Gemini AI could not be reached due to an upstream network or DNS error.";
    default:
      return "Live Gemini AI is temporarily unavailable.";
  }
}

function getIntentSuggestions(intent: AIIntent | undefined, hasKnowledge: boolean): string[] {
  switch (intent) {
    case "GREETING":
      return [
        "Find scholarships for college students",
        "How do I renew a driving licence?",
        "How can I use U-GOV as a developer?",
      ];
    case "DEVELOPER_GUIDANCE":
      return [
        "What technology stack does U-GOV use?",
        "How does Bharat G-Bot work?",
        "Retry with Live AI",
      ];
    case "GENERAL_KNOWLEDGE":
      return hasKnowledge
        ? ["Retry with Live AI", "What can U-GOV help me do?", "Explore U-GOV Services Directory"]
        : ["What is Aadhaar?", "What is a Ration Card?", "What is AI?"];
    case "DOCUMENT_ASSISTANCE":
    case "APPLICATION_GUIDANCE":
      return ["Retry with Live AI", "Check my application status", "Am I ready for scholarship?"];
    default:
      return hasKnowledge
        ? ["Retry with Live AI", "Explore U-GOV Services Directory", "Check my application status"]
        : ["What is Aadhaar?", "What is a Ration Card?", "What can U-GOV help me do?"];
  }
}

export function buildVerifiedOfflineResponse(
  request: AIChatRequest,
  context: OfflineFallbackContext,
  latencyMs?: number
): AIChatResponse {
  const citations: AIResponseCitation[] = [];
  const sections: string[] = [];
  const intent = context.intent;
  const reasonLine = describeOfflineReason(context.errorCategory);

  const lang = (request.language || "en").toLowerCase();
  const langNotice =
    lang !== "en"
      ? `> **Offline language notice**: Live Gemini translation (\`${lang}\`) is temporarily unavailable, so verified U-GOV local knowledge is displayed in English.\n`
      : "";

  // Greetings receive a clean conversational response without forcing catalogue cards or unrelated FAQs
  if (intent === "GREETING") {
    return {
      reply:
        `${langNotice}Namaste! I am **Bharat G-Bot**, your U-GOV public services and platform assistant.\n\n` +
        `I can help you:\n` +
        `• Discover supported U-GOV services (scholarships, driving licences, domicile, income certificates, PM-KISAN, Ayushman Bharat)\n` +
        `• Understand civic terms (Aadhaar, PAN, Ration Card, DigiLocker, SIH) or general concepts\n` +
        `• Navigate DigiVault, Consent Center, Application Tracker, or developer docs\n` +
        `• Check your own U-DOCS readiness or application status when signed in\n\n` +
        `> *Offline local mode active (${reasonLine})*\n\n` +
        `How can I help you today?`,
      source: "U-GOV Verified Local Knowledge (Offline — Live Gemini unavailable)",
      model: "local-verified-knowledge",
      intent,
      retrieval: context.retrieval,
      fallbackAttempted: true,
      offlineFallback: true,
      errorCategory: context.errorCategory,
      latencyMs,
      citations: [],
      suggestions: getIntentSuggestions(intent, true),
      toolCalls: [],
      disclaimer:
        "Offline verified local knowledge response (live Google Gemini service unavailable). Verify statutory requirements with the official issuing authority.",
      timestamp: new Date().toISOString(),
    };
  }

  // Render glossary / verified local knowledge entries cleanly by category
  const isComparison = /\b(difference|compare|versus|vs)\b/i.test(request.message);
  if (context.glossaryMatches.length >= 2 && isComparison) {
    const titles = context.glossaryMatches.map((m) => m.entry.title).join(" vs ");
    sections.push(`### 📚 Verified U-GOV Comparison: ${titles}`);
    for (const { entry } of context.glossaryMatches) {
      const lines = [
        `**${entry.title}**`,
        `• **What it is**: ${entry.simpleExplanation}`,
      ];
      if (entry.issuingAuthority) lines.push(`• **Issuing Authority**: ${entry.issuingAuthority}`);
      lines.push(`• **Common Use**: ${entry.realLifeExample}`);
      if (entry.whereToGetIt) lines.push(`• **Where to obtain**: ${entry.whereToGetIt}`);
      sections.push(lines.join("\n"));

      if (entry.officialUrl) {
        citations.push({
          title: entry.title,
          url: entry.officialUrl,
          snippet: entry.simpleExplanation,
          sourceType: "u-gov",
        });
      }
    }
  } else if (context.glossaryMatches.length >= 1) {
    const { entry } = context.glossaryMatches[0];
    const headingEmoji =
      entry.category === "developer"
        ? "💻"
        : entry.category === "technology"
          ? "🤖"
          : entry.category === "platform"
            ? "🏛️"
            : "📚";
    const lines: string[] = [
      `### ${headingEmoji} ${entry.title}`,
      "",
      entry.simpleExplanation,
      "",
      `• **Practical example**: ${entry.realLifeExample}`,
    ];
    if (entry.keyHighlights && entry.keyHighlights.length > 0) {
      for (const highlight of entry.keyHighlights) {
        lines.push(`• ${highlight}`);
      }
    }
    if (entry.whyGovernmentAsks) {
      lines.push(`• **Why it is requested**: ${entry.whyGovernmentAsks}`);
    }
    if (entry.issuingAuthority) {
      lines.push(`• **Issuing Authority**: ${entry.issuingAuthority}`);
    }
    if (entry.whereToGetIt) {
      lines.push(`• **Where to obtain / portal**: ${entry.whereToGetIt}`);
    }
    if (entry.documentsNeeded && entry.documentsNeeded.length > 0) {
      lines.push(`• **Typical documents needed**: ${entry.documentsNeeded.join(", ")}`);
    }
    sections.push(lines.join("\n"));

    if (entry.officialUrl) {
      citations.push({
        title: entry.title,
        url: entry.officialUrl,
        snippet: entry.simpleExplanation,
        sourceType: "u-gov",
      });
    }
  }

  // Only include service matches if the intent is service-related
  if (intent === "GOVERNMENT_SERVICE" && context.serviceMatches.length > 0) {
    const top = context.serviceMatches[0];
    sections.push(
      `### 🏛️ U-GOV Service Catalogue Match: ${top.name} (\`${top.serviceCode}\`)\n\n` +
        `${top.description || "Verified catalogue entry inside the U-GOV Services Directory."}\n` +
        (top.department ? `• **Department**: ${top.department}\n` : "") +
        (top.slaDays !== undefined ? `• **Estimated SLA**: ${top.slaDays} working days` : "") +
        (top.fee !== undefined ? ` | **Fee**: ₹${top.fee}\n` : "\n") +
        (top.requiredDocuments && top.requiredDocuments.length > 0
          ? `• **Documents listed**: ${top.requiredDocuments.join(", ")}\n`
          : "") +
        (top.officialPortal ? `• **Official Portal**: ${top.officialPortal}` : "")
    );
  }

  // Only include FAQ matches for U-GOV platform/developer/document/application queries
  if (context.knowledgeMatches.length > 0 && intent !== "GENERAL_KNOWLEDGE") {
    const faqBlock = context.knowledgeMatches
      .slice(0, 2)
      .map((f) => `• **${f.title}**: ${f.snippet}`)
      .join("\n");
    sections.push(`### ❓ Relevant U-GOV Help & FAQ\n\n${faqBlock}`);
    for (const item of context.knowledgeMatches.slice(0, 3)) {
      if (!citations.some((c) => c.title === item.title)) {
        citations.push({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          sourceType: "u-gov",
        });
      }
    }
  }

  const hasVerifiedKnowledge = sections.length > 0;
  const reply = hasVerifiedKnowledge
    ? `${langNotice}${sections.join("\n\n")}\n\n> *Answered from U-GOV Verified Local Knowledge (Offline fallback: ${reasonLine})*`
    : `${langNotice}### ⚠️ Offline Local Knowledge Mode\n\n${reasonLine} No matching entry was found in U-GOV's verified local knowledge base for **"${request.message.slice(0, 120)}"**.\n\nYou can ask about U-GOV services, DigiVault, developer usage, Aadhaar, PAN, Ration Card, Domicile Certificate, PM-KISAN, Ayushman Bharat, AI, or retry with live Gemini AI shortly.`;

  return {
    reply,
    source: "U-GOV Verified Local Knowledge (Offline — Live Gemini unavailable)",
    model: "local-verified-knowledge",
    intent,
    retrieval: context.retrieval,
    fallbackAttempted: true,
    offlineFallback: true,
    errorCategory: context.errorCategory,
    latencyMs,
    citations,
    suggestions: getIntentSuggestions(intent, hasVerifiedKnowledge),
    toolCalls: [],
    disclaimer:
      "Offline verified local knowledge response (live Google Gemini service unavailable). Verify statutory requirements with the official issuing authority.",
    timestamp: new Date().toISOString(),
  };
}
