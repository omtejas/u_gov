import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db, WebHubPortalRecord } from "../database/db";
import { AuthenticatedRequest, requireAuth, requireRole, csrfProtection } from "../middleware/auth";

export const webhubRouter = Router();

/**
 * GET /api/v1/webhub
 * Public curated directory of official Government of India web portals.
 */
webhubRouter.get("/", (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const query = (req.query.q || req.query.query) as string | undefined;
  const portals = db.getWebHubPortals(category, query);
  const categories = Array.from(new Set(db.getWebHubPortals().map((p) => p.category)));
  return res.json({
    success: true,
    total: portals.length,
    categories,
    portals,
  });
});

/**
 * POST /api/v1/webhub
 * Admin-only: Adds a curated official portal to Government Web Hub.
 */
webhubRouter.post("/", requireAuth, requireRole("ADMIN"), csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const { name, category, ministry, url, description, isFeatured = false } = req.body || {};
  if (!name || typeof name !== "string" || name.trim().length < 3 || name.trim().length > 140) {
    return res.status(400).json({ success: false, error: "Portal name must be between 3 and 140 characters." });
  }
  if (!category || typeof category !== "string" || category.trim().length < 2 || category.trim().length > 60) {
    return res.status(400).json({ success: false, error: "Valid category is required." });
  }
  if (!url || typeof url !== "string") {
    return res.status(400).json({ success: false, error: "Official HTTPS URL is required." });
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return res.status(400).json({ success: false, error: "Portal URL must be a valid URL." });
  }
  if (parsedUrl.protocol !== "https:") {
    return res.status(400).json({ success: false, error: "Only HTTPS official portal URLs are allowed." });
  }
  if (!description || typeof description !== "string" || description.trim().length < 5 || description.trim().length > 400) {
    return res.status(400).json({ success: false, error: "Description must be between 5 and 400 characters." });
  }

  const now = new Date().toISOString();
  const record: WebHubPortalRecord = {
    id: `hub-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    name: name.trim(),
    category: category.trim(),
    ministry: typeof ministry === "string" && ministry.trim() ? ministry.trim().slice(0, 140) : "Government of India",
    url: parsedUrl.toString(),
    description: description.trim(),
    verifiedOfficial: parsedUrl.hostname.endsWith(".gov.in") || parsedUrl.hostname.endsWith(".nic.in"),
    isFeatured: Boolean(isFeatured),
    createdAt: now,
    updatedAt: now,
  };

  db.createWebHubPortal(record);

  db.insertAuditEvent({
    actorId: req.user!.id,
    actorName: req.profile?.displayName || "System Administrator",
    actorRole: "ADMIN",
    action: "WEBHUB_PORTAL_ADDED",
    resource: `Portal ${record.name}`,
    result: "SUCCESS",
    context: `Added Government Web Hub portal '${record.name}' (${record.url})`,
    ipAddress: req.ip,
  });

  return res.status(201).json({ success: true, portal: record });
});
