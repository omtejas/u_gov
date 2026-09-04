import React from "react";
import { ShieldCheck, PhoneCall, ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#071529] text-slate-300 border-t border-slate-800 pt-10 pb-20 md:pb-10 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800/80">
          {/* Col 1: Platform Overview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                U
              </div>
              <span className="font-bold text-base text-white tracking-tight">
                U-GOV India
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unified Governance & Citizen Services Platform. Built for Smart India Hackathon 2026 (PS ID: SIH26129) to eliminate fragmented public service delivery.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Government Sovereign Security Architecture</span>
            </div>
          </div>

          {/* Col 2: Core Pillars */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              U-System Ecosystem
            </h4>
            <ul className="text-xs space-y-1.5 text-slate-400">
              <li>U-Identity (Single Token Sovereign ID)</li>
              <li>U-Docs (DigiVault & Consent Engine)</li>
              <li>U-Services (National Service Catalogue)</li>
              <li>U-Track (Unified SLA Application Tracking)</li>
              <li>U-AI (Bharat G-Bot Public Knowledge Engine)</li>
            </ul>
          </div>

          {/* Col 3: Statutory Helplines */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              National Citizen Helplines
            </h4>
            <div className="space-y-1.5 text-xs text-slate-400">
              <p className="flex items-center gap-1.5 text-white font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>1947 — Aadhaar & UIDAI Helpdesk</span>
              </p>
              <p className="flex items-center gap-1.5 text-white font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>1930 — National Cyber Crime Helpline</span>
              </p>
              <p className="flex items-center gap-1.5 text-white font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>1800-180-1551 — Kisan Welfare Center</span>
              </p>
              <p className="flex items-center gap-1.5 text-white font-semibold">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>14555 — Ayushman Bharat (PM-JAY)</span>
              </p>
            </div>
          </div>

          {/* Col 4: National Gateways */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Integrated Portals
            </h4>
            <ul className="text-xs space-y-1.5 text-slate-400">
              <li>
                <a
                  href="https://india.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>National Portal of India</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://digilocker.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>DigiLocker Ecosystem</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://pgportal.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>CPGRAMS Public Grievances</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://scholarships.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>National Scholarship Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <p>© 2026 U-GOV India • Unified Public Digital Infrastructure.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span className="hover:text-slate-200 cursor-pointer">Privacy Charter</span>
            <span>•</span>
            <span className="hover:text-slate-200 cursor-pointer">Terms of Service</span>
            <span>•</span>
            <span className="hover:text-slate-200 cursor-pointer">Accessibility Statement</span>
            <span>•</span>
            <span className="hover:text-slate-200 cursor-pointer">Security Audit</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
