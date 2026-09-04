import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { ShieldAlert, ThumbsUp, MapPin, Plus, Clock, CheckCircle2, MessageSquare } from "lucide-react";

export const GrievanceView: React.FC = () => {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const [grievances, setGrievances] = useState([
    {
      id: "grv-1",
      ticketId: "CPGRAMS-2026-99214",
      title: "Contaminated Municipal Tap Water Supply in Ward 14",
      department: "Municipal Corporation & Public Health Engineering",
      location: "Kothrud, Pune, Maharashtra",
      status: "In-Progress",
      filedAt: "2 days ago",
      upvotes: 142,
      description: "Tap water has high turbidity and chemical odor for the past 4 days. Sample collected by local civic lab.",
    },
    {
      id: "grv-2",
      ticketId: "CPGRAMS-2026-88120",
      title: "Broken Streetlights along National Highway 48 Service Road",
      department: "National Highways Authority of India (NHAI)",
      location: "Warje Bypass, Pune",
      status: "Assigned",
      filedAt: "5 days ago",
      upvotes: 89,
      description: "12 consecutive streetlights non-operational, causing dangerous blindspots for two-wheelers at night.",
    },
    {
      id: "grv-3",
      ticketId: "CPGRAMS-2026-77312",
      title: "Delay in DBT Scholarship Disbursement after College Approval",
      department: "Social Justice & Special Assistance Department",
      location: "District Collectorate, Haveli",
      status: "Resolved",
      filedAt: "2 weeks ago",
      upvotes: 310,
      description: "Scholarship sanctioned by college dean but PFMS payment file was stuck at treasury node. Resolved and credited.",
    },
  ]);

  const handleCreateGrievance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTicket = {
      id: `grv-${Date.now()}`,
      ticketId: `CPGRAMS-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      title: title.trim(),
      department: department.trim() || "District Grievance Redressal Cell",
      location: location.trim() || "Pune District",
      status: "Open",
      filedAt: "Just now",
      upvotes: 1,
      description: description.trim() || "Filed via U-GOV Sovereign Grievance Engine",
    };

    setGrievances([newTicket, ...grievances]);
    setTitle("");
    setDepartment("");
    setLocation("");
    setDescription("");
    setIsNewOpen(false);
  };

  const handleBoost = (id: string) => {
    setGrievances((prev) =>
      prev.map((g) => (g.id === id ? { ...g, upvotes: g.upvotes + 1 } : g))
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-600" />
            <span>Civic Issue Solver & CPGRAMS Community Board</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            File statutory citizen grievances with 30-day time-bound SLA resolution under DARPG guidelines.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsNewOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          File New Grievance
        </Button>
      </div>

      {/* Grid of Grievances */}
      <div className="space-y-4">
        {grievances.map((g) => (
          <Card key={g.id} variant="default" padding="lg" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-600">
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
                  dot
                >
                  {g.status}
                </Badge>
              </div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Filed {g.filedAt}</span>
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {g.title}
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {g.description}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-50">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-700">
                  {g.department}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span>{g.location}</span>
                </span>
              </div>

              <button
                onClick={() => handleBoost(g.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200 font-bold transition-colors cursor-pointer self-start sm:self-auto"
              >
                <ThumbsUp className="w-3.5 h-3.5 text-amber-600" />
                <span>Citizen Boost ({g.upvotes})</span>
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* New Grievance Modal */}
      <Modal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        title="File Statutory Public Grievance"
        subtitle="Forwarded directly to the designated Central/State Nodal Grievance Officer"
        maxWidth="md"
      >
        <form onSubmit={handleCreateGrievance} className="space-y-4">
          <Input
            label="Issue Summary"
            placeholder="e.g. Broken water pipeline, scholarship delay, road pothole"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Input
            label="Target Department / Authority"
            placeholder="e.g. Municipal Corporation, PWD, Revenue Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />

          <Input
            label="Exact Location / Ward / District"
            placeholder="e.g. Ward 12, Shivaji Nagar, Pune"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
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
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setIsNewOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="saffron" size="sm" type="submit">
              Submit Grievance
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
