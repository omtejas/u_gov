import React, { useState, useEffect } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { DigiDocument, DocumentVersion } from "../types";
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
  Eye,
  History,
  Search,
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
    uploadDocumentVersion,
    refreshDocuments,
    isLoadingDocuments,
  } = useGov();

  // Active view tab & filters
  const [activeTab, setActiveTab] = useState<"documents" | "consents">("documents");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("all");

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

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<DigiDocument | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [previewMimeType, setPreviewMimeType] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Versions Modal State
  const [versionsDoc, setVersionsDoc] = useState<DigiDocument | null>(null);
  const [versionsList, setVersionsList] = useState<DocumentVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionFileBase64, setVersionFileBase64] = useState<string>("");
  const [versionNotes, setVersionNotes] = useState<string>("");
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

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
    void refreshDocuments();
  }, []);

  // Pre-fill default document type when available
  useEffect(() => {
    if (documentTypes.length > 0 && !docTypeId) {
      setDocTypeId(documentTypes[0].id);
    }
  }, [documentTypes, docTypeId]);

  // Revoke preview blob URL on cleanup
  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        window.URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  const validateAndReadFile = (
    file: File | undefined,
    onLoaded: (file: File, base64: string) => void,
    onError: (msg: string) => void
  ) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onError("File size exceeds 5MB limit. Please choose a smaller document.");
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      onError("Only PDF, JPEG, and PNG formats are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLoaded(file, reader.result as string);
    reader.onerror = () => onError("Failed to read file from disk.");
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setFileBase64("");
      return;
    }
    validateAndReadFile(
      file,
      (validFile, dataUrl) => {
        setSelectedFile(validFile);
        setFileBase64(dataUrl);
      },
      (msg) => {
        setUploadError(msg);
        setSelectedFile(null);
        setFileBase64("");
      }
    );
  };

  const handleVersionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVersionsError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setVersionFile(null);
      setVersionFileBase64("");
      return;
    }
    validateAndReadFile(
      file,
      (validFile, dataUrl) => {
        setVersionFile(validFile);
        setVersionFileBase64(dataUrl);
      },
      (msg) => {
        setVersionsError(msg);
        setVersionFile(null);
        setVersionFileBase64("");
      }
    );
  };

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
        message: "Document uploaded to private U-DOCS storage with a SHA-256 integrity checksum.",
      });
      setTimeout(() => setActionNotice(null), 6000);
    } else {
      setUploadError(res.error || "Deposit failed.");
    }
  };

  const openPreviewModal = async (doc: DigiDocument) => {
    if (previewObjectUrl) {
      window.URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
    setPreviewDoc(doc);
    setPreviewMimeType(doc.mimeType || "application/pdf");
    setPreviewError(null);
    setIsLoadingPreview(true);
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/preview`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPreviewError(data.error || `Unable to preview document (${res.status})`);
        return;
      }
      const contentType = res.headers.get("Content-Type") || doc.mimeType || "application/pdf";
      const blob = await res.blob();
      const objUrl = window.URL.createObjectURL(blob);
      setPreviewMimeType(contentType);
      setPreviewObjectUrl(objUrl);
    } catch {
      setPreviewError("Network error while loading document preview.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const closePreviewModal = () => {
    if (previewObjectUrl) {
      window.URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
    setPreviewDoc(null);
    setPreviewError(null);
  };

  const openVersionsModal = async (doc: DigiDocument) => {
    setVersionsDoc(doc);
    setVersionsList([]);
    setVersionsError(null);
    setVersionFile(null);
    setVersionFileBase64("");
    setVersionNotes("");
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/versions`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setVersionsError(data.error || "Could not load document version history.");
        return;
      }
      setVersionsList(Array.isArray(data.versions) ? data.versions : []);
    } catch {
      setVersionsError("Network error while loading version history.");
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionsDoc || !versionFile || !versionFileBase64) {
      setVersionsError("Please choose a valid PDF, JPEG, or PNG file for the new version.");
      return;
    }
    setIsUploadingVersion(true);
    setVersionsError(null);
    const res = await uploadDocumentVersion(versionsDoc.id, {
      fileName: versionFile.name,
      mimeType: versionFile.type,
      fileData: versionFileBase64,
      notes: versionNotes.trim() || undefined,
    });
    setIsUploadingVersion(false);

    if (!res.success) {
      setVersionsError(res.error || "Failed to upload document version.");
      return;
    }

    setVersionFile(null);
    setVersionFileBase64("");
    setVersionNotes("");
    setActionNotice({
      type: "success",
      message: `Uploaded new immutable version for "${versionsDoc.name}".`,
    });
    setTimeout(() => setActionNotice(null), 6000);
    await openVersionsModal(versionsDoc);
  };

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
        message: `Integrity verification failed for "${doc.name}". Stored binary hash does not match expected checksum.`,
      });
    }
    setTimeout(() => setActionNotice(null), 8000);
  };

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

  const openShareModal = (doc: DigiDocument) => {
    setTargetDoc(doc);
    setShareError(null);
    setIsShareOpen(true);
  };

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
        message: `Time-bound U-GOV consent record (${durationDays} days) created for ${recipientEntity}.`,
      });
      setTimeout(() => setActionNotice(null), 6000);
    } else {
      setShareError(res.error || "Failed to grant consent.");
    }
  };

  const handleRevokeConsent = async (docId: string, consentId: string, recipientName: string) => {
    const res = await revokeConsent(docId, consentId);
    if (res.success) {
      setActionNotice({
        type: "success",
        message: `Consent for ${recipientName} was revoked in U-GOV. This prototype has no live external department connection.`,
      });
    } else {
      setActionNotice({
        type: "error",
        message: `Revocation failed: ${res.error}`,
      });
    }
    setTimeout(() => setActionNotice(null), 6000);
  };

  const handleDeleteSubmit = async () => {
    if (!deleteConfirmDoc) return;
    setIsDeleting(true);
    const res = await deleteDocument(deleteConfirmDoc.id);
    setIsDeleting(false);
    const removedName = deleteConfirmDoc.name;
    setDeleteConfirmDoc(null);

    if (res.success) {
      setActionNotice({
        type: "success",
        message: `Document "${removedName}" and its consent records were removed.`,
      });
    } else {
      setActionNotice({
        type: "error",
        message: `Deletion failed: ${res.error}`,
      });
    }
    setTimeout(() => setActionNotice(null), 6000);
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !searchTerm.trim() ||
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.docNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.issuer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      selectedTypeFilter === "all" || doc.documentTypeId === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

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
    <div className="ugov-documents-page ugov-app-page space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_18px_rgba(25,48,82,.04)]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#171717]">
              U-DOCS Document Vault & Consent Records
            </h1>
            <Badge variant="info" size="sm">
              Prototype privacy controls
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Citizen-controlled vault with private file storage, SHA-256 integrity checks, immutable versioning, and consent logs.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshDocuments()}
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

      {/* Vault safeguards */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 leading-relaxed space-y-1">
          <div>
            <strong>Vault storage safeguards:</strong> Files use private storage keys and authenticated application routes rather than public static URLs.
          </div>
          <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap pt-0.5">
            <span>
              <strong>Stored:</strong> Private vault file (PDF, JPEG, PNG up to 5 MB)
            </span>
            <span>•</span>
            <span>
              <strong>Integrity:</strong> On-demand SHA-256 checksum &amp; version history
            </span>
            <span>•</span>
            <span>
              <strong>Authenticity:</strong> Simulation Sandbox (UIDAI / DigiLocker live bridge required for statutory seal)
            </span>
          </div>
        </div>
      </div>

      {/* Tabs + Search/Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap tabular-nums ${
              activeTab === "documents"
                ? "bg-[#174EA6] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>My Credentials ({documents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("consents")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap tabular-nums ${
              activeTab === "consents"
                ? "bg-[#174EA6] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Consent Records ({allConsents.length})</span>
          </button>
        </div>

        {activeTab === "documents" && documents.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by title or ID..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
              />
            </div>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              aria-label="Filter by document category"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
            >
              <option value="all">All Categories</option>
              {documentTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: DOCUMENTS GRID */}
      {activeTab === "documents" && (
        <>
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {documents.length === 0 ? "Your U-DOCS vault is empty" : "No matching credentials found"}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {documents.length === 0
                  ? "No credentials have been deposited yet. Deposit identity documents, marksheets, or certificates to seal them with a SHA-256 checksum."
                  : "Adjust your search filter or category selection to view deposited documents."}
              </p>
              {documents.length === 0 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsUploadOpen(true)}
                  leftIcon={<Upload className="w-3.5 h-3.5" />}
                >
                  Deposit First Credential
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedTypeFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredDocuments.map((doc) => {
                const docConsents = doc.consents || [];
                const activeDocConsents = docConsents.filter((c) => c.status === "active");
                const integrityCheck = integrityResults[doc.id];

                return (
                  <Card key={doc.id} variant="default" padding="lg" className="space-y-4 flex flex-col justify-between">
                    <div>
                      {/* Doc Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#174EA6] text-white flex items-center justify-center shadow-xs shrink-0">
                            <FileText className="w-5 h-5 text-amber-300" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                              {doc.name}
                            </h3>
                            <span className="text-[11px] text-slate-500 block font-mono mt-0.5 tabular-nums">
                              ID: {doc.docNumber} • v{doc.currentVersion || 1}
                            </span>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="neutral" size="sm">
                            Stored in Vault
                          </Badge>
                          {doc.integrityStatus === "VALID" || integrityCheck?.valid ? (
                            <Badge variant="success" size="sm">
                              Integrity Verified
                            </Badge>
                          ) : (
                            <Badge variant="info" size="sm">
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
                          <span className="text-slate-700 font-medium block tabular-nums">
                            {doc.issuedAt} ({doc.fileSize}) • v{doc.currentVersion || 1}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/60">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Cryptographic SHA-256 Checksum
                          </span>
                          <span className="text-[11px] font-mono text-slate-600 block truncate mt-0.5 select-all">
                            {doc.sha256Checksum || "Checksum unavailable"}
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
                          <span className="flex items-center gap-1.5 tabular-nums">
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
                                  <span className="text-[11px] text-slate-500 block truncate mt-0.5 tabular-nums">
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void openPreviewModal(doc)}
                          leftIcon={<Eye className="w-3.5 h-3.5 text-[#174EA6]" />}
                        >
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void openVersionsModal(doc)}
                          leftIcon={<History className="w-3.5 h-3.5 text-slate-600" />}
                        >
                          Versions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleVerifyIntegrity(doc)}
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
                          onClick={() => void handleDownload(doc)}
                          disabled={downloadingDocId === doc.id}
                          leftIcon={<Download className="w-3.5 h-3.5 text-slate-600" />}
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
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Delete credential and purge from vault"
                        aria-label={`Delete ${doc.name}`}
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
                Consent records are stored within U-GOV. No external department identity or document-retrieval integration is connected in this prototype.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 px-1 tabular-nums">
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
                      <Badge variant="success" size="sm">
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

                    <div className="text-[11px] text-slate-400 flex items-center gap-2 tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Granted: {consent.grantedAt} • Consent Expires: <strong>{consent.expiresAt}</strong>
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
                      Revoke Consent Record
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PREVIEW MODAL */}
      <Modal
        isOpen={Boolean(previewDoc)}
        onClose={closePreviewModal}
        title={previewDoc ? `Document Preview: ${previewDoc.name}` : "Document Preview"}
        subtitle={previewDoc ? `Version v${previewDoc.currentVersion || 1} • ${previewMimeType}` : undefined}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {isLoadingPreview ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading private preview stream...</div>
          ) : previewError ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{previewError}</span>
            </div>
          ) : previewObjectUrl ? (
            previewMimeType.startsWith("image/") ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-center max-h-[65vh] overflow-auto">
                <img
                  src={previewObjectUrl}
                  alt={previewDoc?.name || "Uploaded credential preview"}
                  className="max-w-full max-h-[60vh] object-contain rounded"
                />
              </div>
            ) : previewMimeType === "application/pdf" ? (
              <iframe
                src={previewObjectUrl}
                title={previewDoc?.name || "PDF Preview"}
                className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
              />
            ) : (
              <div className="p-6 text-center text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl">
                Inline preview is unavailable for {previewMimeType}. Use Download to inspect this file locally.
              </div>
            )
          ) : null}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            {previewDoc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleDownload(previewDoc)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Download Original
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={closePreviewModal}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* VERSIONS MODAL */}
      <Modal
        isOpen={Boolean(versionsDoc)}
        onClose={() => setVersionsDoc(null)}
        title={versionsDoc ? `Version History: ${versionsDoc.name}` : "Version History"}
        subtitle="Immutable chronological log of uploaded document revisions and SHA-256 digests"
        maxWidth="lg"
      >
        <div className="space-y-5">
          {versionsError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{versionsError}</span>
            </div>
          )}

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {isLoadingVersions ? (
              <p className="text-xs text-slate-500 py-6 text-center">Loading immutable version ledger...</p>
            ) : versionsList.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No version snapshots recorded yet.</p>
            ) : (
              versionsList.map((ver) => (
                <div
                  key={ver.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#174EA6] tabular-nums">
                        v{ver.versionNumber}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{ver.fileName}</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {(ver.fileSizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-500 truncate">
                      SHA-256: {ver.sha256Checksum}
                    </p>
                    {ver.notes && <p className="text-[11px] text-slate-600">{ver.notes}</p>}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                    {new Date(ver.uploadedAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleUploadNewVersion} className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Upload New Version (v{(versionsDoc?.currentVersion || versionsList.length || 1) + 1})
            </h4>
            <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 space-y-2">
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg"
                onChange={handleVersionFileChange}
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#174EA6] file:text-white hover:file:bg-[#0F397E] cursor-pointer"
                required
              />
              {versionFile && (
                <p className="text-xs font-bold text-emerald-700 tabular-nums">
                  Selected: {versionFile.name} ({(versionFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <Input
              label="Revision Notes (Optional)"
              placeholder="e.g. Updated attested renewal copy"
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setVersionsDoc(null)}>
                Close
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isUploadingVersion}>
                {isUploadingVersion ? "Uploading Version..." : "Upload New Version"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* DEPOSIT DOCUMENT MODAL */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Document to U-DOCS"
        subtitle="Binary will be sealed in a private filesystem vault with randomized UUID keys"
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
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
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
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#174EA6] file:text-white hover:file:bg-[#0F397E] cursor-pointer"
                required
              />
              {selectedFile ? (
                <p className="text-xs font-bold text-emerald-700 tabular-nums">
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
        title="Record Time-Bound Consent"
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
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
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
              Consent Record Duration
            </label>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
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
              <span>Unilateral Revocation Guarantee</span>
            </div>
            <p className="text-[10px] leading-relaxed">
              You can revoke this U-GOV consent record at any time. No external department is connected to retrieve document files in this prototype.
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
              {isSharing ? "Recording Consent..." : "Record Time-Bound Consent"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deleteConfirmDoc)}
        onClose={() => setDeleteConfirmDoc(null)}
        title="Permanently Delete Credential?"
        subtitle="This permanently removes the document record and its private stored file"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete <strong>{deleteConfirmDoc?.name}</strong>? Its U-GOV consent records will also be invalidated.
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
              onClick={() => void handleDeleteSubmit()}
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
