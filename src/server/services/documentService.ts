import crypto from "crypto";
import { db, CitizenDocumentRecord, DocumentConsentRecord, DocumentTypeRecord } from "../database/db";
import { getStorageDriver } from "../storage";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB strict limit
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export interface DepositDocumentInput {
  documentTypeId: string;
  title: string;
  documentNumber: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}

export class DocumentService {
  private storage = getStorageDriver();

  public getDocumentTypes(): DocumentTypeRecord[] {
    return db.getDocumentTypes();
  }

  public getDocumentsByOwner(ownerUserId: string): CitizenDocumentRecord[] {
    return db.getDocumentsByOwner(ownerUserId);
  }

  public async depositDocument(
    ownerUserId: string,
    input: DepositDocumentInput,
    ip?: string
  ): Promise<CitizenDocumentRecord> {
    // 1. Validation
    if (!input.title || typeof input.title !== "string" || !input.title.trim()) {
      throw new Error("Document title is required.");
    }
    if (!input.documentTypeId || typeof input.documentTypeId !== "string") {
      throw new Error("Valid document type is required.");
    }
    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      throw new Error("Document binary payload is empty.");
    }
    if (input.fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds strict 5MB limit (${(input.fileBuffer.length / 1024 / 1024).toFixed(2)} MB).`);
    }

    const cleanMime = input.mimeType.toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
      throw new Error(`Unsupported document format: ${cleanMime}. Allowed formats: PDF, JPEG, PNG.`);
    }

    // 2. Save file via StorageDriver into private vault (UUID key generated internally)
    const { key, sha256, size } = await this.storage.save(input.fileBuffer, {
      mimeType: cleanMime,
      metadata: {
        ownerUserId,
        documentTypeId: input.documentTypeId,
      },
    });

    // 3. Create document record
    const documentId = `doc-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date().toISOString();

    const docRecord: CitizenDocumentRecord = {
      id: documentId,
      ownerUserId,
      documentTypeId: input.documentTypeId,
      title: input.title.trim(),
      documentNumber: input.documentNumber?.trim() || "XXXX-XXXX",
      fileName: input.fileName?.trim() || "credential.pdf",
      mimeType: cleanMime,
      fileSizeBytes: size,
      storageKey: key,
      sha256Checksum: sha256,
      verificationStatus: "SELF_ATTESTED",
      createdAt: now,
      updatedAt: now,
    };

    db.createDocument(docRecord);

    // 4. Record audit event
    const profile = db.getProfileByUserId(ownerUserId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-docup`,
      timestamp: now,
      actorId: ownerUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "DOCUMENT_UPLOADED",
      resource: `Document ${docRecord.title} (${docRecord.id})`,
      result: "SUCCESS",
      context: `Citizen deposited credential to private DigiVault. SHA-256: ${sha256.slice(0, 16)}...`,
      ipAddress: ip,
    });

    return docRecord;
  }

  public async getDocumentById(
    documentId: string,
    requestingUserId: string,
    recipientEntity?: string
  ): Promise<CitizenDocumentRecord> {
    const doc = db.findDocumentById(documentId);
    if (!doc) {
      const err: any = new Error("Document not found.");
      err.statusCode = 404;
      throw err;
    }

    // Ownership check
    if (doc.ownerUserId === requestingUserId) {
      return doc;
    }

    // Check if recipient has active consent grant
    if (recipientEntity) {
      const activeConsent = db.checkActiveConsent(documentId, recipientEntity);
      if (activeConsent) {
        return doc;
      }
    }

    // IDOR Protection: Caller is neither owner nor authorized recipient
    const err: any = new Error("Access denied: you do not have permission to view this document.");
    err.statusCode = 403;
    throw err;
  }

  public async downloadDocument(
    documentId: string,
    requestingUserId: string,
    recipientEntity?: string,
    ip?: string
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string; integrityValid: boolean }> {
    const doc = await this.getDocumentById(documentId, requestingUserId, recipientEntity);

    // Read binary from private vault
    const buffer = await this.storage.read(doc.storageKey);

    // Real-time SHA-256 Integrity Verification
    const liveHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const integrityValid = liveHash === doc.sha256Checksum;
    const now = new Date().toISOString();
    const profile = db.getProfileByUserId(requestingUserId);

    if (!integrityValid) {
      db.recordAuditEvent({
        id: `aud-${Date.now()}-integfail`,
        timestamp: now,
        actorId: requestingUserId,
        actorName: profile?.displayName || "Caller",
        actorRole: "Security Monitor",
        action: "DOCUMENT_INTEGRITY_FAILED",
        resource: `Document ${doc.id}`,
        result: "BLOCKED",
        context: `ALERT: Stored checksum (${doc.sha256Checksum}) does not match live file checksum (${liveHash}).`,
        ipAddress: ip,
      });

      const err: any = new Error("Document integrity failure: file content was modified or corrupted.");
      err.statusCode = 409;
      throw err;
    }

    // Audit successful download
    db.recordAuditEvent({
      id: `aud-${Date.now()}-docdl`,
      timestamp: now,
      actorId: requestingUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: doc.ownerUserId === requestingUserId ? "Owner" : "Authorized Recipient",
      action: "DOCUMENT_DOWNLOADED",
      resource: `Document ${doc.title} (${doc.id})`,
      result: "SUCCESS",
      context: `Streamed encrypted private vault binary with verified SHA-256 integrity.`,
      ipAddress: ip,
    });

    return {
      buffer,
      mimeType: doc.mimeType,
      fileName: doc.fileName,
      integrityValid,
    };
  }

  public async verifyDocumentIntegrity(
    documentId: string,
    requestingUserId: string,
    ip?: string
  ): Promise<{ valid: boolean; storedHash: string; liveHash: string }> {
    const doc = await this.getDocumentById(documentId, requestingUserId);
    const liveHash = await this.storage.computeChecksum(doc.storageKey);
    const valid = liveHash === doc.sha256Checksum;
    const now = new Date().toISOString();
    const profile = db.getProfileByUserId(requestingUserId);

    db.recordAuditEvent({
      id: `aud-${Date.now()}-integ`,
      timestamp: now,
      actorId: requestingUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: valid ? "DOCUMENT_INTEGRITY_VERIFIED" : "DOCUMENT_INTEGRITY_FAILED",
      resource: `Document ${doc.title} (${doc.id})`,
      result: valid ? "SUCCESS" : "FAILED",
      context: `Integrity check against mathematical SHA-256 checksum: ${valid ? "PASS" : "FAIL"}`,
      ipAddress: ip,
    });

    return {
      valid,
      storedHash: doc.sha256Checksum,
      liveHash,
    };
  }

  public async deleteDocument(
    documentId: string,
    requestingUserId: string,
    ip?: string
  ): Promise<boolean> {
    const doc = await this.getDocumentById(documentId, requestingUserId);
    if (doc.ownerUserId !== requestingUserId) {
      const err: any = new Error("Access denied: only the document owner can delete this document.");
      err.statusCode = 403;
      throw err;
    }

    // 1. Delete private binary
    await this.storage.delete(doc.storageKey);

    // 2. Delete database record & associated consents
    const deleted = db.deleteDocument(documentId);

    // 3. Emit audit event
    const profile = db.getProfileByUserId(requestingUserId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-docdel`,
      timestamp: new Date().toISOString(),
      actorId: requestingUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Owner",
      action: "DOCUMENT_DELETED",
      resource: `Document ${doc.title} (${doc.id})`,
      result: "SUCCESS",
      context: `Citizen permanently deleted document and purged binary from private vault.`,
      ipAddress: ip,
    });

