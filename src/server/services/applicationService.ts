import crypto from "crypto";
import {
  db,
  GovernmentApplicationRecord,
  ApplicationStatus,
  GovernmentServiceRecord,
  CitizenDocumentRecord,
} from "../database/db";
import { documentService } from "./documentService";
import { getIntegrationAdapter, ApplicationSubmissionResult } from "../integrations";

export interface CreateApplicationInput {
  serviceId: string;
  formData?: Record<string, any>;
  attachedDocumentIds?: string[];
}

export interface ApplicationReviewDetails {
  application: {
    id: string;
    applicationNumber: string;
    status: ApplicationStatus;
    formData: Record<string, any>;
    createdAt: string;
    submittedAt?: string | null;
  };
  service: {
    id: string;
    serviceCode: string;
    name: string;
    department: string;
    ministry: string;
    slaDays: number;
    fee: number;
  };
  attachedDocuments: {
    id: string;
    title: string;
    documentTypeId: string;
    documentNumber: string;
    sha256Checksum: string;
    verificationStatus: string;
  }[];
  requirements: {
    totalRequired: number;
    attachedCount: number;
    satisfied: boolean;
    missingDocumentTypeIds: string[];
  };
  dataSharingDisclosure: {
    recipientEntity: string;
    purpose: string;
    validityDays: number;
    accessType: string;
    documentsToShare: {
      id: string;
      title: string;
      documentTypeId: string;
      sha256Checksum: string;
    }[];
  };
}

export class ApplicationService {
  /**
   * Helper to evaluate document requirements against attached documents
   */
  private evaluateReadiness(
    service: GovernmentServiceRecord,
    attachedDocumentIds: string[],
    ownerUserId: string
  ): {
    satisfied: boolean;
    validAttachedDocs: CitizenDocumentRecord[];
    missingTypeIds: string[];
  } {
    const userDocs = db.getDocumentsByOwner(ownerUserId);
    const attachedDocs = userDocs.filter((d) => attachedDocumentIds.includes(d.id));
    const attachedTypeIds = new Set(attachedDocs.map((d) => d.documentTypeId));

    const requiredTypeIds = service.requiredDocumentTypeIds || [];
    const missingTypeIds = requiredTypeIds.filter((tId) => !attachedTypeIds.has(tId));

    return {
      satisfied: missingTypeIds.length === 0,
      validAttachedDocs: attachedDocs,
      missingTypeIds,
    };
  }

