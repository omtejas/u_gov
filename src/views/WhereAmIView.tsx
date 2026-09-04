import React, { useState, useEffect } from "react";
import { useGov } from "../context/GovContext";
import { useTranslation } from "../hooks/useTranslation";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  Compass,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  Building2,
  ArrowRight,
  Shield,
  FileCheck,
  Search,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Layers,
  FileText,
  UserCheck,
} from "lucide-react";
import { GovernmentApplication } from "../types";

interface JourneyStage {
  id: string;
  stageNumber: number;
  title: string;
  department: string;
  desc: string;
  status: "COMPLETED" | "CURRENT" | "ACTION_REQUIRED" | "APPROVED" | "REJECTED" | "PENDING";
  timestamp?: string;
}

export const WhereAmIView: React.FC = () => {
  const { governmentApplications, services, setActiveTab, openGBot } = useGov();
  const { t } = useTranslation();

  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [journeyData, setJourneyData] = useState<{
    stages: JourneyStage[];
    nextAction: string;
    slaDaysRemaining: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Set default selected application
  useEffect(() => {
    if (governmentApplications.length > 0 && !selectedAppId) {
      setSelectedAppId(governmentApplications[0].id);
    }
  }, [governmentApplications, selectedAppId]);

  // Fetch journey data when selected application changes
  useEffect(() => {
    if (!selectedAppId) return;

    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/v1/applications/${selectedAppId}/journey`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && data.success) {
          setJourneyData({
            stages: data.stages,
            nextAction: data.nextAction,
            slaDaysRemaining: data.slaDaysRemaining,
          });
        }
      })
      .catch((err) => console.warn("Failed to load journey:", err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAppId]);

  const selectedApp = governmentApplications.find((a) => a.id === selectedAppId);
  const selectedService = selectedApp ? services.find((s) => s.id === selectedApp.serviceId) : null;

  // Render empty state if citizen has no applications
  if (governmentApplications.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Compass className="w-6 h-6 text-blue-600" />
              <span>{t("whereami.title")}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">{t("whereami.subtitle")}</p>
          </div>
        </div>

        <Card variant="default" padding="lg" className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Compass className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{t("whereami.noApplications")}</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            {t("whereami.noApplicationsDesc")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={() => setActiveTab("services")}>
              <Layers className="w-4 h-4 mr-1.5" />
              <span>{t("whereami.exploreServices")}</span>
            </Button>
            <Button variant="outline" onClick={() => setActiveTab("documents")}>
              <FileCheck className="w-4 h-4 mr-1.5" />
              <span>{t("nav.documents")}</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const getStageIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "APPROVED":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "ACTION_REQUIRED":
      case "REJECTED":
        return <AlertTriangle className="w-5 h-5 text-amber-500 animate-bounce" />;
      case "CURRENT":
        return (
          <div className="w-5 h-5 rounded-full border-2 border-blue-600 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          </div>
        );
      default:
        return <Clock className="w-5 h-5 text-slate-300" />;
    }
  };

  const getStageBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="success" size="sm">{t("common.completed")}</Badge>;
      case "APPROVED":
        return <Badge variant="success" size="sm">{t("common.approved")}</Badge>;
      case "ACTION_REQUIRED":
        return <Badge variant="warning" size="sm" dot>{t("common.actionRequired")}</Badge>;
      case "REJECTED":
        return <Badge variant="error" size="sm">{t("common.rejected")}</Badge>;
      case "CURRENT":
        return <Badge variant="info" size="sm" dot>{t("common.inProgress")}</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{t("common.pending")}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Compass className="w-6 h-6 text-blue-600" />
              <span>{t("whereami.title")}</span>
            </h1>
            <Badge variant="info" size="sm">Live Radar</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">{t("whereami.subtitle")}</p>
        </div>

        {/* Scheme Selector Tabs */}
        {governmentApplications.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-md scrollbar-none">
            {governmentApplications.map((app) => {
              const svc = services.find((s) => s.id === app.serviceId);
              const isSel = app.id === selectedAppId;
              return (
                <button
                  key={app.id}
                  onClick={() => setSelectedAppId(app.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSel
                      ? "bg-[#0b1f3a] text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{svc?.name || app.applicationNumber}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Application Overview Banner */}
      {selectedApp && (
        <Card variant="flat" padding="md" className="border-l-4 border-l-blue-600">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-700 font-mono">
                  {selectedApp.applicationNumber}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-medium">
                  {selectedService?.department || "Government Department"}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {selectedService?.name || "Government Service Scheme"}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Status</span>
                <span className="text-xs font-bold text-slate-800">{selectedApp.status.replace(/_/g, " ")}</span>
              </div>
              <div className="text-right border-l border-slate-200 pl-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Statutory SLA</span>
                <span className="text-xs font-bold text-blue-600">
                  {journeyData?.slaDaysRemaining || selectedService?.slaDays || 7} Days Left
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Next Action Callout */}
      {journeyData && journeyData.nextAction && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3.5 shadow-2xs">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              {t("whereami.nextStep")}
            </h4>
            <p className="text-xs text-amber-950 mt-0.5 leading-relaxed">
              {journeyData.nextAction}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openGBot(`Where is my application ${selectedApp?.applicationNumber} and what should I do next?`)}
            className="shrink-0 bg-white"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
            <span>{t("whereami.askGbot")}</span>
          </Button>
        </div>
      )}

      {/* 8-Stage Visual Timeline Stepper */}
      <Card variant="default" padding="lg">
        <h3 className="text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-600" />
          <span>{t("whereami.milestones")}</span>
        </h3>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading statutory journey...</div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-slate-200 before:z-0">
            {(journeyData?.stages || []).map((stage, idx) => {
              const isCompleted = stage.status === "COMPLETED" || stage.status === "APPROVED";
              const isCurrent = stage.status === "CURRENT";
              const isAction = stage.status === "ACTION_REQUIRED";
              const isRejected = stage.status === "REJECTED";

              return (
                <div key={stage.id || idx} className="relative flex items-start gap-4 z-10">
                  {/* Icon Node */}
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
                      isCompleted
                        ? "bg-emerald-50 border-emerald-200 shadow-xs"
                        : isAction || isRejected
                        ? "bg-amber-50 border-amber-300 ring-4 ring-amber-100"
                        : isCurrent
                        ? "bg-blue-50 border-blue-300 ring-4 ring-blue-100 shadow-sm"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    {getStageIcon(stage.status)}
                  </div>

                  {/* Stage Card */}
                  <div
                    className={`flex-1 p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? "bg-blue-50/40 border-blue-200 shadow-xs"
                        : isAction
                        ? "bg-amber-50/40 border-amber-200 shadow-xs"
                        : "bg-white border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          0{stage.stageNumber}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{stage.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {stage.department}
                        </span>
                        {getStageBadge(stage.status)}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{stage.desc}</p>

                    {stage.timestamp && (
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(stage.timestamp).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Quick Navigation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-700">
            Sovereign DPDP Consent Active • Tamper-Evident SHA-256 Ledger Anchored
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setActiveTab("tracker")}>
            <FileText className="w-3.5 h-3.5 mr-1" />
            <span>{t("nav.tracker")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveTab("consent")}>
            <Shield className="w-3.5 h-3.5 mr-1" />
            <span>{t("nav.consent")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
