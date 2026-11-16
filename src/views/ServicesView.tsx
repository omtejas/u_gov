import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Search, Sparkles, Filter, Clock, ArrowRight, SlidersHorizontal, X, Landmark, FileCheck2 } from "lucide-react";

export const ServicesView: React.FC = () => {
  const { services, openServiceModal, searchQuery, setSearchQuery, openGBot } = useGov();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"relevance" | "name" | "processing" | "fee">("relevance");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "prototype" | "maintenance">("all");
  const categories = [
    { id: "all", label: "All services" }, { id: "education", label: "Education" },
    { id: "agriculture", label: "Agriculture" }, { id: "transport", label: "Transport" },
    { id: "healthcare", label: "Healthcare" }, { id: "identity", label: "Identity" },
    { id: "finance", label: "Finance & tax" }, { id: "revenue", label: "Certificates" },
    { id: "welfare", label: "Social welfare" }, { id: "housing", label: "Housing" },
    { id: "employment", label: "Employment" }, { id: "civic", label: "Civic" },
  ];
  const filteredServices = services.filter((service) => {
    const matchesCategory = selectedCategory === "all" || service.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const searchableText = [service.name, service.description, service.department, service.ministry, service.shortCode, service.category, ...(service.requiredDocs || [])].join(" ").toLowerCase();
    const normalizedStatus = String(service.status || "available").toLowerCase();
    const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter;
    return matchesCategory && matchesStatus && (!q || searchableText.includes(q));
  });
  const sortedServices = [...filteredServices].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "processing") return a.slaDays - b.slaDays;
    if (sortBy === "fee") return a.fee - b.fee;
    return 0;
  });
  const resetFilters = () => { setSearchQuery(""); setSelectedCategory("all"); setSortBy("relevance"); setStatusFilter("all"); };

  return (
    <div className="space-y-7 sm:space-y-9">
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#123B7A] to-[#174EA6] p-6 text-white shadow-[0_16px_42px_rgba(23,78,166,.14)] sm:p-8">
        <div className="sovereign-tricolor-bar absolute inset-x-0 top-0" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#F5C518]/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-blue-50"><Landmark size={14} className="text-[#F5C518]" /> U-GOV public service directory</div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Find the service you need.</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">Explore the services listed in this prototype, understand their requirements and open a guided demo application.</p>
          </div>
          <Button variant="saffron" size="md" onClick={() => openGBot("Help me discover a public service based on what I need.")} leftIcon={<Sparkles size={16} />}>Ask G-Bot to help</Button>
        </div>
        <div className="relative mt-6 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-lg sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3">
            <Search size={19} className="shrink-0 text-[#174EA6]" />
            <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search a scheme, service, ministry or document…" className="w-full bg-transparent py-3 text-sm text-[#171717] outline-none placeholder:text-slate-400" aria-label="Search service catalogue" />
            {searchQuery && <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={16} /></button>}
          </div>
          <div className="flex items-center justify-center gap-2 rounded-xl bg-[#174EA6] px-5 py-3 text-sm font-bold text-white sm:min-w-36"><span>{sortedServices.length}</span><span>matches</span></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(25,48,82,.04)] sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-display text-base font-bold text-[#171717]">Browse categories</h2><p className="mt-0.5 text-xs text-slate-500">Choose a topic to narrow down the catalogue.</p></div>
          <button onClick={resetFilters} className="text-xs font-semibold text-[#174EA6] hover:underline">Reset all filters</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${selectedCategory === category.id ? "border-[#174EA6] bg-[#174EA6] text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-[#174EA6]/40 hover:bg-blue-50"}`}>{category.label}</button>)}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#16834A]">Service catalogue</p><h2 className="mt-1 font-display text-xl font-extrabold text-[#171717]">Available in this demo</h2><p className="mt-1 text-xs text-slate-500" aria-live="polite">Showing {sortedServices.length} of {services.length} catalogue entries</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><SlidersHorizontal size={14} /> Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="max-w-32 bg-transparent font-semibold text-slate-700 outline-none"><option value="all">All entries</option><option value="available">Catalogue</option><option value="prototype">Sandbox</option><option value="maintenance">Maintenance</option></select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><Filter size={14} /> Sort
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="max-w-36 bg-transparent font-semibold text-slate-700 outline-none"><option value="relevance">Default</option><option value="name">Name</option><option value="processing">Processing estimate</option><option value="fee">Listed fee</option></select>
            </label>
          </div>
        </div>

        {sortedServices.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedServices.map((service) => (
            <Card key={service.id} variant="hoverable" padding="none" className="group flex h-full flex-col">
              <button onClick={() => openServiceModal(service)} className="flex h-full flex-col p-5 text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="info" size="sm">{service.shortCode}</Badge>
                  <Badge variant={service.status === "available" ? "success" : service.status === "maintenance" ? "warning" : "info"} size="sm">{service.status === "available" ? "Catalogue entry" : service.status === "maintenance" ? "Maintenance" : "Sandbox"}</Badge>
                </div>
                <h3 className="mt-4 font-display text-base font-bold leading-6 text-[#171717] group-hover:text-[#174EA6]">{service.name}</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">{service.ministry}</p>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
                <div className="mt-4 rounded-xl bg-[#F6F8FC] p-3">
                  <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-600">Requirements listed</span><span className="font-bold text-[#174EA6]">{(service.requiredDocs || []).length}</span></div>
                  <div className="mt-2 flex flex-wrap gap-1.5">{(service.requiredDocs || []).slice(0, 2).map((doc, i) => <span key={i} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">{doc}</span>)}{(service.requiredDocs || []).length > 2 && <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">+{service.requiredDocs.length - 2} more</span>}</div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div><p className="text-[10px] text-slate-400">Catalogue estimate</p><p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-slate-700"><Clock size={13} className="text-[#174EA6]" />{service.slaDays} days</p></div>
                  <div className="text-right"><p className="text-[10px] text-slate-400">Fee listed</p><p className="mt-0.5 text-xs font-bold text-[#16834A]">{service.fee === 0 ? "No fee" : `₹${service.fee}`}</p></div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF1FC] text-[#174EA6] transition group-hover:bg-[#174EA6] group-hover:text-white"><ArrowRight size={17} /></span>
                </div>
              </button>
            </Card>
          ))}
        </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#174EA6]"><Search size={22} /></span><h3 className="mt-4 font-display text-base font-bold text-[#171717]">No matching services</h3><p className="mt-1 text-sm text-slate-500">Try a different keyword or clear your filters.</p><Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>Clear filters</Button></div>}
      </section>

      <p className="rounded-xl border border-[#F2E5A8] bg-[#FFF9DF] px-4 py-3 text-xs leading-6 text-[#705600]"><FileCheck2 size={14} className="mr-1.5 inline" /> Fees, processing estimates and document requirements are prototype catalogue entries. They are not live government determinations; verify current rules with the issuing department.</p>
    </div>
  );
};
