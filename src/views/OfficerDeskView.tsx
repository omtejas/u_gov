import React, { useState, useEffect } from "react";
import { useGov } from "../context/GovContext";
import { useTranslation } from "../hooks/useTranslation";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Filter,
  ShieldCheck,
  UserCheck,
  RefreshCw,
  Lock,
  Eye,
  FileText,
  Clock,
  Shield,
  Send,
  AlertCircle,
} from "lucide-react";

interface OfficerApplication {
  id: string;
  applicationNumber: string;
  userId: string;
  citizenName: string;
  citizenState: string;
  citizenDistrict: string;
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  department: string;
  status: string;
  submittedAt: string;
  attachedDocumentCount: number;
  hasConsent: boolean;
  cancellationReason?: string;
}

interface ApplicationDetails {
  id: string;
  applicationNumber: string;
  status: string;
  serviceName: string;
  department: string;
  slaDays: number;
  citizenName: string;
  citizenState: string;
  citizenDistrict: string;
  formData: Record<string, any>;
  cancellationReason?: string;
}

interface AttachedDoc {
  id: string;
  title: string;
  typeName: string;
  documentNumber: string;
  mimeType: string;
  sha256Checksum: string;
  verificationStatus: string;
  uploadedAt?: string;
}

interface ConsentDetail {
  id: string;
  recipientEntity?: string;
  purpose?: string;
  status?: string;
  expiresAt?: string;
}

