import crypto from "crypto";
import { db, CitizenDocumentRecord, DocumentConsentRecord, DocumentTypeRecord, DocumentVersionRecord } from "../database/db";
import { getStorageDriver } from "../storage";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB strict limit
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function detectDocumentMime(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

function safeDisplayFileName(value: string): string {
  const leaf = String(value || "document").replace(/\\/g, "/").split("/").pop() || "document";
  const cleaned = leaf.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 120);
  return cleaned || "document";
}

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
    if (input.title.trim().length > 120) throw new Error("Document title must be 120 characters or fewer.");
    if (!input.documentTypeId || typeof input.documentTypeId !== "string" || input.documentTypeId.length > 64) {
      throw new Error("Valid document type is required.");
    }
    if (!db.findDocumentTypeById(input.documentTypeId)) {
      throw new Error("Selected document type is not present in the U-DOCS catalogue.");
    }
    if (!Buffer.isBuffer(input.fileBuffer) || input.fileBuffer.length === 0) {
      throw new Error("Document binary payload is empty or invalid.");
    }
    if (input.fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds strict 5MB limit (${(input.fileBuffer.length / 1024 / 1024).toFixed(2)} MB).`);
    }

    const cleanMime = typeof input.mimeType === "string" ? input.mimeType.toLowerCase().trim() : "";
    if (!ALLOWED_MIME_TYPES.includes(cleanMime)) throw new Error("Unsupported document format. Allowed formats: PDF, JPEG, PNG.");
    const detectedMime = detectDocumentMime(input.fileBuffer);
    if (!detectedMime || detectedMime !== cleanMime) throw new Error("The file contents do not match the selected document format.");
    if (typeof ownerUserId !== "string" || !ownerUserId.trim()) throw new Error("An authenticated document owner is required.");

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
      documentNumber: typeof input.documentNumber === "string" ? input.documentNumber.trim().slice(0, 80) : "XXXX-XXXX",
      fileName: safeDisplayFileName(input.fileName || "document"),
      mimeType: cleanMime,
      fileSizeBytes: size,
      storageKey: key,
      sha256Checksum: sha256,
      verificationStatus: "SELF_ATTESTED",
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    try {
      db.createDocument(docRecord);
      db.addDocumentVersion({
        id: `docv-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        documentId,
        ownerUserId,
        versionNumber: 1,
        fileName: docRecord.fileName,
        mimeType: docRecord.mimeType,
        fileSizeBytes: docRecord.fileSizeBytes,
        storageKey: docRecord.storageKey,
        sha256Checksum: docRecord.sha256Checksum,
        notes: "Initial vault deposit",
        uploadedAt: now,
      });
    } catch (error) {
      await this.storage.delete(key).catch(() => false);
      throw error;
    }

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
      context: `Citizen uploaded a document to private U-DOCS storage. SHA-256: ${sha256.slice(0, 16)}...`,
      ipAddress: ip,
    });

    return docRecord;
  }

  public async getDocumentVersions(
    documentId: string,
    requestingUserId: string
  ): Promise<DocumentVersionRecord[]> {
    const doc = await this.getDocumentById(documentId, requestingUserId);
    const existingVersions = db.getDocumentVersions(doc.id);
    if (existingVersions.length === 0) {
      return [
        {
          id: `docv-initial-${doc.id}`,
          documentId: doc.id,
          ownerUserId: doc.ownerUserId,
          versionNumber: doc.currentVersion || 1,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSizeBytes: doc.fileSizeBytes,
          storageKey: doc.storageKey,
          sha256Checksum: doc.sha256Checksum,
          notes: "Baseline credential record",
          uploadedAt: doc.createdAt,
        },
      ];
    }
    return existingVersions;
  }

  public async uploadNewVersion(
    documentId: string,
    requestingUserId: string,
    input: { fileName: string; mimeType: string; fileBuffer: Buffer; notes?: string },
    ip?: string
  ): Promise<{ document: CitizenDocumentRecord; version: DocumentVersionRecord }> {
    const doc = await this.getDocumentById(documentId, requestingUserId);
    if (doc.ownerUserId !== requestingUserId) {
      const err: any = new Error("Access denied.");
      err.statusCode = 403;
      throw err;
    }
    if (!Buffer.isBuffer(input.fileBuffer) || input.fileBuffer.length === 0) {
      throw new Error("Document binary payload is empty or invalid.");
    }
    if (input.fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size exceeds strict 5MB limit (${(input.fileBuffer.length / 1024 / 1024).toFixed(2)} MB).`);
    }
    const cleanMime = typeof input.mimeType === "string" ? input.mimeType.toLowerCase().trim() : "";
    if (!ALLOWED_MIME_TYPES.includes(cleanMime)) {
      throw new Error("Unsupported document format. Allowed formats: PDF, JPEG, PNG.");
    }
    const detectedMime = detectDocumentMime(input.fileBuffer);
    if (!detectedMime || detectedMime !== cleanMime) {
      throw new Error("The file contents do not match the selected document format.");
    }

    const existingVersions = db.getDocumentVersions(doc.id);
    if (existingVersions.length === 0) {
      db.addDocumentVersion({
        id: `docv-base-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        documentId: doc.id,
        ownerUserId: doc.ownerUserId,
        versionNumber: doc.currentVersion || 1,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        fileSizeBytes: doc.fileSizeBytes,
        storageKey: doc.storageKey,
        sha256Checksum: doc.sha256Checksum,
        notes: "Baseline credential version",
        uploadedAt: doc.updatedAt || doc.createdAt,
      });
    }

    const { key, sha256, size } = await this.storage.save(input.fileBuffer, {
      mimeType: cleanMime,
      metadata: { ownerUserId: requestingUserId, documentTypeId: doc.documentTypeId },
    });

    const nextVersionNumber = (doc.currentVersion || 1) + 1;
    const now = new Date().toISOString();
    const cleanFileName = safeDisplayFileName(input.fileName || doc.fileName);

    const versionRecord: DocumentVersionRecord = {
      id: `docv-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      documentId: doc.id,
      ownerUserId: requestingUserId,
      versionNumber: nextVersionNumber,
      fileName: cleanFileName,
      mimeType: cleanMime,
      fileSizeBytes: size,
      storageKey: key,
      sha256Checksum: sha256,
      notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 200) : `Updated version v${nextVersionNumber}`,
      uploadedAt: now,
    };

    try {
      db.addDocumentVersion(versionRecord);
      db.updateDocument(doc.id, {
        fileName: cleanFileName,
        mimeType: cleanMime,
        fileSizeBytes: size,
        storageKey: key,
        sha256Checksum: sha256,
        currentVersion: nextVersionNumber,
      });
    } catch (err) {
      await this.storage.delete(key).catch(() => false);
      throw err;
    }

    const profile = db.getProfileByUserId(requestingUserId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-docver`,
      timestamp: now,
      actorId: requestingUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Citizen",
      action: "DOCUMENT_VERSION_UPLOADED",
      resource: `Document ${doc.title} (${doc.id}) v${nextVersionNumber}`,
      result: "SUCCESS",
      context: `Uploaded new document version v${nextVersionNumber}. SHA-256: ${sha256.slice(0, 16)}...`,
      ipAddress: ip,
    });

    return {
      document: db.findDocumentById(doc.id)!,
      version: versionRecord,
    };
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

    // Consent records express a citizen's prototype preference; they do not
    // authenticate an external department. Until department identities and
    // service-to-service credentials exist, only the owner can retrieve files.
    if (doc.ownerUserId === requestingUserId) {
      return doc;
    }

    const err: any = new Error("Access denied: document sharing is recorded in U-GOV, but no authenticated external recipient integration is connected.");
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
    let buffer: Buffer;
    try {
      buffer = await this.storage.read(doc.storageKey);
    } catch (readErr: any) {
      if (readErr?.code === "ENOENT" || readErr?.name === "NoSuchKey") {
        const missingErr: any = new Error("Document binary is missing from the storage vault. Re-upload this credential to restore access.");
        missingErr.statusCode = 404;
        throw missingErr;
      }
      throw readErr;
    }

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
      context: `Downloaded private storage binary after successful SHA-256 integrity verification.`,
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
    let liveHash: string;
    try {
      liveHash = await this.storage.computeChecksum(doc.storageKey);
    } catch (readErr: any) {
      if (readErr?.code === "ENOENT" || readErr?.name === "NoSuchKey") {
        const missingErr: any = new Error("Document binary is missing from the storage vault.");
        missingErr.statusCode = 404;
        throw missingErr;
      }
      throw readErr;
    }
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

    // Persist the metadata/consent removal first. If the database write fails,
    // the binary remains intact and the citizen can safely retry.
    const deleted = db.deleteDocument(documentId);
    if (!deleted) return false;

    // Once metadata is removed, the binary is no longer addressable through
    // the API. A failed purge is recorded for operational cleanup rather than
    // restoring a document record that could point to a missing file.
    let cleanupComplete = false;
    try {
      const existed = await this.storage.exists(doc.storageKey);
      const removed = await this.storage.delete(doc.storageKey);
      cleanupComplete = !existed || removed;
    } catch {
      cleanupComplete = false;
    }

    const profile = db.getProfileByUserId(requestingUserId);
    db.recordAuditEvent({
      id: `aud-${Date.now()}-docdel`,
      timestamp: new Date().toISOString(),
      actorId: requestingUserId,
      actorName: profile?.displayName || "Citizen",
      actorRole: "Owner",
      action: cleanupComplete ? "DOCUMENT_DELETED" : "DOCUMENT_DELETED_STORAGE_CLEANUP_PENDING",
      resource: `Document ${doc.title} (${doc.id})`,
      result: cleanupComplete ? "SUCCESS" : "WARNING",
      context: cleanupComplete
        ? "Document metadata, associated consent records and private storage binary were deleted."
        : "Document metadata and consent records were deleted; binary cleanup requires operational follow-up.",
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

    if (typeof recipientEntity !== "string" || !recipientEntity.trim() || recipientEntity.trim().length > 160) throw new Error("Recipient must be provided and limited to 160 characters.");
    if (typeof purpose !== "string" || !purpose.trim() || purpose.trim().length > 240) throw new Error("Consent purpose must be provided and limited to 240 characters.");
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90) throw new Error("Consent duration must be a whole number between 1 and 90 days.");

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
