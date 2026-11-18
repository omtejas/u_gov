import { Router, Response } from "express";
import crypto from "crypto";
import { db, NotificationRecord } from "../database/db";
import { AuthenticatedRequest, requireAuth, csrfProtection } from "../middleware/auth";

export const notificationsRouter = Router();

/**
 * Helper — creates a persistent notification for a user (called by other routes).
 */
export function createNotification(
  userId: string,
  notification: Omit<NotificationRecord, "id" | "userId" | "createdAt" | "read">
): void {
  db.addNotification({
    id: `notif-${crypto.randomUUID()}`,
    userId,
    read: false,
    createdAt: new Date().toISOString(),
    ...notification,
  });
}

/**
 * GET /api/v1/notifications
 * Returns citizen's own persisted notifications only (IDOR-protected).
 */
notificationsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  let store = db.getNotificationsByUser(userId);

  const apps = db.getApplicationsByOwner(userId);
  let createdAny = false;
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
      createdAny = true;
    }
  }

  if (createdAny) {
    store = db.getNotificationsByUser(userId);
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
 * Lightweight endpoint for badge updates.
 */
notificationsRouter.get("/count", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const store = db.getNotificationsByUser(userId);
  const unreadCount = store.filter((n) => !n.read).length;
  return res.json({ success: true, unreadCount });
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read (citizen-scoped IDOR check).
 */
notificationsRouter.patch("/:id/read", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const updated = db.markNotificationRead(req.params.id, userId);
  if (!updated) {
    return res.status(404).json({ success: false, error: "Notification not found" });
  }
  return res.json({ success: true });
});

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all citizen's notifications as read.
 */
notificationsRouter.patch("/read-all", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  db.markAllNotificationsRead(req.user!.id);
  return res.json({ success: true });
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a specific notification (citizen-scoped).
 */
notificationsRouter.delete("/:id", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const deleted = db.deleteNotification(req.params.id, req.user!.id);
  if (!deleted) {
    return res.status(404).json({ success: false, error: "Notification not found" });
  }
  return res.json({ success: true });
});
