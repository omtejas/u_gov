import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ShieldCheck, Download, Filter, Search, Terminal, Lock } from "lucide-react";

export const AuditView: React.FC = () => {
  const { auditLogs } = useGov();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = auditLogs.filter(
    (l) =>
      !searchTerm ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.context.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <span>U-AUDIT Sovereign Event Ledger</span>
            </h1>
            <Badge variant="success" size="sm" dot>
              Tamper-Evident
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Every authentication, document access, and status transition is cryptographically sealed in an append-only audit trail.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `UGOV_AUDIT_LEDGER_${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          }}
          leftIcon={<Download className="w-3.5 h-3.5" />}
        >
          Export Signed Ledger
        </Button>
      </div>

      {/* Audit Architecture Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Immutable Audit Rule
          </span>
          <h4 className="text-sm font-bold text-slate-800">
            Who → What → When → Result
          </h4>
          <p className="text-xs text-slate-500">
            Non-repudiable logs cannot be altered by ordinary users or administrators.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Cryptographic Sealing
          </span>
          <h4 className="text-sm font-bold text-slate-800">
            SHA-256 Merkle Ledger
          </h4>
          <p className="text-xs text-slate-500">
            Consecutive event hashes chained to guarantee zero retroactive tampering.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Statutory Accountability
          </span>
          <h4 className="text-sm font-bold text-slate-800">
            DPDP & IT Act 2000
          </h4>
          <p className="text-xs text-slate-500">
            Authorized departmental officers are auditable for every document accessed.
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter audit events by action, credential, or department..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
        />
      </div>

      {/* Events Table / Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Timestamp (UTC)</th>
                <th className="py-3.5 px-4">Actor & Authority</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Resource</th>
                <th className="py-3.5 px-4">Result</th>
                <th className="py-3.5 px-4">Context Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="font-bold text-slate-800 block">
                      {log.actor.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {log.actor.uId} {log.actor.ipAddress ? `(${log.actor.ipAddress})` : ""}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">
                    {log.resource}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <Badge
                      variant={
                        log.result === "SUCCESS"
                          ? "success"
                          : log.result === "WARNING"
                          ? "warning"
                          : log.result === "BLOCKED"
                          ? "error"
                          : "info"
                      }
                      size="sm"
                    >
                      {log.result}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                    {log.context}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
