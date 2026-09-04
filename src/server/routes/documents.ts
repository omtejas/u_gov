import { Router, Response } from "express";
import { documentService } from "../services/documentService";
import { AuthenticatedRequest, requireAuth, csrfProtection, rateLimiter } from "../middleware/auth";

export const documentsRouter = Router();

/**
 * GET /api/v1/documents/types
 * Retrieves catalogue of official supported document types
 */
documentsRouter.get("/types", requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const types = documentService.getDocumentTypes();
  return res.json({ success: true, types });
});

/**
 * GET /api/v1/documents
 * List all documents owned by the authenticated citizen
 */
documentsRouter.get("/", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const documents = documentService.getDocumentsByOwner(req.user!.id);
  return res.json({ success: true, documents });
});

/**
 * POST /api/v1/documents/deposit
 * Deposit new credential to private vault with SHA-256 integrity calculation
 * Accepts JSON with Base64 fileData payload
 */
documentsRouter.post(
  "/deposit",
  requireAuth,
  csrfProtection,
  rateLimiter(60000, 10),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { title, documentTypeId, documentNumber, fileName, mimeType, fileData } = req.body;

      if (!fileData || typeof fileData !== "string") {
        return res.status(400).json({ success: false, error: "fileData (base64 encoded binary) is required" });
      }

      // Convert Base64 string to Buffer
      let cleanBase64 = fileData;
      if (cleanBase64.includes(";base64,")) {
        cleanBase64 = cleanBase64.split(";base64,")[1];
      }
      const fileBuffer = Buffer.from(cleanBase64, "base64");

      const doc = await documentService.depositDocument(
        req.user!.id,
        {
          title,
          documentTypeId,
          documentNumber,
          fileName,
          mimeType,
          fileBuffer,
        },
        req.ip
      );

      return res.status(201).json({
        success: true,
        message: "Credential deposited successfully into private DigiVault.",
        document: doc,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      return res.status(statusCode).json({ success: false, error: err.message || "Failed to deposit document." });
    }
  }
);

/**
 * GET /api/v1/documents/:id
 * Retrieve document metadata (Strict IDOR ownership protection)
 */
documentsRouter.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientEntity = req.query.recipient as string | undefined;
    const document = await documentService.getDocumentById(req.params.id, req.user!.id, recipientEntity);
    return res.json({ success: true, document });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: err.message || "Document retrieval failed." });
  }
});

/**
 * GET /api/v1/documents/:id/download
 * Secure authenticated streaming download with live SHA-256 integrity verification
 */
documentsRouter.get("/:id/download", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientEntity = req.query.recipient as string | undefined;
    const { buffer, mimeType, fileName } = await documentService.downloadDocument(
      req.params.id,
      req.user!.id,
      recipientEntity,
      req.ip
    );

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(buffer);
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: err.message || "Download failed." });
  }
});

/**
 * GET /api/v1/documents/:id/verify-integrity
 * Verifies live file hash against stored SHA-256 checksum
 */
documentsRouter.get("/:id/verify-integrity", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await documentService.verifyDocumentIntegrity(req.params.id, req.user!.id, req.ip);
    return res.json({
      success: true,
      documentId: req.params.id,
      integrity: result.valid ? "VALID" : "FAILED",
      algorithm: "SHA-256",
      checksum: result.storedHash,
      liveChecksum: result.liveHash,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: err.message || "Integrity verification failed." });
  }
});

/**
 * DELETE /api/v1/documents/:id
 * Permanently delete document binary and metadata
 */
documentsRouter.delete("/:id", requireAuth, csrfProtection, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await documentService.deleteDocument(req.params.id, req.user!.id, req.ip);
    return res.json({ success: true, deleted, message: "Document deleted successfully." });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({ success: false, error: err.message || "Deletion failed." });
  }
});

/**
 * POST /api/v1/documents/:id/consent
 * Create a time-bound consent grant for a recipient government entity
 */
documentsRouter.post("/:id/consent", requireAuth, csrfProtection, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipientEntity, purpose, durationDays = 30 } = req.body;
    const consent = documentService.grantConsent(
      req.user!.id,
      req.params.id,
      recipientEntity,
      purpose,
      durationDays,
      req.ip
    );
    return res.status(201).json({ success: true, consent, message: "Consent granted successfully." });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({ success: false, error: err.message || "Consent creation failed." });
  }
});

/**
 * POST /api/v1/documents/consent/:consentId/revoke
 * Unilaterally revoke a consent grant with immediate effect
 */
documentsRouter.post("/consent/:consentId/revoke", requireAuth, csrfProtection, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const revoked = documentService.revokeConsent(req.user!.id, req.params.consentId, req.ip);
    if (!revoked) {
      return res.status(404).json({ success: false, error: "Active consent grant not found or already revoked." });
    }
    return res.json({ success: true, message: "Consent unilaterally revoked with immediate effect." });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    return res.status(statusCode).json({ success: false, error: err.message || "Consent revocation failed." });
  }
});

/**
 * GET /api/v1/documents/consents/all
 * Returns all active & historic consents belonging to the citizen
 */
documentsRouter.get("/consents/all", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const consents = documentService.getAllCitizenConsents(req.user!.id);
  return res.json({ success: true, consents });
});
