import React from "react";
import { useGov } from "../../context/GovContext";
import { useTranslation } from "../../hooks/useTranslation";
import { Home, Layers, LayoutDashboard, FolderLock, Sparkles } from "lucide-react";

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, openGBot } = useGov();
  const { t } = useTranslation();

  const mobileTabs = [
    { id: "home", label: t("nav.home"), icon: Home },
    { id: "services", label: t("nav.services"), icon: Layers },
    { id: "gbot", label: "G-Bot AI", icon: Sparkles, isAction: true },
    { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { id: "documents", label: t("nav.documents"), icon: FolderLock },
  ];

  return (
    <nav className="ugov-mobile-nav md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-2 py-1.5 flex items-center justify-around">
      {mobileTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        if (tab.isAction) {
          return (
            <button
              key={tab.id}
              onClick={() => openGBot()}
              className="flex flex-col items-center justify-center -mt-4 cursor-pointer whitespace-nowrap shrink-0"
            >
              <div className="w-10 h-10 rounded-xl bg-[#174EA6] text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4 text-[#F5C518]" />
              </div>
              <span className="text-[10px] font-bold text-[#174EA6] mt-1">
                {tab.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isActive ? "text-[#174EA6]" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                isActive ? "text-[#174EA6]" : "text-slate-400"
              }`}
            />
            <span
              className={`text-[10px] tracking-tight mt-0.5 ${
                isActive ? "font-bold text-[#174EA6]" : "font-medium"
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
