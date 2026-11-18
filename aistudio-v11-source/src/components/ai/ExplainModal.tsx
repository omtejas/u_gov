import React, { useState, useEffect } from "react";
import { useGov } from "../../context/GovContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { HelpCircle, CheckCircle2, FileText, Building2, Sparkles, Info } from "lucide-react";

export const ExplainModal: React.FC = () => {
  const { selectedTerm, closeExplain, language, openGBot } = useGov();
  const [data, setData] = useState<any>(null);
  const [notFoundTerm, setNotFoundTerm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!selectedTerm) {
      setData(null);
      setNotFoundTerm(null);
      return;
    }

    const fetchExplanation = async () => {
      setIsLoading(true);
      setData(null);
      setNotFoundTerm(null);
      try {
        const res = await fetch("/api/v1/ai/explain", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ term: selectedTerm, language }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json.known === false || !json.explanation) {
          setNotFoundTerm(selectedTerm);
        } else {
          setData(json.explanation);
        }
      } catch {
        setNotFoundTerm(selectedTerm);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchExplanation();
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
      ) : notFoundTerm ? (
        <div className="py-6 space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#174EA6] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">No glossary entry found for “{notFoundTerm}”</p>
              <p className="text-xs text-slate-600 leading-relaxed">
                This term is not yet in the curated plain-language glossary. You can ask Bharat G-Bot for contextual guidance tailored to Indian public services.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={closeExplain}>Close</Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5 text-[#F5C518]" />}
              onClick={() => {
                const term = notFoundTerm;
                closeExplain();
                openGBot(`Explain what "${term}" means for Indian citizens, why authorities request it, and how to obtain it.`);
              }}
            >
              Ask Bharat G-Bot
            </Button>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100">
            <h5 className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-1">
              What does this mean in simple words?
            </h5>
            <p className="text-sm text-slate-800 leading-relaxed font-medium">
              {data.simpleExplanation}
            </p>
          </div>

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

          {data.documentsNeeded && data.documentsNeeded.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Standard Supporting Documents Checklist</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600">
                {data.documentsNeeded.map((doc: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span>·</span>
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
