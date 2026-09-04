import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle, Layers, FolderLock, Activity, Sparkles, ShieldCheck } from "lucide-react";

interface OnboardingTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    id: "welcome",
    icon: CheckCircle,
    iconColor: "text-emerald-500",
    title: "Welcome to U-GOV",
    subtitle: "Your Unified Citizen Workspace",
    body: "U-GOV is a single, secure window to access all Central and State government services. Everything you need — documents, applications, consents, and more — is available here.",
    highlight: null,
  },
  {
    id: "services",
    icon: Layers,
    iconColor: "text-blue-500",
    title: "Explore Government Services",
    subtitle: "Find the right scheme for you",
    body: "The Services Hub lists hundreds of government schemes — from scholarships to health coverage. G-Bot can check your eligibility instantly. Click 'Services Hub' in the navigation bar to start.",
    highlight: "Services Hub",
  },
  {
    id: "vault",
    icon: FolderLock,
    iconColor: "text-indigo-500",
    title: "Your DigiVault — Secure Document Store",
    subtitle: "All your credentials in one place",
    body: "Upload your Aadhaar, PAN, Income Certificate, Marksheets, and more to your DigiVault. Each document is stored with a SHA-256 checksum for tamper-evident integrity verification.",
    highlight: "Digital Vault",
  },
  {
    id: "apply",
    icon: Activity,
    iconColor: "text-amber-500",
    title: "Apply & Track Applications",
    subtitle: "End-to-end application lifecycle",
    body: "Start an application for any service. U-GOV checks your document readiness, guides you through the form, and lets you track your application status in real time via the Application Tracker.",
    highlight: "Track Applications",
  },
  {
    id: "consent",
    icon: ShieldCheck,
    iconColor: "text-purple-500",
    title: "Consent — You Stay in Control",
    subtitle: "Full data sovereignty",
    body: "When applying for services, U-GOV asks your explicit consent before sharing any document with a government department. You can revoke access at any time from the Consent Center.",
    highlight: null,
  },
  {
    id: "gbot",
    icon: Sparkles,
    iconColor: "text-rose-500",
    title: "G-Bot — AI-Powered Guidance",
    subtitle: "Your intelligent government assistant",
    body: "Click the 'Ask G-Bot' button anytime to get AI-powered help: check scheme eligibility, understand government terminology, or get step-by-step application guidance. G-Bot is powered by Google Gemini AI.",
    highlight: "Ask G-Bot",
  },
];

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = current.icon;

  // Trap focus inside modal
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight" && !isLast) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isLast, onSkip, step]);

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true" aria-label="Onboarding Tutorial">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/50 overflow-hidden">
        {/* Skip */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
          aria-label="Skip tutorial"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-8 pt-10 pb-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-5">
            <Icon className={`w-8 h-8 ${current.iconColor}`} />
          </div>

          {/* Step counter */}
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Step {step + 1} of {STEPS.length}
          </p>

          {/* Title */}
          <h2 className="text-xl font-extrabold text-slate-900 mb-1">{current.title}</h2>
          <p className="text-sm font-semibold text-slate-500 mb-5">{current.subtitle}</p>

          {/* Body */}
          <p className="text-[14px] text-slate-600 leading-relaxed">
            {current.body}
            {current.highlight && (
              <>
                {" "}Look for the{" "}
                <span className="font-bold text-[#0b1f3a] bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                  {current.highlight}
                </span>{" "}
                button in the navigation bar.
              </>
            )}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 mt-8">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step ? "w-6 h-2 bg-[#0b1f3a]" : "w-2 h-2 bg-slate-200 hover:bg-slate-300"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="px-8 pb-8 flex items-center justify-between gap-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {isLast ? (
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0b1f3a] text-white text-sm font-bold hover:bg-[#163158] transition-colors shadow-sm"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Get Started
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0b1f3a] text-white text-sm font-bold hover:bg-[#163158] transition-colors shadow-sm"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
