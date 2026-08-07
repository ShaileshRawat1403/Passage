import React, { useState } from "react";
import { CheckCircle2, Plus, Bot, Globe, Cpu, Server, ShieldCheck, Key, Zap, Info } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { ConnectionCredential } from "../../types/workflow";

const PROVIDER_PRESETS = [
  {
    id: "openai",
    name: "OpenAI API",
    service: "https://api.openai.com/v1",
    type: "agent_provider" as const,
    defaultModel: "gpt-4o",
    badge: "Commercial LLM",
    description: "Configuration template for OpenAI API endpoints (e.g., GPT-4o, o1, o3-mini).",
  },
  {
    id: "ollama",
    name: "Ollama Open LLM (Local / Self-Hosted)",
    service: "http://localhost:11434",
    type: "agent_provider" as const,
    defaultModel: "llama3.1:8b",
    badge: "Local Open Source",
    description: "Self-hosted open-weights models (Llama 3, Mistral, DeepSeek). Note: Local Passage targets localhost; Cloud Passage requires a network-accessible endpoint or bridge.",
  },
  {
    id: "openrouter",
    name: "OpenAI-Compatible / Groq / OpenRouter",
    service: "https://openrouter.ai/api/v1",
    type: "agent_provider" as const,
    defaultModel: "mistralai/mistral-large",
    badge: "Open LLM Gateway",
    description: "OpenAI-compatible gateway endpoints routing to open-weights inference providers.",
  },
  {
    id: "gemini",
    name: "Google Gemini AI",
    service: "https://generativelanguage.googleapis.com",
    type: "agent_provider" as const,
    defaultModel: "gemini-1.5-pro",
    badge: "Multimodal AI",
    description: "Google Gemini generative API endpoint template for structured action execution.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    service: "https://api.anthropic.com/v1",
    type: "agent_provider" as const,
    defaultModel: "claude-3-5-sonnet-20240620",
    badge: "Enterprise AI",
    description: "Anthropic Claude API template for complex reasoning and structured JSON output actions.",
  },
];

