import React, { useState, useEffect } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { DigiDocument } from "../types";
import {
  ShieldCheck,
  Upload,
  FileText,
  Lock,
  Download,
  Trash2,
  Share2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Building2,
  FileCode2,
  ExternalLink,
  Info,
} from "lucide-react";

export const DocumentsView: React.FC = () => {
  const {
    documents,
    documentTypes,
    depositDocument,
    downloadDocument,
    verifyDocumentIntegrity,
    deleteDocument,
    grantConsent,
    revokeConsent,
    refreshDocuments,
    isLoadingDocuments,
  } = useGov();

  // Active view tab
  const [activeTab, setActiveTab] = useState<"documents" | "consents">("documents");

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docTypeId, setDocTypeId] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Share / Consent Modal State
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [targetDoc, setTargetDoc] = useState<DigiDocument | null>(null);
  const [recipientEntity, setRecipientEntity] = useState("Department of Higher Education (NSP Portal)");
  const [purpose, setPurpose] = useState("Scholarship KYC & Income Eligibility Verification");
  const [durationDays, setDurationDays] = useState(30);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Action status tracking
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [integrityResults, setIntegrityResults] = useState<{
    [docId: string]: { valid: boolean; storedHash?: string; liveHash?: string };
  }>({});
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Delete Confirmation Modal State
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DigiDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    refreshDocuments();
  }, []);

  // Pre-fill default document type when available
  useEffect(() => {
    if (documentTypes.length > 0 && !docTypeId) {
      setDocTypeId(documentTypes[0].id);
    }
  }, [documentTypes, docTypeId]);

  // Handle File Input Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileBase64("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size exceeds 5MB limit. Please choose a smaller document.");
      setSelectedFile(null);
      setFileBase64("");
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setUploadError("Only PDF, JPEG, and PNG formats are supported.");
      setSelectedFile(null);
      setFileBase64("");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result);
    };
    reader.onerror = () => {
      setUploadError("Failed to read file from disk.");
    };
    reader.readAsDataURL(file);
  };

  // Handle Deposit Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      setUploadError("Please provide a document title.");
      return;
    }
    if (!docTypeId) {
      setUploadError("Please select a valid document category.");
      return;
    }
    if (!selectedFile || !fileBase64) {
      setUploadError("Please select a document file to deposit.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const res = await depositDocument({
      title: docTitle.trim(),
      documentTypeId: docTypeId,
      documentNumber: docNumber.trim() || "XXXX-XXXX",
      fileName: selectedFile.name,
      mimeType: selectedFile.type,
      fileData: fileBase64,
    });

    setIsUploading(false);

    if (res.success) {
      setIsUploadOpen(false);
      setDocTitle("");
      setDocNumber("");
      setSelectedFile(null);
      setFileBase64("");
      setActionNotice({
        type: "success",
        message: "Credential deposited successfully into your private DigiVault with cryptographic SHA-256 seal.",
      });
      setTimeout(() => setActionNotice(null), 6000);
    } else {
      setUploadError(res.error || "Deposit failed.");
    }
  };

  // Handle Live Integrity Verification
  const handleVerifyIntegrity = async (doc: DigiDocument) => {
    setVerifyingDocId(doc.id);
    const res = await verifyDocumentIntegrity(doc.id);
    setVerifyingDocId(null);

    setIntegrityResults((prev) => ({
      ...prev,
      [doc.id]: {
        valid: res.valid,
        storedHash: res.storedHash,
        liveHash: res.liveHash,
      },
    }));

    if (res.valid) {
      setActionNotice({
        type: "success",
        message: `Cryptographic integrity confirmed: SHA-256 matches exact stored checksum for "${doc.name}".`,
      });
    } else {
      setActionNotice({
        type: "error",
        message: `CRITICAL ALERT: Integrity verification failed for "${doc.name}". File binary has been altered or corrupted!`,
      });
    }
    setTimeout(() => setActionNotice(null), 8000);
  };

  // Handle Streaming Download
  const handleDownload = async (doc: DigiDocument) => {
    setDownloadingDocId(doc.id);
    const res = await downloadDocument(doc.id, doc.fileName || `${doc.name.toLowerCase().replace(/\s+/g, "_")}.pdf`);
    setDownloadingDocId(null);

    if (!res.success) {
      setActionNotice({
        type: "error",
        message: `Download failed: ${res.error}`,
      });
      setTimeout(() => setActionNotice(null), 6000);
    }
  };

  // Handle Open Share Modal
  const openShareModal = (doc: DigiDocument) => {
    setTargetDoc(doc);
    setShareError(null);
    setIsShareOpen(true);
  };

  // Handle Grant Consent Submission
  const handleGrantConsentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDoc) return;
    if (!recipientEntity.trim() || !purpose.trim()) {
      setShareError("Recipient entity and purpose are mandatory.");
      return;
    }

    setIsSharing(true);
    setShareError(null);

    const res = await grantConsent(targetDoc.id, recipientEntity.trim(), purpose.trim(), durationDays);
    setIsSharing(false);

    if (res.success) {
      setIsShareOpen(false);
      setActionNotice({
        type: "success",
        message: `Time-bound consent (${durationDays} days) granted to ${recipientEntity}. You can revoke access at any second.`,
      });
      setTimeout(() => setActionNotice(null), 6000);
    } else {
      setShareError(res.error || "Failed to grant consent.");
    }
  };

  // Handle Unilateral Revoke
  const handleRevokeConsent = async (docId: string, consentId: string, recipientName: string) => {
    const res = await revokeConsent(docId, consentId);
    if (res.success) {
      setActionNotice({
        type: "success",
        message: `Consent for ${recipientName} unilaterally revoked with immediate effect. Department access is now blocked.`,
      });
    } else {
      setActionNotice({
        type: "error",
        message: `Revocation failed: ${res.error}`,
      });
    }
    setTimeout(() => setActionNotice(null), 6000);
  };

  // Handle Delete Document
  const handleDeleteSubmit = async () => {
    if (!deleteConfirmDoc) return;
    setIsDeleting(true);
    const res = await deleteDocument(deleteConfirmDoc.id);
    setIsDeleting(false);
    setDeleteConfirmDoc(null);

    if (res.success) {
      setActionNotice({
        type: "success",
        message: `Document "${deleteConfirmDoc.name}" and its private binary purged from vault disk.`,
      });
    } else {
      setActionNotice({
        type: "error",
        message: `Deletion failed: ${res.error}`,
      });
    }
    setTimeout(() => setActionNotice(null), 6000);
  };

  // Aggregate all active consents across documents
  const allConsents = documents.flatMap((d) =>
    d.consents.map((c) => ({
      ...c,
      documentId: d.id,
      docName: d.name,
      docNumber: d.docNumber,
    }))
  );
  const activeConsents = allConsents.filter((c) => c.status === "active");

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              U-DOCS Sovereign Digital Vault & Consent Center
            </h1>
            <Badge variant="success" size="sm" dot>
              DPDP Act 2023 Compliant
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Citizen-controlled digital vault backed by mathematical SHA-256 integrity, private filesystem isolation, and real-time unilateral consent revocation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshDocuments()}
            disabled={isLoadingDocuments}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocuments ? "animate-spin" : ""}`} />}
          >
            Refresh Vault
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setUploadError(null);
              setIsUploadOpen(true);
            }}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
          >
            Deposit Credential
          </Button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            actionNotice.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-[11px] font-bold uppercase tracking-wider opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sovereign Guarantee Box */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 leading-relaxed space-y-1">
          <div>
            <strong>Sovereign Vault Principle:</strong> Documents are stored strictly in private, unexposed vault storage with randomized UUID keys. No direct URL access is possible.
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap pt-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <strong>Stored:</strong> Private encrypted binary
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <strong>Integrity:</strong> Real-time SHA-256 match
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <strong>Authenticity:</strong> Simulation Sandbox (UIDAI / DigiLocker live bridge required for statutory seal)
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "documents"
              ? "bg-[#0b1f3a] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>My Sovereign Credentials ({documents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("consents")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "consents"
              ? "bg-[#0b1f3a] text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Active Department Consents ({activeConsents.length})</span>
        </button>
      </div>

      {/* TAB 1: DOCUMENTS GRID */}
      {activeTab === "documents" && (
        <>
          {documents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Your DigiVault is Empty</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No credentials have been deposited yet. Deposit your identity documents, marksheets, or certificates to protect them with cryptographic SHA-256 integrity.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsUploadOpen(true)}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Deposit First Credential
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {documents.map((doc) => {
                const docConsents = doc.consents || [];
                const activeDocConsents = docConsents.filter((c) => c.status === "active");
                const integrityCheck = integrityResults[doc.id];

                return (
                  <Card key={doc.id} variant="default" padding="lg" className="space-y-4 flex flex-col justify-between">
                    <div>
                      {/* Doc Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#0b1f3a] text-white flex items-center justify-center shadow-xs shrink-0">
                            <FileText className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                              {doc.name}
                            </h3>
                            <span className="text-[11px] text-slate-500 block font-mono mt-0.5">
                              ID: {doc.docNumber}
                            </span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="neutral" size="sm">
                            Stored in Vault
                          </Badge>
                          {doc.integrityStatus === "VALID" || integrityCheck?.valid ? (
                            <Badge variant="success" size="sm" dot>
                              Integrity Verified
                            </Badge>
                          ) : (
                            <Badge variant="info" size="sm" dot>
                              Self-Attested
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-50 border border-slate-100 mt-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Issuing Authority
                          </span>
                          <span className="text-slate-700 font-medium truncate block">
                            {doc.issuer}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Vault Ingestion
                          </span>
                          <span className="text-slate-700 font-medium block">
                            {doc.issuedAt} ({doc.fileSize})
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Cryptographic SHA-256 Checksum
                          </span>
                          <span className="text-[11px] font-mono text-slate-600 block truncate mt-0.5 select-all">
                            {doc.sha256Checksum || "a7c91e84...calculated_at_vault"}
                          </span>
                        </div>
                      </div>

                      {/* Integrity Verification Feedback Banner */}
                      {integrityCheck && (
                        <div
                          className={`mt-3 p-2.5 rounded-xl border text-[11px] ${
                            integrityCheck.valid
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-red-50 border-red-200 text-red-800"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold">
                            {integrityCheck.valid ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            )}
                            <span>
                              {integrityCheck.valid
                                ? "MATHEMATICAL INTEGRITY CONFIRMED"
                                : "INTEGRITY FAILURE DETECTED"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] leading-tight opacity-90 font-mono truncate">
                            Live Hash: {integrityCheck.liveHash}
                          </p>
                        </div>
                      )}

                      {/* Attached Consents Section */}
                      <div className="space-y-2 pt-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-blue-600" />
                            <span>Active Department Grants ({activeDocConsents.length})</span>
                          </span>
                          {activeDocConsents.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              Time-bound access
                            </span>
                          )}
                        </div>

                        {activeDocConsents.length > 0 ? (
                          <div className="space-y-1.5">
                            {activeDocConsents.map((consent) => (
                              <div
                                key={consent.id}
                                className="p-2.5 rounded-xl border border-slate-200/90 flex items-center justify-between gap-2 text-xs bg-white"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800 truncate">
                                      {consent.accessor || consent.recipientEntity}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-100 text-emerald-800">
                                      ACTIVE
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                                    {consent.purpose} • Expires: {consent.expiresAt}
                                  </span>
                                </div>

                                <button
                                  onClick={() =>
                                    handleRevokeConsent(
                                      doc.id,
                                      consent.id,
                                      consent.accessor || consent.recipientEntity || "Department"
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-[11px] shrink-0 transition-colors cursor-pointer"
                                >
                                  Revoke
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">
                            No active consent grants. External departments cannot view this credential.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Footer */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerifyIntegrity(doc)}
                          disabled={verifyingDocId === doc.id}
                          leftIcon={
                            <ShieldCheck
                              className={`w-3.5 h-3.5 text-blue-600 ${
                                verifyingDocId === doc.id ? "animate-spin" : ""
                              }`}
                            />
                          }
                        >
                          {verifyingDocId === doc.id ? "Verifying..." : "Verify"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingDocId === doc.id}
                          leftIcon={
                            <Download
                              className={`w-3.5 h-3.5 text-slate-600 ${
                                downloadingDocId === doc.id ? "animate-pulse" : ""
                              }`}
                            />
                          }
                        >
                          {downloadingDocId === doc.id ? "Streaming..." : "Download"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openShareModal(doc)}
                          leftIcon={<Share2 className="w-3.5 h-3.5 text-emerald-600" />}
                        >
                          Share
                        </Button>
                      </div>

                      <button
                        onClick={() => setDeleteConfirmDoc(doc)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete credential and purge from vault"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: ACTIVE CONSENTS MANAGEMENT */}
      {activeTab === "consents" && (
        <div className="space-y-4">
          {activeConsents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Zero Active Consents</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No third-party department currently holds an active consent grant to access your credentials. Your digital data remains 100% private and sovereign.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  Showing <strong>{activeConsents.length}</strong> active department authorization(s).
                </span>
                <span className="text-blue-600 font-semibold">
                  You can unilaterally revoke access at any time without department approval.
                </span>
              </div>

              {activeConsents.map((consent) => (
                <div
                  key={consent.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {consent.accessor || consent.recipientEntity}
                      </h4>
                      <Badge variant="success" size="sm" dot>
                        ACTIVE
                      </Badge>
                    </div>

                    <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                      <span>
                        <strong>Credential:</strong> {consent.docName} ({consent.docNumber})
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Purpose:</strong> {consent.purpose}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Granted: {consent.grantedAt} • Access Expires: <strong>{consent.expiresAt}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        handleRevokeConsent(
                          consent.documentId!,
                          consent.id,
                          consent.accessor || consent.recipientEntity || "Department"
                        )
                      }
                    >
                      Revoke Access Immediately
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DEPOSIT DOCUMENT MODAL */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Deposit Credential into Private DigiVault"
        subtitle="Binary will be sealed in an unexposed filesystem vault with randomized UUID keys"
        maxWidth="md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          {uploadError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Document Category / Type
            </label>
            <select
              value={docTypeId}
              onChange={(e) => setDocTypeId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0b1f3a]"
              required
            >
              {documentTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name} ({dt.issuingAuthority})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Document / Certificate Title"
            placeholder="e.g. Caste Certificate, HSC Marksheet, Bonafide"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            required
          />

          <Input
            label="Certificate / Registration Number"
            placeholder="e.g. MH/2026/881290"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Document File (PDF, PNG, JPEG — Max 5MB)
            </label>
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={handleFileChange}
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0b1f3a] file:text-white hover:file:bg-[#16355d] cursor-pointer"
                required
              />
              {selectedFile ? (
                <p className="text-xs font-bold text-emerald-700">
                  Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              ) : (
                <span className="text-[10px] text-slate-400 block">
                  File will be hashed with SHA-256 upon deposit. No public URL exposure.
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Statutory Disclosure:</strong> Storing a self-attested PDF does not generate a statutory government digital signature. Authority verification requires state agency issuance.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsUploadOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isUploading}>
              {isUploading ? "Sealing & Calculating SHA-256..." : "Deposit & Seal in Vault"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* SHARE / GRANT CONSENT MODAL */}
      <Modal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title="Grant Time-Bound Department Consent"
        subtitle={`Authorize access to "${targetDoc?.name}" under explicit DPDP terms`}
        maxWidth="md"
      >
        <form onSubmit={handleGrantConsentSubmit} className="space-y-4">
          {shareError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{shareError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Authorized Recipient Government Department
            </label>
            <select
              value={recipientEntity}
              onChange={(e) => setRecipientEntity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0b1f3a]"
              required
            >
              <option value="Department of Higher Education (NSP Portal)">
                Department of Higher Education (NSP Portal)
              </option>
              <option value="Ministry of Road Transport & Highways (MoRTH)">
                Ministry of Road Transport & Highways (MoRTH)
              </option>
              <option value="Revenue & Land Records Department, Maharashtra">
                Revenue & Land Records Department, Maharashtra
              </option>
              <option value="Pune Municipal Corporation (PMC)">
                Pune Municipal Corporation (PMC)
              </option>
              <option value="Food, Civil Supplies & Consumer Protection">
                Food, Civil Supplies & Consumer Protection
              </option>
            </select>
          </div>

          <Input
            label="Specific Purpose of Processing"
            placeholder="e.g. Scholarship Verification, Driving Licence Verification"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Consent Expiry Window (Time-Bound Access)
            </label>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#0b1f3a]"
            >
              <option value={7}>7 Days (Single Verification)</option>
              <option value={15}>15 Days (Application Processing)</option>
              <option value={30}>30 Days (Standard Service Delivery)</option>
              <option value={90}>90 Days (Extended Academic Review)</option>
            </select>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-700" />
              <span>Sovereign Unilateral Revocation Guarantee</span>
            </div>
            <p className="text-[10px] leading-relaxed">
              In accordance with DPDP framework, you maintain the unconditional right to revoke this consent at any time. When revoked, the recipient department will be immediately blocked from accessing this document.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsShareOpen(false)}
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSharing}>
              {isSharing ? "Recording Consent..." : "Grant Time-Bound Access"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deleteConfirmDoc)}
        onClose={() => setDeleteConfirmDoc(null)}
        title="Permanently Delete Credential?"
        subtitle="This action will permanently purge the binary from the private disk vault"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete <strong>{deleteConfirmDoc?.name}</strong>? All associated department consents will be automatically invalidated, and the encrypted binary will be unlinked from the vault.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmDoc(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSubmit}
              disabled={isDeleting}
            >
              {isDeleting ? "Purging..." : "Permanently Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
