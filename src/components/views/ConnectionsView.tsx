import React, { useState } from "react";
import { Plug, CheckCircle2, RefreshCw, Plus, Bot, Globe, Shield, Key } from "lucide-react";
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
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-[#eef3ff]">
            External Connections & API Integrations
          </h1>
          <p className="text-[#8c98ae] mt-0.5">
            Manage authenticated connections for AI Agent providers, REST endpoints, webhooks, and enterprise APIs.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl bg-[#45e0d1] hover:bg-[#38c9bb] text-[#080b12] font-bold flex items-center gap-1.5 shadow-lg shadow-[#45e0d1]/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Connection</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {connections.map((c) => (
          <div
            key={c.id}
            className="p-5 rounded-2xl bg-[#0f1420] border border-[#253047] shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#131a28] border border-[#253047] flex items-center justify-center text-[#45e0d1]">
                  {c.type === "agent_provider" ? <Bot className="w-4 h-4 text-[#ff5db1]" /> : <Globe className="w-4 h-4 text-[#71a7ff]" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#eef3ff]">{c.name}</h3>
                  <p className="text-[10px] font-mono text-[#8c98ae]">{c.service}</p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-[#5ee28a]/10 text-[#5ee28a] border border-[#5ee28a]/30 font-mono text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            </div>

            <div className="pt-2 border-t border-[#253047] flex items-center justify-between text-[10px] font-mono text-[#8c98ae]">
              <span>Last tested: {new Date(c.lastTestedAt || Date.now()).toLocaleTimeString()}</span>
              <button className="text-[#45e0d1] hover:underline flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Test Ping
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="p-5 rounded-2xl bg-[#0f1420] border border-[#253047] space-y-3 max-w-md">
          <h3 className="font-bold text-sm text-[#eef3ff]">Add New Integration Connection</h3>
          <div>
            <label className="block text-[#8c98ae] font-mono mb-1">Connection Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe Billing Webhook"
              className="w-full px-3 py-2 rounded-xl bg-[#131a28] border border-[#253047] text-[#eef3ff] outline-none text-xs"
            />
          </div>
          <div>
            <label className="block text-[#8c98ae] font-mono mb-1">Service Target</label>
            <input
              type="text"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. https://api.stripe.com"
              className="w-full px-3 py-2 rounded-xl bg-[#131a28] border border-[#253047] text-[#eef3ff] outline-none text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 rounded-lg bg-[#080b12] text-[#8c98ae]">
              Cancel
            </button>
            <button onClick={handleAdd} className="px-4 py-1.5 rounded-lg bg-[#45e0d1] text-[#080b12] font-bold">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
