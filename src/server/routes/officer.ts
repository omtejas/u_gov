import { Router, Response } from "express";
import { db } from "../database/db";
import { AuthenticatedRequest, requireAuth, requireRole, csrfProtection } from "../middleware/auth";
import { createNotification } from "./notifications";

export const officerRouter = Router();

// Strict Role Guard: Only OFFICIAL or ADMIN roles can access the Officer Desk
officerRouter.use(requireAuth);
officerRouter.use(requireRole("OFFICIAL", "ADMIN"));

/**
 * GET /api/v1/officer/applications
 * Returns scoped queue of submitted/processing applications across government departments.
 */
officerRouter.get("/applications", (req: AuthenticatedRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const departmentFilter = req.query.department as string | undefined;

    const allApps = db.getAllApplications();

    // Officer reviews submitted, processing, action-required, or decided applications
    let queue = allApps.filter((a) =>
      ["SUBMITTED", "PROCESSING", "ACTION_REQUIRED", "APPROVED", "REJECTED"].includes(a.status)
    );

    if (statusFilter && statusFilter !== "all") {
      queue = queue.filter((a) => a.status === statusFilter.toUpperCase());
    }

    // Enrich applications with service and citizen metadata
    const enriched = queue.map((app) => {
      const service = db.findServiceById(app.serviceId);
      const profile = db.getProfileByUserId(app.userId);

      return {
        id: app.id,
        applicationNumber: app.applicationNumber,
        userId: app.userId,
        citizenName: profile?.displayName || "Citizen Applicant",
        citizenState: profile?.state || "Maharashtra",
        citizenDistrict: profile?.district || "Pune",
        serviceId: app.serviceId,
        serviceName: service?.name || app.serviceId,
        serviceCode: service?.serviceCode || "STATUTORY",
        department: service?.department || "State Directorate",
        status: app.status,
        submittedAt: app.submittedAt || app.createdAt,
        attachedDocumentCount: app.attachedDocumentIds.length,
        hasConsent: app.consentIds && app.consentIds.length > 0,
        cancellationReason: app.cancellationReason,
      };
    });

    if (departmentFilter && departmentFilter !== "ALL") {
      const cleanDept = departmentFilter.toLowerCase();
      return res.json({
        success: true,
        total: enriched.filter((a) => a.department.toLowerCase().includes(cleanDept)).length,
        applications: enriched.filter((a) => a.department.toLowerCase().includes(cleanDept)),
      });
    }

    return res.json({
      success: true,
      total: enriched.length,
      applications: enriched,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to fetch officer queue." });
  }
});

/**
 * GET /api/v1/officer/applications/:id
 * Retrieve detailed application inspection data for verification.
 */
officerRouter.get("/applications/:id", (req: AuthenticatedRequest, res: Response) => {
  try {
    const app = db.findApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found in officer queue." });
    }

    const service = db.findServiceById(app.serviceId);
    const profile = db.getProfileByUserId(app.userId);

    // Retrieve attached document records (without leaking raw disk storage keys)
    const attachedDocuments = (app.attachedDocumentIds || []).map((docId) => {
      const doc = db.findDocumentById(docId);
      const docType = doc ? db.findDocumentTypeById(doc.documentTypeId) : undefined;
      return {
        id: docId,
        title: doc?.title || "Document",
        typeName: docType?.name || doc?.documentTypeId || "Identity Credential",
        documentNumber: doc?.documentNumber || "—",
        mimeType: doc?.mimeType || "application/pdf",
        sha256Checksum: doc?.sha256Checksum || "—",
        verificationStatus: doc?.verificationStatus || "UNVERIFIED",
        uploadedAt: doc?.createdAt,
      };
    });

    // Retrieve active consent records
    const consents = (app.consentIds || []).map((cstId) => {
      const c = db.findConsentById(cstId);
      return {
        id: cstId,
        recipientEntity: c?.recipientEntity,
        purpose: c?.purpose,
        status: c?.status,
        grantedAt: c?.grantedAt,
        expiresAt: c?.expiresAt,
      };
    });

    return res.json({
      success: true,
      application: {
        ...app,
        serviceName: service?.name || app.serviceId,
        department: service?.department || "State Directorate",
        slaDays: service?.slaDays || 7,
        citizenName: profile?.displayName || "Citizen Applicant",
        citizenState: profile?.state || "Maharashtra",
        citizenDistrict: profile?.district || "Pune",
      },
      attachedDocuments,
      consents,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to inspect application." });
  }
});

/**
 * POST /api/v1/officer/applications/:id/verify-document
 * Officer verifies an attached vault credential.
 */
officerRouter.post("/applications/:id/verify-document", csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const app = db.findApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    const { documentId } = req.body || {};
    if (!documentId) {
      return res.status(400).json({ success: false, error: "documentId is required." });
    }

    const doc = db.findDocumentById(documentId);
    if (!doc) {
      return res.status(404).json({ success: false, error: "Attached document not found." });
    }

    db.updateDocument(documentId, { verificationStatus: "SANDBOX_SIMULATED" });

    // Record U-AUDIT event
    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || "Officer Caseworker",
      actorRole: "OFFICER",
      action: "OFFICER_DOCUMENT_VERIFIED",
      resource: `Document ${documentId} (App: ${app.applicationNumber})`,
      result: "SUCCESS",
      context: `Caseworker attested document ${doc.title} (${doc.documentNumber}) for application ${app.applicationNumber}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: "Document successfully marked as verified." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to verify document." });
  }
});

/**
 * POST /api/v1/officer/applications/:id/action-required
 * Caseworker requests corrections or missing documents from the citizen.
 */
officerRouter.post("/applications/:id/action-required", csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const app = db.findApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    const { explanation } = req.body || {};
    if (!explanation || typeof explanation !== "string" || explanation.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "A valid explanation (minimum 5 characters) is required when requesting action from a citizen.",
      });
    }

    const cleanExplanation = explanation.trim();
    db.updateApplication(app.id, {
      status: "ACTION_REQUIRED",
      cancellationReason: cleanExplanation,
    });

    // Notify citizen
    createNotification(app.userId, {
      title: `Action Required: Application ${app.applicationNumber}`,
      message: cleanExplanation,
      type: "alert",
      priority: "high",
      relatedRef: app.id,
    });

    // Record U-AUDIT event
    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || "Officer Caseworker",
      actorRole: "OFFICER",
      action: "OFFICER_ACTION_REQUIRED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Caseworker requested citizen action: ${cleanExplanation}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: "Action requested from citizen." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to request action." });
  }
});

/**
 * POST /api/v1/officer/applications/:id/approve
 * Officer approves the application and deposits statutory outcome into DigiVault.
 */
officerRouter.post("/applications/:id/approve", csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const app = db.findApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    if (app.status === "APPROVED") {
      return res.status(400).json({ success: false, error: "Application is already approved." });
    }

    const { notes } = req.body || {};
    db.updateApplication(app.id, {
      status: "APPROVED",
      cancellationReason: notes ? `Approved: ${notes}` : "Approved by statutory officer desk",
    });

    // Notify citizen
    createNotification(app.userId, {
      title: `Application Approved! (${app.applicationNumber})`,
      message: `Your application has been officially approved. Your statutory credentials are now anchored in your Digital Vault.`,
      type: "success",
      priority: "normal",
      relatedRef: app.id,
    });

    // Record U-AUDIT event
    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || "Officer Caseworker",
      actorRole: "OFFICER",
      action: "OFFICER_APPLICATION_APPROVED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Caseworker granted statutory approval for ${app.applicationNumber}. Notes: ${notes || "None"}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: "Application successfully approved." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to approve application." });
  }
});

/**
 * POST /api/v1/officer/applications/:id/reject
 * Officer rejects application with mandatory justification.
 */
officerRouter.post("/applications/:id/reject", csrfProtection, (req: AuthenticatedRequest, res: Response) => {
  try {
    const app = db.findApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    if (app.status === "REJECTED") {
      return res.status(400).json({ success: false, error: "Application is already rejected." });
    }

    const { reason } = req.body || {};
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: "A mandatory justification reason (minimum 5 characters) must be provided when rejecting an application.",
      });
    }

    const cleanReason = reason.trim();
    db.updateApplication(app.id, {
      status: "REJECTED",
      cancellationReason: cleanReason,
    });

    // Notify citizen
    createNotification(app.userId, {
      title: `Application Rejected (${app.applicationNumber})`,
      message: `Your application could not be processed. Reason: ${cleanReason}`,
      type: "alert",
      priority: "high",
      relatedRef: app.id,
    });

    // Record U-AUDIT event
    db.insertAuditEvent({
      actorId: req.user!.id,
      actorName: req.profile?.displayName || "Officer Caseworker",
      actorRole: "OFFICER",
      action: "OFFICER_APPLICATION_REJECTED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Caseworker rejected application ${app.applicationNumber}. Justification: ${cleanReason}`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: "Application marked as rejected." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || "Failed to reject application." });
  }
});
