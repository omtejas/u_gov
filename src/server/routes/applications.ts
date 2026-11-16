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

    const service = app.service;

    // Compute stages
    const stages = [
      {
        id: "stage-1",
        stageNumber: 1,
        title: "Service Catalogue Review",
        department: service?.department || "U-GOV Service Catalogue",
        desc: `Opened the listed service ${service?.name || app.serviceId}. Official eligibility is not verified by this prototype.`,
        status: "COMPLETED",
        timestamp: app.createdAt,
      },
      {
        id: "stage-2",
        stageNumber: 2,
        title: "U-DOCS Document Readiness",
        department: "U-GOV Document Vault",
        desc: `${app.attachedDocumentIds.length} document(s) attached to this prototype application.`,
        status: (app.status === "DRAFT" || app.status === "DOCUMENTS_REQUIRED") ? "CURRENT" : "COMPLETED",
        timestamp: app.createdAt,
      },
      {
        id: "stage-3",
        stageNumber: 3,
        title: "U-GOV Prototype Consent Record",
        department: "U-CONSENT Engine",
        desc: app.consentIds && app.consentIds.length > 0
          ? "A consent record was created within U-GOV for the selected documents."
          : "No U-GOV prototype consent record has been created yet.",
        status: (app.consentIds && app.consentIds.length > 0)
          ? "COMPLETED"
          : (app.status === "CONSENT_REQUIRED" ? "CURRENT" : (app.status === "DOCUMENTS_REQUIRED" ? "PENDING" : "COMPLETED")),
      },
      {
        id: "stage-4",
        stageNumber: 4,
        title: "Application Record Preparation",
        department: "U-APPLICATIONS Engine",
        desc: `Application data stored in the U-GOV prototype under reference ${app.applicationNumber}.`,
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
          ? `Accepted by the U-GOV sandbox adapter at ${app.submittedAt}.`
          : "Awaiting citizen submission to the U-GOV sandbox.",
        status: ["SUBMITTED", "PROCESSING", "ACTION_REQUIRED", "APPROVED", "REJECTED"].includes(app.status)
          ? "COMPLETED"
          : "PENDING",
        timestamp: app.submittedAt || undefined,
      },
      {
        id: "stage-6",
        stageNumber: 6,
        title: "Sandbox Adapter Response",
        department: "U-GOV Sandbox Gateway",
        desc: "Prototype adapter response only; no live government system synchronization is performed.",
        status: ["PROCESSING", "ACTION_REQUIRED", "APPROVED", "REJECTED"].includes(app.status)
          ? "COMPLETED"
          : (app.status === "SUBMITTED" ? "CURRENT" : "PENDING"),
      },
      {
        id: "stage-7",
        stageNumber: 7,
        title: "Prototype Processing State",
        department: "U-GOV Demonstration Workflow",
        desc: app.status === "ACTION_REQUIRED"
          ? (app.cancellationReason || "The prototype record is marked as requiring further action.")
          : (["APPROVED", "REJECTED"].includes(app.status)
            ? "A terminal outcome is recorded in the prototype; it is not an official government decision."
            : "No live caseworker assignment or departmental review is connected."),
        status: ["APPROVED", "REJECTED"].includes(app.status)
          ? "COMPLETED"
          : (app.status === "ACTION_REQUIRED" ? "ACTION_REQUIRED" : (["SUBMITTED", "PROCESSING"].includes(app.status) ? "CURRENT" : "PENDING")),
      },
      {
        id: "stage-8",
        stageNumber: 8,
        title: "Prototype Outcome",
        department: "U-GOV Demonstration Workflow",
        desc: app.status === "APPROVED"
          ? "Prototype status marked APPROVED. This is not an official government decision or certificate."
          : (app.status === "REJECTED"
            ? `Application REJECTED: ${app.cancellationReason || "Statutory criteria not met"}.`
            : "No official government decision or certificate is available through this prototype."),
        status: app.status === "APPROVED" ? "APPROVED" : (app.status === "REJECTED" ? "REJECTED" : "PENDING"),
      },
    ];

    let nextAction = "No citizen action is currently indicated by this U-GOV prototype record.";
    if (app.status === "DOCUMENTS_REQUIRED") {
      nextAction = "Add the listed missing document types to U-DOCS and attach them to this application.";
    } else if (app.status === "READY" || app.status === "CONSENT_REQUIRED") {
      nextAction = "Review the selected documents and record consent within the U-GOV prototype.";
    } else if (app.status === "ACTION_REQUIRED") {
      nextAction = "Review the prototype application record and follow any displayed document or form instructions.";
    } else if (app.status === "APPROVED") {
      nextAction = "The prototype record has a terminal status. No official certificate is issued by this demonstration.";
    }

    return res.json({
      success: true,
      application: app,
      service,
      stages,
      slaDaysRemaining: service ? Math.max(0, service.slaDays - Math.floor((Date.now() - new Date(app.submittedAt || app.createdAt).getTime()) / 86400000)) : null,
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

