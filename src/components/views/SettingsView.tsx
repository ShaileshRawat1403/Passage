import React from "react";
import { Shield, Lock } from "lucide-react";

export const SettingsView: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-xl font-bold font-mono text-slate-100 uppercase tracking-wider">
          Governance & Execution Policies
        </h1>
        <p className="text-slate-400 mt-0.5 text-xs">
          Configure security permissions, audit logging policies, and worker execution backoffs.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-5 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Audit & Compliance Trail</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Every state entry, action execution, and guard evaluation produces an immutable hash-chained audit event.
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-slate-200">Strict Immutable Mode</span>
            <input type="checkbox" defaultChecked className="w-4 h-4 accent-cyan-400" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Role-Based Manual Override Permissions</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Specify which roles may manually trigger blocked transitions or bypass guard failures in production cases.
          </p>
          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-slate-200">
              <span>Workflow Administrator</span>
              <span className="text-emerald-400">Full Override</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-slate-200">
              <span>Finance Director</span>
              <span className="text-amber-400">High-Value Approval Override</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
