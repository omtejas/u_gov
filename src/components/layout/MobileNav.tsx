import React from "react";
import { useGov } from "../../context/GovContext";
import { Home, Layers, LayoutDashboard, FolderLock, Sparkles } from "lucide-react";

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, openGBot } = useGov();

  const mobileTabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "services", label: "Services", icon: Layers },
    { id: "gbot", label: "G-Bot AI", icon: Sparkles, isAction: true },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "documents", label: "DigiVault", icon: FolderLock },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-2 py-1.5 flex items-center justify-around">
      {mobileTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        if (tab.isAction) {
          return (
            <button
              key={tab.id}
              onClick={() => openGBot()}
              className="flex flex-col items-center justify-center -mt-5 cursor-pointer"
            >
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <span className="text-[10px] font-bold text-blue-700 mt-1">
                {tab.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors cursor-pointer ${
              isActive ? "text-[#0b1f3a]" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Icon
              className={`w-5 h-5 ${
                isActive ? "text-blue-600 font-bold" : "text-slate-400"
              }`}
            />
            <span
              className={`text-[10px] tracking-tight mt-0.5 ${
                isActive ? "font-bold text-[#0b1f3a]" : "font-medium"
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
