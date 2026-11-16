import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
 import { Search, Sparkles, Filter, Clock, ArrowRight } from "lucide-react";

export const ServicesView: React.FC = () => {
  const { services, openServiceModal, searchQuery, setSearchQuery, openGBot } = useGov();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"relevance" | "name" | "processing" | "fee">("relevance");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "prototype" | "maintenance">("all");

  const categories: { id: string; label: string }[] = [
    { id: "all", label: "All Services" },
    { id: "education", label: "Education & Scholarships" },
    { id: "agriculture", label: "Agriculture & Farmers" },
    { id: "transport", label: "Transport & Driving" },
    { id: "healthcare", label: "Healthcare & AYUSH" },
    { id: "identity", label: "Identity & Passport" },
    { id: "finance", label: "Finance & Tax" },
    { id: "revenue", label: "Revenue & Certificates" },
    { id: "welfare", label: "Social Welfare" },
    { id: "housing", label: "Housing & PMAY" },
    { id: "employment", label: "Employment & Skills" },
    { id: "civic", label: "Civic Services" },
  ];

  const filteredServices = services.filter((s) => {
    const matchesCategory =
      selectedCategory === "all" || s.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const searchableText = [
      s.name, s.description, s.department, s.ministry, s.shortCode, s.category,
      ...(s.requiredDocs || []),
    ].join(" ").toLowerCase();
    const normalizedStatus = String(s.status || "available").toLowerCase();
    const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter;
    return matchesCategory && matchesStatus && (!q || searchableText.includes(q));
  });

  const sortedServices = [...filteredServices].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "processing") return a.slaDays - b.slaDays;
    if (sortBy === "fee") return a.fee - b.fee;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            U-GOV Service Catalogue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Explore prototype service entries, review listed requirements and continue through the U-GOV demo workflow. Confirm current rules with the issuing department.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="saffron"
            size="sm"
            onClick={() => openGBot("Help me discover relevant services in the U-GOV prototype catalogue.")}
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
          >
            Ask G-Bot about services
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by keyword, scheme name, or ministry..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-500" aria-live="polite">
          Showing <strong className="text-slate-800">{sortedServices.length}</strong> of {services.length} catalogue entries
        </p>
        <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700"
          >
            <option value="all">All entries</option>
            <option value="available">Catalogue entries</option>
            <option value="prototype">Sandbox prototypes</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <Filter className="w-3.5 h-3.5" />
          Sort by
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="relevance">Default order</option>
            <option value="name">Service name</option>
            <option value="processing">Shortest catalogue estimate</option>
            <option value="fee">Lowest listed fee</option>
          </select>
        </label>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#0b1f3a] text-white shadow-2xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedServices.map((service) => (
          <Card
            key={service.id}
            variant="hoverable"
            padding="md"
            className="flex flex-col justify-between"
            onClick={() => openServiceModal(service)}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="info" size="sm">{service.shortCode}</Badge>
                  <Badge
                    variant={service.status === "available" ? "success" : service.status === "maintenance" ? "warning" : "info"}
                    size="sm"
                  >
                    {service.status === "available" ? "Catalogue entry" : service.status === "maintenance" ? "Maintenance" : "Sandbox"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Catalogue estimate: {service.slaDays}d</span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {service.name}
                </h3>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                  {service.ministry}
                </span>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {service.description}
              </p>

              {/* Requirements summary */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                  Requirements listed in catalogue ({service.requiredDocs.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {service.requiredDocs.slice(0, 3).map((d, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-medium truncate max-w-[150px]"
                    >
                      {d}
                    </span>
                  ))}
                  {service.requiredDocs.length > 3 && (
                    <span className="px-1.5 py-0.5 text-[10px] text-slate-400 font-bold">
                      +{service.requiredDocs.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700">
                {service.fee === 0 ? "No fee listed in prototype" : `Prototype fee: ₹${service.fee}`}
              </span>
              <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>View Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      {sortedServices.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-sm font-semibold text-slate-700">No catalogue entries match your filter.</p>
          <p className="text-xs text-slate-500 mt-1">Try clearing your search query or ask Bharat G-Bot for assistance.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
              setSortBy("relevance");
              setStatusFilter("all");
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
};
