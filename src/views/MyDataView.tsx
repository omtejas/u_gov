import React, { useState, useEffect } from "react";
import {
  Database, FileText, ShieldCheck, Activity, User, Download, Fingerprint, Info,
  AlertTriangle, Lock, RefreshCw, Layers, ChevronRight
} from "lucide-react";
import { useGov } from "../context/GovContext";

export const MyDataView: React.FC = () => {
  const { user, documents, governmentApplications, refreshDocuments, refreshApplications } = useGov();
  const [auditActivity, setAuditActivity] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [consentCount, setConsentCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    refreshDocuments();
    refreshApplications();
    fetchActivity();
    fetchConsentCount();
  }, []);

  const fetchActivity = async () => {
    try {
      setIsLoadingAudit(true);
      const res = await fetch("/api/v1/auth/sessions", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAuditActivity(data.sessions || []);
      }
    } catch { /* silent */ } finally {
      setIsLoadingAudit(false);
    }
  };

  const fetchConsentCount = async () => {
    try {
      const res = await fetch("/api/v1/documents/consents", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConsentCount((data.consents || []).filter((c: any) => c.status === "ACTIVE").length);
      }
    } catch { /* silent */ }
  };

  // Conceptual U-SYS ID: deterministic from user ID (no Aadhaar linkage)
  const generateUSystemId = (uid: string): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let hash = 5381;
    for (let i = 0; i < uid.length; i++) {
      hash = ((hash << 5) + hash) + uid.charCodeAt(i);
      hash = hash & hash;
    }
    const abs = Math.abs(hash);
    const seg = (n: number) => Array.from({ length: 4 }, (_, i) => chars[(n >> (i * 5)) & 31]).join("");
    return `USYS-${seg(abs)}-${seg(abs >> 20)}-${seg(abs >> 10)}`;
  };

  const uSystemId = user ? generateUSystemId(user.id || "citizen") : "USYS-XXXX-XXXX-XXXX";

  const handleExportData = () => {
    setIsExporting(true);
    const exportData = {
      exportedAt: new Date().toISOString(),
      disclaimer: "U-GOV Prototype Data Export — This is a development prototype. Data is not linked to any real government system.",
      citizen: {
        displayName: user?.name,
        email: user?.email,
        state: user?.state,
        district: user?.district,
        kycLevel: user?.kycLevel,
      },
      documentCount: documents.length,
      applicationCount: governmentApplications.length,
      activeConsentCount: consentCount,
      prototypeLimitation: "Actual document files cannot be exported in prototype mode. Only metadata is included.",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ugov-data-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setIsExporting(false), 1500);
  };

  const sections = [
    {
      id: "identity",
      icon: User,
      color: "text-blue-600",
      bg: "bg-blue-50",
      title: "Identity & Profile",
      count: null,
      items: [
        { label: "Full Name", value: user?.name || "—" },
        { label: "Email / U-ID", value: user?.email || "—" },
        { label: "State", value: user?.state || "—" },
        { label: "KYC Level", value: user?.kycLevel || "—" },
        { label: "U-SYS ID", value: uSystemId, mono: true },
      ],
    },
    {
      id: "documents",
      icon: FileText,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      title: "DigiVault Documents",
      count: documents.length,
      items: documents.map((d) => ({
        label: d.name,
        value: `${d.type || d.documentTypeId || "—"} · ${d.verificationStatus || d.verified ? "Verified" : "Unverified"}`,
      })),
    },
    {
      id: "applications",
      icon: Activity,
      color: "text-amber-600",
      bg: "bg-amber-50",
      title: "Government Applications",
      count: governmentApplications.length,
      items: governmentApplications.slice(0, 5).map((a) => ({
        label: a.applicationNumber,
        value: a.status,
      })),
    },
    {
      id: "consents",
      icon: ShieldCheck,
      color: "text-purple-600",
      bg: "bg-purple-50",
      title: "Active Data Consents",
      count: consentCount,
      items: [{ label: "Active consents", value: `${consentCount} document(s) shared with government departments` }],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-[#0b1f3a]" />
            <h1 className="text-2xl font-extrabold text-[#0b1f3a]">My Data Center</h1>
          </div>
          <p className="text-slate-500 text-sm">View, understand, and control all data stored in your U-GOV workspace.</p>
        </div>
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0b1f3a] text-white text-xs font-bold hover:bg-[#163158] transition-colors disabled:opacity-70"
        >
          <Download className="w-3.5 h-3.5" />
          {isExporting ? "Exporting…" : "Export Data"}
        </button>
      </div>

      {/* U-SYS ID Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0b1f3a] to-[#1a3a6e] rounded-2xl p-6 text-white">
        <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Fingerprint className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">Prototype Citizen Identifier</span>
          </div>
          <p className="font-mono text-2xl font-bold tracking-widest text-amber-300">{uSystemId}</p>
          <p className="text-xs text-white/50 mt-2">
            Deterministic prototype ID — not Aadhaar derived · Future: Government-Issued DPI ID
          </p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-white/40">
            <AlertTriangle className="w-3 h-3" />
            <span>This is a Sandbox identifier and has no legal standing.</span>
          </div>
        </div>
      </div>

      {/* Notices */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200/60">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Prototype Data Notice</p>
          <p className="text-xs text-amber-700 mt-0.5">
            U-GOV is a working prototype. No data is shared with real government systems. All Aadhaar, PAN, and DigiLocker references are Sandbox simulations only. The SHA-256 Audit Ledger is real and tamper-evident within this prototype.
          </p>
        </div>
      </div>

      {/* Data Sections */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <div key={sec.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
              <div className={`flex items-center gap-3 px-5 py-4 border-b border-slate-100`}>
                <div className={`w-8 h-8 rounded-xl ${sec.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${sec.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">{sec.title}</p>
                  {sec.count !== null && (
                    <p className="text-[11px] text-slate-400">{sec.count} item{sec.count !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {sec.items.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">None yet.</p>
                ) : (
                  sec.items.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 px-5 py-3">
                      <span className="text-xs text-slate-500 font-medium">{item.label}</span>
                      <span className={`text-xs text-slate-700 font-semibold text-right ${(item as any).mono ? "font-mono text-[11px]" : ""}`}>
                        {item.value}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rights Section */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-700">Your Data Rights</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { title: "Right to Access", desc: "All your data is visible here. Nothing is hidden." },
            { title: "Right to Revoke", desc: "Revoke any consent instantly from the Consent Center." },
            { title: "Right to Delete", desc: "Delete any document from your DigiVault at any time." },
            { title: "Right to Audit", desc: "Every action is permanently recorded in the SHA-256 Audit Ledger." },
          ].map((right) => (
            <div key={right.title} className="flex gap-2.5 p-3 rounded-xl bg-white border border-slate-200">
              <ChevronRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-700">{right.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{right.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
