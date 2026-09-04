import { Router, Response } from "express";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { applicationService } from "../services/applicationService";

export const applicationsRouter = Router();

/**
 * All citizen application endpoints strictly require authenticated sessions.
 */
applicationsRouter.use(requireAuth);

/**
 * POST /api/v1/applications
 * Create a new application for a government service
 */
applicationsRouter.post("/", (req: AuthenticatedRequest, res: Response) => {
  try {
    const { serviceId, formData, attachedDocumentIds } = req.body || {};
    const app = applicationService.createApplication(
      req.user!.id,
      { serviceId, formData, attachedDocumentIds },
      req.ip
    );
    return res.status(201).json({
      success: true,
      application: app,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to create application.",
    });
  }
});

/**
 * GET /api/v1/applications
 * List all applications created by the authenticated citizen
 */
applicationsRouter.get("/", (req: AuthenticatedRequest, res: Response) => {
  try {
    const applications = applicationService.getApplicationsByOwner(req.user!.id);
    return res.json({
      success: true,
      total: applications.length,
      applications,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to fetch applications.",
    });
  }
});

/**
 * GET /api/v1/applications/:id
 * Retrieve full details of an application (strictly owner-accessible)
 */
applicationsRouter.get("/:id", (req: AuthenticatedRequest, res: Response) => {
  try {
    const application = applicationService.getApplicationById(req.params.id, req.user!.id);
    return res.json({
      success: true,
      application,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to retrieve application.",
    });
  }
});

/**
 * POST /api/v1/applications/:id/documents
 * Attach a citizen-owned credential to an application
 */
applicationsRouter.post("/:id/documents", (req: AuthenticatedRequest, res: Response) => {
  try {
    const { documentId } = req.body || {};
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: "documentId is required in request body.",
      });
    }

    const updatedApp = applicationService.attachDocument(
      req.params.id,
      req.user!.id,
      documentId,
      req.ip
    );

    return res.json({
      success: true,
      application: updatedApp,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to attach document.",
    });
  }
});

/**
 * DELETE /api/v1/applications/:id/documents/:documentId
 * Detach a credential from an application
 */
applicationsRouter.delete("/:id/documents/:documentId", (req: AuthenticatedRequest, res: Response) => {
  try {
    const updatedApp = applicationService.removeDocument(
      req.params.id,
      req.user!.id,
      req.params.documentId,
      req.ip
    );

    return res.json({
      success: true,
      application: updatedApp,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to remove document.",
    });
  }
});

/**
 * GET /api/v1/applications/:id/review
 * Retrieve data sharing disclosures and statutory consent requirements
 */
applicationsRouter.get("/:id/review", (req: AuthenticatedRequest, res: Response) => {
  try {
    const reviewDetails = applicationService.reviewApplication(
      req.params.id,
      req.user!.id,
      req.ip
    );

    return res.json({
      success: true,
      review: reviewDetails,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to generate review details.",
    });
  }
});

/**
 * POST /api/v1/applications/:id/submit
 * Authorize statutory U-CONSENT for all attached documents and submit application
 */
applicationsRouter.post("/:id/submit", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await applicationService.grantConsentAndSubmit(
      req.params.id,
      req.user!.id,
      req.ip
    );

    return res.json({
      success: true,
      application: result.application,
      submission: result.submissionResult,
      consentsGrantedCount: result.consentsGrantedCount,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to submit application.",
    });
  }
});

/**
 * POST /api/v1/applications/:id/cancel
 * Cancel an in-progress or prepared application
 */
applicationsRouter.post("/:id/cancel", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason } = req.body || {};
    const updatedApp = await applicationService.cancelApplication(
      req.params.id,
      req.user!.id,
      reason,
      req.ip
    );

    return res.json({
      success: true,
      application: updatedApp,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to cancel application.",
    });
  }
});

/**
 * GET /api/v1/applications/:id/journey
 * Citizen Journey Tracer: Returns rich milestone journey for an application (IDOR-scoped)
 */
