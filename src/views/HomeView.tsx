import React from "react";
import { useGov } from "../context/GovContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  Search,
  Sparkles,
  ShieldCheck,
  FolderLock,
  Activity,
  ArrowRight,
  GraduationCap,
  Sprout,
  Car,
  HeartPulse,
  Landmark,
  Building,
} from "lucide-react";

export const HomeView: React.FC = () => {
  const { services, openServiceModal, setActiveTab, openGBot, setSearchQuery } = useGov();

  const featuredServices = services.filter((s) => s.featured || s.isPopular).slice(0, 6);

  const categories = [
    { id: "education", label: "Scholarships & Education", icon: GraduationCap, color: "text-blue-600 bg-blue-50" },
    { id: "agriculture", label: "Farmers & Agriculture", icon: Sprout, color: "text-emerald-600 bg-emerald-50" },
    { id: "transport", label: "Transport & Driving", icon: Car, color: "text-amber-600 bg-amber-50" },
    { id: "healthcare", label: "Health & Ayushman", icon: HeartPulse, color: "text-rose-600 bg-rose-50" },
    { id: "welfare", label: "Certificates & Welfare", icon: Landmark, color: "text-indigo-600 bg-indigo-50" },
    { id: "housing", label: "Housing & PMAY", icon: Building, color: "text-cyan-600 bg-cyan-50" },
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative rounded-3xl bg-[#0b1f3a] text-white p-6 sm:p-12 overflow-hidden shadow-xl border border-blue-900/60">
        {/* Ambient sovereign gradients */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="sovereign-tricolor-bar absolute inset-x-0 top-0" />

        <div className="relative z-10 max-w-3xl space-y-6">
          {/* DPI Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold tracking-wide text-amber-200 uppercase text-[11px]">
              National Digital Public Infrastructure • Smart India Hackathon 2026
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
            One Citizen. One Identity. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-amber-200">
              Connected Governance.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Access 240+ Central and State citizen schemes, verified DigiVault credentials, and statutory SLA application tracking via one high-assurance sovereign public gateway.
          </p>

          {/* Natural Language Citizen Search Bar */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="What service or scheme do you need? (e.g., scholarship, driving licence, PM Kisan)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearchQuery((e.target as HTMLInputElement).value);
                    setActiveTab("services");
                  }
                }}
                className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 rounded-2xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-lg"
              />
            </div>
            <Button
              variant="saffron"
              size="lg"
              onClick={() => setActiveTab("services")}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Explore Hub
            </Button>
          </div>

          {/* Quick Guidance Prompt */}
          <div className="pt-1 flex items-center gap-2 text-xs text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Unsure which department or scheme?</span>
            <button
              onClick={() => openGBot("What government schemes am I eligible for?")}
              className="text-amber-300 hover:underline font-bold cursor-pointer"
            >
              Ask Bharat G-Bot AI →
            </button>
          </div>
        </div>
      </div>

      {/* Flagship Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card variant="hoverable" padding="lg" onClick={() => setActiveTab("documents")}>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <FolderLock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            U-DOCS Digital Vault
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Store and share verified government documents with granular consent control and instant revocability.
          </p>
        </Card>

        <Card variant="hoverable" padding="lg" onClick={() => setActiveTab("tracker")}>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            U-TRACK Application Radar
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            End-to-end statutory SLA tracking across Central and State departments with transparent timelines.
          </p>
        </Card>

        <Card variant="hoverable" padding="lg" onClick={() => openGBot()}>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            U-AI Bharat G-Bot
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Multilingual public services assistant grounded in authoritative government regulations.
          </p>
        </Card>
      </div>

      {/* Service Categories Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Browse by Citizen Need
            </h2>
            <p className="text-xs text-slate-500">
              Citizen-centric classification regardless of internal departmental structures
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("services")}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            All 240+ Services
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={() => {
                  setSearchQuery(cat.id);
                  setActiveTab("services");
                }}
                className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center gap-2 group"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {cat.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Featured Services */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Flagship Sovereign Services
            </h2>
            <p className="text-xs text-slate-500">
              Most requested public welfare and statutory services with instant DigiVault integration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuredServices.map((service) => (
            <Card
              key={service.id}
              variant="hoverable"
              padding="md"
              className="flex flex-col justify-between"
              onClick={() => openServiceModal(service)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="info" size="sm">
                    {service.shortCode}
                  </Badge>
                  <span className="text-[11px] font-semibold text-slate-500">
                    SLA: {service.slaDays} Days
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-blue-600">
                    {service.name}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                    {service.ministry}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {service.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700">
                  {service.fee === 0 ? "Free of Charge" : `Fee: ₹${service.fee}`}
                </span>
                <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