export const OfficerDeskView: React.FC = () => {
  const { user, roles, mode, setMode } = useGov();
  const { t } = useTranslation();

  const [applications, setApplications] = useState<OfficerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Review modal state
  const [inspectingAppId, setInspectingAppId] = useState<string | null>(null);
  const [appDetails, setAppDetails] = useState<ApplicationDetails | null>(null);
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);
  const [consents, setConsents] = useState<ConsentDetail[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Decision inputs
  const [actionExplanation, setActionExplanation] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [decisionMode, setDecisionMode] = useState<"NONE" | "ACTION" | "APPROVE" | "REJECT">("NONE");
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isOfficerOrAdmin =
    roles.includes("OFFICIAL") ||
    roles.includes("OFFICER") ||
    roles.includes("ADMIN") ||
    mode === "official" ||
    mode === "admin";

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const url = new URL("/api/v1/officer/applications", window.location.origin);
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      if (selectedDept !== "ALL") url.searchParams.set("department", selectedDept);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.applications)) {
          setApplications(data.applications);
        }
      }
    } catch (err) {
      console.warn("Failed to load officer queue:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOfficerOrAdmin) {
      loadQueue();
    }
  }, [isOfficerOrAdmin, selectedDept, statusFilter]);

  const inspectApplication = async (appId: string) => {
    setInspectingAppId(appId);
    setIsLoadingDetails(true);
    setDecisionMode("NONE");
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/v1/officer/applications/${appId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAppDetails(data.application);
          setAttachedDocs(data.attachedDocuments || []);
          setConsents(data.consents || []);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch application details:", err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleVerifyDocument = async (docId: string) => {
    if (!inspectingAppId) return;
    try {
      const res = await fetch(`/api/v1/officer/applications/${inspectingAppId}/verify-document`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      if (res.ok) {
        setAttachedDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, verificationStatus: "SANDBOX_SIMULATED" } : d))
        );
        setFeedbackMsg({ type: "success", text: "Credential verified and recorded to U-AUDIT ledger." });
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Failed to verify document." });
    }
  };

  const handleExecuteDecision = async () => {
    if (!inspectingAppId || decisionMode === "NONE") return;
    setIsSubmittingDecision(true);
    setFeedbackMsg(null);

    try {
      let endpoint = "";
      let payload: Record<string, string> = {};

      if (decisionMode === "ACTION") {
        if (!actionExplanation.trim() || actionExplanation.trim().length < 5) {
          setFeedbackMsg({ type: "error", text: "Please provide a valid explanation (minimum 5 characters)." });
          setIsSubmittingDecision(false);
          return;
        }
        endpoint = `/api/v1/officer/applications/${inspectingAppId}/action-required`;
        payload = { explanation: actionExplanation.trim() };
      } else if (decisionMode === "APPROVE") {
        endpoint = `/api/v1/officer/applications/${inspectingAppId}/approve`;
        payload = { notes: approvalNotes.trim() };
      } else if (decisionMode === "REJECT") {
        if (!rejectionReason.trim() || rejectionReason.trim().length < 5) {
          setFeedbackMsg({ type: "error", text: "A mandatory justification reason (minimum 5 characters) is required." });
          setIsSubmittingDecision(false);
          return;
        }
        endpoint = `/api/v1/officer/applications/${inspectingAppId}/reject`;
        payload = { reason: rejectionReason.trim() };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({ type: "success", text: data.message || "Decision executed successfully." });
        setDecisionMode("NONE");
        setActionExplanation("");
        setRejectionReason("");
        setApprovalNotes("");
        // Reload details & queue
        loadQueue();
        inspectApplication(inspectingAppId);
      } else {
        setFeedbackMsg({ type: "error", text: data.error || "Failed to execute decision." });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Execution error." });
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // If user is neither officer nor admin
  if (!isOfficerOrAdmin) {
    return (
      <Card variant="default" padding="lg" className="max-w-xl mx-auto my-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Officer Desk Access Restricted</h2>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
          This portal requires role <code className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">OFFICIAL</code> or{" "}
          <code className="bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded">ADMIN</code>. Switch mode to inspect caseworker verification workflows in this SIH prototype simulation.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="primary" onClick={() => setMode("admin")}>
            <UserCheck className="w-4 h-4 mr-1.5" />
            <span>Switch to U-SYS Admin Mode</span>
          </Button>
        </div>
      </Card>
    );
  }

  // KPIs
  const pendingCount = applications.filter((a) => a.status === "SUBMITTED" || a.status === "PROCESSING").length;
  const actionCount = applications.filter((a) => a.status === "ACTION_REQUIRED").length;
  const approvedCount = applications.filter((a) => a.status === "APPROVED").length;
  const rejectedCount = applications.filter((a) => a.status === "REJECTED").length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-amber-600" />
              <span>{t("officer.title")}</span>
            </h1>
            <Badge variant="warning" size="sm">Caseworker Gateway</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t("officer.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">
            {t("officer.sandboxNotice")}
          </Badge>
          <Button variant="outline" size="sm" onClick={loadQueue} disabled={isLoading}>
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="flat" padding="md" className="border-l-4 border-l-blue-600">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{pendingCount}</div>
          <span className="text-[11px] text-blue-600 font-semibold mt-0.5 block">Active Submissions</span>
        </Card>

        <Card variant="flat" padding="md" className="border-l-4 border-l-amber-500">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Action Required</span>
          <div className="text-2xl font-black text-amber-600 mt-1">{actionCount}</div>
          <span className="text-[11px] text-amber-600 font-semibold mt-0.5 block">Awaiting Citizen Response</span>
        </Card>

        <Card variant="flat" padding="md" className="border-l-4 border-l-emerald-600">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">Direct Vault Issued</span>
        </Card>

        <Card variant="flat" padding="md" className="border-l-4 border-l-slate-400">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Caseload</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{applications.length}</div>
          <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">{rejectedCount} Rejected</span>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card variant="flat" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Department:</span>
          </span>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {["ALL", "Higher Education", "Revenue", "Transport", "Agriculture", "Municipal"].map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  selectedDept === dept
                    ? "bg-[#0b1f3a] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Status:</span>
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PROCESSING">Processing</option>
            <option value="ACTION_REQUIRED">Action Required</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </Card>

      {/* Application Queue Table */}
      <Card variant="default" padding="none">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <span>{t("officer.queue")}</span>
          </h3>
          <span className="text-xs text-slate-400">{applications.length} cases in scope</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading officer queue...</div>
        ) : applications.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No applications match the selected department and status filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Reference No.</th>
                  <th className="p-3.5">Service Scheme</th>
                  <th className="p-3.5">Citizen / Location</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Credentials</th>
                  <th className="p-3.5">Consent</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-blue-700">
                      {app.applicationNumber}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-900 block">{app.serviceName}</span>
                      <span className="text-[11px] text-slate-400">{app.department}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-800 block">{app.citizenName}</span>
                      <span className="text-[11px] text-slate-400">
                        {app.citizenDistrict}, {app.citizenState}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {app.status === "APPROVED" && <Badge variant="success" size="sm">APPROVED</Badge>}
                      {app.status === "REJECTED" && <Badge variant="error" size="sm">REJECTED</Badge>}
                      {app.status === "ACTION_REQUIRED" && (
                        <Badge variant="warning" size="sm" dot>ACTION REQUIRED</Badge>
                      )}
                      {(app.status === "SUBMITTED" || app.status === "PROCESSING") && (
                        <Badge variant="info" size="sm" dot>{app.status}</Badge>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                        <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{app.attachedDocumentCount} attached</span>
                      </span>
                    </td>
                    <td className="p-3.5">
                      {app.hasConsent ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Active DPDP</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => inspectApplication(app.id)}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>{t("officer.review")}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Application Inspection & Verification Modal */}
      <Modal
        isOpen={!!inspectingAppId}
        onClose={() => setInspectingAppId(null)}
        title={appDetails ? `Review: ${appDetails.applicationNumber}` : "Review Application"}
        size="lg"
      >
        {isLoadingDetails || !appDetails ? (
          <div className="py-12 text-center text-xs text-slate-400">Inspecting credential disclosures...</div>
        ) : (
          <div className="space-y-6">
            {/* Feedback Alert */}
            {feedbackMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  feedbackMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}
              >
                {feedbackMsg.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
                <span>{feedbackMsg.text}</span>
              </div>
            )}

            {/* Scheme & Applicant Header */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">{appDetails.department}</span>
                <h3 className="text-base font-extrabold text-slate-900">{appDetails.serviceName}</h3>
                <span className="text-xs text-slate-500 mt-0.5 block">
                  Applicant: <strong>{appDetails.citizenName}</strong> ({appDetails.citizenDistrict}, {appDetails.citizenState})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Current:</span>
                <Badge variant="info" size="sm">{appDetails.status}</Badge>
              </div>
            </div>

            {/* Attached Credentials Disclosures */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4 text-blue-600" />
                <span>Disclosed Vault Credentials ({attachedDocs.length})</span>
              </h4>

              {attachedDocs.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
                  No credentials attached to this application.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {attachedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-slate-900">{doc.title}</h5>
                          <span className="text-[10px] text-slate-400 font-mono">({doc.documentNumber})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>{doc.typeName}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px]">SHA-256: {doc.sha256Checksum.slice(0, 12)}...</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {doc.verificationStatus === "DIGILOCKER_VERIFIED" || doc.verificationStatus === "SANDBOX_SIMULATED" ? (
                          <Badge variant="success" size="sm">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            <span>{t("officer.docVerified")}</span>
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerifyDocument(doc.id)}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            <span>{t("officer.verifyDoc")}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DPDP Consent Record */}
            {consents.length > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>DPDP Purpose-Bound Consent Active</span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Purpose: {consents[0].purpose || "Credential verification for statutory service delivery"}
                </p>
              </div>
            )}

            {/* Decision Modes */}
            <div className="border-t border-slate-200 pt-4">
              {decisionMode === "NONE" ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="outline" size="sm" onClick={() => setInspectingAppId(null)}>
                    {t("common.close")}
                  </Button>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDecisionMode("ACTION")}
                      className="border-amber-300 text-amber-800 hover:bg-amber-50"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                      <span>{t("officer.requestCorrection")}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDecisionMode("REJECT")}
                      className="border-red-300 text-red-800 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
                      <span>{t("officer.reject")}</span>
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setDecisionMode("APPROVE")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-300" />
                      <span>{t("officer.approve")}</span>
                    </Button>
                  </div>
                </div>
              ) : decisionMode === "ACTION" ? (
                <div className="space-y-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <h5 className="text-xs font-bold text-amber-900 uppercase">
                    {t("officer.actionExplanation")}
                  </h5>
                  <Input
                    value={actionExplanation}
                    onChange={(e) => setActionExplanation(e.target.value)}
                    placeholder="e.g. Please re-upload Income Certificate with clear Tehsildar seal."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDecisionMode("NONE")}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleExecuteDecision}
                      disabled={isSubmittingDecision}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      <span>Send Request to Citizen</span>
                    </Button>
                  </div>
                </div>
              ) : decisionMode === "APPROVE" ? (
                <div className="space-y-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <h5 className="text-xs font-bold text-emerald-900 uppercase">
                    {t("officer.confirmApprove")}
                  </h5>
                  <Input
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Optional caseworker notes for statutory file..."
                  />
                  <p className="text-[11px] text-emerald-700">
                    Executing approval will update the citizen's application status to APPROVED, anchor statutory certificate issuance, and record the decision to the U-AUDIT SHA-256 hash-chained ledger.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDecisionMode("NONE")}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleExecuteDecision}
                      disabled={isSubmittingDecision}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      <span>Confirm Approval</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-xl bg-red-50 border border-red-200">
                  <h5 className="text-xs font-bold text-red-900 uppercase">
                    {t("officer.rejectionReason")} (Mandatory)
                  </h5>
                  <Input
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Applicant does not meet the continuous 15-year state domicile requirement."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDecisionMode("NONE")}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleExecuteDecision}
                      disabled={isSubmittingDecision}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      <span>Confirm Rejection</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
