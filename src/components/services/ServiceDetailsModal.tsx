import React, { useState } from "react";
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
} from "lucide-react";

export const ServiceDetailsModal: React.FC = () => {
  const { selectedService, closeServiceModal, applyForService, openExplain, setActiveTab } = useGov();
  const [isApplying, setIsApplying] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  if (!selectedService) return null;

  const handleApply = () => {
    setIsApplying(true);
    setTimeout(() => {
      const res = applyForService(selectedService.id);
      setIsApplying(false);
      setResultMessage(res.message);
    }, 800);
  };

  return (
    <Modal
      isOpen={Boolean(selectedService)}
      onClose={() => {
        setResultMessage(null);
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
      {resultMessage ? (
        <div className="py-6 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-slate-900">
            Application Submitted Successfully!
          </h4>
          <p className="text-sm text-slate-600 max-w-md leading-relaxed">
            {resultMessage}
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="primary"
              onClick={() => {
                closeServiceModal();
                setResultMessage(null);
                setActiveTab("tracker");
              }}
            >
              Track in Applications
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                closeServiceModal();
                setResultMessage(null);
              }}
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
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

          {/* Eligibility & Required Documents */}
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
                <span>Required Documents</span>
                <span className="text-[10px] text-blue-600 font-normal">Click term to explain</span>
              </h5>
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
                onClick={handleApply}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                className="w-1/2 sm:w-auto"
              >
                Apply via DigiVault
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
