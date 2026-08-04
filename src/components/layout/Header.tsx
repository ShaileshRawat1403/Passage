import React, { useState } from "react";
import {
  Layers,
  Sparkles,
  Play,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Plug,
  Package,
  Settings,
  List,
  Compass,
} from "lucide-react";
import { useWorkflowStore, NavigationTab } from "../../store/workflowStore";
import { DescribeWorkflowModal } from "../ai/DescribeWorkflowModal";

export const Header: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    setActiveWorkflowId,
    activeTab,
    setActiveTab,
    validationIssues,
    startNewRun,
  } = useWorkflowStore();

  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];
  const errorCount = validationIssues.filter((i) => i.severity === "error").length;
  const warningCount = validationIssues.filter((i) => i.severity === "warning").length;

  return (
    <>
      <header className="h-14 bg-black/40 backdrop-blur-xl border-b border-white/10 px-6 flex items-center justify-between text-xs select-none z-30 relative">
        {/* Brand & Workflow Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500/50 rounded bg-cyan-500/10 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <div className="w-4 h-4 bg-cyan-500/20 border border-cyan-400 rounded-xs" />
            </div>
            <div>
              <h1 className="font-bold tracking-[0.2em] text-xs text-cyan-400 leading-tight font-mono">
                PASSAGE // ARCHON
              </h1>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest font-medium font-mono">
                Workflow Surveillance Unit
              </p>
            </div>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Workflow Picker */}
          <select
            value={activeWorkflowId}
            onChange={(e) => setActiveWorkflowId(e.target.value)}
            className="bg-white/5 border border-white/10 hover:border-cyan-500/50 text-slate-200 font-semibold text-xs px-3 py-1.5 rounded-lg outline-none font-mono focus:border-cyan-400 transition-colors"
          >
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id} className="bg-[#020617] text-slate-200">
                {wf.name} (v{wf.version})
              </option>
            ))}
          </select>

          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[9px] uppercase font-bold tracking-wider">
            {activeWorkflow?.status || "Published"}
          </span>
        </div>

        {/* Main Navigation Tabs */}
        <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 backdrop-blur-sm">
          {[
            { id: "designer", label: "Designer", icon: Layers },
            { id: "runs", label: "Runs", icon: Activity },
            { id: "workflows", label: "Workflows", icon: List },
            { id: "connections", label: "Connections", icon: Plug },
            { id: "components", label: "Components", icon: Package },
            { id: "settings", label: "Governance", icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavigationTab)}
                className={`px-3 py-1 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                    : "text-slate-400 hover:text-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls & Validation Status */}
        <div className="flex items-center gap-3">
          {/* Validation Pill */}
          <div
            className={`px-3 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider border flex items-center gap-1.5 ${
              errorCount > 0
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : warningCount > 0
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            }`}
          >
            {errorCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>
              {errorCount > 0
                ? `${errorCount} ERRORS`
                : warningCount > 0
                ? `${warningCount} WARNINGS`
                : "VALIDATED"}
            </span>
          </div>

          {/* AI Workflow Creator */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Describe (AI)</span>
          </button>

          {/* Run / Simulate */}
          <button
            onClick={() => {
              startNewRun(activeWorkflow.id);
              setActiveTab("runs");
            }}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Simulate Case</span>
          </button>
        </div>
      </header>

      <DescribeWorkflowModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </>
  );
};
