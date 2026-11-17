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
        <div className="h-[76px] max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4">
          <button onClick={() => setActiveTab("home")} className="flex items-center gap-3 cursor-pointer select-none text-left group">
            <span className="w-11 h-11 rounded-xl bg-[#174EA6] p-1 flex items-center justify-center overflow-hidden group-hover:rotate-[-4deg] transition-transform"><img src="/logo.png" alt="U-GOV emblem" className="w-full h-full object-contain" /></span>
            <span className="flex flex-col"><span className="flex items-center gap-2"><strong className="font-extrabold text-[21px] tracking-[-.07em] text-[#101828] leading-none">U-GOV</strong><span className="text-[9px] font-extrabold px-2 py-1 rounded bg-[#EAF1FC] text-[#174EA6] tracking-wider uppercase">V6</span></span><span className="text-[9px] font-bold text-slate-500 tracking-[.13em] uppercase mt-1">Unified Governance Gateway</span></span>
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#F4F7FB] text-slate-600 text-[10px] font-bold"><ShieldCheck className="w-3.5 h-3.5 text-[#16834A]" /> PROTOTYPE ENVIRONMENT</div>
            <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs"><Globe className="w-3.5 h-3.5" /><select value={language} onChange={(e) => setLanguage(e.target.value as any)} className="bg-transparent text-xs font-semibold outline-none cursor-pointer" aria-label="Select language"><option value="en">EN</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option><option value="kn">ಕನ್ನಡ</option></select></label>
            {isAuthenticated && <button onClick={() => setIsSearchOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-[#174EA6] hover:border-[#174EA6] transition text-xs" title="Search U-GOV (Ctrl+K)" aria-label="Open search"><Search className="w-4 h-4" /><span className="hidden sm:inline">Search</span><kbd className="hidden lg:inline text-[9px] bg-slate-100 rounded px-1.5 py-1">⌘K</kbd></button>}
            {isAuthenticated && <NotificationCenter />}
            {isAuthenticated && user ? <div className="flex items-center gap-2 pl-2 border-l border-slate-200"><button onClick={() => setActiveTab("dashboard")} className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-50"><span className="w-8 h-8 rounded-full bg-[#174EA6] text-white flex items-center justify-center font-bold text-xs">{user.name.slice(0,1)}</span><span className="hidden sm:flex flex-col text-left"><strong className="text-xs text-slate-900">{user.name.split(" ")[0]}</strong><small className="text-[9px] text-[#16834A] font-bold">{user.kycLevel.split(" ")[0]}</small></span></button><button onClick={logout} title="Sign out" className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><LogOut className="w-4 h-4" /></button></div> : <button onClick={() => setActiveTab("auth")} className="inline-flex items-center gap-2 bg-[#174EA6] text-white px-4 py-2.5 rounded-lg text-xs font-bold hover:bg-[#123B7A] transition">Sign in <ArrowUpRight size={14} /></button>}
          </div>
        </div>
      </header>
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
