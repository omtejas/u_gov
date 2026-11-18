import React from "react";
import { useGov } from "../../context/GovContext";
import { useTranslation } from "../../hooks/useTranslation";
import { Home, Layers, LayoutDashboard, FolderLock, Activity, ShieldAlert, ShieldCheck, Server, Sparkles, Bell, Database, Shield, HelpCircle, Compass, Briefcase, ArrowUpRight, Globe2, UserCheck } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, openGBot, roles } = useGov();
  const { unreadCount } = useNotifications();
  const { t } = useTranslation();

  const navItems: Array<{ id: string; label: string; icon: React.ElementType; badge?: number }> = [
    { id: "home", label: t("nav.home"), icon: Home },
    { id: "services", label: t("nav.services"), icon: Layers },
    { id: "webhub", label: t("nav.webhub"), icon: Globe2 },
    { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { id: "documents", label: t("nav.documents"), icon: FolderLock },
    { id: "tracker", label: t("nav.tracker"), icon: Activity },
    { id: "whereami", label: t("nav.whereami"), icon: Compass },
    { id: "profile", label: t("nav.profile"), icon: UserCheck },
    { id: "consent", label: t("nav.consent"), icon: Shield },
    { id: "notifications", label: t("nav.notifications"), icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: "mydata", label: t("nav.mydata"), icon: Database },
    { id: "faq", label: t("nav.faq"), icon: HelpCircle },
    { id: "grievance", label: t("nav.grievance"), icon: ShieldAlert },
    { id: "audit", label: t("nav.audit"), icon: ShieldCheck },
  ];

  if (roles.includes("OFFICIAL") || roles.includes("OFFICER") || roles.includes("ADMIN")) {
    navItems.push({ id: "officer", label: t("nav.officer"), icon: Briefcase });
  }
  if (roles.includes("ADMIN")) {
    navItems.push({ id: "admin", label: t("nav.admin"), icon: Server });
  }

  return (
    <nav className="fixed top-[76px] w-full z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active ? "bg-[#EAF1FC] text-[#174EA6]" : "text-slate-600 hover:text-[#101828] hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-[#174EA6]" : "text-slate-400"}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-0.5 min-w-4 h-4 rounded-full bg-[#D62828] text-white text-[10px] font-bold flex items-center justify-center px-1 tabular-nums">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0 py-1.5">
          <button
            onClick={() => openGBot()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#174EA6] text-white text-xs font-bold hover:bg-[#123B7A] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F5C518]" />
            <span>Ask G-Bot</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
    </nav>
  );
};
