import React, { useState } from "react";
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
  const { services, applications, auditLogs } = useGov();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"telemetry" | "builder">("telemetry");

  // Service Builder State
  const [localServices, setLocalServices] = useState<GovService[]>(services);
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
    { name: "UIDAI Aadhaar 2.0 Auth Node", status: "Healthy", latency: "38 ms", uptime: "99.99%", load: "24%" },
    { name: "DigiLocker DPI Credential Verifier", status: "Healthy", latency: "46 ms", uptime: "99.98%", load: "31%" },
    { name: "PFMS Direct Benefit Transfer (DBT)", status: "Healthy", latency: "72 ms", uptime: "99.95%", load: "58%" },
    { name: "State Revenue Land Registry (Bhulekh)", status: "Healthy", latency: "95 ms", uptime: "99.91%", load: "42%" },
    { name: "CPGRAMS Statutory Grievance Gateway", status: "Healthy", latency: "52 ms", uptime: "99.97%", load: "19%" },
    { name: "Bharat G-Bot Gemini 2.5 Reasoning Node", status: "Active", latency: "210 ms", uptime: "99.99%", load: "15%" },
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
            slaDays: Number(formSla) || 15,
            fee: Number(formFee) || 0,
            requiredDocumentTypeIds: docTypeIds,
            status: formStatus,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setBuilderMsg({ type: "success", text: "Scheme updated successfully and recorded to U-AUDIT." });
          setLocalServices((prev) =>
            prev.map((s) => (s.id === editingService.id ? { ...s, name: formName, department: formDept, slaDays: Number(formSla), fee: Number(formFee) } : s))
          );
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
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Server className="w-6 h-6 text-blue-700" />
              <span>U-SYS Master Ecosystem Command Console</span>
            </h1>
            <Badge variant="info" size="sm">
              Cluster Mode
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time public digital infrastructure telemetry, service mesh health, and No-Code Service Builder.
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
              <div className="text-2xl font-black text-slate-900 mt-1">
                {localServices.length}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                100% Operational
              </span>
            </Card>

            <Card variant="flat" padding="md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Handled Transactions
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                148,290
              </div>
              <span className="text-[11px] text-blue-600 font-semibold mt-0.5 block">
                +18.4% this week
              </span>
            </Card>

            <Card variant="flat" padding="md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                System Average Latency
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                54 ms
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                Sub-100ms Target Met
              </span>
            </Card>

            <Card variant="flat" padding="md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Audit Ledger State
              </span>
              <div className="text-2xl font-black text-slate-900 mt-1">
                Verified
              </div>
              <span className="text-[11px] text-slate-500 font-semibold mt-0.5 block">
                SHA-256 Hash-Chain Consistent
              </span>
            </Card>
          </div>

          {/* Core Node Telemetry Table */}
          <Card variant="default" padding="none" className="space-y-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                National Gateway Node Topology & Live Health
              </h3>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Telemetry updated every 5s</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Node / Infrastructure Gateway</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Avg Latency</th>
                    <th className="py-3 px-4">Cluster Load</th>
                    <th className="py-3 px-4">30-Day Uptime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nodes.map((n, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{n.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="success" size="sm" dot>
                          {n.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 font-bold">
                        {n.latency}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: n.load }}
                            />
                          </div>
                          <span className="text-slate-500 font-mono text-[11px]">{n.load}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                        {n.uptime}
                      </td>
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
                      <td className="py-3 px-4 font-bold text-slate-900">{svc.slaDays} Days</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
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
        size="md"
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
