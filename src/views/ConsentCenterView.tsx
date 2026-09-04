import React, { useEffect, useState } from "react";
import {
  ShieldCheck, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink, FileText, Building2
} from "lucide-react";
import { useGov } from "../context/GovContext";

interface ConsentRecord {
  id: string;
  documentId: string;
  ownerUserId: string;
  recipientEntity: string;
  purpose: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

interface ConsentWithDoc extends ConsentRecord {
  documentTitle: string;
  documentType: string;
}

export const ConsentCenterView: React.FC = () => {
  const { revokeConsent, documents } = useGov();
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "REVOKED" | "EXPIRED">("ALL");

  const fetchConsents = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/v1/documents/consents", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setConsents(data.consents || []);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchConsents(); }, []);

  const handleRevoke = async (docId: string, consentId: string) => {
    setRevoking(consentId);
    await revokeConsent(docId, consentId);
    await fetchConsents();
    setRevoking(null);
  };

  const enriched: ConsentWithDoc[] = consents.map((c) => {
    const doc = documents.find((d) => d.id === c.documentId);
    return {
      ...c,
      documentTitle: doc?.name || "Document",
      documentType: doc?.type || doc?.documentTypeId || "UNKNOWN",
    };
  });

  const filtered = filter === "ALL" ? enriched : enriched.filter((c) => c.status === filter);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const isExpiringSoon = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  const STATUS_CONFIG = {
    ACTIVE: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "Active" },
    REVOKED: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Revoked" },
    EXPIRED: { icon: Clock, color: "text-slate-500", bg: "bg-slate-50 border-slate-200", label: "Expired" },
  };

  const activeCount = consents.filter((c) => c.status === "ACTIVE").length;
  const expiringSoon = consents.filter((c) => c.status === "ACTIVE" && isExpiringSoon(c.expiresAt)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#0b1f3a]" />
            <h1 className="text-2xl font-extrabold text-[#0b1f3a]">Consent Center</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Full control over which government departments can access your documents. Revoke any consent instantly.
          </p>
        </div>
        <button
          onClick={fetchConsents}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Consents", value: consents.length, color: "text-slate-700", bg: "bg-slate-50" },
          { label: "Active", value: activeCount, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Expiring Soon (7d)", value: expiringSoon, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Revoked", value: consents.filter((c) => c.status === "REVOKED").length, color: "text-red-700", bg: "bg-red-50" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 border border-slate-200/60`}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{stat.label}</p>
            <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200/60">
        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Your Data Sovereignty</p>
          <p className="text-xs text-blue-700 mt-0.5">
            U-GOV never shares your documents without your explicit consent. Revoking a consent immediately prevents the recipient from accessing the document. All consent operations are permanently recorded in the SHA-256 Hash-Chained Audit Ledger.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ALL", "ACTIVE", "REVOKED", "EXPIRED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === f ? "bg-[#0b1f3a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "ALL" ? `All (${consents.length})` : `${f} (${consents.filter((c) => c.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Consent List */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading consents…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No consents found</p>
          <p className="text-slate-400 text-sm mt-1">
            {filter === "ALL" ? "Your consents will appear here when you apply for services." : `No ${filter.toLowerCase()} consents.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((consent) => {
            const cfg = STATUS_CONFIG[consent.status];
            const StatusIcon = cfg.icon;
            const expiring = consent.status === "ACTIVE" && isExpiringSoon(consent.expiresAt);
            return (
              <div
                key={consent.id}
                className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-md ${
                  expiring ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200/80"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{consent.documentTitle}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-xs text-slate-600 font-medium truncate">{consent.recipientEntity}</p>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{consent.purpose}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </span>
                    {consent.status === "ACTIVE" && (
                      <button
                        onClick={() => handleRevoke(consent.documentId, consent.id)}
                        disabled={revoking === consent.id}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold border border-red-200 transition-colors disabled:opacity-50"
                      >
                        {revoking === consent.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Granted: {formatDate(consent.grantedAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {consent.status === "REVOKED" && consent.revokedAt
                      ? `Revoked: ${formatDate(consent.revokedAt)}`
                      : `Expires: ${formatDate(consent.expiresAt)}`}
                  </span>
                  {expiring && (
                    <span className="flex items-center gap-1 text-amber-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Expiring soon
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
