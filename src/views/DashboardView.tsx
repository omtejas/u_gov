import React from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  User,
  ShieldCheck,
  FolderLock,
  Activity,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";

export const DashboardView: React.FC = () => {
  const {
    user,
    applications,
    governmentApplications,
    documents,
    auditLogs,
    setActiveTab,
    openServiceModal,
    openApplicationModal,
    services,
  } = useGov();

  const activeGovernmentApps = governmentApplications.filter(
    (a) => !["APPROVED", "REJECTED", "CANCELLED"].includes(a.status)
  );
  const activeApplications = governmentApplications.length > 0
    ? activeGovernmentApps
    : applications.filter((a) => a.status !== "completed");
  const pendingActions = governmentApplications.length > 0
    ? governmentApplications.filter((a) => a.status === "DOCUMENTS_REQUIRED" || a.status === "ACTION_REQUIRED")
    : applications.filter((a) => a.status === "action_required");

  const displayName = user?.name || "Citizen";
  const kycLevel = user?.kycLevel || "Tier 1 (Basic)";
  const uId = user?.uId || "U-0000-0000-IND";
  const state = user?.state || "Maharashtra";
  const district = user?.district || "Pune";

  return (
    <div className="space-y-8">
      {/* Citizen Identity Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0b1f3a] via-[#11294d] to-[#071529] text-white shadow-lg border border-blue-900/60 relative overflow-hidden">
        <div className="sovereign-tricolor-bar absolute inset-x-0 top-0" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Identity info */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl font-black text-amber-300 shadow-inner">
              {displayName.slice(0, 1)}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  {displayName}
                </h1>
                <Badge variant="success" size="sm" dot>
                  {kycLevel}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
                <span>U-ID: <strong className="text-white">{uId}</strong></span>
                <span>•</span>
                <span>{district}, {state}</span>
              </div>
            </div>
          </div>

          {/* Linked Statutory Tokens */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Aadhaar Seeded</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>PAN 2.0 Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Required Banner if any */}
      {pendingActions.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold">
                Action Required on {pendingActions.length} Application(s)
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                {(pendingActions[0] as any)?.actionRequiredText || "Additional document verification or biometric confirmation required."}
              </p>
            </div>
          </div>
          <Button
            variant="saffron"
            size="sm"
            onClick={() => setActiveTab("tracker")}
          >
            Take Action
          </Button>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="flat" padding="md">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Applications
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {activeApplications.length}
          </div>
          <span className="text-[11px] text-blue-600 font-medium mt-1 block">
            {applications.filter((a) => a.status === "under_review").length} under SLA review
          </span>
        </Card>

        <Card variant="flat" padding="md">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            DigiVault Documents
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {documents.length}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            100% Cryptographically Sealed
          </span>
        </Card>

        <Card variant="flat" padding="md">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Active Data Consents
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {documents.reduce((acc, d) => acc + d.consents.filter((c) => c.status === "active").length, 0)}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Granular access permissions
          </span>
        </Card>

        <Card variant="flat" padding="md">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            SLA Compliance Rate
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            100%
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Zero SLA breach across services
          </span>
        </Card>
      </div>

      {/* Main 2-Column Split: Active Applications & DigiVault Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Applications Tracker */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>In-Flight Application Radar</span>
            </h3>
            <button
              onClick={() => setActiveTab("tracker")}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({governmentApplications.length > 0 ? governmentApplications.length : applications.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {governmentApplications.length > 0 ? (
              governmentApplications.slice(0, 3).map((app) => (
                <Card key={app.id} variant="hoverable" padding="md" onClick={() => openApplicationModal(app)}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {app.applicationNumber}
                      </span>
                      <Badge
                        variant={
                          app.status === "SUBMITTED" || app.status === "APPROVED"
                            ? "success"
                            : app.status === "DOCUMENTS_REQUIRED"
                            ? "warning"
                            : "info"
                        }
                        size="sm"
                        dot
                      >
                        {app.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      SLA: {app.service?.slaDays || 15} Days
                    </span>
                  </div>

                  <div className="py-2.5">
                    <h4 className="text-sm font-bold text-slate-900">
                      {app.service?.name || "Government Application"}
                    </h4>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {app.service?.department} • {app.attachedDocumentIds.length} Credential(s) Attached
                    </span>
                  </div>
                </Card>
              ))
            ) : (
              applications.map((app) => (
                <Card key={app.id} variant="hoverable" padding="md" onClick={() => setActiveTab("tracker")}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {app.refNumber}
                      </span>
                      <Badge
                        variant={
                          app.status === "approved"
                            ? "success"
                            : app.status === "action_required"
                            ? "warning"
                            : "info"
                        }
                        size="sm"
                      >
                        {app.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Target SLA: {new Date(app.slaTargetDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="py-2.5">
                    <h4 className="text-sm font-bold text-slate-900">
                      {app.serviceName}
                    </h4>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      {app.department}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: DigiVault Documents Preview & Audit Logs */}
        <div className="space-y-6">
          {/* DigiVault Snippet */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FolderLock className="w-4 h-4 text-blue-600" />
                <span>Verified Credentials</span>
              </h3>
              <button
                onClick={() => setActiveTab("documents")}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Manage Vault
              </button>
            </div>

            <div className="space-y-2">
              {documents.slice(0, 4).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setActiveTab("documents")}
                  className="p-3 rounded-xl bg-white border border-slate-200/80 hover:border-blue-300 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-800 block truncate">
                        {doc.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {doc.docNumber}
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit Events */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Tamper-Evident Activity</span>
              </h3>
              <button
                onClick={() => setActiveTab("audit")}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Full Audit Trail
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              {auditLogs.slice(0, 3).map((log) => (
                <div key={log.id} className="text-xs space-y-0.5 border-b border-slate-200/60 pb-2 last:border-none last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-1">
                    {log.context}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
