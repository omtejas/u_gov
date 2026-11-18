import React, { useEffect, useState } from "react";
import { useGov } from "../context/GovContext";
import { useTranslation } from "../hooks/useTranslation";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import {
  Server,
  Activity,
  ShieldCheck,
  Database,
  CheckCircle2,
  Cpu,
  Globe,
  RefreshCw,
  Plus,
  Edit,
  Layers,
  Search,
  Filter,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Building2,
} from "lucide-react";
import { GovService } from "../types";

export const AdminView: React.FC = () => {
  const { services, applications, auditLogs, refreshServices } = useGov();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"telemetry" | "builder">("telemetry");
  const [aiHealth, setAiHealth] = useState<{
    provider?: string;
    providerLabel?: string;
    mode?: string;
    liveAI?: boolean;
    notice?: string;
    timestamp?: string;
  } | null>(null);

  const refreshAIHealth = async () => {
    try {
      const response = await fetch("/api/v1/ai/health", { credentials: "include" });
      if (!response.ok) throw new Error("AI health check failed");
      setAiHealth(await response.json());
    } catch {
      setAiHealth(null);
    }
  };

  useEffect(() => {
    void refreshAIHealth();
  }, []);

  // Service Builder State
  const [localServices, setLocalServices] = useState<GovService[]>(services);
  useEffect(() => {
    setLocalServices(services);
  }, [services]);

  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<GovService | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formMinistry, setFormMinistry] = useState("");
  const [formCategory, setFormCategory] = useState("education");
  const [formDesc, setFormDesc] = useState("");
  const [formSla, setFormSla] = useState("15");
  const [formFee, setFormFee] = useState("0");
  const [formDocs, setFormDocs] = useState("AADHAAR, INCOME_CERT");
  const [formStatus, setFormStatus] = useState<"AVAILABLE" | "SANDBOX_PROTOTYPE" | "MAINTENANCE">("AVAILABLE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [builderMsg, setBuilderMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const nodes = [
    { name: "U-GOV Citizen Interface", mode: "Application UI", status: "ACTIVE", scope: "Current web application" },
    { name: "U-SERVICES Catalogue", mode: "Prototype data", status: "ACTIVE", scope: "Seeded service entries" },
    { name: "U-DOCS Document Vault", mode: "Configured storage", status: "CONFIGURED", scope: "Private citizen-owned files" },
    { name: "U-INTEGRATIONS Gateway", mode: "Sandbox adapters", status: "SANDBOX", scope: "Mock providers only; no live government APIs" },
    { name: "U-AI Assistant", mode: aiHealth?.providerLabel || "Checking provider", status: aiHealth ? (aiHealth.liveAI ? "LIVE" : "DEMO") : "UNKNOWN", scope: aiHealth?.notice || "Provider health is not currently available" },
    { name: "U-AUDIT Ledger", mode: "SHA-256 hash chain", status: "CONFIGURED", scope: "Prototype audit events" },
  ];

  const resetForm = () => {
    setFormName("");
    setFormCode("");
    setFormDept("");
    setFormMinistry("");
    setFormCategory("education");
    setFormDesc("");
    setFormSla("15");
    setFormFee("0");
    setFormDocs("AADHAAR, INCOME_CERT");
    setFormStatus("AVAILABLE");
    setEditingService(null);
    setBuilderMsg(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (svc: GovService) => {
    setEditingService(svc);
    setFormName(svc.name);
    setFormCode(svc.shortCode || svc.id);
    setFormDept(svc.department);
    setFormMinistry(svc.ministry);
    setFormCategory(svc.category);
    setFormDesc(svc.description);
    setFormSla(String(svc.slaDays || 15));
    setFormFee(String(svc.fee || 0));
    setFormDocs((svc.requiredDocs || []).join(", ") || "AADHAAR");
    setFormStatus(svc.status === "available" ? "AVAILABLE" : (svc.status === "maintenance" ? "MAINTENANCE" : "SANDBOX_PROTOTYPE"));
    setBuilderMsg(null);
    setIsCreateModalOpen(true);
  };

  const handleSaveService = async () => {
    if (!formName.trim() || formName.trim().length < 3) {
      setBuilderMsg({ type: "error", text: "Scheme name must be at least 3 characters." });
      return;
    }
    if (!editingService && (!formCode.trim() || formCode.trim().length < 2)) {
      setBuilderMsg({ type: "error", text: "Service code must be at least 2 characters." });
      return;
    }
    if (!formDept.trim()) {
      setBuilderMsg({ type: "error", text: "Issuing department is required." });
      return;
    }

    const slaValue = Number(formSla);
    const feeValue = Number(formFee);
    if (!Number.isInteger(slaValue) || slaValue < 1 || slaValue > 365) {
      setBuilderMsg({ type: "error", text: "Catalogue processing estimate must be a whole number from 1 to 365 days." });
      return;
    }
    if (!Number.isFinite(feeValue) || feeValue < 0 || feeValue > 100000) {
      setBuilderMsg({ type: "error", text: "Listed fee must be between ₹0 and ₹100,000." });
      return;
    }
    if (!editingService && !/^[A-Z0-9_-]{2,32}$/i.test(formCode.trim())) {
      setBuilderMsg({ type: "error", text: "Service code must use 2–32 letters, numbers, hyphens, or underscores." });
      return;
    }

    const allowedDocumentTypes = new Set(["AADHAAR", "PAN", "DRIVING_LICENCE", "DOMICILE", "INCOME_CERT", "MARKSHEET"]);
    const requestedDocumentTypes = formDocs
      .split(",")
      .map((value) => value.trim().toUpperCase().replace(/\s+/g, "_"))
      .filter(Boolean);
    const invalidDocumentTypes = requestedDocumentTypes.filter((value) => !allowedDocumentTypes.has(value));
    if (invalidDocumentTypes.length > 0) {
      setBuilderMsg({ type: "error", text: `Unknown document type ID(s): ${invalidDocumentTypes.join(", ")}.` });
      return;
    }

    setIsSubmitting(true);
    setBuilderMsg(null);

    const docTypeIds = formDocs
      .split(",")
      .map((d) => d.trim().toUpperCase().replace(/\s+/g, "_"))
      .filter(Boolean);

    try {
      if (editingService) {
        // Update existing service
        const res = await fetch(`/api/v1/services/${editingService.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            department: formDept.trim(),
            ministry: formMinistry.trim() || formDept.trim(),
            category: formCategory,
            description: formDesc.trim(),
            slaDays: slaValue,
            fee: feeValue,
            requiredDocumentTypeIds: docTypeIds,
            status: formStatus,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setBuilderMsg({ type: "success", text: "Scheme updated successfully and recorded to U-AUDIT." });
          setLocalServices((prev) =>
            prev.map((s) => (s.id === editingService.id ? { ...s, name: formName, department: formDept, slaDays: slaValue, fee: feeValue } : s))
          );
          await refreshServices();
          setTimeout(() => setIsCreateModalOpen(false), 800);
        } else {
          setBuilderMsg({ type: "error", text: data.error || "Failed to update service." });
        }
      } else {
        // Create new service
        const res = await fetch("/api/v1/services", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            serviceCode: formCode.toUpperCase().trim(),
            department: formDept.trim(),
            ministry: formMinistry.trim() || formDept.trim(),
            category: formCategory,
            description: formDesc.trim() || `Statutory public scheme for ${formName}`,
            slaDays: Number(formSla) || 15,
            fee: Number(formFee) || 0,
            requiredDocumentTypeIds: docTypeIds,
            status: formStatus,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setBuilderMsg({ type: "success", text: "New scheme created and anchored to U-AUDIT." });
          const newSvc: GovService = {
            id: data.service.id,
            name: data.service.name,
            shortCode: data.service.serviceCode,
            department: data.service.department,
            ministry: data.service.ministry,
            category: data.service.category as any,
            description: data.service.description,
            benefits: data.service.benefits,
            eligibility: data.service.eligibility,
            requiredDocs: data.service.requiredDocuments,
            slaDays: data.service.slaDays,
            fee: data.service.fee,
            officialPortal: data.service.officialPortal,
            status: data.service.status === "AVAILABLE" ? "available" : "prototype",
          };
          setLocalServices((prev) => [newSvc, ...prev]);
          await refreshServices();
          setTimeout(() => setIsCreateModalOpen(false), 800);
        } else {
          setBuilderMsg({ type: "error", text: data.error || "Failed to create service." });
        }
      }
    } catch (err: any) {
      setBuilderMsg({ type: "error", text: err.message || "Network error." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (svc: GovService) => {
    const nextStatus = svc.status === "available" ? "MAINTENANCE" : "AVAILABLE";
    try {
      const res = await fetch(`/api/v1/services/${svc.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setLocalServices((prev) =>
          prev.map((s) => (s.id === svc.id ? { ...s, status: nextStatus === "AVAILABLE" ? "available" : "maintenance" } : s))
        );
        await refreshServices();
      }
    } catch (e) {
      console.warn("Failed to toggle status:", e);
    }
  };

  const filteredServices = localServices.filter((s) => {
    const matchesSearch =
      !searchFilter ||
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.department.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.shortCode && s.shortCode.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesCat = categoryFilter === "all" || s.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <div className="ugov-app-page ugov-admin-page space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Server className="w-6 h-6 text-blue-700" />
              <span>U-SYS Master Ecosystem Command Console</span>
            </h1>
            <Badge variant="info" size="sm">
              Prototype Console
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Prototype component overview, catalogue administration, and sandbox integration visibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "telemetry" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              System Telemetry
            </button>
            <button
              onClick={() => setActiveTab("builder")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "builder" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              No-Code Service Builder
            </button>
          </div>
        </div>
      </div>

      {activeTab === "telemetry" ? (
        <>
          {/* High-Level Telemetry Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card variant="flat" padding="md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Registered Public Services
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {localServices.length}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                Prototype catalogue
              </span>
            </Card>

            <Card variant="flat" padding="md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Application Records
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {applications.length}
              </div>
              <span className="text-[11px] text-blue-600 font-semibold mt-0.5 block">
                Records in current application store
              </span>
            </Card>

            <Card variant="flat" padding="md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Citizen Audit Events
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {auditLogs.length}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                Visible in current prototype session
              </span>
            </Card>

            <Card variant="flat" padding="md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Audit Ledger State
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                Hash-chained
              </div>
              <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">
                Verify integrity in the Audit view
              </span>
            </Card>
          </div>

          {/* Core Node Telemetry Table */}
          <Card variant="default" padding="none" className="space-y-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                U-GOV Components & Integration Boundaries
              </h3>
              <button
                onClick={() => void refreshAIHealth()}
                className="text-xs text-slate-500 hover:text-blue-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{aiHealth?.timestamp ? `AI checked ${new Date(aiHealth.timestamp).toLocaleTimeString()}` : "Check AI provider"}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Current scope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nodes.map((n, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{n.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{n.mode}</td>
                      <td className="py-3 px-4">
                        <Badge variant={n.status === "ACTIVE" || n.status === "LIVE" ? "success" : n.status === "DEMO" ? "warning" : "info"} size="sm" dot>
                          {n.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{n.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        /* No-Code Government Service Builder Tab */
        <div className="space-y-6">
          <Card variant="flat" padding="md" className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{t("builder.title")}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t("builder.subtitle")}</p>
            </div>
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-1.5" />
              <span>{t("builder.createNew")}</span>
            </Button>
          </Card>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search registered schemes..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700"
              >
                <option value="all">All Categories</option>
                <option value="education">Education</option>
                <option value="revenue">Revenue</option>
                <option value="agriculture">Agriculture</option>
                <option value="transport">Transport</option>
                <option value="civic">Civic</option>
                <option value="welfare">Welfare</option>
              </select>
            </div>
          </div>

          {/* Services Table */}
          <Card variant="default" padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Service Scheme</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">SLA (Days)</th>
                    <th className="py-3 px-4">Fee</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredServices.map((svc) => (
                    <tr key={svc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{svc.name}</span>
                        <span className="text-[11px] text-slate-400 capitalize">{svc.category}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {svc.shortCode || "STATUTORY"}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{svc.department}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">{svc.slaDays} Days</td>
                      <td className="py-3 px-4 font-bold text-emerald-700 tabular-nums">
                        {svc.fee === 0 ? "Free (₹0)" : `₹${svc.fee}`}
                      </td>
                      <td className="py-3 px-4">
                        {svc.status === "available" ? (
                          <Badge variant="success" size="sm" dot>Available</Badge>
                        ) : svc.status === "maintenance" ? (
                          <Badge variant="warning" size="sm" dot>Maintenance</Badge>
                        ) : (
                          <Badge variant="info" size="sm" dot>Prototype</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => openEditModal(svc)}>
                            <Edit className="w-3 h-3 mr-1" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(svc)}
                            title="Toggle Availability"
                          >
                            {svc.status === "available" ? (
                              <ToggleRight className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-3.5 h-3.5 text-amber-500" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* No-Code Scheme Builder Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingService ? t("builder.editService") : t("builder.createNew")}
        maxWidth="md"
      >
        <div className="space-y-4">
          {builderMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                builderMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {builderMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>{builderMsg.text}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">{t("builder.serviceName")} *</label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. National Apprenticeship Promotion Scheme"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">{t("builder.serviceCode")} *</label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. NAPS-GOV"
                disabled={!!editingService}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">{t("builder.category")}</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
              >
                <option value="education">Education</option>
                <option value="revenue">Revenue</option>
                <option value="agriculture">Agriculture</option>
                <option value="transport">Transport</option>
                <option value="civic">Civic</option>
                <option value="welfare">Welfare</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">{t("builder.department")} *</label>
              <Input
                value={formDept}
                onChange={(e) => setFormDept(e.target.value)}
                placeholder="e.g. Ministry of Skill Development"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">{t("builder.slaDays")}</label>
              <Input
                type="number"
                value={formSla}
                onChange={(e) => setFormSla(e.target.value)}
                placeholder="15"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">{t("builder.fee")}</label>
              <Input
                type="number"
                value={formFee}
                onChange={(e) => setFormFee(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 block">{t("builder.status")}</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="SANDBOX_PROTOTYPE">SANDBOX_PROTOTYPE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">
              {t("builder.reqDocs")} (Comma separated IDs)
            </label>
            <Input
              value={formDocs}
              onChange={(e) => setFormDocs(e.target.value)}
              placeholder="AADHAAR, INCOME_CERT, MARKSHEET, DOMICILE"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Available vault IDs: AADHAAR, PAN, DRIVING_LICENCE, DOMICILE, INCOME_CERT, MARKSHEET
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">Scheme Description</label>
            <Input
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Direct benefit scheme providing financial and statutory support to eligible citizens."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveService}
              disabled={isSubmitting}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>{editingService ? "Save Changes" : "Register Scheme"}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
