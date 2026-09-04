import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import {
  FolderLock,
  ShieldCheck,
  Upload,
  FileText,
  Lock,
  CheckCircle2,
  XCircle,
  Eye,
  Trash2,
  AlertCircle,
} from "lucide-react";

export const DocumentsView: React.FC = () => {
  const { documents, revokeConsent, uploadDocument } = useGov();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [docName, setDocName] = useState("");
  const [docIssuer, setDocIssuer] = useState("");
  const [docType, setDocType] = useState("");

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;
    uploadDocument({
      name: docName.trim(),
      issuer: docIssuer.trim() || "Competent Public Authority",
      type: docType.trim() || "Citizen Identity Credential",
    });
    setDocName("");
    setDocIssuer("");
    setDocType("");
    setIsUploadOpen(false);
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              U-DOCS Digital Vault & Consent Center
            </h1>
            <Badge variant="success" size="sm" dot>
              DPDP Act 2023 Compliant
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Store, manage, and share sovereign digital documents with cryptographic integrity. You retain 100% control over third-party data access.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsUploadOpen(true)}
          leftIcon={<Upload className="w-3.5 h-3.5" />}
        >
          Deposit Credential
        </Button>
      </div>

      {/* Sovereign Guarantee Info Box */}
      <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 leading-relaxed">
          <strong>Non-Repudiation Principle:</strong> Under the Information Technology Act (IT Act 2000) and Digital Personal Data Protection (DPDP) Act 2023, credentials stored in U-DOCS are legally equivalent to original paper certificates. External departments cannot access your documents without an explicit, time-bound consent grant recorded in your tamper-evident audit ledger.
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {documents.map((doc) => (
          <Card key={doc.id} variant="default" padding="lg" className="space-y-4">
            {/* Doc Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0b1f3a] text-white flex items-center justify-center shadow-xs">
                  <FileText className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    {doc.name}
                  </h3>
                  <span className="text-[11px] text-slate-500 block font-mono mt-0.5">
                    ID: {doc.docNumber}
                  </span>
                </div>
              </div>
              <Badge variant="success" size="sm" dot>
                Verified
              </Badge>
            </div>

            {/* Doc Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-50 border border-slate-100">
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
                  Issuance Date
                </span>
                <span className="text-slate-700 font-medium block">
                  {doc.issuedAt}
                </span>
              </div>
            </div>

            {/* Active Consents */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Authorized Department Consents ({doc.consents.length})</span>
                </span>
              </div>

              {doc.consents.length > 0 ? (
                <div className="space-y-2">
                  {doc.consents.map((consent) => (
                    <div
                      key={consent.id}
                      className="p-2.5 rounded-xl border border-slate-200/90 flex items-center justify-between gap-2 text-xs bg-white"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 truncate">
                            {consent.accessor}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              consent.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-500 line-through"
                            }`}
                          >
                            {consent.status.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                          {consent.purpose}
                        </span>
                      </div>

                      {consent.status === "active" && (
                        <button
                          onClick={() => revokeConsent(doc.id, consent.id)}
                          className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-[11px] shrink-0 transition-colors cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No external departments currently have access to this credential.
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Upload Document Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Deposit Credential into DigiVault"
        subtitle="Credentials will be digitally sealed and anchored to your U-ID"
        maxWidth="md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <Input
            label="Document / Certificate Name"
            placeholder="e.g. Caste Certificate, Marksheet, Bonafide"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            required
          />

          <Input
            label="Issuing Authority"
            placeholder="e.g. Tehsildar Office, State Board of Education"
            value={docIssuer}
            onChange={(e) => setDocIssuer(e.target.value)}
          />

          <Input
            label="Credential Category"
            placeholder="e.g. Education, Welfare, Property, Residence"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          />

          <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2">
            <Upload className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">
              Drag and drop PDF/JPG or click to select certificate file
            </p>
            <span className="text-[10px] text-slate-400">
              Maximum file size: 10 MB (Auto-scanned for virus & cryptographic signature)
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsUploadOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Deposit & Seal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