  /**
   * Create a new government application
   */
  public createApplication(
    userId: string,
    input: CreateApplicationInput,
    ip?: string
  ): GovernmentApplicationRecord {
    if (!input.serviceId || typeof input.serviceId !== "string") {
      const err: any = new Error("Valid serviceId is required.");
      err.statusCode = 400;
      throw err;
    }

    let service = db.findServiceById(input.serviceId);
    if (!service) {
      service = db.findServiceByCode(input.serviceId);
    }
    if (!service) {
      const err: any = new Error(`Government service not found: "${input.serviceId}".`);
      err.statusCode = 404;
      throw err;
    }

    // Validate any attachedDocumentIds belong to this citizen
    const initialDocIds: string[] = [];
    if (Array.isArray(input.attachedDocumentIds)) {
      for (const docId of input.attachedDocumentIds) {
        const doc = db.findDocumentById(docId);
        if (!doc || doc.ownerUserId !== userId) {
          const err: any = new Error(`Access denied: Document "${docId}" does not belong to your DigiVault.`);
          err.statusCode = 403;
          throw err;
        }
        initialDocIds.push(docId);
      }
    }

    // Evaluate readiness
    const readiness = this.evaluateReadiness(service, initialDocIds, userId);
    const initialStatus: ApplicationStatus = readiness.satisfied ? "READY" : "DOCUMENTS_REQUIRED";

    const appId = `app-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    const appNumber = `UGOV-2026-${service.serviceCode}-${randomHex}`;
    const now = new Date().toISOString();

    const appRecord: GovernmentApplicationRecord = {
      id: appId,
      applicationNumber: appNumber,
      userId,
      serviceId: service.id,
      status: initialStatus,
      formData: input.formData || {},
      attachedDocumentIds: initialDocIds,
      consentIds: [],
      trackingToken: null,
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    db.createApplication(appRecord);

    const profile = db.getProfileByUserId(userId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-appcreate`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "APPLICATION_CREATED",
      resource: `Application ${appNumber} (${service.name})`,
      result: "SUCCESS",
      context: `Citizen initiated application for ${service.name}. Initial status: ${initialStatus}.`,
      ipAddress: ip,
    });

    if (initialStatus === "READY") {
      db.recordAuditEvent({
        id: `aud-${Date.now()}-appready`,
        timestamp: now,
        actorId: userId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "APPLICATION_READY",
        resource: `Application ${appNumber}`,
        result: "SUCCESS",
        context: `All required documents attached upon creation. Application marked READY for consent & submission.`,
        ipAddress: ip,
      });
    }

    return appRecord;
  }

  /**
   * List all applications belonging to the requesting citizen
   */
  public getApplicationsByOwner(userId: string): (GovernmentApplicationRecord & { service: GovernmentServiceRecord | null })[] {
    const apps = db.getApplicationsByOwner(userId);
    return apps.map((app) => ({
      ...app,
      service: db.findServiceById(app.serviceId) || null,
    }));
  }

  /**
   * Get single application by ID with strict citizen ownership enforcement
   */
  public getApplicationById(
    applicationId: string,
    requestingUserId: string
  ): GovernmentApplicationRecord & { service: GovernmentServiceRecord | null; attachedDocuments: CitizenDocumentRecord[] } {
    const app = db.findApplicationById(applicationId);
    if (!app) {
      const err: any = new Error("Application not found.");
      err.statusCode = 404;
      throw err;
    }

    // Strict Server-Side IDOR Enforcement
    if (app.userId !== requestingUserId) {
      const err: any = new Error("Access denied: You are not authorized to access this application.");
      err.statusCode = 403;
      throw err;
    }

    const service = db.findServiceById(app.serviceId) || null;
    const userDocs = db.getDocumentsByOwner(requestingUserId);
    const attachedDocuments = userDocs.filter((d) => app.attachedDocumentIds.includes(d.id));

    return {
      ...app,
      service,
      attachedDocuments,
    };
  }

  /**
   * Attach a citizen-owned credential to an application
   */
  public attachDocument(
    applicationId: string,
    userId: string,
    documentId: string,
    ip?: string
  ): GovernmentApplicationRecord {
    const app = db.findApplicationById(applicationId);
    if (!app) {
      const err: any = new Error("Application not found.");
      err.statusCode = 404;
      throw err;
    }

    // IDOR check
    if (app.userId !== userId) {
      const err: any = new Error("Access denied: You do not own this application.");
      err.statusCode = 403;
      throw err;
    }

    // Lifecycle check
    if (["SUBMITTED", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"].includes(app.status)) {
      const err: any = new Error(`Cannot modify documents for application in ${app.status} state.`);
      err.statusCode = 400;
      throw err;
    }

    // Validate document ownership
    const doc = db.findDocumentById(documentId);
    if (!doc || doc.ownerUserId !== userId) {
      const err: any = new Error("Access denied: Document does not exist or does not belong to your DigiVault.");
      err.statusCode = 403;
      throw err;
    }

    // Check if already attached
    if (!app.attachedDocumentIds.includes(documentId)) {
      app.attachedDocumentIds.push(documentId);
    }

    const service = db.findServiceById(app.serviceId);
    let newStatus: ApplicationStatus = app.status;
    let becameReady = false;

    if (service) {
      const readiness = this.evaluateReadiness(service, app.attachedDocumentIds, userId);
      if (readiness.satisfied) {
        if (app.status !== "READY" && app.status !== "CONSENT_REQUIRED" && app.status !== "CONSENT_GRANTED") {
          newStatus = "READY";
          becameReady = true;
        }
      } else {
        newStatus = "DOCUMENTS_REQUIRED";
      }
    }

    db.updateApplication(app.id, {
      attachedDocumentIds: app.attachedDocumentIds,
      status: newStatus,
    });

    const profile = db.getProfileByUserId(userId);
    const now = new Date().toISOString();

    db.recordAuditEvent({
      id: `aud-${Date.now()}-docattach`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "APPLICATION_DOCUMENT_ATTACHED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Attached credential "${doc.title}" (${doc.documentTypeId}) to application.`,
      ipAddress: ip,
    });

    if (becameReady) {
      db.recordAuditEvent({
        id: `aud-${Date.now()}-appready`,
        timestamp: now,
        actorId: userId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "APPLICATION_READY",
        resource: `Application ${app.applicationNumber}`,
        result: "SUCCESS",
        context: `All required documents attached. Application transitioned to READY.`,
        ipAddress: ip,
      });
    }

    return db.findApplicationById(applicationId)!;
  }

  /**
   * Detach a credential from an application
   */
  public removeDocument(
    applicationId: string,
    userId: string,
    documentId: string,
    ip?: string
  ): GovernmentApplicationRecord {
    const app = db.findApplicationById(applicationId);
    if (!app) {
      const err: any = new Error("Application not found.");
      err.statusCode = 404;
      throw err;
    }

    // IDOR check
    if (app.userId !== userId) {
      const err: any = new Error("Access denied: You do not own this application.");
      err.statusCode = 403;
      throw err;
    }

    // Lifecycle check
    if (["SUBMITTED", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"].includes(app.status)) {
      const err: any = new Error(`Cannot remove documents from application in ${app.status} state.`);
      err.statusCode = 400;
      throw err;
    }

    const originalLength = app.attachedDocumentIds.length;
    app.attachedDocumentIds = app.attachedDocumentIds.filter((id) => id !== documentId);

    if (app.attachedDocumentIds.length === originalLength) {
      const err: any = new Error("Document is not attached to this application.");
      err.statusCode = 400;
      throw err;
    }

    const service = db.findServiceById(app.serviceId);
    let newStatus: ApplicationStatus = app.status;

    if (service) {
      const readiness = this.evaluateReadiness(service, app.attachedDocumentIds, userId);
      if (!readiness.satisfied) {
        newStatus = "DOCUMENTS_REQUIRED";
      }
    }

    db.updateApplication(app.id, {
      attachedDocumentIds: app.attachedDocumentIds,
      status: newStatus,
    });

    const profile = db.getProfileByUserId(userId);
    const now = new Date().toISOString();

    db.recordAuditEvent({
      id: `aud-${Date.now()}-docdetach`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "APPLICATION_DOCUMENT_REMOVED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Removed document ${documentId} from application. Status updated to ${newStatus}.`,
      ipAddress: ip,
    });

    return db.findApplicationById(applicationId)!;
  }

  /**
   * Review application data sharing disclosures before granting consent
   */
  public reviewApplication(
    applicationId: string,
    userId: string,
    ip?: string
  ): ApplicationReviewDetails {
    const app = db.findApplicationById(applicationId);
    if (!app) {
      const err: any = new Error("Application not found.");
      err.statusCode = 404;
      throw err;
    }

    if (app.userId !== userId) {
      const err: any = new Error("Access denied: You do not own this application.");
      err.statusCode = 403;
      throw err;
    }

    const service = db.findServiceById(app.serviceId);
    if (!service) {
      const err: any = new Error("Associated service not found.");
      err.statusCode = 404;
      throw err;
    }

    const readiness = this.evaluateReadiness(service, app.attachedDocumentIds, userId);

    const profile = db.getProfileByUserId(userId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-cstreq`,
      timestamp: new Date().toISOString(),
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "APPLICATION_CONSENT_REQUESTED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Citizen requested data-sharing review for ${service.department}.`,
      ipAddress: ip,
    });

    return {
      application: {
        id: app.id,
        applicationNumber: app.applicationNumber,
        status: app.status,
        formData: app.formData,
        createdAt: app.createdAt,
        submittedAt: app.submittedAt,
      },
      service: {
        id: service.id,
        serviceCode: service.serviceCode,
        name: service.name,
        department: service.department,
        ministry: service.ministry,
        slaDays: service.slaDays,
        fee: service.fee,
      },
      attachedDocuments: readiness.validAttachedDocs.map((d) => ({
        id: d.id,
        title: d.title,
        documentTypeId: d.documentTypeId,
        documentNumber: d.documentNumber,
        sha256Checksum: d.sha256Checksum,
        verificationStatus: d.verificationStatus,
      })),
      requirements: {
        totalRequired: service.requiredDocumentTypeIds.length,
        attachedCount: readiness.validAttachedDocs.length,
        satisfied: readiness.satisfied,
        missingDocumentTypeIds: readiness.missingTypeIds,
      },
      dataSharingDisclosure: {
        recipientEntity: service.department,
        purpose: `Verification of eligibility and processing for ${service.name} (${app.applicationNumber})`,
        validityDays: 30,
        accessType: "READ_FOR_APPLICATION_PROCESSING",
        documentsToShare: readiness.validAttachedDocs.map((d) => ({
          id: d.id,
          title: d.title,
          documentTypeId: d.documentTypeId,
          sha256Checksum: d.sha256Checksum,
        })),
      },
    };
  }

  /**
   * Explicitly grant consent for attached documents and submit application
   */
  public async grantConsentAndSubmit(
    applicationId: string,
    userId: string,
    ip?: string
  ): Promise<{
    success: boolean;
    application: GovernmentApplicationRecord;
    submissionResult: ApplicationSubmissionResult;
    consentsGrantedCount: number;
  }> {
    const app = db.findApplicationById(applicationId);
    if (!app) {
      const err: any = new Error("Application not found.");
      err.statusCode = 404;
      throw err;
    }

    if (app.userId !== userId) {
      const err: any = new Error("Access denied: You do not own this application.");
      err.statusCode = 403;
      throw err;
    }

    // Cannot submit if already submitted / processed / cancelled
    if (["SUBMITTED", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"].includes(app.status)) {
      const err: any = new Error(`Cannot submit application in ${app.status} status.`);
      err.statusCode = 400;
      throw err;
    }

    const service = db.findServiceById(app.serviceId);
    if (!service) {
      const err: any = new Error("Associated service not found.");
      err.statusCode = 404;
      throw err;
    }

    // Evaluate requirements satisfaction
    const readiness = this.evaluateReadiness(service, app.attachedDocumentIds, userId);
    if (!readiness.satisfied) {
      const err: any = new Error(
        `Cannot submit application: Missing required credentials (${readiness.missingTypeIds.join(", ")}). Please attach all mandatory documents.`
      );
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    const profile = db.getProfileByUserId(userId);

    // 1. Grant explicit U-CONSENT for each attached document
    const newConsentIds: string[] = [];
    for (const doc of readiness.validAttachedDocs) {
      const consent = documentService.grantConsent(
        userId,
        doc.id,
        service.department,
        `Statutory application processing for ${service.name} (${app.applicationNumber})`,
        30,
        ip
      );
      newConsentIds.push(consent.id);
    }

    db.recordAuditEvent({
      id: `aud-${Date.now()}-cstgrant`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "APPLICATION_CONSENT_GRANTED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Citizen granted statutory data sharing consent for ${newConsentIds.length} attached credentials to ${service.department}.`,
      ipAddress: ip,
    });

    // 2. Dispatch to integration adapter
    const adapter = getIntegrationAdapter();
    const submissionResult = await adapter.submitApplication({
      applicationId: app.id,
      applicationNumber: app.applicationNumber,
      serviceCode: service.serviceCode,
      serviceName: service.name,
      citizenUserId: userId,
      formData: app.formData,
      attachedDocuments: readiness.validAttachedDocs.map((d) => ({
        documentId: d.id,
        documentTypeId: d.documentTypeId,
        title: d.title,
        documentNumber: d.documentNumber,
        sha256Checksum: d.sha256Checksum,
      })),
      consentIds: newConsentIds,
    });

    // 3. Update application state
    db.updateApplication(app.id, {
      status: "SUBMITTED",
      consentIds: newConsentIds,
      trackingToken: submissionResult.trackingToken,
      submittedAt: submissionResult.submittedAt,
    });

    db.recordAuditEvent({
      id: `aud-${Date.now()}-appsubmit`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "APPLICATION_SUBMITTED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Application formally submitted. Tracking Token: ${submissionResult.trackingToken}.`,
      ipAddress: ip,
    });

    const updatedApp = db.findApplicationById(app.id)!;

    return {
      success: true,
      application: updatedApp,
      submissionResult,
      consentsGrantedCount: newConsentIds.length,
    };
  }

  /**
   * Cancel an application
   */
  public async cancelApplication(
    applicationId: string,
    userId: string,
    reason?: string,
    ip?: string
  ): Promise<GovernmentApplicationRecord> {
    const app = db.findApplicationById(applicationId);
    if (!app) {
      const err: any = new Error("Application not found.");
      err.statusCode = 404;
      throw err;
    }

    if (app.userId !== userId) {
      const err: any = new Error("Access denied: You do not own this application.");
      err.statusCode = 403;
      throw err;
    }

    if (["APPROVED", "REJECTED", "CANCELLED"].includes(app.status)) {
      const err: any = new Error(`Cannot cancel application already in ${app.status} state.`);
      err.statusCode = 400;
      throw err;
    }

    const adapter = getIntegrationAdapter();
    await adapter.cancelApplication(app.applicationNumber, reason);

    db.updateApplication(app.id, {
      status: "CANCELLED",
      cancellationReason: reason?.trim() || "Citizen requested cancellation",
    });

    const profile = db.getProfileByUserId(userId);
    const now = new Date().toISOString();

    db.recordAuditEvent({
      id: `aud-${Date.now()}-appcancel`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "APPLICATION_CANCELLED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Citizen cancelled application. Reason: ${reason || "No reason specified"}.`,
      ipAddress: ip,
    });

    return db.findApplicationById(app.id)!;
  }
}

export const applicationService = new ApplicationService();
