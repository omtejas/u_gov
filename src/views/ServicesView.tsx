import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ServiceCategory } from "../types";
import { Search, Sparkles, Filter, Clock, ArrowRight, CheckCircle2 } from "lucide-react";

export const ServicesView: React.FC = () => {
  const { services, openServiceModal, searchQuery, setSearchQuery, openGBot } = useGov();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories: { id: string; label: string }[] = [
    { id: "all", label: "All Services" },
    { id: "education", label: "Education & Scholarships" },
    { id: "agriculture", label: "Agriculture & Farmers" },
    { id: "transport", label: "Transport & Driving" },
    { id: "healthcare", label: "Healthcare & AYUSH" },
    { id: "identity", label: "Identity & Passport" },
    { id: "finance", label: "Finance & Tax" },
    { id: "welfare", label: "Certificates & Social Welfare" },
    { id: "housing", label: "Housing & PMAY" },
  ];

  const filteredServices = services.filter((s) => {
    const matchesCategory =
      selectedCategory === "all" || s.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.shortCode.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            National Public Services Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Discover, check eligibility, and apply for Central and State citizen services with zero paper friction.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="saffron"
            size="sm"
            onClick={() => openGBot("What government schemes am I eligible for?")}
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
          >
            AI Scheme Matcher
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
        {filteredServices.map((service) => (
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
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>SLA: {service.slaDays}d</span>
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
                  Required Credentials ({service.requiredDocs.length}):
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
                {service.fee === 0 ? "100% Free" : `Fee: ₹${service.fee}`}
              </span>
              <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                <span>View Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </Card>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-sm font-semibold text-slate-700">No public services match your filter.</p>
          <p className="text-xs text-slate-500 mt-1">Try clearing your search query or ask Bharat G-Bot for assistance.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("all");
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
};
