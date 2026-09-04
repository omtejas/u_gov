import React from "react";
import { useGov } from "../../context/GovContext";
import {
  Home,
  Layers,
  LayoutDashboard,
  FolderLock,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Server,
  Sparkles,
} from "lucide-react";

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, mode, setMode, openGBot } = useGov();

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "services", label: "Services Hub", icon: Layers },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "Digital Vault", icon: FolderLock },
    { id: "tracker", label: "Track Applications", icon: Activity },
    { id: "grievance", label: "Issue Solver", icon: ShieldAlert },
    { id: "audit", label: "Audit & Security", icon: ShieldCheck },
  ];

  if (mode === "admin" || mode === "official") {
    navItems.push({ id: "admin", label: "U-SYS Telemetry", icon: Server });
  }

  return (
    <nav className="fixed top-[67px] w-full z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(11,31,58,0.02)] hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0b1f3a] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? "text-amber-400" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Action: G-Bot AI Assistant button & Mode Switcher */}
        <div className="flex items-center gap-2 py-1.5">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-semibold border border-slate-200">
            <button
              onClick={() => setMode("citizen")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                mode === "citizen"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Citizen
            </button>
            <button
              onClick={() => setMode("admin")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                mode === "admin"
                  ? "bg-white text-blue-700 shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              U-SYS Admin
            </button>
          </div>

          {/* AI Guidance Pill */}
          <button
            onClick={() => openGBot()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold hover:brightness-110 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Ask G-Bot</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
