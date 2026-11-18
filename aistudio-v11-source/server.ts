import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { authenticate } from "./src/server/middleware/auth";
import { authRouter } from "./src/server/routes/auth";
import { documentsRouter } from "./src/server/routes/documents";
import { servicesRouter } from "./src/server/routes/services";
import { applicationsRouter } from "./src/server/routes/applications";
import { integrationsRouter } from "./src/server/routes/integrations";
import { aiRouter } from "./src/server/routes/ai";
import { searchRouter } from "./src/server/routes/search";
import { notificationsRouter } from "./src/server/routes/notifications";
import { feedbackRouter } from "./src/server/routes/feedback";
import { faqRouter } from "./src/server/routes/faq";
import { officerRouter } from "./src/server/routes/officer";
import { grievancesRouter } from "./src/server/routes/grievances";
import { webhubRouter } from "./src/server/routes/webhub";
import { db } from "./src/server/database/db";
import { requireAuth, csrfProtection } from "./src/server/middleware/auth";
import { inspectStorageDirectory } from "./src/server/storage/storageHealth";
import { getStorageDriver } from "./src/server/storage/storageFactory";
import type { AuthenticatedRequest } from "./src/server/middleware/auth";

dotenv.config();

export const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable("x-powered-by");
app.set("trust proxy", 1);

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://accounts.google.com https://www.googleapis.com https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com ws: wss:; frame-src 'self' blob: https://accounts.google.com https://*.firebaseapp.com;"
  );
  next();
});

app.use(express.json({ limit: "10mb" }));

// A redirect to a Netlify Function carries this internal prefix in some
// runtimes. Strip it so the existing /api/v1 routes work both locally and on
// Netlify without changing client-side request URLs.
app.use((req, _res, next) => {
  const functionPrefix = "/.netlify/functions/api";
  if (req.url === functionPrefix || req.url.startsWith(`${functionPrefix}/`)) {
    req.url = req.url.slice(functionPrefix.length) || "/";
  }
  next();
});

// Apply session authentication middleware
app.use(authenticate as any);

// Mount U-IDENTITY and U-AUDIT routes
app.use("/api/v1/auth", authRouter);

// Mount U-DOCS and U-CONSENT routes
app.use("/api/v1/documents", documentsRouter);

// Mount U-SERVICES Public Service Catalogue routes
app.use("/api/v1/services", servicesRouter);

// Mount U-APPLICATIONS Lifecycle Engine routes
app.use("/api/v1/applications", applicationsRouter);

// Mount U-INTEGRATIONS Adapter & Gateway routes (Phase 5)
app.use("/api/v1/integrations", integrationsRouter);

// Mount U-AI Sovereign Citizen Assistant & Intelligence routes (Phase 6)
app.use("/api/v1/ai", aiRouter);

// Mount U-WORKSPACE Functional Upgrade routes (Phase 7)
app.use("/api/v1/search", searchRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/feedback", feedbackRouter);
app.use("/api/v1/faq", faqRouter);
app.use("/api/v1/officer", officerRouter);
app.use("/api/v1/grievances", grievancesRouter);
app.use("/api/v1/webhub", webhubRouter);

// User Preferences endpoint (persistent, citizen-scoped)
app.get("/api/v1/preferences", requireAuth as any, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  return res.json({ success: true, preferences: db.getUserPreferences(userId) });
});
app.patch("/api/v1/preferences", requireAuth as any, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { tutorialSeen, preferredLanguage, notificationsEnabled, dashboardLayout, theme } = req.body || {};
  const updates: Record<string, unknown> = {};
  if (tutorialSeen !== undefined) updates.tutorialSeen = Boolean(tutorialSeen);
  if (preferredLanguage !== undefined) {
    const lang = String(preferredLanguage).trim();
    if (!["en", "hi", "mr", "kn"].includes(lang)) {
      return res.status(400).json({ success: false, error: "Unsupported preferred language." });
    }
    updates.preferredLanguage = lang;
  }
  if (notificationsEnabled !== undefined) updates.notificationsEnabled = Boolean(notificationsEnabled);
  if (dashboardLayout !== undefined && ["standard", "compact", "simple"].includes(String(dashboardLayout))) {
    updates.dashboardLayout = String(dashboardLayout);
  }
  if (theme !== undefined && ["light", "high-contrast"].includes(String(theme))) {
    updates.theme = String(theme);
  }
  const saved = db.updateUserPreferences(userId, updates);
  return res.json({ success: true, preferences: saved });
});

