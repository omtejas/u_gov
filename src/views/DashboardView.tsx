import React, { useCallback, useEffect, useState } from "react";
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
  AlertTriangle,
  FileText,
  Server,
  RefreshCw,
  Wifi,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const DashboardView: React.FC = () => {
  const {
    user,
    applications,
    governmentApplications,
    documents,
    auditLogs,
    setActiveTab,
     openApplicationModal,
    openGBot,
   } = useGov();

  const [providerHealth, setProviderHealth] = useState<Array<{ providerCode: string; displayName: string; status: string; latencyMs?: number; environment?: string }>>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [healthCheckedAt, setHealthCheckedAt] = useState("");

  const runCloudDiagnostics = useCallback(async () => {
    setHealthLoading(true);
    setHealthError("");
    try {
      const response = await fetch("/api/v1/integrations/providers", { credentials: "include" });
      const payload = await response.json();
      if (!response.ok || !payload.success || !Array.isArray(payload.providers)) {
        throw new Error(payload.error || "Unable to load integration gateway registry.");
      }
      const results = await Promise.all(payload.providers.map(async (provider: any) => {
        try {
          const probe = await fetch(`/api/v1/integrations/providers/${encodeURIComponent(provider.providerCode)}/health`, { credentials: "include" });
          const data = await probe.json();
          if (!probe.ok || !data.success || !data.health) throw new Error("Health probe failed");
          return {
            providerCode: provider.providerCode,
            displayName: provider.displayName,
            status: data.health.status || "UNKNOWN",
            latencyMs: data.health.latencyMs,
            environment: data.health.environment || provider.environment,
          };
        } catch {
          return {
            providerCode: provider.providerCode,
            displayName: provider.displayName,
            status: "UNAVAILABLE",
            environment: provider.environment,
          };
        }
      }));
      setProviderHealth(results);
      setHealthCheckedAt(new Date().toLocaleTimeString());
    } catch (error: any) {
      setHealthError(error?.message || "Cloud diagnostics could not be completed.");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void runCloudDiagnostics();
  }, [runCloudDiagnostics]);

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
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#123B7A] via-[#174EA6] to-[#123B7A] text-white shadow-lg border border-blue-300/30 relative overflow-hidden">
        <div className="sovereign-tricolor-bar absolute inset-x-0 top-0" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Identity info */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-xl font-black text-[#F5C518] shadow-inner">
                {displayName.slice(0, 1)}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#174EA6] border border-blue-400/40 p-0.5 overflow-hidden shadow-sm">
                <img src="/logo.png" alt="U-GOV" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                  {displayName}
                </h1>
                <Badge variant="info" size="sm" dot>
                  Profile: {kycLevel}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-mono">
                <span>U-ID: <strong className="text-white">{uId}</strong></span>
                <span>•</span>
                <span>{district}, {state}</span>
              </div>
            </div>
          </div>

          {/* Prototype identity disclosure */}
          <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs text-slate-200">
            Prototype identity • Not government-verified
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
                {(pendingActions[0] as any)?.actionRequiredText || "Review the application details and complete any outstanding steps."}
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

      {/* Citizen quick actions */}
      <section aria-label="Quick actions" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Button variant="outline" className="justify-start" onClick={() => setActiveTab("services")}>
          <FileText className="w-4 h-4 mr-2" /> Explore Services
        </Button>
        <Button variant="outline" className="justify-start" onClick={() => setActiveTab("documents")}>
          <FolderLock className="w-4 h-4 mr-2" /> My Documents
        </Button>
        <Button variant="outline" className="justify-start" onClick={() => setActiveTab("tracker")}>
          <Activity className="w-4 h-4 mr-2" /> Track Applications
        </Button>
        <Button variant="outline" className="justify-start" onClick={() => openGBot("Help me find a government service in the U-GOV prototype catalogue.")}>
          <Sparkles className="w-4 h-4 mr-2" /> Ask G-Bot
        </Button>
      </section>

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
            {pendingActions.length} require attention
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
            Stored in your private vault
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
            Applications Requiring Action
          </span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {pendingActions.length}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Based on your current application records
          </span>
        </Card>
      </div>

      {/* U-GOV Cloud Interoperability Control Tower */}
      <section className="rounded-3xl overflow-hidden border border-slate-800 bg-[#071426] text-white shadow-xl">
        <div className="p-5 sm:p-6 bg-gradient-to-r from-[#174EA6] via-[#123B7A] to-[#174EA6] relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-white to-emerald-400" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#F5D957] text-[10px] font-black tracking-[0.22em] uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                U-GOV / CLOUD OPERATIONS
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-2">Interoperability Control Tower</h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Live health probes across the U-GOV sandbox gateway network. One interface, multiple departmental adapters.
              </p>
            </div>
            <Button onClick={() => void runCloudDiagnostics()} disabled={healthLoading} className="shrink-0">
              <RefreshCw className={`w-4 h-4 mr-2 ${healthLoading ? "animate-spin" : ""}`} />
              {healthLoading ? "Probing Gateways..." : "Run Live Diagnostics"}
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Registered Gateways</div>
              <div className="text-2xl font-black mt-1">{providerHealth.length || "—"}</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Healthy Adapters</div>
              <div className="text-2xl font-black text-emerald-300 mt-1">{providerHealth.filter((p) => p.status === "HEALTHY").length}</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Gateway Environment</div>
              <div className="text-lg font-black text-[#F5D957] mt-2">SANDBOX</div>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Last Diagnostics</div>
              <div className="text-sm font-bold mt-2">{healthCheckedAt || (healthLoading ? "Running..." : "Not run")}</div>
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          {healthError && (
            <div className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{healthError}</div>
          )}
          {providerHealth.length === 0 && healthLoading ? (
            <div className="py-8 text-center text-sm text-slate-300"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Contacting sandbox gateways...</div>
          ) : providerHealth.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {providerHealth.map((provider) => {
                const healthy = provider.status === "HEALTHY";
                const degraded = provider.status === "DEGRADED";
                return (
                  <div key={provider.providerCode} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${healthy ? "bg-emerald-400/15 text-emerald-300" : degraded ? "bg-amber-400/15 text-[#F5C518]" : "bg-rose-400/15 text-rose-300"}`}>
                          <Server className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 truncate">{provider.providerCode}</span>
                      </div>
                      {healthy ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <XCircle className="w-4 h-4 text-rose-300" />}
                    </div>
                    <h3 className="text-sm font-bold leading-snug mt-3 min-h-[2.5rem]">{provider.displayName}</h3>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                      <span className={`text-[10px] font-bold tracking-wider ${healthy ? "text-emerald-300" : degraded ? "text-[#F5C518]" : "text-rose-300"}`}>{provider.status}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1"><Wifi className="w-3 h-3" />{typeof provider.latencyMs === "number" ? `${provider.latencyMs} ms` : "—"}</span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-2">{provider.environment || "SANDBOX"} • Adapter health probe</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-center text-xs text-slate-300">
              Gateway health is not available yet. Run diagnostics to retry.
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-4 text-[10px] text-slate-400">
            <span>Architecture: Citizen UI → U-GOV API → Adapter Gateway → Department Sandbox</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-300" /> No live government system is contacted</span>
          </div>
        </div>
      </section>

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
                <span>Recent Vault Documents</span>
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
                      <span className="text-[10px] text-slate-500">
                        Stored in your private vault
                      </span>
                    </div>
                  </div>
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
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
