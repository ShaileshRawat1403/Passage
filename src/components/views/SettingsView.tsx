import React from "react";
import { Settings, Shield, Lock, Cpu, Server, Key } from "lucide-react";

export const SettingsView: React.FC = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-xl font-bold font-mono text-[#eef3ff]">
          Governance & Execution Policies
        </h1>
        <p className="text-[#8c98ae] mt-0.5">
          Configure security permissions, audit logging policies, and worker execution backoffs.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-5 rounded-2xl bg-[#0f1420] border border-[#253047] shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#eef3ff]">
            <Shield className="w-4 h-4 text-[#45e0d1]" />
            <span>Audit & Compliance Trail</span>
          </div>
          <p className="text-[#8c98ae]">
            Every state entry, action execution, and guard evaluation produces an immutable hash-chained audit event.
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-[#253047]">
            <span className="text-[#eef3ff]">Strict Immutable Mode</span>
            <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#45e0d1]" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0f1420] border border-[#253047] shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#eef3ff]">
            <Lock className="w-4 h-4 text-[#ffc766]" />
            <span>Role-Based Manual Override Permissions</span>
          </div>
          <p className="text-[#8c98ae]">
            Specify which roles may manually trigger blocked transitions or bypass guard failures in production cases.
          </p>
          <div className="space-y-2 font-mono">
            <div className="p-2.5 rounded-lg bg-[#131a28] border border-[#253047] flex items-center justify-between text-[#eef3ff]">
              <span>Workflow Administrator</span>
              <span className="text-[#5ee28a]">Full Override</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#131a28] border border-[#253047] flex items-center justify-between text-[#eef3ff]">
              <span>Finance Director</span>
              <span className="text-[#ffc766]">High-Value Approval Override</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