// Health endpoint reports storage readiness without treating a configured path
// as proof of durability. Production startup separately enforces the mount guard.
app.get("/api/v1/health", async (_req: Request, res: Response) => {
  const dataDirectory = process.env.UGOV_DATA_DIR || path.join(process.cwd(), "storage");
  const storageReadiness = inspectStorageDirectory(dataDirectory);
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const ephemeralDemoMode = process.env.NODE_ENV === "production" && (process.env.UGOV_STORAGE_MODE === "ephemeral-demo" || !process.env.UGOV_DATA_DIR);
  const storageType = (process.env.UGOV_STORAGE_TYPE || "local").toLowerCase();
  let binaryStorage: { healthy: boolean; provider: "local" | "s3"; detail: string } = {
    healthy: false, provider: storageType === "s3" ? "s3" : "local", detail: "Storage health check has not completed.",
  };
  try { binaryStorage = await getStorageDriver().checkHealth(); }
  catch { binaryStorage.detail = "Configured storage backend is unavailable or missing required configuration."; }
  const metadataStorageReady = process.env.NODE_ENV !== "production" || storageReadiness.persistentMountVerified || ephemeralDemoMode;
  const storageReady = metadataStorageReady && binaryStorage.healthy;
  const hostedAiConfigured = Boolean(process.env.OPENAI_API_KEY || geminiConfigured);
  res.status(storageReady ? 200 : 503).json({
    status: storageReady ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    service: "U-GOV National Unified Governance Platform",
    version: "10.0",
    environment: process.env.NODE_ENV || "development",
    aiEngineActive: hostedAiConfigured,
    ai: {
      provider: process.env.OPENAI_API_KEY ? "openai-compatible" : geminiConfigured ? "gemini" : "mock",
      credentialsConfigured: hostedAiConfigured,
      internetSearchConfigured: Boolean(process.env.TAVILY_API_KEY || process.env.BRAVE_SEARCH_API_KEY),
    },
    database: {
      engine: "atomic-json-store",
      firestoreConfigured: true,
      postgresConfigured: Boolean(process.env.DATABASE_URL),
      runtimeIntegrated: true,
      notice: "Backend API state uses atomic fsync JSON persistence; Firebase Firestore client SDK is configured for client data.",
    },
    storage: {
      metadataEngine: "json-file",
      binaryEngine: binaryStorage.provider,
      binaryHealthy: binaryStorage.healthy,
      binaryDetail: binaryStorage.detail,
      directoryConfigured: Boolean(process.env.UGOV_DATA_DIR),
      directoryExists: storageReadiness.directoryExists,
      writable: storageReadiness.writable,
      persistentMountVerified: storageReadiness.persistentMountVerified,
      filesystem: storageReadiness.filesystem,
      durability: storageReadiness.persistentMountVerified ? "persistent-volume-mounted-and-writable" : ephemeralDemoMode ? "ephemeral-demo-non-durable" : storageReadiness.ephemeralPath ? "ephemeral" : "not-verified",
      mode: ephemeralDemoMode ? "ephemeral-demo" : "persistent-required",
      warning: storageReadiness.reason,
    },
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Build output sits under the project root in deployment environments.
    const distPath = process.env.STATIC_DIR || path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[U-GOV Sovereign DPI Platform] Server running on http://localhost:${PORT}`);
  });
}

// Netlify imports `app` from its function entry point.  Do not open a long-lived
// listener in that environment; Netlify owns the HTTP server lifecycle.
if (!process.env.NETLIFY) {
  startServer();
}
