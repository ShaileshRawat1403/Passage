import React, { useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Play,
  Layers,
  Database,
  ArrowRight,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { useLayoutStore } from "../../store/layoutStore";

type DiagnosticsTab = "health" | "telemetry" | "copilot";

export const WorkflowDiagnosticsPanel: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    activeRunId,
    activeRuns,
    validationIssues,
    setSelectedStateId,
    setSelectedTransitionId,
  } = useWorkflowStore();

  const {
    inspectorWidth,
    setInspectorWidth,
    isInspectorOpen,
    toggleInspector,
  } = useLayoutStore();

  const [activeTab, setActiveTab] = useState<DiagnosticsTab>("health");
  const [isResizing, setIsResizing] = useState(false);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
  const activeRun = activeRuns.find((r) => r.id === activeRunId);

  const errors = validationIssues.filter((i) => i.severity === "error");
  const warnings = validationIssues.filter((i) => i.severity === "warning");

  const startResizing = useCallback(
    (mouseDownEvent: React.MouseEvent) => {
      mouseDownEvent.preventDefault();
      setIsResizing(true);

      const startX = mouseDownEvent.clientX;
      const startWidth = inspectorWidth;

      const onMouseMove = (mouseMoveEvent: MouseEvent) => {
        const currentX = mouseMoveEvent.clientX;
        const newWidth = startWidth + (startX - currentX);
        setInspectorWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [inspectorWidth, setInspectorWidth]
  );

  if (!isInspectorOpen) {
    return null;
  }

  return (
    <div
      style={{ width: `${inspectorWidth}px` }}
      className="relative border-l border-white/10 bg-black/40 backdrop-blur-xl flex flex-col h-full overflow-hidden text-xs z-20 shrink-0 select-none transition-[width] duration-75"
    >
      {/* Adjustable Resizer Handle on Left Edge */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setInspectorWidth(320)}
        title="Drag edge to adjust width (Double-click to reset)"
        className={`absolute top-0 left-0 w-2.5 h-full cursor-col-resize z-30 group flex items-center justify-center transition-colors ${
          isResizing ? "bg-cyan-500/40" : "hover:bg-cyan-500/20"
        }`}
      >
        <div className="w-0.5 h-10 rounded-full bg-white/20 group-hover:bg-cyan-400 group-hover:shadow-[0_0_8px_#22d3ee] transition-all" />
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-xs uppercase tracking-wider text-slate-100 font-mono">
            Workflow Health & Telemetry
          </span>
        </div>
        <button
          onClick={toggleInspector}
          className="p-1 rounded text-slate-400 hover:text-slate-100 cursor-pointer"
          title="Hide Drawer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-black/30 shrink-0">
        <button
          onClick={() => setActiveTab("health")}
          className={`flex-1 py-2 font-mono text-[11px] font-semibold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "health"
              ? "border-cyan-400 text-cyan-400 bg-white/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Diagnostics ({validationIssues.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`flex-1 py-2 font-mono text-[11px] font-semibold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "telemetry"
              ? "border-cyan-400 text-cyan-400 bg-white/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Live Context</span>
        </button>
        <button
          onClick={() => setActiveTab("copilot")}
          className={`flex-1 py-2 font-mono text-[11px] font-semibold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "copilot"
              ? "border-cyan-400 text-cyan-400 bg-white/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Copilot</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4">
        {activeTab === "health" && (
          <div className="space-y-4">
            {/* Health Score Summary Card */}
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-0.5">
                  Contract Health Status
                </span>
                <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5 font-mono">
                  {errors.length === 0 ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Sealed & Valid
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" /> {errors.length} Critical Issue{errors.length > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 block">Warnings</span>
                <span className="font-mono font-bold text-amber-400">{warnings.length}</span>
              </div>
            </div>

            {/* List of Validation Issues */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Detected Contract Issues
              </span>

              {validationIssues.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                  <p className="font-mono font-bold text-xs">No Contract Deficiencies</p>
                  <p className="text-[11px] text-emerald-300/80">
                    All state machine invariants, reachability, and guard expressions are fully validated.
                  </p>
                </div>
              ) : (
                validationIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      issue.severity === "error"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-200 hover:border-rose-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-200 hover:border-amber-400"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold font-mono text-xs">
                        {issue.severity === "error" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span>{issue.severity === "error" ? "CRITICAL ERROR" : "WARNING"}</span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-300">
                        {issue.id}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-200">{issue.message}</p>

                    {/* Quick Action Button to Open Floating Inspector */}
                    {(issue.stateId || issue.transitionId) && (
                      <button
                        onClick={() => {
                          if (issue.stateId) setSelectedStateId(issue.stateId);
                          if (issue.transitionId) setSelectedTransitionId(issue.transitionId);
                        }}
                        className="w-full mt-1 py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-white/10"
                      >
                        <Zap className="w-3 h-3 text-cyan-400" />
                        <span>Inspect & Fix in Floating Inspector</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "telemetry" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                Active Execution Run
              </span>

              {activeRun ? (
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Run ID:</span>
                    <span className="text-cyan-400 font-bold">{activeRun.id}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Current State:</span>
                    <span className="text-amber-400 font-bold">{activeRun.currentStateId}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-emerald-400 font-bold uppercase">{activeRun.status}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No active simulation run in memory.</p>
              )}
            </div>

            {/* Context Variables Preview */}
            {activeRun && (
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                  Context Variables Payload
                </span>
                <pre className="p-3 rounded-lg bg-black/60 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-white/10 max-h-60 overflow-y-auto">
                  {JSON.stringify(activeRun.context, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === "copilot" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-xs">
                <Sparkles className="w-4 h-4" />
                <span>AI Workflow Architecture Advisor</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                AI inspects state transitions, guard conditions, and SLA policies to optimize your workflow pipeline.
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  title: "Enforce Human Approval SLA",
                  desc: "Add 24h timeout policies to pending approval states.",
                },
                {
                  title: "Guard Fallback Verification",
                  desc: "Ensure default routes exist for decision nodes.",
                },
                {
                  title: "Immutable Audit Log Enforcement",
                  desc: "Enable immutable record policy across all action executions.",
                },
              ].map((rec, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="font-bold text-slate-100 font-mono text-xs">{rec.title}</div>
                  <p className="text-[11px] text-slate-400">{rec.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
