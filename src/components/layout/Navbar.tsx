import React from "react";
import { useGov } from "../../context/GovContext";
import { useTranslation } from "../../hooks/useTranslation";
import { Home, Layers, LayoutDashboard, FolderLock, Activity, ShieldAlert, ShieldCheck, Server, Sparkles, Bell, Database, Shield, HelpCircle, Compass, Briefcase, ArrowUpRight } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, mode, setMode, openGBot, roles } = useGov();
  const { unreadCount } = useNotifications(); const { t } = useTranslation();
  const navItems = [
    {id:"home",label:t("nav.home"),icon:Home},{id:"services",label:t("nav.services"),icon:Layers},
    {id:"dashboard",label:t("nav.dashboard"),icon:LayoutDashboard},{id:"documents",label:t("nav.documents"),icon:FolderLock},
    {id:"tracker",label:t("nav.applications"),icon:Activity},{id:"whereami",label:t("nav.whereami"),icon:Compass},
    {id:"consent",label:t("nav.consent"),icon:Shield},{id:"notifications",label:t("nav.notifications"),icon:Bell,badge:unreadCount>0?unreadCount:undefined},
    {id:"mydata",label:t("nav.mydata"),icon:Database},{id:"faq",label:t("nav.faq"),icon:HelpCircle},
    {id:"grievance",label:t("nav.grievance"),icon:ShieldAlert},{id:"audit",label:t("nav.audit"),icon:ShieldCheck}
  ];
  if(mode==="admin"||mode==="official"||roles.includes("OFFICIAL")||roles.includes("ADMIN")) navItems.push({id:"officer",label:t("nav.officer"),icon:Briefcase});
  if(mode==="admin"||mode==="official"||roles.includes("ADMIN")) navItems.push({id:"admin",label:t("nav.admin"),icon:Server});
  return (
    <nav className="fixed top-[80px] w-full z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 overflow-x-auto py-2.5 scrollbar-none">
          {navItems.map(item=>{const Icon=item.icon;const active=activeTab===item.id;return <button key={item.id} onClick={()=>setActiveTab(item.id)} className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-bold shrink-0 transition-all cursor-pointer ${active?"bg-[#EAF1FC] text-[#174EA6]":"text-slate-500 hover:text-[#101828] hover:bg-slate-50"}`}><Icon className={`w-3.5 h-3.5 ${active?"text-[#174EA6]":"text-slate-400"}`}/><span>{item.label}</span>{(item as any).badge&&<span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-[#D62828] text-white text-[9px] font-bold flex items-center justify-center px-1">{(item as any).badge>9?"9+":(item as any).badge}</span>}</button>;})}
        </div>
        <div className="hidden lg:flex items-center gap-2 shrink-0 py-1.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-md text-[10px] font-bold"><button onClick={()=>setMode("citizen")} className={`px-2.5 py-1.5 rounded ${mode==="citizen"?"bg-white text-slate-900 shadow-sm":"text-slate-500"}`}>Citizen</button><button onClick={()=>setMode("admin")} className={`px-2.5 py-1.5 rounded ${mode==="admin"?"bg-white text-[#174EA6] shadow-sm":"text-slate-500"}`}>U-SYS Admin</button></div>
          <button onClick={()=>openGBot()} className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#174EA6] text-white text-[11px] font-bold hover:bg-[#123B7A]"><Sparkles className="w-3.5 h-3.5 text-[#F5C518]"/>Ask G-Bot<ArrowUpRight size={13}/></button>
        </div>
      </div>
    </nav>
  );
};
