import React from "react";
import { useGov } from "../context/GovContext";
import { Search, Sparkles, ShieldCheck, FolderLock, Activity, ArrowRight, GraduationCap, Sprout, Car, HeartPulse, Landmark, Building2, FileCheck2, Globe2 } from "lucide-react";

export const HomeView: React.FC = () => {
  const { services, openServiceModal, setActiveTab, openGBot, setSearchQuery } = useGov();
  const featuredServices = services.filter((s) => s.featured || s.isPopular).slice(0, 6);
  const categories = [
    { id: "education", label: "Education & scholarships", icon: GraduationCap, tone: "bg-blue-50 text-[#174EA6]" },
    { id: "agriculture", label: "Farmers & agriculture", icon: Sprout, tone: "bg-green-50 text-[#16834A]" },
    { id: "transport", label: "Transport & driving", icon: Car, tone: "bg-yellow-50 text-[#8A6500]" },
    { id: "healthcare", label: "Health & wellbeing", icon: HeartPulse, tone: "bg-red-50 text-[#D62828]" },
    { id: "welfare", label: "Certificates & welfare", icon: Landmark, tone: "bg-blue-50 text-[#174EA6]" },
    { id: "housing", label: "Housing & homes", icon: Building2, tone: "bg-green-50 text-[#16834A]" },
  ];
  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#123B7A] via-[#174EA6] to-[#2466BC] px-5 py-9 text-white shadow-[0_20px_55px_rgba(23,78,166,.18)] sm:px-10 sm:py-14">
        <div className="sovereign-tricolor-bar absolute inset-x-0 top-0" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#F5C518]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 right-1/4 h-72 w-72 rounded-full bg-[#16834A]/20 blur-3xl" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-blue-50 backdrop-blur">
            <ShieldCheck size={15} className="text-[#F5C518]" /> A simpler way to access public services
          </div>
          <div className="space-y-3">
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
              Government services,<br /><span className="text-[#F5D957]">made simpler.</span>
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-blue-100 sm:text-base">
              Discover services, understand what you need, keep track of applications and manage your documents in one convenient place.
            </p>
          </div>
          <div className="flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row">
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
              <Search size={20} className="shrink-0 text-[#174EA6]" />
              <input
                type="text"
                aria-label="Search public services"
                placeholder="What service are you looking for?"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearchQuery((e.target as HTMLInputElement).value);
                    setActiveTab("services");
                  }
                }}
                className="w-full bg-transparent py-3 text-sm text-[#171717] outline-none placeholder:text-slate-400"
              />
            </div>
            <button onClick={() => setActiveTab("services")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174EA6] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#123B7A]">
              Explore services <ArrowRight size={16} />
            </button>
          </div>
          <button onClick={() => openGBot("Help me find the right government service.")} className="inline-flex items-center gap-2 rounded-full px-1 py-1 text-sm font-semibold text-white transition hover:text-[#F5D957]">
            <Sparkles size={17} className="text-[#F5C518]" /> Not sure where to start? Ask Bharat G-Bot <ArrowRight size={14} />
          </button>
        </div>
        <div className="relative z-10 mt-9 grid max-w-3xl grid-cols-3 gap-2 border-t border-white/15 pt-5 sm:gap-6">
          <div><p className="font-display text-xl font-extrabold sm:text-2xl">{services.length}</p><p className="mt-1 text-[10px] text-blue-100 sm:text-xs">Services in this demo</p></div>
          <div><p className="font-display text-xl font-extrabold sm:text-2xl">One</p><p className="mt-1 text-[10px] text-blue-100 sm:text-xs">Connected experience</p></div>
          <div><p className="font-display text-xl font-extrabold sm:text-2xl">24/7</p><p className="mt-1 text-[10px] text-blue-100 sm:text-xs">Self-service access</p></div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: "Your digital document vault", text: "Keep your demo documents organised and manage access permissions.", icon: FolderLock, tone: "bg-blue-50 text-[#174EA6]", action: () => setActiveTab("documents"), link: "Open DigiVault" },
          { title: "Track your applications", text: "See application progress and identify actions that may need your attention.", icon: Activity, tone: "bg-green-50 text-[#16834A]", action: () => setActiveTab("tracker"), link: "View tracker" },
          { title: "Guidance when you need it", text: "Ask questions in natural language and explore relevant public-service information.", icon: Sparkles, tone: "bg-yellow-50 text-[#8A6500]", action: () => openGBot(), link: "Chat with G-Bot" },
        ].map((item) => {
          const Icon = item.icon;
          return <button key={item.title} onClick={item.action} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_6px_24px_rgba(25,48,82,.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg sm:p-6">
            <span className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}><Icon size={21} /></span>
            <h2 className="font-display text-base font-bold text-[#171717]">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#174EA6]">{item.link}<ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
          </button>;
        })}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#174EA6]">Find what you need</p><h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#171717]">Browse by citizen need</h2><p className="mt-1 text-sm text-slate-500">Start with a topic. We’ll help you find the right service.</p></div>
          <button onClick={() => setActiveTab("services")} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-[#174EA6] transition hover:bg-blue-50 sm:self-auto">View all services <ArrowRight size={14} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return <button key={cat.id} onClick={() => { setSearchQuery(cat.id); setActiveTab("services"); }} className="group flex min-h-32 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#174EA6]/30 hover:shadow-md">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.tone}`}><Icon size={20} /></span>
              <span className="mt-4 text-xs font-bold leading-5 text-slate-800">{cat.label}</span>
            </button>;
          })}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#16834A]">Popular in the catalogue</p><h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-[#171717]">Explore featured services</h2><p className="mt-1 text-sm text-slate-500">Review the information available in this U-GOV prototype.</p></div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featuredServices.map((service) => (
            <button key={service.id} onClick={() => openServiceModal(service)} className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_6px_24px_rgba(25,48,82,.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
              <div className="flex w-full items-center justify-between gap-2"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-[#174EA6]">{service.shortCode}</span><span className="text-[11px] font-medium text-slate-500">Typical SLA: {service.slaDays} days</span></div>
              <h3 className="mt-4 font-display text-base font-bold leading-6 text-[#171717] group-hover:text-[#174EA6]">{service.name}</h3>
              <p className="mt-1 text-xs font-medium text-slate-500">{service.ministry}</p>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16834A]"><FileCheck2 size={14} />{service.fee === 0 ? "No fee listed" : `Fee listed: ₹${service.fee}`}</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#174EA6]">Details <ArrowRight size={14} /></span>
              </div>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-[#D9E5F5] bg-[#EEF4FC] p-4 text-xs leading-6 text-[#27466F]"><Globe2 size={15} className="mr-1 inline" /> Service details shown here are prototype catalogue information. Always confirm current rules, fees and eligibility with the issuing department.</div>
      </section>
    </div>
  );
};
