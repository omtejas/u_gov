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
