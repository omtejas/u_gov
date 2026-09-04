import React, { useState, useEffect } from "react";
import { useGov } from "../../context/GovContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  XCircle,
  Trash2,
  Plus,
  Lock,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { GovernmentApplication, ApplicationReviewData, DigiDocument } from "../../types";

export const ApplicationWorkflowModal: React.FC = () => {
  const {
    activeApplicationModal,
    closeApplicationModal,
    documents,
    attachDocumentToApplication,
    removeDocumentFromApplication,
    reviewGovernmentApplication,
    submitGovernmentApplication,
    cancelGovernmentApplication,
    setActiveTab,
  } = useGov();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [reviewData, setReviewData] = useState<ApplicationReviewData | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Cancellation State
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);

  const app = activeApplicationModal;

  useEffect(() => {
    if (!app) {
      setStep(1);
      setReviewData(null);
      setConsentConfirmed(false);
      setActionError(null);
      setShowCancelPrompt(false);
      setCancellationReason("");
      return;
    }

    // Direct to tracking step if already submitted, processing, or terminal
    if (["SUBMITTED", "PROCESSING", "APPROVED", "REJECTED", "CANCELLED"].includes(app.status)) {
      setStep(4);
    } else if (app.status === "READY") {
      setStep(2);
    } else {
      setStep(1);
    }
  }, [app?.id, app?.status]);

  // Load review disclosures when entering Step 3
  useEffect(() => {
    if (step === 3 && app) {
      loadReview();
    }
  }, [step, app?.id]);

  const loadReview = async () => {
    if (!app) return;
    setIsLoadingReview(true);
    setActionError(null);
    const res = await reviewGovernmentApplication(app.id);
    setIsLoadingReview(false);
    if (res.success && res.review) {
      setReviewData(res.review);
    } else {
      setActionError(res.error || "Failed to load statutory review disclosures.");
    }
  };

  if (!app) return null;

  const isTerminal = ["APPROVED", "REJECTED", "CANCELLED"].includes(app.status);
  const isSubmitted = ["SUBMITTED", "PROCESSING"].includes(app.status);

  const handleAttach = async (documentId: string) => {
    setActionError(null);
    const res = await attachDocumentToApplication(app.id, documentId);
    if (!res.success) {
      setActionError(res.error || "Failed to attach document.");
    }
  };

  const handleDetach = async (documentId: string) => {
    setActionError(null);
    const res = await removeDocumentFromApplication(app.id, documentId);
    if (!res.success) {
      setActionError(res.error || "Failed to remove document.");
    }
  };

  const handleSubmit = async () => {
    if (!consentConfirmed) {
      setActionError("Please confirm statutory data sharing consent before submitting.");
      return;
    }
    setActionError(null);
    setIsSubmitting(true);
    const res = await submitGovernmentApplication(app.id);
    setIsSubmitting(false);
    if (res.success) {
      setStep(4);
    } else {
      setActionError(res.error || "Submission failed. Please check requirements.");
    }
  };

  const handleCancelApplication = async () => {
    if (!cancellationReason.trim()) {
      setActionError("Please specify a reason for cancellation.");
      return;
    }
    setIsCancelling(true);
    setActionError(null);
    const res = await cancelGovernmentApplication(app.id, cancellationReason);
    setIsCancelling(false);
    setShowCancelPrompt(false);
    if (res.success) {
      setStep(4);
    } else {
      setActionError(res.error || "Failed to cancel application.");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="neutral" size="sm">DRAFT</Badge>;
      case "DOCUMENTS_REQUIRED":
        return <Badge variant="warning" size="sm" dot>DOCUMENTS REQUIRED</Badge>;
      case "READY":
        return <Badge variant="info" size="sm" dot>READY FOR CONSENT</Badge>;
      case "CONSENT_REQUIRED":
      case "CONSENT_GRANTED":
        return <Badge variant="info" size="sm" dot>{status.replace("_", " ")}</Badge>;
      case "SUBMITTED":
        return <Badge variant="success" size="sm" dot>SUBMITTED (SANDBOX)</Badge>;
      case "PROCESSING":
        return <Badge variant="info" size="sm" dot>PROCESSING</Badge>;
      case "ACTION_REQUIRED":
        return <Badge variant="warning" size="sm" dot>ACTION REQUIRED</Badge>;
      case "APPROVED":
        return <Badge variant="success" size="sm">APPROVED</Badge>;
      case "REJECTED":
        return <Badge variant="error" size="sm">REJECTED</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral" size="sm">CANCELLED</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={Boolean(app)}
      onClose={closeApplicationModal}
      title={
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold text-slate-900">
              {app.service?.name || "Government Service Application"}
            </span>
            {getStatusBadge(app.status)}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-0.5">
            <span>Ref: <strong>{app.applicationNumber}</strong></span>
            <span>•</span>
            <span className="text-amber-700 font-sans font-semibold">Sandbox Prototype Gateway</span>
          </div>
        </div>
      }
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Step Progression Bar (Only for non-submitted flows) */}
        {!isSubmitted && !isTerminal && (
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            {[
              { id: 1, label: "1. Overview & Data" },
              { id: 2, label: "2. Vault Credentials" },
              { id: 3, label: "3. Review & Consent" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.id <= step || (s.id === 2 && app.status !== "CANCELLED") || (s.id === 3 && app.status === "READY")) {
                    setStep(s.id as any);
                  }
                }}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                  step === s.id
                    ? "text-blue-600 border-b-2 border-blue-600 pb-1"
                    : step > s.id
                    ? "text-slate-700 hover:text-slate-900"
                    : "text-slate-400 cursor-not-allowed"
                }`}
              >
                {step > s.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : null}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Action Error Banner */}
        {actionError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-rose-600 font-bold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 1: Overview & Form Data                                 */}
        {/* ============================================================ */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Service Summary Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{app.service?.name}</h4>
                  <p className="text-xs text-slate-500">{app.service?.department} • {app.service?.ministry}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    SLA: <strong>{app.service?.slaDays || 15} Days</strong>
                  </span>
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-semibold">
                    {app.service?.fee === 0 ? "100% Free" : `₹${app.service?.fee}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Prototype Form Data Display */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Application Specific Form Data
                </h5>
                <Badge variant="neutral" size="sm">Prototype Simulation</Badge>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block">Service Scheme Code:</span>
                    <strong className="text-slate-800 font-mono">{app.service?.serviceCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Application Status:</span>
                    <strong className="text-slate-800">{app.status}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Applicant Citizen Reference:</span>
                    <strong className="text-slate-800 font-mono">{app.userId}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Initiated Timestamp:</span>
                    <strong className="text-slate-800">{new Date(app.createdAt).toLocaleString()}</strong>
                  </div>
                </div>

                {app.formData && Object.keys(app.formData).length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-200">
                    <span className="text-slate-400 block mb-1">Additional Application Parameters:</span>
                    <pre className="text-[11px] bg-white p-2 rounded-lg border border-slate-200 text-slate-700 overflow-x-auto">
                      {JSON.stringify(app.formData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelPrompt(true)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Cancel Application
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(2)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Credentials Selection
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 2: DigiVault Credential Selection                      */}
        {/* ============================================================ */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Readiness Header */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Prerequisite Verification Status
                  </h4>
                  <span className="text-sm font-extrabold text-slate-900">
                    {app.status === "READY"
                      ? "All Mandatory Credentials Attached — Application Ready"
                      : "Credentials Required — Please Select Documents Below"}
                  </span>
                </div>
                {getStatusBadge(app.status)}
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    app.status === "READY" ? "bg-emerald-500 w-full" : "bg-amber-500 w-1/2"
                  }`}
                />
              </div>
            </div>

            {/* Credential Selection List */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Available Credentials in Your Sovereign DigiVault</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Vault Document Selection (Never Shared Silently)
                </span>
              </h5>

              {documents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">No documents found in your DigiVault.</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                    Please deposit your required credentials (Aadhaar, Income Certificate, etc.) in your DigiVault before attaching.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      closeApplicationModal();
                      setActiveTab("documents");
                    }}
                  >
                    Go to DigiVault
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {documents.map((doc) => {
                    const isAttached = app.attachedDocumentIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isAttached
                            ? "bg-emerald-50/40 border-emerald-300 shadow-2xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isAttached
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h6 className="text-xs font-bold text-slate-900">{doc.name}</h6>
                              <Badge variant="neutral" size="sm">{doc.type}</Badge>
                            </div>
                            <span className="text-[11px] text-slate-500 block font-mono">
                              Doc No: {doc.docNumber} • {doc.issuer}
                            </span>
                            {doc.sha256Checksum && (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                SHA-256: {doc.sha256Checksum.slice(0, 16)}...
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isAttached ? (
                            <>
                              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Attached
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDetach(doc.id)}
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 h-8 text-xs"
                              >
                                Detach
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAttach(doc.id)}
                              leftIcon={<Plus className="w-3.5 h-3.5" />}
                              className="h-8 text-xs"
                            >
                              Attach Credential
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelPrompt(true)}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Cancel
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={app.status !== "READY"}
                  onClick={() => setStep(3)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Review Sharing & Consent
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 3: Review Disclosures & Statutory U-CONSENT             */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-5">
            {isLoadingReview ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Generating statutory data-sharing review disclosures...
              </div>
            ) : reviewData ? (
              <div className="space-y-4">
                {/* Data Sharing Header Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-900 to-[#0b1f3a] text-white space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Statutory Data Sharing Authorization</span>
                  </div>
                  <h4 className="text-base font-bold">
                    Review Credentials Disclosed for Statutory Processing
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Under sovereign data protection rules, U-GOV requires your explicit authorization before granting time-bound access to your attached DigiVault credentials.
                  </p>
                </div>

                {/* Statutory Scope Breakdown */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block font-semibold">Statutory Recipient Department:</span>
                      <strong className="text-slate-900 text-sm">{reviewData.dataSharingDisclosure.recipientEntity}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold">Consent Validity Period:</span>
                      <strong className="text-slate-900 text-sm">{reviewData.dataSharingDisclosure.validityDays} Days (Time-Bound)</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block font-semibold">Authorized Purpose:</span>
                    <p className="text-slate-800 mt-0.5 bg-white p-2.5 rounded-lg border border-slate-200 font-medium">
                      {reviewData.dataSharingDisclosure.purpose}
                    </p>
                  </div>
                </div>

                {/* Attached Credentials Disclosed */}
                <div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Credentials to be Shared ({reviewData.attachedDocuments.length})
                  </h5>
                  <div className="space-y-2">
                    {reviewData.attachedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <strong className="text-slate-800 block">{doc.title}</strong>
                            <span className="text-[11px] text-slate-500 font-mono">
                              Type: {doc.documentTypeId} • No: {doc.documentNumber}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                          SHA: {doc.sha256Checksum.slice(0, 12)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Prototype Sandbox Disclaimer */}
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <strong className="block">Sandbox Prototype Gateway Notice</strong>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      This application will be dispatched to the U-GOV Sandbox Gateway. No real government department APIs or external state servers are contacted during this demonstration.
                    </p>
                  </div>
                </div>

                {/* Explicit Consent Checkbox */}
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consentConfirmed}
                      onChange={(e) => setConsentConfirmed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-800 font-medium leading-relaxed">
                      I understand what data will be shared, who will receive it (
                      <strong>{reviewData.dataSharingDisclosure.recipientEntity}</strong>), why it is required, and that the authorization expires in <strong>30 days</strong>. I hereby authorize U-GOV to generate statutory U-CONSENT tokens for this application.
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            {/* Navigation & Submit Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Documents
              </Button>

              <Button
                variant="saffron"
                size="sm"
                disabled={!consentConfirmed || isSubmitting}
                isLoading={isSubmitting}
                onClick={handleSubmit}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Grant Consent & Submit to Sandbox
              </Button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: Application Details & Sandbox Tracking              */}
        {/* ============================================================ */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Status Header */}
            {app.status === "CANCELLED" ? (
              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-300 text-slate-800 flex items-start gap-3">
                <XCircle className="w-6 h-6 text-slate-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900">Application Cancelled</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Reason: <em>{app.cancellationReason || "Cancelled upon citizen request."}</em>
                  </p>
                  <span className="text-[11px] text-slate-400 block">
                    Cancelled timestamp: {new Date(app.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : isSubmitted ? (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-800">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">Application Formally Submitted</h4>
                    <span className="text-xs text-emerald-700 font-medium">
                      Dispatched to U-GOV Sandbox Gateway • SLA: {app.service?.slaDays || 15} Working Days
                    </span>
                  </div>
                </div>

                {app.trackingToken && (
                  <div className="p-3 bg-white rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                        Sandbox Tracking Token
                      </span>
                      <strong className="text-slate-900 font-mono text-xs sm:text-sm">
                        {app.trackingToken}
                      </strong>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(app.trackingToken!)}
                      leftIcon={copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      className="h-8 text-xs"
                    >
                      {copiedToken ? "Copied" : "Copy Token"}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Key Information Table */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Application & Integration Gateway Metadata
                </h5>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                  U-INTEGRATIONS Sandbox
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                <div>
                  <span className="text-slate-400 block">Application Number:</span>
                  <strong className="font-mono text-slate-900">{app.applicationNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Target Service:</span>
                  <strong className="text-slate-900">{app.service?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Department / Authority:</span>
                  <span className="text-slate-900">{app.service?.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Current Status:</span>
                  <span className="text-slate-900 font-semibold">{app.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Integration Gateway:</span>
                  <span className="text-slate-900 font-mono">
                    SANDBOX_{app.service?.serviceCode || "DEFAULT"} (Simulated Bus)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Attached Credentials:</span>
                  <span className="text-slate-900 font-medium">
                    {app.attachedDocumentIds.length} credential(s) attached
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Active Consent Tokens:</span>
                  <span className="text-slate-900 font-medium">
                    {app.consentIds.length} statutory token(s) granted
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Security Boundary:</span>
                  <span className="text-emerald-700 font-medium">
                    Internal Mock Loopback (SSRF Safe)
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline progression */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
              <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Application Milestone Timeline
              </h5>
              <div className="relative pl-5 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
                <div className="relative">
                  <div className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white ring-2 ring-emerald-100" />
                  <span className="font-bold text-slate-900 block">Application Initiated</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(app.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="relative">
                  <div
                    className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      app.attachedDocumentIds.length > 0
                        ? "bg-emerald-600 ring-2 ring-emerald-100"
                        : "bg-slate-300"
                    }`}
                  />
                  <span
                    className={`font-bold block ${
                      app.attachedDocumentIds.length > 0 ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    DigiVault Credentials Attached ({app.attachedDocumentIds.length})
                  </span>
                </div>

                <div className="relative">
                  <div
                    className={`absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      isSubmitted
                        ? "bg-emerald-600 ring-2 ring-emerald-100"
                        : app.status === "CANCELLED"
                        ? "bg-rose-500"
                        : "bg-slate-300"
                    }`}
                  />
                  <span
                    className={`font-bold block ${
                      isSubmitted
                        ? "text-emerald-700"
                        : app.status === "CANCELLED"
                        ? "text-rose-700"
                        : "text-slate-400"
                    }`}
                  >
                    {app.status === "CANCELLED"
                      ? "Application Cancelled"
                      : isSubmitted
                      ? "Statutory U-CONSENT Granted & Submitted"
                      : "Pending Consent & Submission"}
                  </span>
                  {app.submittedAt && (
                    <span className="text-[10px] text-slate-400 font-mono block">
                      Submitted at {new Date(app.submittedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              {/* Can cancel if not terminal */}
              {!isTerminal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelPrompt(true)}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Cancel Application
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={closeApplicationModal}
                className="ml-auto"
              >
                Close View
              </Button>
            </div>
          </div>
        )}

        {/* Cancellation Confirmation Dialog Prompt */}
        {showCancelPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="text-sm font-bold text-slate-900">Confirm Application Cancellation</h4>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to cancel application <strong>{app.applicationNumber}</strong>? This will permanently mark the application as CANCELLED and withdraw statutory processing.
              </p>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inadvertent filing, criteria not met, alternative scheme chosen..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCancelPrompt(false);
                    setCancellationReason("");
                  }}
                  disabled={isCancelling}
                >
                  Keep Application
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCancelApplication}
                  isLoading={isCancelling}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  Yes, Cancel Application
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
