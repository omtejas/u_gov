import React from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Server, Activity, ShieldCheck, Database, CheckCircle2, Cpu, Globe, RefreshCw } from "lucide-react";

export const AdminView: React.FC = () => {
  const { services, applications, auditLogs } = useGov();

  const nodes = [
    { name: "UIDAI Aadhaar 2.0 Auth Node", status: "Healthy", latency: "38 ms", uptime: "99.99%", load: "24%" },
    { name: "DigiLocker DPI Credential Verifier", status: "Healthy", latency: "46 ms", uptime: "99.98%", load: "31%" },
    { name: "PFMS Direct Benefit Transfer (DBT)", status: "Healthy", latency: "72 ms", uptime: "99.95%", load: "58%" },
    { name: "State Revenue Land Registry (Bhulekh)", status: "Healthy", latency: "95 ms", uptime: "99.91%", load: "42%" },
    { name: "CPGRAMS Statutory Grievance Gateway", status: "Healthy", latency: "52 ms", uptime: "99.97%", load: "19%" },
    { name: "Bharat G-Bot Gemini 2.5 Reasoning Node", status: "Active", latency: "210 ms", uptime: "99.99%", load: "15%" },
  ];

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
            Real-time public digital infrastructure telemetry, service mesh health, and interoperability gateway metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" size="md" dot>
            Global Infrastructure Healthy
          </Badge>
        </div>
      </div>

      {/* High-Level Telemetry Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="flat" padding="md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Registered Public Services
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {services.length}
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
            SHA-256 Merkle Consistent
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
    </div>
  );
};
