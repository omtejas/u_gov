import crypto from "crypto";
import {
  db,
  GovernmentApplicationRecord,
  ApplicationStatus,
  GovernmentServiceRecord,
  CitizenDocumentRecord,
} from "../database/db";
import { documentService } from "./documentService";
import {
  getIntegrationAdapter,
  ApplicationSubmissionResult,
  integrationRegistry,
  ReliabilityEngine,
  IntegrationError,
  StatusResponse,
} from "../integrations";

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

    // 2. Integration Idempotency & Correlation Setup
    const correlationId = `UGOV-INT-${crypto.randomBytes(6).toString("hex")}`;
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(`${app.id}:${service.serviceCode}:${userId}`)
      .digest("hex");

    // Check if an integration submission already succeeded for this idempotency key
    const existingSubmission = ReliabilityEngine.checkIdempotency(idempotencyKey);
    if (existingSubmission) {
      return {
        success: true,
        application: app,
        submissionResult: existingSubmission,
        consentsGrantedCount: app.consentIds.length,
      };
    }

    // Resolve provider adapter from central IntegrationRegistry
    const adapter = integrationRegistry.getAdapterForService(service.serviceCode);
    const providerInfo = adapter.getProviderInfo();

    db.recordAuditEvent({
      id: `aud-${Date.now()}-intstart`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "INTEGRATION_SUBMISSION_STARTED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Dispatched to integration provider ${providerInfo.providerCode} (Correlation: ${correlationId}).`,
      ipAddress: ip,
    });

    // Execute submission through ReliabilityEngine (Timeout + Bounded Retries)
    let submissionResult: ApplicationSubmissionResult;
    try {
      const execResult = await ReliabilityEngine.withRetry(
        async (attempt) => {
          return await adapter.submitApplication({
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
            correlationId,
            idempotencyKey,
            targetEnvironment: "SANDBOX",
          });
        },
        providerInfo.providerCode,
        correlationId,
        { maxRetries: 3, timeoutMs: 5000 }
      );

      submissionResult = execResult.result;

      // Persist to idempotency store
      ReliabilityEngine.recordIdempotency(idempotencyKey, submissionResult);

      // Record in application_integrations table
      db.recordIntegrationAttempt({
        id: `int-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        applicationId: app.id,
        providerCode: providerInfo.providerCode,
        idempotencyKey,
        correlationId,
        status: submissionResult.status,
        trackingToken: submissionResult.trackingToken,
        providerReference: submissionResult.providerApplicationId || submissionResult.externalReference || null,
        attemptCount: execResult.attempts,
        lastErrorCode: null,
        createdAt: now,
        updatedAt: now,
      });

      db.recordAuditEvent({
        id: `aud-${Date.now()}-intsucc`,
        timestamp: now,
        actorId: userId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "INTEGRATION_SUBMISSION_SUCCEEDED",
        resource: `Application ${app.applicationNumber}`,
        result: "SUCCESS",
        context: `Provider ${providerInfo.providerCode} acknowledged receipt with token ${submissionResult.trackingToken}.`,
        ipAddress: ip,
      });
    } catch (err: any) {
      const errorCode = err instanceof IntegrationError ? err.code : "INTEGRATION_UNKNOWN_ERROR";

      db.recordIntegrationAttempt({
        id: `int-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        applicationId: app.id,
        providerCode: providerInfo.providerCode,
        idempotencyKey,
        correlationId,
        status: "FAILED",
        trackingToken: null,
        providerReference: null,
        attemptCount: 1,
        lastErrorCode: errorCode,
        createdAt: now,
        updatedAt: now,
      });

      db.recordAuditEvent({
        id: `aud-${Date.now()}-intfail`,
        timestamp: now,
        actorId: userId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "INTEGRATION_SUBMISSION_FAILED",
        resource: `Application ${app.applicationNumber}`,
        result: "BLOCKED",
        context: `Integration submission to ${providerInfo.providerCode} failed. Code: ${errorCode}.`,
        ipAddress: ip,
      });

      const normalizedErr: any = new Error(
        err.message || "The public service provider is temporarily unavailable. Please try again later."
      );
      normalizedErr.statusCode = err.statusCode || 502;
      normalizedErr.code = errorCode;
      throw normalizedErr;
    }

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

    const service = db.findServiceById(app.serviceId);
    const adapter = integrationRegistry.getAdapterForService(service?.serviceCode || "*");
    const providerInfo = adapter.getProviderInfo();
    const correlationId = `UGOV-INT-${crypto.randomBytes(6).toString("hex")}`;
    const now = new Date().toISOString();
    const profile = db.getProfileByUserId(userId);

    db.recordAuditEvent({
      id: `aud-${Date.now()}-intcnlstart`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "INTEGRATION_CANCEL_STARTED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Notified provider ${providerInfo.providerCode} of cancellation.`,
      ipAddress: ip,
    });

    try {
      await adapter.cancelApplication({
        applicationId: app.id,
        applicationNumber: app.applicationNumber,
        serviceCode: service?.serviceCode || "GENERIC",
        trackingToken: app.trackingToken,
        reason,
        correlationId,
      });

      db.recordAuditEvent({
        id: `aud-${Date.now()}-intcnlsucc`,
        timestamp: now,
        actorId: userId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "INTEGRATION_CANCEL_SUCCEEDED",
        resource: `Application ${app.applicationNumber}`,
        result: "SUCCESS",
        context: `Provider ${providerInfo.providerCode} confirmed cancellation of ${app.applicationNumber}.`,
        ipAddress: ip,
      });
    } catch (err: any) {
      db.recordAuditEvent({
        id: `aud-${Date.now()}-intcnlfail`,
        timestamp: now,
        actorId: userId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "INTEGRATION_CANCEL_FAILED",
        resource: `Application ${app.applicationNumber}`,
        result: "WARNING",
        context: `Provider ${providerInfo.providerCode} cancellation returned non-fatal error: ${err.message}.`,
        ipAddress: ip,
      });
    }

    db.updateApplication(app.id, {
      status: "CANCELLED",
      cancellationReason: reason?.trim() || "Citizen requested cancellation",
    });

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

  /**
   * Poll external provider status and update application if changed
   */
  public async pollIntegrationStatus(
    applicationId: string,
    userId: string,
    ip?: string
  ): Promise<StatusResponse> {
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

    if (!app.trackingToken) {
      const err: any = new Error("Application has not been submitted yet and has no tracking token.");
      err.statusCode = 400;
      throw err;
    }

    const service = db.findServiceById(app.serviceId);
    const adapter = integrationRegistry.getAdapterForService(service?.serviceCode || "*");
    const providerInfo = adapter.getProviderInfo();
    const correlationId = `UGOV-INT-${crypto.randomBytes(6).toString("hex")}`;
    const now = new Date().toISOString();
    const profile = db.getProfileByUserId(userId);

    const statusResponse = await adapter.getApplicationStatus({
      applicationId: app.id,
      applicationNumber: app.applicationNumber,
      serviceCode: service?.serviceCode || "GENERIC",
      trackingToken: app.trackingToken,
      correlationId,
    });

    db.recordAuditEvent({
      id: `aud-${Date.now()}-intpoll`,
      timestamp: now,
      actorId: userId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "INTEGRATION_STATUS_CHECKED",
      resource: `Application ${app.applicationNumber}`,
      result: "SUCCESS",
      context: `Checked status with provider ${providerInfo.providerCode}: ${statusResponse.status}.`,
      ipAddress: ip,
    });

    // Update application state if status transitioned upstream
    if (app.status !== statusResponse.status && !["CANCELLED"].includes(app.status)) {
      db.updateApplication(app.id, {
        status: statusResponse.status,
      });

      db.updateIntegrationStatus(app.id, statusResponse.status, null);

      db.recordAuditEvent({
        id: `aud-${Date.now()}-intstchange`,
        timestamp: now,
        actorId: userId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "INTEGRATION_STATUS_CHANGED",
        resource: `Application ${app.applicationNumber}`,
        result: "SUCCESS",
        context: `Application status transitioned from ${app.status} to ${statusResponse.status} via provider polling.`,
        ipAddress: ip,
      });
    }

    return statusResponse;
  }

  /**
   * Get integration attempt record for an application (strictly owner-scoped)
   */
  public getApplicationIntegration(applicationId: string, userId: string) {
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

    const integration = db.findIntegrationByApplicationId(applicationId);
    const service = db.findServiceById(app.serviceId);
    const adapter = integrationRegistry.getAdapterForService(service?.serviceCode || "*");

    return {
      application: {
        id: app.id,
        applicationNumber: app.applicationNumber,
        status: app.status,
        trackingToken: app.trackingToken,
      },
      provider: adapter.getProviderInfo(),
      integrationRecord: integration || null,
      environment: "SANDBOX",
      disclaimer: "Sandbox Integration • Prototype Simulation • Not a live government connection",
    };
  }
}

export const applicationService = new ApplicationService();
