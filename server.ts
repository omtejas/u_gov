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
import { requireAuth } from "./src/server/middleware/auth";
import type { AuthenticatedRequest } from "./src/server/middleware/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable("x-powered-by");

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none';"
  );
  next();
});

app.use(express.json({ limit: "10mb" }));

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

// User Preferences endpoint (lightweight, citizen-scoped)
const preferencesStore: Record<string, Record<string, unknown>> = {};
app.get("/api/v1/preferences", requireAuth as any, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  return res.json({ success: true, preferences: preferencesStore[userId] || {} });
});
app.patch("/api/v1/preferences", requireAuth as any, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const allowed = ["tutorialSeen", "preferredLanguage", "notificationsEnabled", "dashboardLayout", "theme"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }
  preferencesStore[userId] = { ...(preferencesStore[userId] || {}), ...updates };
  return res.json({ success: true, preferences: preferencesStore[userId] });
});

// Health Telemetry Endpoint
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "U-GOV National Unified Governance Platform",
    dpiVersion: "3.2-production-ready",
    aiEngineActive: Boolean(process.env.GEMINI_API_KEY),
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
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[U-GOV Sovereign DPI Platform] Server running on http://localhost:${PORT}`);
  });
}

startServer();
