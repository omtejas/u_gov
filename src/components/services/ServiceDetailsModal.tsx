import React, { useState, useEffect } from "react";
import { useGov } from "../../context/GovContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  ExternalLink,
  Building,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { ServiceRequirementsEvaluation } from "../../types";

export const ServiceDetailsModal: React.FC = () => {
  const {
    selectedService,
    closeServiceModal,
    openExplain,
    isAuthenticated,
    setActiveTab,
    governmentApplications,
    createGovernmentApplication,
    openApplicationModal,
    checkServiceRequirements,
  } = useGov();

  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [requirementsEval, setRequirementsEval] = useState<ServiceRequirementsEvaluation | null>(null);
  const [isLoadingReqs, setIsLoadingReqs] = useState(false);

  useEffect(() => {
    if (selectedService && isAuthenticated) {
      loadRequirements();
    } else {
      setRequirementsEval(null);
    }
  }, [selectedService?.id, isAuthenticated]);

  const loadRequirements = async () => {
    if (!selectedService) return;
    setIsLoadingReqs(true);
    setErrorMessage(null);
    const res = await checkServiceRequirements(selectedService.id);
    setIsLoadingReqs(false);
    if (res.success && res.evaluation) {
      setRequirementsEval(res.evaluation);
    }
  };

  if (!selectedService) return null;

  // Check if citizen already has an active application for this service
  const existingApp = governmentApplications.find(
    (a) =>
      a.serviceId === selectedService.id &&
      !["APPROVED", "REJECTED", "CANCELLED"].includes(a.status)
  );

  const handleStartApplication = async () => {
    if (!isAuthenticated) {
      closeServiceModal();
      setActiveTab("auth");
      return;
    }

    if (existingApp) {
      closeServiceModal();
      openApplicationModal(existingApp);
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);
    const res = await createGovernmentApplication(selectedService.id, {
      appliedFrom: "ServicesDirectory",
      scheme: selectedService.name,
    });
    setIsApplying(false);

    if (res.success && res.application) {
      closeServiceModal();
      openApplicationModal(res.application);
    } else {
      setErrorMessage(res.error || "Failed to initiate service application.");
    }
  };

  return (
    <Modal
      isOpen={Boolean(selectedService)}
      onClose={() => {
        setErrorMessage(null);
        closeServiceModal();
      }}
      title={
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold text-slate-900">
              {selectedService.name}
            </span>
            <Badge variant="success" size="sm" dot>
              {selectedService.status === "available" ? "Active DPI Service" : "Prototype"}
            </Badge>
          </div>
          <span className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 font-medium">
            <Building className="w-3.5 h-3.5" />
            <span>
              {selectedService.department} • {selectedService.ministry}
            </span>
          </span>
        </div>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Processing SLA
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                {selectedService.slaDays} Working Days
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Statutory Fee
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                {selectedService.fee === 0 ? "100% Free" : `₹${selectedService.fee}`}
              </span>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                Verification
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                DigiVault e-KYC
              </span>
            </div>
          </div>
        </div>

        {/* Existing Application Banner */}
        {existingApp && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <strong className="block">Active Application In Progress</strong>
              <span className="text-blue-700 font-mono text-[11px]">
                {existingApp.applicationNumber} • Status: {existingApp.status}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                closeServiceModal();
                openApplicationModal(existingApp);
              }}
              className="h-8 text-xs border-blue-300 text-blue-800 bg-white"
            >
              Open Application
            </Button>
          </div>
        )}

        {/* Description */}
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Service Scope & Objectives
          </h5>
          <p className="text-sm text-slate-700 leading-relaxed">
            {selectedService.description}
          </p>
        </div>

        {/* Key Benefits */}
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Citizen Benefits
          </h5>
          <ul className="space-y-1.5">
            {selectedService.benefits.map((ben, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{ben}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Eligibility & Required Documents with Live Readiness */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Eligibility Parameters
            </h5>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {selectedService.eligibility.map((el, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  <span>{el}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center justify-between">
              <span>Required Credentials</span>
              {requirementsEval && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                  {requirementsEval.readinessPercentage}% in Vault
                </span>
              )}
            </h5>

            {requirementsEval ? (
              <ul className="space-y-2 text-xs">
                {requirementsEval.requirements.map((req, i) => (
                  <li key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200/80">
                    <div className="flex items-center gap-1.5">
                      {req.satisfied ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800">{req.documentTypeName}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        req.satisfied
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {req.satisfied ? "In Vault" : "Missing"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-600">
                {selectedService.requiredDocs.map((doc, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{doc}</span>
                    </div>
                    <button
                      onClick={() => openExplain(doc)}
                      className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Explain
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <a
            href={selectedService.officialPortal}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
          >
            <span>Visit Ministry Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={closeServiceModal}
              className="w-1/2 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isApplying}
              onClick={handleStartApplication}
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
              className="w-1/2 sm:w-auto"
            >
              {existingApp ? "Continue Application" : "Apply via DigiVault"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