export const ConnectionsView: React.FC = () => {
  const { connections, addConnection } = useWorkflowStore();
  const [showAdd, setShowAdd] = useState(false);

  // Connection form state
  const [selectedPreset, setSelectedPreset] = useState("openai");
  const [name, setName] = useState("OpenAI Provider Config");
  const [service, setService] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setName(preset.name);
      setService(preset.service);
      setModel(preset.defaultModel);
    }
  };

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: string; message?: string; latencyMs?: number }>>({});

  const handleTestConnection = async (connectionId: string) => {
    setTestingId(connectionId);
    try {
      const res = await fetch(`/api/providers/${connectionId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestResults((prev) => ({
        ...prev,
        [connectionId]: {
          status: data.status || (res.ok ? "verified" : "failed"),
          message: data.message || data.error,
          latencyMs: data.latencyMs,
        },
      }));
      if (res.ok) {
        useWorkflowStore.getState().hydrateFromDurableStore();
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [connectionId]: {
          status: "failed",
          message: String(err),
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    addConnection({
      id: `conn-${Date.now()}`,
      name,
      type: selectedPreset === "custom_api" ? "api_key" : "agent_provider",
      service: service || "External API Endpoint",
      status: "configured",
      lastTestedAt: new Date().toISOString(),
      defaultModel: model,
      providerId: selectedPreset,
    });

    // Log activity
    useWorkflowStore.getState().addActivityLog({
      category: "connection",
      action: "Provider Connection Template Configured",
      details: `Configured template '${name}' (${service}) with default model '${model}'.`,
      severity: "info",
    });

    setName("");
    setService("");
    setApiKey("");
    setShowAdd(false);
  };

  const renderStatusBadge = (status: ConnectionCredential["status"]) => {
    switch (status) {
      case "available_local":
        return (
          <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Available locally
          </span>
        );
      case "configured":
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Configured
          </span>
        );
      case "verified":
      case "connected":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Verified
          </span>
        );
      case "failed":
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            Failed
          </span>
        );
      case "unavailable":
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            Unavailable
          </span>
        );
      case "untested":
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/30 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            Untested
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 text-xs font-sans">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-cyan-400 tracking-wider font-bold mb-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Provider & Integration Hub</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-100 tracking-wider uppercase">
            Provider Templates
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Configure integration templates for commercial LLMs, OpenAI-compatible gateways, and self-hosted open-weights engines.
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Provider Template</span>
        </button>
      </div>

      {/* 2. Provider Quick-Selection Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Provider Templates
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Local & Cloud LLM Endpoints</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {PROVIDER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                handleSelectPreset(preset.id);
                setShowAdd(true);
              }}
              className="p-3.5 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-cyan-500/50 transition-all text-left space-y-2 group cursor-pointer backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[9px] font-bold">
                  {preset.badge}
                </span>
                <Bot className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              </div>

              <div>
                <h3 className="font-bold font-mono text-slate-200 text-xs group-hover:text-cyan-300 transition-colors">
                  {preset.name.split(" ")[0]}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{preset.defaultModel}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Topology Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 flex items-start gap-3 font-mono text-[11px] text-slate-300">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-cyan-300 font-bold">Inference Topology Note:</span> Local Passage runtimes can connect directly to local endpoints (e.g. <code className="text-cyan-200">http://localhost:11434</code>). Cloud-hosted Passage requires an authenticated network-accessible gateway or companion bridge.
        </div>
      </div>

      {/* 3. Configured Connections Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          Configured Provider Connections ({connections.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map((c) => {
            const isOllama = c.name.toLowerCase().includes("ollama") || c.service.includes("11434");
            const isOpenAI = c.name.toLowerCase().includes("openai");

            return (
              <div
                key={c.id}
                className="p-5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all shadow-2xl space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isOllama
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                        : isOpenAI
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                    }`}>
                      {c.type === "agent_provider" ? <Bot className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="font-bold font-mono text-sm text-slate-100 flex items-center gap-2">
                        {c.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400 break-all">{c.service}</p>
                    </div>
                  </div>

                  {renderStatusBadge(c.status)}
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Authentication:</span>
                    <span className="text-slate-200">{isOllama ? "Local Network (No Auth)" : "Secret Manager Reference"}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Service Type:</span>
                    <span className="text-cyan-400 font-semibold">{c.type === "agent_provider" ? "LLM Action Provider" : "HTTP REST Endpoint"}</span>
                  </div>
                </div>

                {(() => {
                  const result = testResults[c.id];
                  if (!result) return null;
                  return (
                    <div className={`p-2.5 rounded-xl border text-[11px] font-mono leading-tight ${
                      result.status === "verified"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    }`}>
                      <div className="font-bold flex items-center justify-between">
                        <span>Status: {result.status}</span>
                        {result.latencyMs !== undefined && (
                          <span>{result.latencyMs}ms</span>
                        )}
                      </div>
                      {result.message && (
                        <p className="mt-1 opacity-90 font-sans text-[10px] break-all">{result.message}</p>
                      )}
                    </div>
                  );
                })()}

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="text-slate-400 font-mono text-[10px]">
                    Provider Adapter Layer Active
                  </span>

                  <button
                    onClick={() => handleTestConnection(c.id)}
                    disabled={testingId === c.id}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold font-mono text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {testingId === c.id ? (
                      <span>Testing Endpoint...</span>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Add Provider Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-slate-950 border border-white/10 space-y-4 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm text-slate-100 uppercase font-mono tracking-wider">
                  Configure Provider Template
                </h3>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {/* Provider Select */}
            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                Select Provider Template
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => handleSelectPreset(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none font-mono text-xs focus:border-cyan-400"
              >
                {PROVIDER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-950 text-slate-200">
                    {p.name}
                  </option>
                ))}
                <option value="custom_api" className="bg-slate-950 text-slate-200">
                  Custom REST / OpenAI-Compatible Endpoint
                </option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                Connection Identifier
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. OpenAI GPT-4o Gateway"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                  API Base Endpoint URL
                </label>
                <input
                  type="text"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                  Default Model Alias
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gpt-4o"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            {selectedPreset === "ollama" || service.includes("localhost") ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[10px] space-y-1">
                <p className="font-bold">Ollama / Localhost Network Topology:</p>
                <p className="text-slate-300">
                  <code className="text-amber-200">localhost:11434</code> works directly when Passage runs locally. For Cloud Passage deployments, configure an authenticated bridge or accessible endpoint URL.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                  Secret Key Reference (P2.0 Secret Manager)
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400 font-mono"
                  />
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-1">
                  Credentials will map to GCP Secret Manager references in P2.0. Never logged or stored unencrypted.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-slate-200 font-mono cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                Save Template Config
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

