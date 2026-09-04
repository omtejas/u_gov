import { Router, Response } from "express";
import { db } from "../database/db";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

export const searchRouter = Router();

// Static FAQ catalogue used as search targets
const FAQ_ITEMS = [
  { id: "faq-1", question: "How do I upload a document to my DigiVault?", category: "documents", keywords: ["upload", "document", "vault", "digivault", "add"] },
  { id: "faq-2", question: "What is U-GOV Consent and how do I grant it?", category: "consent", keywords: ["consent", "grant", "share", "permission"] },
  { id: "faq-3", question: "How do I apply for a government service?", category: "services", keywords: ["apply", "application", "service", "how to"] },
  { id: "faq-4", question: "How do I track my application status?", category: "tracker", keywords: ["track", "status", "application", "progress"] },
  { id: "faq-5", question: "What is the SHA-256 Audit Ledger?", category: "audit", keywords: ["audit", "ledger", "sha256", "hash", "tamper"] },
  { id: "faq-6", question: "How do I revoke a consent?", category: "consent", keywords: ["revoke", "consent", "cancel", "withdraw"] },
  { id: "faq-7", question: "Is my data secure on U-GOV?", category: "security", keywords: ["security", "safe", "privacy", "data"] },
  { id: "faq-8", question: "How do I reset my password?", category: "account", keywords: ["password", "reset", "forgot", "change"] },
  { id: "faq-9", question: "What documents does NSP scholarship require?", category: "services", keywords: ["nsp", "scholarship", "education", "document"] },
  { id: "faq-10", question: "Can I use U-GOV on mobile?", category: "general", keywords: ["mobile", "phone", "app", "browser"] },
];

const FEATURE_ITEMS = [
  { id: "feat-dashboard", label: "My Dashboard", tab: "dashboard", description: "View your citizen workspace and activity summary", keywords: ["dashboard", "home", "workspace", "overview"] },
  { id: "feat-docs", label: "DigiVault — Documents", tab: "documents", description: "Upload and manage your government credentials", keywords: ["documents", "vault", "digivault", "upload", "credentials"] },
  { id: "feat-services", label: "Services Catalogue", tab: "services", description: "Browse all available government services", keywords: ["services", "catalogue", "browse", "government"] },
  { id: "feat-tracker", label: "Application Tracker", tab: "tracker", description: "Track your submitted applications in real time", keywords: ["tracker", "application", "status", "progress"] },
  { id: "feat-consent", label: "Consent Center", tab: "consent", description: "Manage your document sharing permissions", keywords: ["consent", "sharing", "permissions", "manage"] },
  { id: "feat-data", label: "My Data Center", tab: "mydata", description: "View and control all your data in U-GOV", keywords: ["data", "center", "control", "privacy"] },
  { id: "feat-notifications", label: "Notifications", tab: "notifications", description: "View all your alerts and updates", keywords: ["notifications", "alerts", "updates", "messages"] },
  { id: "feat-faq", label: "Help & FAQ", tab: "faq", description: "Frequently asked questions and help guides", keywords: ["help", "faq", "guide", "support", "how to"] },
  { id: "feat-audit", label: "Audit Ledger", tab: "audit", description: "Inspect the SHA-256 Hash-Chained Audit Ledger", keywords: ["audit", "ledger", "logs", "security", "sha256"] },
  { id: "feat-grievance", label: "Grievance", tab: "grievance", description: "Report an issue or file a complaint", keywords: ["grievance", "complaint", "report", "issue", "problem"] },
  { id: "feat-whereami", label: "Where Am I? — Citizen Journey Tracer", tab: "whereami", description: "Trace active application progress, requirements, milestones, and next actions", keywords: ["where", "journey", "tracer", "progress", "milestone", "stage", "timeline"] },
  { id: "feat-officer", label: "Officer Desk — Verification Workspace", tab: "officer", description: "Secure government case officer review and verification portal", keywords: ["officer", "desk", "review", "verify", "case", "workflow", "approve", "reject"] },
];

/**
 * GET /api/v1/search?q=<query>&category=<all|services|documents|applications|faq|features>
 * Secure universal search — scoped to authenticated citizen's own data only.
 * Services and features are public-side results; documents/applications are IDOR-protected.
 */
searchRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawQuery = (req.query.q as string || "").trim().toLowerCase();
    const category = (req.query.category as string || "all").toLowerCase();

    if (!rawQuery || rawQuery.length < 2) {
      return res.json({ success: true, results: [], query: rawQuery, totalCount: 0 });
    }

    if (rawQuery.length > 200) {
      return res.status(400).json({ success: false, error: "Search query too long" });
    }

    const userId = req.user!.id;

    const results: { type: string; id: string; title: string; subtitle: string; tab?: string; relevance: number }[] = [];

    // --- Services (public catalogue, always searchable) ---
    if (category === "all" || category === "services") {
      const services = db.getServices(undefined, rawQuery);
      for (const svc of services.slice(0, 5)) {
        results.push({
          type: "service",
          id: svc.id,
          title: svc.name,
          subtitle: `${svc.department} · ${svc.category} · ${svc.status === "SANDBOX_PROTOTYPE" ? "Sandbox" : "Available"}`,
          tab: "services",
          relevance: svc.name.toLowerCase().startsWith(rawQuery) ? 3 : 2,
        });
      }
    }

    // --- Citizen's own documents (IDOR-protected: userId scoped) ---
    if (category === "all" || category === "documents") {
      const docs = db.getDocumentsByOwner(userId);
      const matchedDocs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(rawQuery) ||
          d.documentNumber.toLowerCase().includes(rawQuery) ||
          d.documentTypeId.toLowerCase().includes(rawQuery)
      );
      for (const doc of matchedDocs.slice(0, 4)) {
        results.push({
          type: "document",
          id: doc.id,
          title: doc.title,
          subtitle: `Document · ${doc.documentTypeId} · ${doc.verificationStatus}`,
          tab: "documents",
          relevance: doc.title.toLowerCase().startsWith(rawQuery) ? 3 : 1,
        });
      }
    }

    // --- Citizen's own applications (IDOR-protected: userId scoped) ---
    if (category === "all" || category === "applications") {
      const apps = db.getApplicationsByOwner(userId);
      const matchedApps = apps.filter(
        (a) =>
          a.applicationNumber.toLowerCase().includes(rawQuery) ||
          a.status.toLowerCase().includes(rawQuery)
      );
      // Enrich with service name
      for (const app of matchedApps.slice(0, 4)) {
        const svc = db.findServiceById(app.serviceId);
        results.push({
          type: "application",
          id: app.id,
          title: app.applicationNumber,
          subtitle: `${svc?.name || "Application"} · ${app.status}`,
          tab: "tracker",
          relevance: 2,
        });
      }
    }

    // --- FAQ (static, full text match) ---
    if (category === "all" || category === "faq") {
      const matchedFaq = FAQ_ITEMS.filter(
        (f) =>
          f.question.toLowerCase().includes(rawQuery) ||
          f.keywords.some((k) => k.includes(rawQuery) || rawQuery.includes(k))
      );
      for (const faq of matchedFaq.slice(0, 3)) {
        results.push({
          type: "faq",
          id: faq.id,
          title: faq.question,
          subtitle: `Help & FAQ · ${faq.category}`,
          tab: "faq",
          relevance: 1,
        });
      }
    }

    // --- Platform Features ---
    if (category === "all" || category === "features") {
      const matchedFeatures = FEATURE_ITEMS.filter(
        (f) =>
          f.label.toLowerCase().includes(rawQuery) ||
          f.description.toLowerCase().includes(rawQuery) ||
          f.keywords.some((k) => k.includes(rawQuery) || rawQuery.includes(k))
      );
      for (const feat of matchedFeatures.slice(0, 3)) {
        results.push({
          type: "feature",
          id: feat.id,
          title: feat.label,
          subtitle: feat.description,
          tab: feat.tab,
          relevance: feat.label.toLowerCase().startsWith(rawQuery) ? 4 : 1,
        });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);
    const limited = results.slice(0, 12);

    return res.json({
      success: true,
      query: rawQuery,
      totalCount: limited.length,
      results: limited,
    });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ success: false, error: "Search service temporarily unavailable" });
  }
});
