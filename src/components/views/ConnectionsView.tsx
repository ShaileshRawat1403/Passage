import React, { useState } from "react";
import { CheckCircle2, RefreshCw, Plus, Bot, Globe } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export const ConnectionsView: React.FC = () => {
  const { connections, addConnection } = useWorkflowStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [service, setService] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    addConnection({
      id: `conn-${Date.now()}`,
      name,
      type: "api_key",
      service: service || "External REST API",
      status: "connected",
      lastTestedAt: new Date().toISOString(),
    });
    setName("");
    setService("");
    setShowAdd(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 uppercase tracking-wider">
            External Connections & API Integrations
          </h1>
          <p className="text-slate-400 mt-0.5 text-xs">
            Manage authenticated connections for AI Agent providers, REST endpoints, webhooks, and enterprise APIs.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Connection</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {connections.map((c) => (
          <div
            key={c.id}
            className="p-5 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400">
                  {c.type === "agent_provider" ? <Bot className="w-4 h-4 text-pink-400" /> : <Globe className="w-4 h-4 text-blue-400" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">{c.name}</h3>
                  <p className="text-[10px] font-mono text-slate-400">{c.service}</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Last tested: {new Date(c.lastTestedAt || Date.now()).toLocaleTimeString()}</span>
              <button className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer">
                <RefreshCw className="w-3 h-3" />
                Test Ping
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-3 max-w-md shadow-2xl">
          <h3 className="font-bold text-sm text-slate-100 uppercase font-mono tracking-wider">Add New Integration Connection</h3>
          <div>
            <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">Connection Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe Billing Webhook"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">Service Target</label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. https://api.stripe.com"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-slate-200 cursor-pointer">
              Cancel
            </button>
            <button onClick={handleAdd} className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
