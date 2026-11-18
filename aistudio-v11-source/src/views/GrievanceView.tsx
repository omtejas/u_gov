import React, { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { CivicGrievance } from "../types";
import {
  ShieldAlert,
  ThumbsUp,
  MapPin,
  Plus,
  Clock,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";

const STATUS_FILTERS = ["All", "Open", "Assigned", "In-Progress", "Resolved"] as const;
const GRIEVANCE_CATEGORIES = [
  "Municipal Services",
  "Roads & Highways",
  "Scholarships & DBT",
  "Water & Sanitation",
  "Land & Revenue",
  "Civic Infrastructure",
];

export const GrievanceView: React.FC = () => {
  const [grievances, setGrievances] = useState<CivicGrievance[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(GRIEVANCE_CATEGORIES[0]);
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchGrievances = async (status?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const qs = status && status !== "All" ? `?status=${encodeURIComponent(status)}` : "";
      const res = await fetch(`/api/v1/grievances${qs}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Unable to load grievance board.");
        return;
      }
      setGrievances(Array.isArray(data.grievances) ? data.grievances : []);
    } catch {
      setErrorMsg("Network error while loading civic grievances.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchGrievances(statusFilter);
  }, [statusFilter]);

  const handleCreateGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !department.trim() || !location.trim() || !description.trim()) {
      setSubmitError("All grievance fields are required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/v1/grievances", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          department: department.trim(),
          location: location.trim(),
          description: description.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || "Could not record grievance.");
        return;
      }
      setGrievances((prev) => [data.grievance, ...prev]);
      setTitle("");
      setDepartment("");
      setLocation("");
      setDescription("");
      setIsNewOpen(false);
    } catch {
      setSubmitError("Network error while submitting grievance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBoost = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/grievances/${id}/upvote`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGrievances((prev) =>
          prev.map((g) =>
            g.id === id ? { ...g, upvotes: data.upvotes, upvotedByMe: Boolean(data.upvotedByMe) } : g
          )
        );
      }
    } catch {
      // ignore transient toggle error
    }
  };

  return (
    <div className="ugov-app-page ugov-grievance-page space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            <span>Civic Issue Board — Sandbox</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Lodge and endorse civic grievance tickets stored in the U-GOV persistent ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchGrievances(statusFilter)}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSubmitError(null);
              setIsNewOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Lodge Issue
          </Button>
        </div>
      </div>

      {/* Honesty Notice */}
      <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 text-xs text-slate-700 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#174EA6] shrink-0 mt-0.5" />
        <span>
          <strong>Prototype Scope:</strong> Tickets created here persist in the U-GOV backend store and audit log for demonstration. They are not transmitted externally to CPGRAMS or municipal ticketing systems.
        </span>
      </div>

      {/* Status Filter Strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? "bg-[#174EA6] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">
          {grievances.length} ticket{grievances.length === 1 ? "" : "s"} shown
        </span>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* List of Grievances */}
      <div className="space-y-4">
        {isLoading ? (
          <Card variant="default" padding="lg">
            <p className="text-xs text-slate-500 text-center py-6">Loading civic grievance ledger...</p>
          </Card>
        ) : grievances.length === 0 ? (
          <Card variant="default" padding="lg">
            <p className="text-xs text-slate-500 text-center py-6">
              No civic grievance tickets match the selected filter.
            </p>
          </Card>
        ) : (
          grievances.map((g) => (
            <Card key={g.id} variant="default" padding="lg" className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-slate-700 tabular-nums">
                    {g.ticketId}
                  </span>
                  <Badge
                    variant={
                      g.status === "Resolved"
                        ? "success"
                        : g.status === "In-Progress"
                        ? "info"
                        : "warning"
                    }
                    size="sm"
                  >
                    {g.status}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {g.category}
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1 tabular-nums">
                  <Clock className="w-3 h-3" />
                  <span>Filed {new Date(g.filedAt).toLocaleDateString()}</span>
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">{g.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{g.description}</p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-50">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-slate-700">{g.department}</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <MapPin className="w-3 h-3 text-red-500" />
                    <span>{g.location}</span>
                  </span>
                </div>

                <button
                  onClick={() => void handleBoost(g.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto tabular-nums whitespace-nowrap ${
                    g.upvotedByMe
                      ? "bg-[#174EA6] text-white border-[#174EA6]"
                      : "bg-slate-50 text-slate-800 hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{g.upvotedByMe ? "Endorsed" : "Endorse"} ({g.upvotes})</span>
                </button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* New Grievance Modal */}
      <Modal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="Lodge Civic Issue"
        subtitle="Persisted in your local U-GOV ledger; not submitted to external CPGRAMS authorities."
        maxWidth="md"
      >
        <form onSubmit={handleCreateGrievance} className="space-y-4">
          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <Input
            label="Issue Summary"
            placeholder="e.g. Broken water pipeline, scholarship delay, road pothole"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide">
              Issue Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
            >
              {GRIEVANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Target Department / Authority"
            placeholder="e.g. Municipal Corporation, PWD, Revenue Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />

          <Input
            label="Exact Location / Ward / District"
            placeholder="e.g. Ward 12, Shivaji Nagar, Pune"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 tracking-wide">
              Detailed Description & Impact
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, dates, and how citizens are affected..."
              className="w-full rounded-md border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsNewOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Save Civic Issue"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
