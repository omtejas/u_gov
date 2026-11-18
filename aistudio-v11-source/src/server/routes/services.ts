import { Router, Request, Response } from "express";
import { governmentService } from "../services/governmentService";
import { db } from "../database/db";
import { AuthenticatedRequest, requireAuth, requireRole, csrfProtection } from "../middleware/auth";

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

/**
 * POST /api/v1/services
 * No-Code Service Builder: Create a new government scheme (Admin-only).
 */
servicesRouter.post("/", requireAuth, requireRole("ADMIN"), csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      serviceCode,
      department,
      ministry,
      description,
      category,
      state = "ALL_INDIA",
      requiredDocumentTypeIds = [],
      requiredDocuments = [],
      benefits = [],
      eligibility = [],
      slaDays = 15,
      fee = 0,
      status = "AVAILABLE",
      officialPortal = "https://india.gov.in",
      isPopular = false,
      featured = false,
    } = req.body || {};

    if (!name || typeof name !== "string" || name.trim().length < 3) {
      return res.status(400).json({ success: false, error: "Valid scheme name (minimum 3 characters) is required." });
    }
    if (!serviceCode || typeof serviceCode !== "string" || serviceCode.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Valid service code (minimum 2 characters) is required." });
    }
    if (!department || typeof department !== "string") {
      return res.status(400).json({ success: false, error: "Issuing department is required." });
    }
    if (!description || typeof description !== "string") {
      return res.status(400).json({ success: false, error: "Scheme description is required." });
    }

    const cleanCode = serviceCode.toUpperCase().trim();
    const existing = db.findServiceByCode(cleanCode);
    if (existing) {
      return res.status(409).json({ success: false, error: `Service with code ${cleanCode} already exists.` });
    }

    const now = new Date().toISOString();
    const newService = {
      id: `serv-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`,
      serviceCode: cleanCode,
      name: name.trim(),
      department: department.trim(),
      ministry: (ministry || department).trim(),
      description: description.trim(),
      category: (category || "general").toLowerCase().trim(),
      state: state.trim(),
      requiredDocumentTypeIds: Array.isArray(requiredDocumentTypeIds) ? requiredDocumentTypeIds : [],
      requiredDocuments: Array.isArray(requiredDocuments) && requiredDocuments.length > 0
        ? requiredDocuments
        : requiredDocumentTypeIds.map((id: string) => id.replace(/_/g, " ")),
      benefits: Array.isArray(benefits) ? benefits : ["Direct statutory service delivery"],
      eligibility: Array.isArray(eligibility) ? eligibility : ["Citizen of India"],
      slaDays: Number(slaDays) || 15,
      fee: Number(fee) || 0,
      status: ["AVAILABLE", "SANDBOX_PROTOTYPE", "MAINTENANCE"].includes(status) ? status : "AVAILABLE",
      officialPortal: officialPortal || "https://india.gov.in",
      isPopular: Boolean(isPopular),
      featured: Boolean(featured),
      createdAt: now,
      updatedAt: now,
    };

    db.createService(newService as any);

    // Record U-AUDIT event
    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || "System Administrator",
      actorRole: "ADMIN",
      action: "SERVICE_CREATED",
      resource: `Service ${newService.serviceCode}`,
      result: "SUCCESS",
      context: `Admin created new public scheme '${newService.name}' (${newService.serviceCode}) with SLA ${newService.slaDays} days`,
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, service: newService });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to create service." });
  }
});

/**
 * PATCH /api/v1/services/:id
 * No-Code Service Builder: Update scheme metadata or requirements (Admin-only).
 */
servicesRouter.patch("/:id", requireAuth, requireRole("ADMIN"), csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const service = db.findServiceById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, error: "Service not found." });
    }

    const allowed = [
      "name",
      "department",
      "ministry",
      "description",
      "category",
      "state",
      "requiredDocumentTypeIds",
      "requiredDocuments",
      "benefits",
      "eligibility",
      "slaDays",
      "fee",
      "status",
      "officialPortal",
      "isPopular",
      "featured",
    ];

    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    db.updateService(service.id, updates);

    // Record U-AUDIT event
    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || "System Administrator",
      actorRole: "ADMIN",
      action: "SERVICE_UPDATED",
      resource: `Service ${service.serviceCode}`,
      result: "SUCCESS",
      context: `Admin updated scheme '${service.name}' fields: ${Object.keys(updates).join(", ")}`,
      ipAddress: req.ip,
    });

    const updated = db.findServiceById(service.id);
    return res.json({ success: true, service: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to update service." });
  }
});

/**
 * PATCH /api/v1/services/:id/status
 * No-Code Service Builder: Toggle service availability status (Admin-only).
 */
servicesRouter.patch("/:id/status", requireAuth, requireRole("ADMIN"), csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const service = db.findServiceById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, error: "Service not found." });
    }

    const { status } = req.body || {};
    if (!["AVAILABLE", "SANDBOX_PROTOTYPE", "MAINTENANCE"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be one of: AVAILABLE, SANDBOX_PROTOTYPE, MAINTENANCE",
      });
    }

    db.updateService(service.id, { status });

    // Record U-AUDIT event
    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || "System Administrator",
      actorRole: "ADMIN",
      action: "SERVICE_STATUS_CHANGED",
      resource: `Service ${service.serviceCode}`,
      result: "SUCCESS",
      context: `Admin changed scheme status to ${status} for ${service.serviceCode}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, service: db.findServiceById(service.id) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to update service status." });
  }
});

