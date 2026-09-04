import React from "react";
import { useGov } from "../../context/GovContext";
import { useTranslation } from "../../hooks/useTranslation";
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
  Bell,
  Database,
  Shield,
  HelpCircle,
  Compass,
  Briefcase,
} from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, mode, setMode, openGBot, roles } = useGov();
  const { unreadCount } = useNotifications();
  const { t } = useTranslation();

  const navItems = [
    { id: "home", label: t("nav.home"), icon: Home },
    { id: "services", label: t("nav.services"), icon: Layers },
    { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { id: "documents", label: t("nav.documents"), icon: FolderLock },
    { id: "tracker", label: t("nav.applications"), icon: Activity },
    { id: "whereami", label: t("nav.whereami"), icon: Compass },
    { id: "consent", label: t("nav.consent"), icon: Shield },
    { id: "notifications", label: t("nav.notifications"), icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: "mydata", label: t("nav.mydata"), icon: Database },
    { id: "faq", label: t("nav.faq"), icon: HelpCircle },
    { id: "grievance", label: t("nav.grievance"), icon: ShieldAlert },
    { id: "audit", label: t("nav.audit"), icon: ShieldCheck },
  ];

  if (mode === "admin" || mode === "official" || roles.includes("OFFICIAL") || roles.includes("ADMIN")) {
    navItems.push({ id: "officer", label: t("nav.officer"), icon: Briefcase });
  }

  if (mode === "admin" || mode === "official" || roles.includes("ADMIN")) {
    navItems.push({ id: "admin", label: t("nav.admin"), icon: Server });
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
                className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
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
                {(item as any).badge && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 ring-2 ring-white">
                    {(item as any).badge > 9 ? "9+" : (item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Action: G-Bot AI Assistant button & Mode Switcher */}
        <div className="flex items-center gap-2 py-1.5 shrink-0">
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
