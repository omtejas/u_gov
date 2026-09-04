import React, { useState, useEffect } from "react";
import { useGov } from "../../context/GovContext";
import { Modal } from "../ui/Modal";
import { HelpCircle, CheckCircle2, FileText, Building2, ExternalLink } from "lucide-react";

export const ExplainModal: React.FC = () => {
  const { selectedTerm, closeExplain, language } = useGov();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedTerm) {
      setData(null);
      return;
    }

    const fetchExplanation = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/v1/ai/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term: selectedTerm, language }),
        });
        const json = await res.json();
        setData(json.explanation);
      } catch (e) {
        setData({
          simpleExplanation: `A standard public administration certificate required for government services.`,
          realLifeExample: `Used to verify identity, eligibility, or domicile.`,
          whyGovernmentAsks: `To establish statutory rights and eliminate fraudulent claims.`,
          whereToGetIt: `Local Tehsil, Seva Kendra, or District Collectorate.`,
          documentsNeeded: ["Aadhaar Card", "Proof of Residence", "Self-Declaration"],
          issuingAuthority: `Sub-Divisional Magistrate / Revenue Officer`,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchExplanation();
  }, [selectedTerm, language]);

  if (!selectedTerm) return null;

  return (
    <Modal
      isOpen={Boolean(selectedTerm)}
      onClose={closeExplain}
      title={
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <span>Explain Government Term: {selectedTerm}</span>
        </div>
      }
      subtitle="Plain-language explanation without confusing bureaucratic jargon"
      maxWidth="lg"
    >
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span>Generating simple citizen explanation...</span>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Simple Explanation */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
            <h5 className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-1">
              What does this mean in simple words?
            </h5>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">
              {data.simpleExplanation}
            </p>
          </div>

          {/* Real Life Example */}
          {data.realLifeExample && (
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80">
              <h5 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                Real-Life Example
              </h5>
              <p className="text-xs text-slate-700 leading-relaxed">
                {data.realLifeExample}
              </p>
            </div>
          )}

          {/* Why government asks & Where to get */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Why is it required?</span>
              </div>
              <p className="text-xs text-slate-600">{data.whyGovernmentAsks}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Where do you get it?</span>
              </div>
              <p className="text-xs text-slate-600">{data.whereToGetIt}</p>
            </div>
          </div>

          {/* Documents Needed */}
          {data.documentsNeeded && data.documentsNeeded.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Standard Supporting Documents Checklist:</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600">
                {data.documentsNeeded.map((doc: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};
