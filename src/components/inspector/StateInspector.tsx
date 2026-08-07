import React, { useState, useCallback } from "react";
import {
  X,
  Plus,
  Trash2,
  Zap,
  ArrowRight,
  Clock,
  Layers,
  Bot,
  Globe,
  UserCheck,
  Shield,
  ChevronRight,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { useLayoutStore } from "../../store/layoutStore";
import { GuardBuilder } from "./GuardBuilder";
import { ActionConfigModal } from "./ActionConfigModal";
import { ActionDefinition, StateType } from "../../types/workflow";
import { HumanReadableTransitionEditor } from "./HumanReadableTransitionEditor";
import { classifyWorkflowEdges } from "../../lib/layout/classification";
import { formatGuard } from "../../domain/transitionFormatter";

type InspectorTab = "state" | "actions" | "transitions" | "guards" | "policies" | "data" | "history";

export const StateInspector: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    selectedStateId,
    selectedTransitionId,
    setSelectedStateId,
    setSelectedTransitionId,
    updateState,
    deleteState,
    addActionToState,
    removeActionFromState,
    addTransition,
    updateTransition,
    deleteTransition,
    validationIssues,
  } = useWorkflowStore();

  const {
    inspectorWidth,
    setInspectorWidth,
    isInspectorOpen,
    toggleInspector,
  } = useLayoutStore();

  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState<InspectorTab>("state");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionPhase, setActionPhase] = useState<"entry" | "active" | "exit">("active");
  const [editingAction, setEditingAction] = useState<ActionDefinition | undefined>(undefined);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
  const activeState = activeWorkflow?.states.find((s) => s.id === selectedStateId);

  const activeTransition = activeWorkflow?.states
    .flatMap((s) => s.transitions || [])
    .find((t) => t.id === selectedTransitionId);

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

  if (!activeState && !activeTransition) {
    return (
      <div
        style={{ width: `${inspectorWidth}px` }}
        className="relative border-l border-white/10 bg-black/30 backdrop-blur-xl p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3 shrink-0 select-none z-20 transition-[width] duration-75"
      >
        {/* Adjustable Resizer Handle on Left Edge */}
        <div
          onMouseDown={startResizing}
          onDoubleClick={() => setInspectorWidth(320)}
          title="Drag edge to adjust inspector drawer width (Double-click to reset)"
          className={`absolute top-0 left-0 w-2.5 h-full cursor-col-resize z-30 group flex items-center justify-center transition-colors ${
            isResizing ? "bg-cyan-500/40" : "hover:bg-cyan-500/20"
          }`}
        >
          <div className="w-0.5 h-10 rounded-full bg-white/20 group-hover:bg-cyan-400 group-hover:shadow-[0_0_8px_#22d3ee] transition-all" />
        </div>

        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]">
          <Layers className="w-6 h-6" />
        </div>
        <p className="font-bold text-sm text-slate-100 tracking-wider font-mono uppercase">State Inspector</p>
        <p className="leading-relaxed font-sans text-slate-400">
          Click any state or transition arrow on the canvas to configure lifecycle actions, guards, and SLA rules.
        </p>
        <button
          onClick={toggleInspector}
          className="mt-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
        >
          <span>Hide Drawer</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // IF TRANSITION IS SELECTED
  if (activeTransition && activeWorkflow) {
    return (
      <div
        style={{ width: `${inspectorWidth}px` }}
        className="relative border-l border-white/10 bg-black/30 backdrop-blur-xl flex flex-col h-full overflow-hidden text-xs z-20 shrink-0 select-none transition-[width] duration-75"
      >
        {/* Adjustable Resizer Handle on Left Edge */}
        <div
          onMouseDown={startResizing}
          onDoubleClick={() => setInspectorWidth(320)}
          title="Drag edge to adjust inspector drawer width (Double-click to reset)"
          className={`absolute top-0 left-0 w-2.5 h-full cursor-col-resize z-30 group flex items-center justify-center transition-colors ${
            isResizing ? "bg-cyan-500/40" : "hover:bg-cyan-500/20"
          }`}
        >
          <div className="w-0.5 h-10 rounded-full bg-white/20 group-hover:bg-cyan-400 group-hover:shadow-[0_0_8px_#22d3ee] transition-all" />
        </div>

        <div className="px-4 py-3.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-100 font-mono">
              Route Inspector
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedTransitionId(null)}
              className="p-1 rounded text-slate-400 hover:text-slate-100 cursor-pointer"
              title="Close Route Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <HumanReadableTransitionEditor
            workflow={activeWorkflow}
            transition={activeTransition}
            validationIssues={validationIssues}
          />
        </div>
      </div>
    );
  }

  // IF STATE IS SELECTED
  return (
    <div
      style={{ width: `${inspectorWidth}px` }}
      className="relative border-l border-white/10 bg-black/30 backdrop-blur-xl flex flex-col h-full overflow-hidden text-xs z-20 shrink-0 select-none transition-[width] duration-75"
    >
      {/* Adjustable Resizer Handle on Left Edge */}
      <div
        onMouseDown={startResizing}
        onDoubleClick={() => setInspectorWidth(320)}
        title="Drag edge to adjust inspector drawer width (Double-click to reset)"
        className={`absolute top-0 left-0 w-2.5 h-full cursor-col-resize z-30 group flex items-center justify-center transition-colors ${
          isResizing ? "bg-cyan-500/40" : "hover:bg-cyan-500/20"
        }`}
      >
        <div className="w-0.5 h-10 rounded-full bg-white/20 group-hover:bg-cyan-400 group-hover:shadow-[0_0_8px_#22d3ee] transition-all" />
      </div>

      {/* State Inspector Header */}
      <div className="px-4 py-3.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-xs font-mono uppercase tracking-widest text-slate-100">State Inspector</span>
        </div>
        <button
          onClick={() => setSelectedStateId(null)}
          className="p-1 rounded text-slate-400 hover:text-slate-100 cursor-pointer"
          title="Close State Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-black/20 overflow-x-auto no-scrollbar">
        {[
          { id: "state", label: "State" },
          { id: "actions", label: "Actions" },
          { id: "transitions", label: "Routes" },
          { id: "guards", label: "Guards" },
          { id: "policies", label: "Policies" },
          { id: "data", label: "Data" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as InspectorTab)}
            className={`px-3 py-2 font-mono font-semibold text-[11px] whitespace-nowrap border-b-2 transition-all cursor-pointer ${
              activeTab === t.id
                ? "border-cyan-400 text-cyan-400 bg-white/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 overflow-y-auto flex-1 space-y-4">
        {activeTab === "state" && activeState && (
          <div className="space-y-4">
            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">State Name</label>
              <input
                type="text"
                value={activeState.name}
                onChange={(e) => updateState(activeWorkflowId, activeState.id, { name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 font-bold text-sm outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">State Type</label>
              <select
                value={activeState.type}
                onChange={(e) =>
                  updateState(activeWorkflowId, activeState.id, {
                    type: e.target.value as StateType,
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 font-semibold outline-none focus:border-cyan-400"
              >
                <option value="start" className="bg-[#020617]">Start State</option>
                <option value="atomic" className="bg-[#020617]">Standard / Atomic State</option>
                <option value="decision" className="bg-[#020617]">Decision State</option>
                <option value="parallel" className="bg-[#020617]">Parallel State (Run Together)</option>
                <option value="waiting" className="bg-[#020617]">Waiting State</option>
                <option value="approval" className="bg-[#020617]">Human Approval State</option>
                <option value="final" className="bg-[#020617]">Final / End State</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">Description</label>
              <textarea
                rows={3}
                value={activeState.description || ""}
                onChange={(e) =>
                  updateState(activeWorkflowId, activeState.id, { description: e.target.value })
                }
                placeholder="Explain the purpose of this state step..."
                className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 outline-none focus:border-cyan-400"
              />
            </div>

            <button
              onClick={() => deleteState(activeWorkflowId, activeState.id)}
              className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold flex items-center justify-center gap-1.5 transition-all mt-6 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete State</span>
            </button>
          </div>
        )}

        {activeTab === "actions" && activeState && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">State Actions</span>
              <button
                onClick={() => {
                  setEditingAction(undefined);
                  setActionPhase("active");
                  setIsActionModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-cyan-400 text-slate-950 font-bold flex items-center gap-1 hover:bg-cyan-300 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Action</span>
              </button>
            </div>

            {/* Entry Actions */}
            <div>
              <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold mb-1.5">
                ON ENTRY ACTIONS ({activeState.entryActions?.length || 0})
              </div>
              <div className="space-y-1.5">
                {activeState.entryActions?.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-semibold text-slate-200">{act.name}</span>
                    </div>
                    <button
                      onClick={() => removeActionFromState(activeWorkflowId, activeState.id, "entry", act.id)}
                      className="text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Actions */}
            <div>
              <div className="text-[10px] font-mono uppercase text-amber-400 font-bold mb-1.5">
                WHILE ACTIVE ACTIONS ({activeState.activeActions?.length || 0})
              </div>
              <div className="space-y-1.5">
                {activeState.activeActions?.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {act.type === "agent" && <Bot className="w-3.5 h-3.5 text-pink-400" />}
                      {act.type === "http" && <Globe className="w-3.5 h-3.5 text-blue-400" />}
                      {act.type === "human_task" && <UserCheck className="w-3.5 h-3.5 text-cyan-400" />}
                      {act.type === "audit" && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                      <span className="font-semibold text-slate-200">{act.name}</span>
                    </div>
                    <button
                      onClick={() => removeActionFromState(activeWorkflowId, activeState.id, "active", act.id)}
                      className="text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "transitions" && activeState && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Outgoing Routes</span>
              <button
                onClick={() => {
                  const targetState = activeWorkflow?.states.find((s) => s.id !== activeState.id);
                  if (targetState) {
                    addTransition(activeWorkflowId, {
                      id: "",
                      sourceStateId: activeState.id,
                      targetStateId: targetState.id,
                      event: "NEXT_EVENT",
                      priority: 10,
                    });
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-cyan-400 text-slate-950 font-bold flex items-center gap-1 hover:bg-cyan-300 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Route</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {(() => {
                const edgeKinds = activeWorkflow ? classifyWorkflowEdges(activeWorkflow) : {};
                return activeState.transitions?.map((tr) => {
                  const targetState = activeWorkflow?.states.find((s) => s.id === tr.targetStateId);
                  const targetName = targetState ? targetState.name : tr.targetStateId;
                  const kind = edgeKinds[tr.id] || "forward";
                  const guardSummary = formatGuard(tr.guard);

                  return (
                    <div
                      key={tr.id}
                      onClick={() => setSelectedTransitionId(tr.id)}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400 cursor-pointer transition-all space-y-2 group hover:bg-white/[0.07]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-cyan-400 font-bold text-xs truncate">
                          WHEN {tr.event || "NO_EVENT"}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[9px] font-bold">
                            P{tr.priority ?? 10}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                              kind === "loopback"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : kind === "branch"
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : kind === "self_loop"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            }`}
                          >
                            {kind}
                          </span>
                        </div>
                      </div>

                      <div className="text-slate-200 flex items-center gap-1.5 font-sans font-medium">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">THEN</span>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-semibold text-slate-100">{targetName}</span>
                        {targetState && (
                          <span className="text-[10px] text-slate-400 font-mono">({tr.targetStateId})</span>
                        )}
                      </div>

                      {guardSummary ? (
                        <div className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 truncate">
                          IF {guardSummary}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-sans italic">
                          No conditions (Always eligible)
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {activeTab === "guards" && activeState && (
          <div>
            <p className="text-slate-400 mb-3 leading-relaxed">
              Guards evaluate conditions on outgoing transitions from state "{activeState.name}".
            </p>
            {activeState.transitions?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No outgoing transitions to attach guards to.</p>
            ) : (
              activeState.transitions?.map((tr) => (
                <div key={tr.id} className="p-3 bg-white/5 border border-white/10 rounded-xl mb-3 space-y-2">
                  <div className="font-mono text-cyan-400 font-bold">
                    Route to {tr.targetStateId} (Trigger: {tr.event})
                  </div>
                  <GuardBuilder
                    guard={tr.guard}
                    onChange={(guard) => updateTransition(activeWorkflowId, tr.id, { guard })}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "policies" && activeState && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>State Timeout SLA</span>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-mono mb-1 uppercase tracking-wider">
                  Timeout Duration (Hours)
                </label>
                <input
                  type="number"
                  value={
                    activeState.timeout?.durationMs
                      ? Math.round(activeState.timeout.durationMs / 3600000)
                      : 24
                  }
                  onChange={(e) =>
                    updateState(activeWorkflowId, activeState.id, {
                      timeout: {
                        durationMs: Number(e.target.value) * 3600000,
                        event: "TIMEOUT_REACHED",
                      },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-slate-200 font-mono outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>Activity & Governance Policy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Immutable Activity Logging</span>
                <input
                  type="checkbox"
                  checked={activeState.audit?.immutable ?? true}
                  onChange={(e) =>
                    updateState(activeWorkflowId, activeState.id, {
                      audit: { enabled: true, immutable: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-cyan-400"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <span className="text-cyan-400 font-semibold">Workflow Context References</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Actions and guard conditions in this state inspect and mutate the workflow context:
              </p>
              <pre className="p-2.5 rounded-lg bg-black/40 text-slate-200 text-[11px] overflow-x-auto leading-relaxed border border-white/10">
{`$.invoice.amount
$.invoice.vendorId
$.validation.schemaValid
$.validation.vendorActive
$.analysis.riskScore`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      <ActionConfigModal
        isOpen={isActionModalOpen}
        action={editingAction}
        onClose={() => setIsActionModalOpen(false)}
        onSave={(newAct) => {
          if (activeState) {
            addActionToState(activeWorkflowId, activeState.id, actionPhase, newAct);
          }
        }}
      />
    </div>
  );
};
