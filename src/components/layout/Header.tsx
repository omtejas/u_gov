import React, { useState, useEffect } from "react";
import { useGov } from "../../context/GovContext";
import { useNotifications } from "../../context/NotificationContext";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { ShieldCheck, Globe, User, LogOut, Search, WifiOff } from "lucide-react";
import { GlobalSearch } from "../ui/GlobalSearch";
import { NotificationCenter } from "../ui/NotificationCenter";

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout, language, setLanguage, setActiveTab } = useGov();
  const { unreadCount } = useNotifications();
  const { isOnline } = useNetworkStatus();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl+K → open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isAuthenticated) setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAuthenticated]);

  return (
    <>
      <header className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_6px_rgba(11,31,58,0.03)]">
        {/* Sovereign Tricolor Accent Trace Line */}
        <div className="sovereign-tricolor-bar w-full" />

        {/* Offline Banner */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500 text-white text-xs font-semibold">
            <WifiOff className="w-3.5 h-3.5" />
            <span>You are offline. Some features may be unavailable.</span>
          </div>
        )}

        <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Emblem & National Gateway Title */}
          <div
            onClick={() => setActiveTab("home")}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#0b1f3a] p-1 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
              <img src="/logo.png" alt="U-GOV Sovereign Emblem" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-[#000615] leading-none">
                  U-GOV
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/80 text-[#855800] tracking-wider uppercase">
                  DPI v3.2
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wider uppercase mt-0.5">
                Unified Governance Gateway • Republic of India
              </span>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 256-Bit SSL Status indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 border border-slate-200/70">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-medium text-slate-700">
                High-Assurance TLS 1.3
              </span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors text-xs font-medium cursor-pointer">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer pr-1"
                aria-label="Select language"
              >
                <option value="en">English (IN)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>

            {/* Search Button (authenticated only) */}
            {isAuthenticated && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors text-xs font-medium cursor-pointer"
                title="Search U-GOV (Ctrl+K)"
                aria-label="Open search"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 rounded bg-slate-200 text-[10px] font-mono text-slate-500">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Notification Center (authenticated only) */}
            {isAuthenticated && <NotificationCenter />}

            {/* User Profile / Login */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div
                  onClick={() => setActiveTab("dashboard")}
                  className="flex items-center gap-2 cursor-pointer p-1 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0b1f3a] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                    {user.name.slice(0, 1)}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {user.name.split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold tracking-wide">
                      {user.kycLevel.split(" ")[0]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab("auth")}
                className="px-3.5 py-1.5 rounded-xl bg-[#0b1f3a] text-white text-xs font-semibold hover:bg-[#163158] transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
