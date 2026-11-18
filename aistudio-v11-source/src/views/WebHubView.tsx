import React, { useEffect, useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import {
  Globe,
  ExternalLink,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";

interface DirectoryPortal {
  id: string;
  name: string;
  category: string;
  ministry: string;
  url: string;
  description: string;
  verifiedOfficial: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export const WebHubView: React.FC = () => {
  const { roles } = useGov();
  const isAdmin = roles.includes("ADMIN");

  const [portals, setPortals] = useState<DirectoryPortal[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Admin Add Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Citizen Services");
  const [newMinistry, setNewMinistry] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadPortals = async (cat: string, query: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (cat !== "All") params.set("category", cat);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/v1/webhub${params.toString() ? `?${params.toString()}` : ""}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to load Government Web Hub directory.");
        return;
      }
      setPortals(Array.isArray(data.portals) ? data.portals : []);
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
    } catch {
      setErrorMsg("Network error while loading official portals.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPortals(selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery]);

  const handleAddPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/webhub", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory.trim(),
          ministry: newMinistry.trim() || "Government of India",
          url: newUrl.trim(),
          description: newDescription.trim(),
          isFeatured: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || "Could not add portal.");
        return;
      }
      setIsAddOpen(false);
      setNewName("");
      setNewMinistry("");
      setNewUrl("");
      setNewDescription("");
      await loadPortals(selectedCategory, searchQuery);
    } catch {
      setSubmitError("Network error while saving portal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHostname = (rawUrl: string) => {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return rawUrl;
    }
  };

  return (
    <div className="ugov-app-page ugov-webhub-page space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Globe className="w-6 h-6 text-[#174EA6]" />
            <span>Government Web Hub</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Curated directory of official Government of India portals, national registries, and state citizen gateways.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-500 tabular-nums whitespace-nowrap">
            {portals.length} Official Portal{portals.length === 1 ? "" : "s"}
          </span>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setSubmitError(null);
                setIsAddOpen(true);
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Official Portal
            </Button>
          )}
        </div>
      </div>

      {/* External Handoff Disclosure */}
      <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60 text-xs text-slate-700 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#174EA6] shrink-0 mt-0.5" />
        <span>
          <strong>External Portal Boundary:</strong> Launching a portal opens the external government website in a new browser tab. U-GOV never shares your session cookie or vault files automatically across external domains.
        </span>
      </div>

      {/* Search & Category Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {["All", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-[#174EA6] text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search portal name, ministry, domain..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-xs text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Portal Grid */}
      {isLoading ? (
        <Card variant="default" padding="lg">
          <p className="text-xs text-slate-500 text-center py-8">Loading curated national portals...</p>
        </Card>
      ) : portals.length === 0 ? (
        <Card variant="default" padding="lg">
          <p className="text-xs text-slate-500 text-center py-8">
            No official portals matched your search criteria.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portals.map((portal) => (
            <Card key={portal.id} variant="default" padding="lg" className="flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#174EA6]">
                    {portal.category}
                  </span>
                  {portal.verifiedOfficial && (
                    <Badge variant="success" size="sm">
                      .GOV / .NIC
                    </Badge>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-snug">
                    {portal.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    {portal.ministry}
                  </p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{portal.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] font-mono text-slate-500 truncate">
                  {getHostname(portal.url)}
                </span>
                <a
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#174EA6] text-white text-xs font-bold hover:bg-[#0F397E] transition-colors shrink-0 whitespace-nowrap"
                >
                  <span>Open Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Admin Add Portal Modal */}
      {isAdmin && (
        <Modal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          title="Register Official Portal"
          subtitle="Adds a curated HTTPS official portal to the Government Web Hub"
          maxWidth="md"
        >
          <form onSubmit={handleAddPortal} className="space-y-4">
            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <Input
              label="Portal Name"
              placeholder="e.g. National Portal of India"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Category"
                placeholder="e.g. Citizen Services"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                required
              />
              <Input
                label="Ministry / Department"
                placeholder="e.g. MeitY"
                value={newMinistry}
                onChange={(e) => setNewMinistry(e.target.value)}
                required
              />
            </div>

            <Input
              label="Official HTTPS URL"
              type="url"
              placeholder="https://www.india.gov.in"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 tracking-wide">
                Description
              </label>
              <textarea
                rows={3}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Concise summary of official public services accessible on this portal..."
                className="w-full rounded-md border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                <span>{isSubmitting ? "Saving..." : "Publish to Web Hub"}</span>
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
