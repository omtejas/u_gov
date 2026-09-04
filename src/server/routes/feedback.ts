import { Router, Response } from "express";
import crypto from "crypto";
import { AuthenticatedRequest, requireAuth, requireRole, csrfProtection } from "../middleware/auth";

export const feedbackRouter = Router();

interface FeedbackRecord {
  id: string;
  userId: string;
  category: "bug" | "feature" | "ui" | "service" | "general" | "security";
  subject: string;
  message: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  status: "RECEIVED" | "REVIEWED" | "RESOLVED";
  createdAt: string;
}

// In-memory feedback store (citizen-scoped)
const feedbackStore: FeedbackRecord[] = [];

/**
 * POST /api/v1/feedback
 * Submit citizen feedback — stored with ownership, never returns other citizens' data.
 */
feedbackRouter.post("/", requireAuth, csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { category, subject, message, rating } = req.body;

  if (!category || !["bug", "feature", "ui", "service", "general", "security"].includes(category)) {
    return res.status(400).json({ success: false, error: "Invalid feedback category" });
  }
  if (!subject || typeof subject !== "string" || subject.trim().length < 5 || subject.trim().length > 100) {
    return res.status(400).json({ success: false, error: "Subject must be between 5 and 100 characters" });
  }
  if (!message || typeof message !== "string" || message.trim().length < 10 || message.trim().length > 2000) {
    return res.status(400).json({ success: false, error: "Message must be between 10 and 2000 characters" });
  }
  if (rating !== undefined && rating !== null && (typeof rating !== "number" || rating < 1 || rating > 5)) {
    return res.status(400).json({ success: false, error: "Rating must be between 1 and 5" });
  }

  // Rate limit: max 5 feedbacks per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentCount = feedbackStore.filter(
    (f) => f.userId === userId && f.createdAt > oneHourAgo
  ).length;
  if (recentCount >= 5) {
    return res.status(429).json({
      success: false,
      error: "Too many submissions",
      message: "You can submit up to 5 feedback items per hour. Please try again later.",
    });
  }

  const record: FeedbackRecord = {
    id: `fb-${crypto.randomUUID()}`,
    userId,
    category,
    subject: subject.trim(),
    message: message.trim(),
    rating: rating ?? null,
    status: "RECEIVED",
    createdAt: new Date().toISOString(),
  };

  feedbackStore.push(record);

  return res.status(201).json({
    success: true,
    message: "Thank you for your feedback. It has been recorded and will be reviewed by the U-GOV team.",
    id: record.id,
  });
});

/**
 * GET /api/v1/feedback/my
 * Get citizen's own submitted feedback.
 */
feedbackRouter.get("/my", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const myFeedback = feedbackStore
    .filter((f) => f.userId === userId)
    .map((f) => ({ id: f.id, category: f.category, subject: f.subject, status: f.status, rating: f.rating, createdAt: f.createdAt }));
  return res.json({ success: true, feedback: myFeedback });
});

/**
 * GET /api/v1/feedback/admin/analytics
 * Admin-only: aggregate statistics across all feedback.
 * Individual user IDs are NOT returned — only aggregates.
 */
feedbackRouter.get("/admin/analytics", requireAuth, requireRole("ADMIN"), (req: AuthenticatedRequest, res: Response) => {
  const totalCount = feedbackStore.length;
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let ratingSum = 0;
  let ratedCount = 0;

  for (const fb of feedbackStore) {
    byCategory[fb.category] = (byCategory[fb.category] || 0) + 1;
    byStatus[fb.status] = (byStatus[fb.status] || 0) + 1;
    if (fb.rating) {
      ratingSum += fb.rating;
      ratedCount++;
    }
  }

  const averageRating = ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : null;
  const recentItems = feedbackStore
    .slice(-10)
    .reverse()
    .map((f) => ({ id: f.id, category: f.category, subject: f.subject, status: f.status, createdAt: f.createdAt }));

  return res.json({
    success: true,
    analytics: {
      totalCount,
      byCategory,
      byStatus,
      averageRating,
      ratedCount,
      recentItems,
    },
  });
});
