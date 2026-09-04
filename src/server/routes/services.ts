import { Router, Request, Response } from "express";
import { governmentService } from "../services/governmentService";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";

export const servicesRouter = Router();

/**
 * GET /api/v1/services/categories
 * Returns catalogue of service categories with service count statistics
 */
servicesRouter.get("/categories", (_req: Request, res: Response) => {
  const categories = governmentService.getServiceCategories();
  return res.json({ success: true, categories });
});

/**
 * GET /api/v1/services
 * Public Service Discovery API with category filtering, keyword searching, and state scoping
 */
servicesRouter.get("/", (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const query = (req.query.q || req.query.query) as string | undefined;
  const state = req.query.state as string | undefined;

  const services = governmentService.listServices({ category, query, state });
  return res.json({
    success: true,
    total: services.length,
    services,
  });
});

/**
 * GET /api/v1/services/:id/requirements
 * Authenticated Service Requirement Engine:
 * Compares service prerequisites with credentials stored in citizen's private U-DOCS vault
 */
servicesRouter.get("/:id/requirements", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const evaluation = governmentService.getServiceRequirements(
      req.params.id,
      req.user!.id,
      req.ip
    );
    return res.json({ success: true, evaluation });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message || "Failed to evaluate service requirements.",
    });
  }
});

/**
 * GET /api/v1/services/:id
 * Retrieve detailed government service specification by ID or short code
 */
servicesRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const requestingUserId = (req as AuthenticatedRequest).user?.id;
    const service = governmentService.getServiceById(req.params.id, requestingUserId, req.ip);
    return res.json({ success: true, service });
  } catch (err: any) {
    const statusCode = err.statusCode || 404;
    return res.status(statusCode).json({
      success: false,
      error: err.message || "Service not found.",
    });
  }
});
