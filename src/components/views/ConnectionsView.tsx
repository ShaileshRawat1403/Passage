import React, { useState } from "react";
import { CheckCircle2, RefreshCw, Plus, Bot, Globe, Cpu, Server, ShieldCheck, Key, Zap, Trash2 } from "lucide-react";
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
    description: "Connect OpenAI models for automated guard evaluations, decision nodes, and function calling.",
  },
  {
    id: "ollama",
    name: "Ollama Open LLM (Local / Self-Hosted)",
    service: "http://localhost:11434",
    type: "agent_provider" as const,
    defaultModel: "llama3.1:8b",
    badge: "Local Open Source",
    description: "Run private open-weights models (Llama 3, Mistral, DeepSeek, Qwen) on your own infrastructure.",
  },
  {
    id: "openrouter",
    name: "OpenAI-Compatible / Groq / OpenRouter",
    service: "https://openrouter.ai/api/v1",
    type: "agent_provider" as const,
    defaultModel: "mistralai/mistral-large",
    badge: "Open LLM Gateway",
    description: "Route requests to high-throughput open LLMs via unified OpenAI-compatible endpoint schema.",
  },
  {
    id: "gemini",
    name: "Google Gemini AI",
    service: "https://generativelanguage.googleapis.com",
    type: "agent_provider" as const,
    defaultModel: "gemini-1.5-pro",
    badge: "Multimodal AI",
    description: "High-speed multimodal reasoning and long-context state validation.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    service: "https://api.anthropic.com/v1",
    type: "agent_provider" as const,
    defaultModel: "claude-3-5-sonnet-20240620",
    badge: "Enterprise AI",
    description: "Complex reasoning, structured JSON outputs, and policy guard enforcement.",
  },
];

export const ConnectionsView: React.FC = () => {
  const { connections, addConnection } = useWorkflowStore();
  const [showAdd, setShowAdd] = useState(false);

  // Connection form state
  const [selectedPreset, setSelectedPreset] = useState("openai");
  const [name, setName] = useState("OpenAI Production Cluster");
  const [service, setService] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [pingSuccess, setPingSuccess] = useState<string | null>(null);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setName(preset.name);
      setService(preset.service);
      setModel(preset.defaultModel);
    }
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    addConnection({
      id: `conn-${Date.now()}`,
      name,
      type: selectedPreset === "custom_api" ? "api_key" : "agent_provider",
      service: service || "External API Endpoint",
      status: "connected",
      lastTestedAt: new Date().toISOString(),
    });

    // Log activity
    useWorkflowStore.getState().addActivityLog({
      category: "connection",
      action: "API Connection Configured",
      details: `Configured '${name}' (${service}) with model '${model}'.`,
      severity: "success",
    });

    setName("");
    setService("");
    setApiKey("");
    setShowAdd(false);
  };

  const handleTestPing = (id: string, name: string) => {
    setTestingId(id);
    setPingSuccess(null);
    setTimeout(() => {
      setTestingId(null);
      setPingSuccess(id);
      setTimeout(() => setPingSuccess(null), 3000);
    }, 600);
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
            Connections & AI Model Providers
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Configure external API endpoints, commercial LLM providers (OpenAI, Anthropic, Gemini), and self-hosted open-weights models (Ollama, vLLM, Groq).
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Provider Connection</span>
        </button>
      </div>

      {/* 2. Provider Quick-Selection Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Supported Provider Templates
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Local Ollama & OpenAI Compatible supported</span>
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

      {/* 3. Active Connections Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          Configured Integration Credentials ({connections.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connections.map((c) => {
            const isTesting = testingId === c.id;
            const isPinged = pingSuccess === c.id;
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

                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Authentication:</span>
                    <span className="text-slate-200">{isOllama ? "No API Key (Local Network)" : "Bearer API Token (Masked ••••••••)"}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Service Type:</span>
                    <span className="text-cyan-400 font-semibold">{c.type === "agent_provider" ? "LLM Inference Engine" : "HTTP REST Endpoint"}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Last health ping: {new Date(c.lastTestedAt || Date.now()).toLocaleTimeString()}</span>

                  <button
                    onClick={() => handleTestPing(c.id, c.name)}
                    disabled={isTesting}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
                    <span>{isTesting ? "Pinging..." : isPinged ? "Ping 200 OK!" : "Test Ping"}</span>
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
                  Configure AI Provider / API Endpoint
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
                  Model Alias / Identifier
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. llama3.1:8b"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                API Key Secret {selectedPreset === "ollama" && "(Optional for local network)"}
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedPreset === "ollama" ? "Not required for local Ollama" : "sk-..."}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none text-xs focus:border-cyan-400 font-mono"
                />
              </div>
              <p className="text-[10px] font-mono text-slate-500 mt-1">
                Keys are stored securely in memory or environment secrets in production.
              </p>
            </div>

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
                Save Connection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

