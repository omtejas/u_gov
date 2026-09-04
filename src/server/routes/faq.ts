import { Router, Response } from "express";
import { AuthenticatedRequest, requireAuth, csrfProtection } from "../middleware/auth";

export const faqRouter = Router();

// Static FAQ catalogue
const FAQ_CATALOGUE = [
  {
    id: "faq-1",
    category: "getting-started",
    categoryLabel: "Getting Started",
    question: "What is U-GOV?",
    answer:
      "U-GOV is the Unified Governance & Citizen Services Platform (SIH26129) — a secure, single-window system that connects citizens with Central and State government services, manages digital documents, and provides AI-powered assistance for navigating government schemes.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-2",
    category: "getting-started",
    categoryLabel: "Getting Started",
    question: "How do I create a U-GOV account?",
    answer:
      "Click 'Sign In' on the top-right corner, then select 'Create Account'. Enter your email or U-GOV ID, a secure password, and your state/district. All accounts start as a basic citizen account and can be upgraded through KYC verification.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-3",
    category: "documents",
    categoryLabel: "DigiVault & Documents",
    question: "How do I upload a document to my DigiVault?",
    answer:
      "Navigate to the 'DigiVault' tab from the navigation bar. Click 'Deposit New Document', select your document type, enter the document number, and upload the file. U-GOV will compute and store a SHA-256 checksum for tamper-evident verification.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-4",
    category: "documents",
    categoryLabel: "DigiVault & Documents",
    question: "What document formats are supported?",
    answer:
      "U-GOV supports PDF (recommended), JPEG, PNG, and WEBP formats. Maximum file size is 10 MB. For government documents, PDF is strongly recommended as it preserves document integrity best.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-5",
    category: "consent",
    categoryLabel: "Consent & Privacy",
    question: "What is U-GOV Consent?",
    answer:
      "Consent is your explicit authorization for a government department or portal to access a specific document from your DigiVault for a specific purpose and time period. You remain in full control — you can view, modify, or revoke any consent at any time from the Consent Center.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-6",
    category: "consent",
    categoryLabel: "Consent & Privacy",
    question: "How do I revoke a consent?",
    answer:
      "Go to the Consent Center (Dashboard → Consent Center, or the main navigation). Find the consent you want to revoke and click 'Revoke'. The document access is immediately withdrawn. The department or portal can no longer access that document after revocation.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-7",
    category: "services",
    categoryLabel: "Government Services",
    question: "How do I apply for a government service?",
    answer:
      "Browse the Services Catalogue, click on the service you need, and select 'Apply Now'. U-GOV will check your document readiness and guide you step-by-step through the application. You can save as a draft and return anytime.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-8",
    category: "services",
    categoryLabel: "Government Services",
    question: "What is a Sandbox or Prototype service?",
    answer:
      "Services labeled 'Sandbox' or 'Prototype' are integrated in demonstration mode — they do not submit to real government systems. This allows you to experience the full application workflow safely. The label is prominently displayed on all sandbox services.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-9",
    category: "tracker",
    categoryLabel: "Application Tracking",
    question: "How do I track my application status?",
    answer:
      "Click 'Tracker' in the navigation bar to view all your applications. Each application shows its current status, history timeline, and next action required. You can also filter by status.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-10",
    category: "security",
    categoryLabel: "Security & Privacy",
    question: "How is my data secured?",
    answer:
      "U-GOV uses a SHA-256 Hash-Chained Append-Only Audit Ledger to tamper-evident record every system event. Passwords are hashed with PBKDF2 (310,000 rounds). Sessions use cryptographically random 256-bit tokens stored in HttpOnly cookies — never localStorage. All vault files are stored with strict file-system permission controls (0o600).",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-11",
    category: "security",
    categoryLabel: "Security & Privacy",
    question: "What is the SHA-256 Audit Ledger?",
    answer:
      "Every action in U-GOV (login, document upload, application submission) is permanently recorded in a hash-chained ledger. Each entry's hash depends on the previous entry — making retroactive tampering mathematically detectable. Authorized auditors can verify ledger integrity at any time.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-12",
    category: "account",
    categoryLabel: "Account Management",
    question: "How do I change my password?",
    answer:
      "Go to your Profile settings (click your name/avatar in the top-right), then select 'Security Settings'. Enter your current password, then your new password twice. Password changes are logged in the Audit Ledger.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-13",
    category: "ai",
    categoryLabel: "G-Bot AI Assistant",
    question: "What can G-Bot help me with?",
    answer:
      "G-Bot is powered by Google Gemini AI and can help you: find the right government scheme, check your eligibility for services, explain complex government terminology, guide you through application steps, and answer questions about your documents and consents.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-14",
    category: "ai",
    categoryLabel: "G-Bot AI Assistant",
    question: "Is G-Bot's advice legally binding?",
    answer:
      "No. G-Bot is an AI assistant for informational guidance only. For official eligibility, scheme rules, and legal matters, always verify with the official government portal or department. G-Bot responses include appropriate disclaimers.",
    helpful: 0,
    notHelpful: 0,
  },
  {
    id: "faq-15",
    category: "general",
    categoryLabel: "General",
    question: "Is U-GOV available in regional languages?",
    answer:
      "U-GOV currently fully supports English. Hindi, Marathi, and Kannada language support is actively being developed. The language selector is available in the top navigation bar. All government service names, document types, and official references follow standardized Government of India nomenclature.",
    helpful: 0,
    notHelpful: 0,
  },
];

// In-memory vote store (anonymous — maps faq_id → { helpful, notHelpful })
const voteStore: Record<string, { helpful: number; notHelpful: number }> = {};

function getVotes(faqId: string) {
  return voteStore[faqId] || { helpful: 0, notHelpful: 0 };
}

/**
 * GET /api/v1/faq
 * Returns full FAQ catalogue with current vote counts.
 * Requires auth to prevent scraping; votes are aggregate and anonymous.
 */
faqRouter.get("/", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const result = FAQ_CATALOGUE.map((item) => {
    const votes = getVotes(item.id);
    return { ...item, helpful: votes.helpful, notHelpful: votes.notHelpful };
  });
  return res.json({ success: true, faq: result, totalCount: result.length });
});

/**
 * GET /api/v1/faq/categories
 * Returns unique categories list.
 */
faqRouter.get("/categories", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const seen = new Set<string>();
  const categories: { id: string; label: string; count: number }[] = [];
  for (const item of FAQ_CATALOGUE) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      const count = FAQ_CATALOGUE.filter((f) => f.category === item.category).length;
      categories.push({ id: item.category, label: item.categoryLabel, count });
    }
  }
  return res.json({ success: true, categories });
});

/**
 * POST /api/v1/faq/:id/vote
 * Record helpful/unhelpful vote. Votes are aggregate, not user-linked.
 */
faqRouter.post("/:id/vote", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { vote } = req.body;

  const item = FAQ_CATALOGUE.find((f) => f.id === id);
  if (!item) {
    return res.status(404).json({ success: false, error: "FAQ item not found" });
  }
  if (!["helpful", "notHelpful"].includes(vote)) {
    return res.status(400).json({ success: false, error: "Vote must be 'helpful' or 'notHelpful'" });
  }

  if (!voteStore[id]) {
    voteStore[id] = { helpful: 0, notHelpful: 0 };
  }
  voteStore[id][vote as "helpful" | "notHelpful"]++;

  return res.json({ success: true, votes: getVotes(id) });
});
