import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  FileText,
  FileCheck2,
  Lock,
  Sparkles,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { GovernmentApplication } from "../types";

export const TrackerView: React.FC = () => {
  const {
    governmentApplications,
    isLoadingApplications,
    refreshApplications,
    openApplicationModal,
    setActiveTab,
  } = useGov();

  const [filter, setFilter] = useState<string>("all");
  const [copiedAppNumber, setCopiedAppNumber] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAppNumber(text);
    setTimeout(() => setCopiedAppNumber(null), 2000);
  };

  const filteredApps = governmentApplications.filter((app) => {
    if (filter === "all") return true;
    if (filter === "required") return app.status === "DOCUMENTS_REQUIRED" || app.status === "DRAFT";
    if (filter === "ready") return app.status === "READY" || app.status === "CONSENT_REQUIRED";
    if (filter === "submitted") return app.status === "SUBMITTED" || app.status === "PROCESSING";
    if (filter === "cancelled") return app.status === "CANCELLED";
    return true;
  });

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

  const submittedCount = governmentApplications.filter((a) => a.status === "SUBMITTED" || a.status === "PROCESSING").length;
  const readyCount = governmentApplications.filter((a) => a.status === "READY").length;
  const requiredCount = governmentApplications.filter((a) => a.status === "DOCUMENTS_REQUIRED" || a.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-600" />
            <span>U-APPLICATIONS Unified Lifecycle Radar</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            End-to-end citizen application lifecycle with sovereign document authorization and Sandbox Gateway simulation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshApplications}
            disabled={isLoadingApplications}
            className="text-xs"
          >
            {isLoadingApplications ? "Refreshing..." : "Refresh Radar"}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setActiveTab("services")}
            leftIcon={<Layers className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Apply for Service
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Applications
          </span>
          <span className="text-2xl font-extrabold text-slate-900">
            {governmentApplications.length}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
            Documents Required
          </span>
          <span className="text-2xl font-extrabold text-amber-600">
            {requiredCount}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">
            Ready for Consent
          </span>
          <span className="text-2xl font-extrabold text-blue-600">
            {readyCount}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            Submitted to Sandbox
          </span>
          <span className="text-2xl font-extrabold text-emerald-600">
            {submittedCount}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "all", label: `All Applications (${governmentApplications.length})` },
          { id: "required", label: `Credentials Required (${requiredCount})` },
          { id: "ready", label: `Ready for Consent (${readyCount})` },
          { id: "submitted", label: `Submitted (${submittedCount})` },
          { id: "cancelled", label: "Cancelled" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
              filter === item.id
                ? "bg-[#0b1f3a] text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApps.map((app) => {
          const isSubmitted = ["SUBMITTED", "PROCESSING"].includes(app.status);
          const isReady = app.status === "READY";
          const isCancelled = app.status === "CANCELLED";

          return (
            <Card key={app.id} variant="default" padding="lg" className="space-y-4 hover:border-slate-300 transition-all">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      {app.service?.name || "Government Public Service"}
                    </h3>
                    {getStatusBadge(app.status)}
                    <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded-full">
                      Sandbox Simulation
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                    <span>{app.service?.department || "Department"}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      App Number:
                      <strong className="font-mono text-slate-800">{app.applicationNumber}</strong>
                      <button
                        onClick={() => handleCopy(app.applicationNumber)}
                        title="Copy Application Number"
                        className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                      >
                        {copiedAppNumber === app.applicationNumber ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0 font-medium">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>SLA: <strong>{app.service?.slaDays || 15} Days</strong></span>
                  </div>

                  <Button
                    variant={isReady ? "saffron" : isSubmitted ? "outline" : "primary"}
                    size="sm"
                    onClick={() => openApplicationModal(app)}
                    className="h-8 text-xs shrink-0"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    {isReady
                      ? "Review & Submit"
                      : isSubmitted
                      ? "Track Details"
                      : isCancelled
                      ? "View Record"
                      : "Continue Application"}
                  </Button>
                </div>
              </div>

              {/* Progress & Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">
                    Attached Vault Credentials
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>{app.attachedDocumentIds.length} Credential(s) Attached</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">
                    Statutory U-CONSENT
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>
                      {app.consentIds.length > 0
                        ? `${app.consentIds.length} Token(s) Authorized`
                        : "Pending Authorization"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block mb-0.5">
                    Tracking Identifier
                  </span>
                  <span className="font-mono text-slate-900 font-bold block truncate">
                    {app.trackingToken || "Generated upon submission"}
                  </span>
                </div>
              </div>

              {/* Cancellation notice if cancelled */}
              {isCancelled && app.cancellationReason && (
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    <strong>Cancellation Note:</strong> {app.cancellationReason}
                  </span>
                </div>
              )}
            </Card>
          );
        })}

        {/* Empty State */}
        {filteredApps.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">
              {governmentApplications.length === 0
                ? "No Government Applications Yet"
                : "No applications match this filter"}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Select a service from the Public Services Directory, verify your DigiVault prerequisites, and submit with explicit statutory consent.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-2"
              onClick={() => setActiveTab("services")}
            >
              Browse Services Directory
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
