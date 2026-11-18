import React, { useState, useEffect } from "react";
import { useGov } from "../../context/GovContext";
import { useNotifications } from "../../context/NotificationContext";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { ShieldCheck, Globe, User, LogOut, Search, WifiOff, ArrowUpRight } from "lucide-react";
import { GlobalSearch } from "../ui/GlobalSearch";
import { NotificationCenter } from "../ui/NotificationCenter";

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout, language, setLanguage, setActiveTab } = useGov();
  const { unreadCount } = useNotifications();
  const { isOnline } = useNetworkStatus();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); if (isAuthenticated) setIsSearchOpen(true); } };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [isAuthenticated]);
  return (
    <>
      <header className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80">
        <div className="sovereign-tricolor-bar w-full" />
        {!isOnline && <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500 text-white text-xs font-semibold"><WifiOff className="w-3.5 h-3.5" /><span>You are offline. Some features may be unavailable.</span></div>}
        <div className="h-[72px] max-w-[1440px] mx-auto px-3 sm:px-8 lg:px-12 flex items-center justify-between gap-2 sm:gap-6">
          <button onClick={() => setActiveTab("home")} className="flex items-center gap-2 sm:gap-3 cursor-pointer select-none text-left group whitespace-nowrap shrink-0">
            <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#174EA6] p-1 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-[1.03]"><img src="/logo.png" alt="U-GOV emblem" className="w-full h-full object-contain" /></span>
            <span className="font-display font-extrabold text-[18px] sm:text-[20px] tracking-tight text-[#101828] leading-none">U-GOV</span>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <label className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs whitespace-nowrap shrink-0"><Globe className="w-3.5 h-3.5 shrink-0" /><select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-xs font-semibold outline-none cursor-pointer max-w-[4.25rem] sm:max-w-none" aria-label="Select language"><option value="en">EN</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option><option value="kn">ಕನ್ನಡ</option></select></label>
            {isAuthenticated && <button onClick={() => setIsSearchOpen(true)} className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-[#174EA6] hover:border-[#174EA6] transition text-xs whitespace-nowrap shrink-0" title="Search U-GOV (Ctrl+K)" aria-label="Open search"><Search className="w-4 h-4" /><span className="hidden sm:inline">Search</span><kbd className="hidden lg:inline text-[10px] font-mono bg-slate-100 rounded px-1.5 py-0.5">⌘K</kbd></button>}
            {isAuthenticated && <NotificationCenter />}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-1 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 shrink-0">
                <button onClick={() => setActiveTab("profile")} className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0" title="Open Citizen Profile & Life Bio" aria-label="Open Citizen Profile & Life Bio">
                  <span className="w-8 h-8 rounded-full bg-[#174EA6] text-white flex items-center justify-center font-bold text-xs">{user.name.slice(0, 1)}</span>
                  <span className="hidden sm:flex flex-col text-left">
                    <strong className="text-xs text-slate-900 leading-tight">{user.name.split(" ")[0]}</strong>
                    <small className="text-[10px] text-[#16834A] font-semibold leading-tight">{user.kycLevel.split(" ")[0]}</small>
                  </span>
                </button>
                <button onClick={logout} title="Sign out" aria-label="Sign out" className="p-1.5 sm:p-2 text-slate-500 hover:text-[#D62828] rounded-lg transition-colors whitespace-nowrap shrink-0"><LogOut className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => setActiveTab("auth")} className="inline-flex items-center gap-2 bg-[#174EA6] text-white px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#123B7A] transition whitespace-nowrap shrink-0">Sign in <ArrowUpRight size={14} /></button>
            )}
          </div>
        </div>
      </header>
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
