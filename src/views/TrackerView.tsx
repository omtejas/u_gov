import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Activity, Clock, CheckCircle2, AlertCircle, AlertTriangle, Calendar, ExternalLink } from "lucide-react";

export const TrackerView: React.FC = () => {
  const { applications, setActiveTab } = useGov();
  const [filter, setFilter] = useState<string>("all");

  const filteredApps = applications.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-600" />
            <span>U-TRACK Unified Application Radar</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status tracking across Central & State government portals with statutory SLA countdowns.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", label: "All Requests" },
            { id: "under_review", label: "Under Review" },
            { id: "action_required", label: "Action Required" },
            { id: "approved", label: "Approved" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                filter === item.id
                  ? "bg-[#0b1f3a] text-white shadow-2xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Applications List */}
      <div className="space-y-6">
        {filteredApps.map((app) => (
          <Card key={app.id} variant="default" padding="lg" className="space-y-5">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    {app.serviceName}
                  </h3>
                  <Badge
                    variant={
                      app.status === "approved"
                        ? "success"
                        : app.status === "action_required"
                        ? "warning"
                        : "info"
                    }
                    size="sm"
                    dot
                  >
                    {app.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                <span className="text-xs text-slate-500 block font-medium">
                  {app.department} • Ref: <strong className="text-slate-700 font-mono">{app.refNumber}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>
                  SLA Target: <strong>{new Date(app.slaTargetDate).toLocaleDateString()}</strong>
                </span>
              </div>
            </div>

            {/* Action Required Banner if status === action_required */}
            {app.status === "action_required" && app.actionRequiredText && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                    Citizen Action Required
                  </h5>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {app.actionRequiredText}
                  </p>
                </div>
                <Button variant="saffron" size="sm" className="shrink-0">
                  Book Slot
                </Button>
              </div>
            )}

            {/* Timeline progression */}
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Statutory Milestone Progression
              </h5>
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {app.timeline.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        step.completed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : step.current
                          ? "border-blue-600 bg-white ring-4 ring-blue-100"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {step.completed && <CheckCircle2 className="w-3 h-3" />}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            step.completed
                              ? "text-slate-900"
                              : step.current
                              ? "text-blue-700"
                              : "text-slate-400"
                          }`}
                        >
                          {step.title}
                        </span>
                        {step.timestamp && (
                          <span className="text-[10px] text-slate-400">
                            ({step.timestamp})
                          </span>
                        )}
                      </div>
                      {step.notes && (
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {step.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}

        {filteredApps.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <p className="text-sm font-semibold text-slate-700">No applications match this filter.</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => setActiveTab("services")}
            >
              Apply for a Service
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