applicationsRouter.get("/:id/journey", (req: AuthenticatedRequest, res: Response) => {
  try {
    const app = applicationService.getApplicationById(req.params.id, req.user!.id);
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    const service = applicationService.getServiceById(app.serviceId);

    // Compute stages
    const stages = [
      {
        id: "stage-1",
        stageNumber: 1,
        title: "Scheme Discovery & Eligibility Check",
        department: service?.department || "National Portal",
        desc: `Discovered statutory scheme ${service?.name || app.serviceId}. Verified initial criteria.`,
        status: "COMPLETED",
        timestamp: app.createdAt,
      },
      {
        id: "stage-2",
        stageNumber: 2,
        title: "U-DOCS Vault Requirements Check",
        department: "Citizen Sovereign Vault",
        desc: `${app.attachedDocumentIds.length} required credential(s) attached from private digital vault.`,
        status: (app.status === "DRAFT" || app.status === "DOCUMENTS_REQUIRED") ? "CURRENT" : "COMPLETED",
        timestamp: app.createdAt,
      },
      {
        id: "stage-3",
        stageNumber: 3,
        title: "Sovereign DPDP Consent Authorization",
        department: "U-CONSENT Engine",
        desc: app.consentIds && app.consentIds.length > 0
          ? "Explicit purpose-bound consent granted for credential verification."
          : "Awaiting explicit citizen data-sharing consent.",
        status: (app.consentIds && app.consentIds.length > 0)
          ? "COMPLETED"
          : (app.status === "CONSENT_REQUIRED" ? "CURRENT" : (app.status === "DOCUMENTS_REQUIRED" ? "PENDING" : "COMPLETED")),
      },
      {
        id: "stage-4",
        stageNumber: 4,
        title: "Application Payload Generation",
        department: "U-APPLICATIONS Engine",
        desc: `Form payload serialized with statutory reference ${app.applicationNumber}.`,
        status: (app.status === "DRAFT" || app.status === "DOCUMENTS_REQUIRED" || app.status === "READY" || app.status === "CONSENT_REQUIRED")
          ? "PENDING"
          : "COMPLETED",
      },
      {
        id: "stage-5",
        stageNumber: 5,
        title: "Sandbox Gateway Submission",
        department: "U-INTEGRATIONS Hub",
        desc: app.submittedAt
          ? `Dispatched to department integration adapter at ${app.submittedAt}.`
          : "Awaiting final citizen dispatch.",
        status: ["SUBMITTED", "PROCESSING", "ACTION_REQUIRED", "APPROVED", "REJECTED"].includes(app.status)
          ? "COMPLETED"
          : "PENDING",
        timestamp: app.submittedAt || undefined,
      },
      {
        id: "stage-6",
        stageNumber: 6,
        title: "Departmental Adapter Synchronization",
        department: service?.department || "Department Gateway",
        desc: `Synchronized with ${service?.serviceCode || "STATUTORY"} integration adapter.`,
        status: ["PROCESSING", "ACTION_REQUIRED", "APPROVED", "REJECTED"].includes(app.status)
          ? "COMPLETED"
          : (app.status === "SUBMITTED" ? "CURRENT" : "PENDING"),
      },
      {
        id: "stage-7",
        stageNumber: 7,
        title: "Caseworker Verification & Inspection",
        department: `${service?.department || "State Directorate"} Desk`,
        desc: app.status === "ACTION_REQUIRED"
          ? (app.cancellationReason || "Caseworker requested additional document verification.")
          : (["APPROVED", "REJECTED"].includes(app.status)
            ? "Caseworker completed credential inspection."
            : "Assigned to departmental officer desk for credential inspection."),
        status: ["APPROVED", "REJECTED"].includes(app.status)
          ? "COMPLETED"
          : (app.status === "ACTION_REQUIRED" ? "ACTION_REQUIRED" : (["SUBMITTED", "PROCESSING"].includes(app.status) ? "CURRENT" : "PENDING")),
      },
      {
        id: "stage-8",
        stageNumber: 8,
        title: "Statutory Decision & Delivery",
        department: service?.ministry || "Republic of India",
        desc: app.status === "APPROVED"
          ? "Application officially APPROVED. Statutory certificate issued and anchored to U-DOCS Vault."
          : (app.status === "REJECTED"
            ? `Application REJECTED: ${app.cancellationReason || "Statutory criteria not met"}.`
            : "Final statutory decision pending caseworker review."),
        status: app.status === "APPROVED" ? "APPROVED" : (app.status === "REJECTED" ? "REJECTED" : "PENDING"),
      },
    ];

    let nextAction = "No action needed. Application is progressing through statutory channels.";
    if (app.status === "DOCUMENTS_REQUIRED") {
      nextAction = "Upload missing credentials to your Digital Vault and attach them.";
    } else if (app.status === "READY" || app.status === "CONSENT_REQUIRED") {
      nextAction = "Grant DPDP consent to authorize credential sharing with the department.";
    } else if (app.status === "ACTION_REQUIRED") {
      nextAction = `Action Required by Caseworker: ${app.cancellationReason || "Please review and re-submit the required documents."}`;
    } else if (app.status === "APPROVED") {
      nextAction = "Application complete! Your approved certificate is available in your Digital Vault.";
    }

    return res.json({
      success: true,
      application,
      service,
      stages,
      slaDaysRemaining: service ? Math.max(1, service.slaDays - 2) : 7,
      nextAction,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to fetch journey.",
    });
  }
});

