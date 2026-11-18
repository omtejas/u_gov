import { Router, Response } from "express";
import crypto from "crypto";
import { db, GrievanceRecord } from "../database/db";
import { AuthenticatedRequest, requireAuth, csrfProtection } from "../middleware/auth";
import { createNotification } from "./notifications";

export const grievancesRouter = Router();

/**
 * GET /api/v1/grievances
 * Returns persisted civic grievance tickets with optional status filtering.
 */
grievancesRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const userId = req.user!.id;
  const grievances = db.getGrievances(status).map((g) => ({
    id: g.id,
    ticketId: g.ticketId,
    title: g.title,
    category: g.category,
    department: g.department,
    location: g.location,
    status: g.status,
    filedAt: g.createdAt,
    upvotes: g.upvotes,
    upvotedByMe: (g.upvotedByUserIds || []).includes(userId),
    isOwner: g.ownerUserId === userId,
    description: g.description,
  }));

  return res.json({ success: true, grievances, total: grievances.length });
});

/**
 * POST /api/v1/grievances
 * Lodges a persistent civic grievance ticket with audit trail and notification.
 */
grievancesRouter.post("/", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, category, department, location, description } = req.body || {};

    if (!title || typeof title !== "string" || title.trim().length < 3 || title.trim().length > 140) {
      return res.status(400).json({ success: false, error: "Title must be between 3 and 140 characters." });
    }
    if (!category || typeof category !== "string" || category.trim().length < 2 || category.trim().length > 60) {
      return res.status(400).json({ success: false, error: "Valid grievance category is required." });
    }
    if (!department || typeof department !== "string" || department.trim().length < 2 || department.trim().length > 120) {
      return res.status(400).json({ success: false, error: "Concerned department is required." });
    }
    if (!location || typeof location !== "string" || location.trim().length < 2 || location.trim().length > 120) {
      return res.status(400).json({ success: false, error: "Location is required." });
    }
    if (!description || typeof description !== "string" || description.trim().length < 5 || description.trim().length > 2000) {
      return res.status(400).json({ success: false, error: "Description must be between 5 and 2000 characters." });
    }

    const now = new Date().toISOString();
    const ticketNumber = `GRV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const record: GrievanceRecord = {
      id: `grv-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      ticketId: ticketNumber,
      ownerUserId: req.user!.id,
      title: title.trim(),
      category: category.trim(),
      department: department.trim(),
      location: location.trim(),
      status: "Open",
      upvotes: 1,
      upvotedByUserIds: [req.user!.id],
      description: description.trim(),
      createdAt: now,
      updatedAt: now,
    };

    db.createGrievance(record);

    createNotification(req.user!.id, {
      title: `Grievance Lodged: ${record.ticketId}`,
      message: `Your grievance "${record.title}" has been recorded for ${record.department}.`,
      type: "info",
      priority: "normal",
      relatedRef: record.id,
    });

    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || req.user!.identifier,
      actorRole: "CITIZEN",
      action: "GRIEVANCE_FILED",
      resource: `Grievance ${record.ticketId}`,
      result: "SUCCESS",
      context: `Citizen filed civic grievance '${record.title}' under ${record.department}`,
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      grievance: {
        id: record.id,
        ticketId: record.ticketId,
        title: record.title,
        category: record.category,
        department: record.department,
        location: record.location,
        status: record.status,
        filedAt: record.createdAt,
        upvotes: record.upvotes,
        upvotedByMe: true,
        isOwner: true,
        description: record.description,
      },
    });
  } catch {
    return res.status(500).json({ success: false, error: "Failed to file grievance." });
  }
});

/**
 * POST /api/v1/grievances/:id/upvote
 * Toggles citizen endorsement on a grievance ticket.
 */
grievancesRouter.post("/:id/upvote", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.toggleGrievanceUpvote(req.params.id, req.user!.id);
  if (!updated) {
    return res.status(404).json({ success: false, error: "Grievance ticket not found." });
  }
  return res.json({
    success: true,
    id: updated.id,
    upvotes: updated.upvotes,
    upvotedByMe: updated.upvotedByUserIds.includes(req.user!.id),
  });
});