    return deleted;
  }

  // --- Consent Engine ---

  public grantConsent(
    ownerUserId: string,
    documentId: string,
    recipientEntity: string,
    purpose: string,
    durationDays: number = 30,
    ip?: string
  ): DocumentConsentRecord {
    const doc = db.findDocumentById(documentId);
    if (!doc || doc.ownerUserId !== ownerUserId) {
      const err: any = new Error("Access denied: cannot grant consent for an unowned document.");
      err.statusCode = 403;
      throw err;
    }

    if (!recipientEntity || !recipientEntity.trim()) {
      throw new Error("Recipient government department/entity is required.");
    }
    if (!purpose || !purpose.trim()) {
      throw new Error("Explicit purpose for consent is required.");
    }

    const consentId = `cst-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const consentRecord: DocumentConsentRecord = {
      id: consentId,
      documentId,
      ownerUserId,
      recipientEntity: recipientEntity.trim(),
      purpose: purpose.trim(),
      status: "ACTIVE",
      grantedAt: now.toISOString(),
      expiresAt,
    };

    db.createConsent(consentRecord);

    const profile = db.getProfileByUserId(ownerUserId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-cstgrant`,
      timestamp: now.toISOString(),
      actorId: ownerUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "CONSENT_CREATED",
      resource: `Consent for ${doc.title} -> ${consentRecord.recipientEntity}`,
      result: "SUCCESS",
      context: `Granted time-bound access (${durationDays} days) for purpose: "${purpose}".`,
      ipAddress: ip,
    });

    return consentRecord;
  }

  public revokeConsent(
    ownerUserId: string,
    consentId: string,
    ip?: string
  ): boolean {
    const consent = db.findConsentById(consentId);
    if (!consent || consent.ownerUserId !== ownerUserId) {
      const err: any = new Error("Access denied: cannot revoke consent for an unowned document.");
      err.statusCode = 403;
      throw err;
    }

    const revoked = db.revokeConsent(consentId, ownerUserId);
    if (revoked) {
      const profile = db.getProfileByUserId(ownerUserId);
      db.recordAuditEvent({
        id: `aud-${Date.now()}-cstrev`,
        timestamp: new Date().toISOString(),
        actorId: ownerUserId,
        actorName: profile?.displayName || "Citizen",
        actorRole: "Citizen",
        action: "CONSENT_REVOKED",
        resource: `Consent ${consentId}`,
        result: "SUCCESS",
        context: `Citizen unilaterally revoked department access consent immediately.`,
        ipAddress: ip,
      });
    }
    return revoked;
  }

  public getDocumentConsents(documentId: string, requestingUserId: string): DocumentConsentRecord[] {
    const doc = db.findDocumentById(documentId);
    if (!doc || doc.ownerUserId !== requestingUserId) {
      const err: any = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
    return db.getConsentsByDocumentId(documentId);
  }

  public getAllCitizenConsents(ownerUserId: string): DocumentConsentRecord[] {
    return db.getConsentsByOwner(ownerUserId);
  }
}

export const documentService = new DocumentService();
