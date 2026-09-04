import { Router, Response } from "express";
import crypto from "crypto";
import { db } from "../database/db";
import { AuthenticatedRequest, requireAuth, csrfProtection } from "../middleware/auth";

export const notificationsRouter = Router();

// ─── In-memory notification store (citizen-scoped) ───────────────────────────
// Shape: Record<userId, NotificationRecord[]>
// Notifications are derived from application state changes and stored per-citizen.
// This is separate from the JSON DB to avoid bloating ugov_store.json on every poll.
// In production, this would be a PostgreSQL table.

interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert" | "status";
  priority: "high" | "normal" | "low";
  read: boolean;
  relatedRef?: string;
  createdAt: string;
}

const notificationStore: Record<string, NotificationRecord[]> = {};

function getOrCreateStore(userId: string): NotificationRecord[] {
  if (!notificationStore[userId]) {
    // Seed initial notifications for demo purposes
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    notificationStore[userId] = [
      {
        id: `notif-seed-1-${crypto.randomUUID()}`,
        userId,
        title: "Welcome to U-GOV",
        message: "Your citizen workspace is ready. Explore services, manage documents, and apply for schemes.",
        type: "info",
        priority: "normal",
        read: false,
        createdAt: twoDaysAgo,
      },
      {
        id: `notif-seed-2-${crypto.randomUUID()}`,
        userId,
        title: "Consent Expiry Reminder",
        message: "Your consent for Income Certificate shared with NSP Portal will expire in 30 days. Review in Consent Center.",
        type: "warning",
        priority: "high",
        read: false,
        relatedRef: "cst-seed-01",
        createdAt: oneDayAgo,
      },
      {
        id: `notif-seed-3-${crypto.randomUUID()}`,
        userId,
        title: "G-Bot AI Assistant Activated",
        message: "U-GOV G-Bot is available to help you navigate services, check eligibility, and explain government terminology.",
        type: "success",
        priority: "low",
        read: true,
        createdAt: oneHourAgo,
      },
    ];
  }
  return notificationStore[userId];
}

/**
 * POST /api/v1/notifications/internal/create
 * Internal helper — creates a notification for a user (called by other routes).
 * Not exposed as an HTTP endpoint.
 */
export function createNotification(
  userId: string,
  notification: Omit<NotificationRecord, "id" | "userId" | "createdAt" | "read">
): void {
  const store = getOrCreateStore(userId);
  store.unshift({
    id: `notif-${crypto.randomUUID()}`,
    userId,
    read: false,
    createdAt: new Date().toISOString(),
    ...notification,
  });
  // Cap at 100 notifications per citizen
  if (store.length > 100) {
    notificationStore[userId] = store.slice(0, 100);
  }
}

/**
 * GET /api/v1/notifications
 * Returns citizen's own notifications only (IDOR-protected).
 */
notificationsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const store = getOrCreateStore(userId);
  // Check/expire application-linked notifications by syncing with real app data
  const apps = db.getApplicationsByOwner(userId);
  for (const app of apps) {
    const hasAppNotif = store.some((n) => n.relatedRef === app.id);
    if (!hasAppNotif && (app.status === "ACTION_REQUIRED" || app.status === "DOCUMENTS_REQUIRED")) {
      const svc = db.findServiceById(app.serviceId);
      createNotification(userId, {
        title: `Action Required: ${svc?.name || "Application"}`,
        message: `Your application ${app.applicationNumber} requires immediate attention (${app.status.replace(/_/g, " ")}).`,
        type: "alert",
        priority: "high",
        relatedRef: app.id,
      });
    }
  }

  const unreadCount = store.filter((n) => !n.read).length;
  return res.json({
    success: true,
    notifications: store.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      priority: n.priority,
      read: n.read,
      relatedRef: n.relatedRef,
      createdAt: n.createdAt,
    })),
    unreadCount,
  });
});

/**
 * GET /api/v1/notifications/count
 * Lightweight endpoint for badge updates (minimal payload).
 */
notificationsRouter.get("/count", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const store = getOrCreateStore(userId);
  const unreadCount = store.filter((n) => !n.read).length;
  return res.json({ success: true, unreadCount });
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read (citizen-scoped IDOR check).
 */
notificationsRouter.patch("/:id/read", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const store = getOrCreateStore(userId);
  const notif = store.find((n) => n.id === id && n.userId === userId);
  if (!notif) {
    return res.status(404).json({ success: false, error: "Notification not found" });
  }
  notif.read = true;
  return res.json({ success: true });
});

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all citizen's notifications as read.
 */
notificationsRouter.patch("/read-all", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const store = getOrCreateStore(userId);
  store.forEach((n) => {
    n.read = true;
  });
  return res.json({ success: true });
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a specific notification (citizen-scoped).
 */
notificationsRouter.delete("/:id", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const store = getOrCreateStore(userId);
  const initialLen = store.length;
  notificationStore[userId] = store.filter((n) => !(n.id === id && n.userId === userId));
  if (notificationStore[userId].length === initialLen) {
    return res.status(404).json({ success: false, error: "Notification not found" });
  }
  return res.json({ success: true });
});
