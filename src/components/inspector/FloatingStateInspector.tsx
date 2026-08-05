import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  Zap,
  ArrowRight,
  Clock,
  Layers,
  Bot,
  Globe,
  UserCheck,
  Shield,
  GripHorizontal,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { GuardBuilder } from "./GuardBuilder";
import { ActionConfigModal } from "./ActionConfigModal";
import { ActionDefinition, StateType } from "../../types/workflow";
import { HumanReadableTransitionEditor } from "./HumanReadableTransitionEditor";
import { classifyWorkflowEdges } from "../../lib/layout/classification";
import { formatGuard } from "../../domain/transitionFormatter";

type InspectorTab = "state" | "actions" | "transitions" | "guards" | "policies" | "data";

export const FloatingStateInspector: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    selectedStateId,
    selectedTransitionId,
    setSelectedStateId,
    setSelectedTransitionId,
    updateState,
    duplicateState,
    deleteState,
    addActionToState,
    removeActionFromState,
    addTransition,
    updateTransition,
    deleteTransition,
    validationIssues,
  } = useWorkflowStore();

  const [activeTab, setActiveTab] = useState<InspectorTab>("state");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionPhase, setActionPhase] = useState<"entry" | "active" | "exit">("active");
  const [editingAction, setEditingAction] = useState<ActionDefinition | undefined>(undefined);
  const [isMinimized, setIsMinimized] = useState(false);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
  const activeState = activeWorkflow?.states.find((s) => s.id === selectedStateId);

  const activeTransition = activeWorkflow?.states
    .flatMap((s) => s.transitions || [])
    .find((t) => t.id === selectedTransitionId);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking the header / drag handle area
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input") || (e.target as HTMLElement).closest("select")) {
      return;
    }
    isDraggingRef.current = true;
    const cardElement = (e.currentTarget as HTMLElement).closest(".floating-inspector-card");
    if (cardElement) {
      const rect = cardElement.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = Math.max(16, Math.min(window.innerWidth - 380, moveEvent.clientX - dragOffsetRef.current.x));
      const newY = Math.max(60, Math.min(window.innerHeight - 300, moveEvent.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Keyboard shortcut ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedStateId(null);
        setSelectedTransitionId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedStateId, setSelectedTransitionId]);

  if (!activeState && !activeTransition) {
    return null;
  }

  const containerStyle: React.CSSProperties = position
    ? { position: "fixed", left: `${position.x}px`, top: `${position.y}px` }
    : { position: "absolute", top: "20px", right: "20px" };

  return (
    <div
      style={containerStyle}
      className="floating-inspector-card z-40 w-[360px] sm:w-[400px] max-h-[82vh] bg-[#090d16]/95 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_15px_50px_rgba(0,0,0,0.85)] rounded-2xl flex flex-col overflow-hidden text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <GripHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
          {activeState ? (
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
              <span className="font-bold text-slate-100 font-mono truncate text-xs">
                {activeState.name}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono text-[9px] uppercase font-bold shrink-0">
                {activeState.type}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate">
              <ArrowRight className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-bold text-slate-100 font-mono truncate text-xs">
                Route: {activeTransition?.event}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 cursor-pointer"
            title={isMinimized ? "Expand Inspector" : "Minimize Inspector"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => {
              setSelectedStateId(null);
              setSelectedTransitionId(null);
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10 cursor-pointer"
            title="Close Floating Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* IF TRANSITION IS SELECTED */}
          {activeTransition && activeWorkflow && (
            <div className="p-4 overflow-y-auto flex-1">
              <HumanReadableTransitionEditor
                workflow={activeWorkflow}
                transition={activeTransition}
                validationIssues={validationIssues}
              />
            </div>
          )}

          {/* IF STATE IS SELECTED */}
          {activeState && (
            <>
              {/* Navigation Tabs */}
              <div className="flex border-b border-white/10 bg-black/40 overflow-x-auto no-scrollbar shrink-0">
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
                    className={`px-3 py-2 font-mono font-semibold text-[10px] sm:text-[11px] whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                      activeTab === t.id
                        ? "border-cyan-400 text-cyan-400 bg-white/5"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Body */}
              <div className="p-4 overflow-y-auto flex-1 space-y-4 max-h-[60vh]">
                {activeTab === "state" && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                        State Name
                      </label>
                      <input
                        type="text"
                        value={activeState.name}
                        onChange={(e) => updateState(activeWorkflowId, activeState.id, { name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 font-bold text-sm outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                        State Type
                      </label>
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
                        <option value="parallel" className="bg-[#020617]">Parallel State</option>
                        <option value="waiting" className="bg-[#020617]">Waiting State</option>
                        <option value="approval" className="bg-[#020617]">Human Approval State</option>
                        <option value="final" className="bg-[#020617]">Final / End State</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-mono mb-1 text-[10px] uppercase tracking-wider">
                        Description
                      </label>
                      <textarea
                        rows={2.5}
                        value={activeState.description || ""}
                        onChange={(e) =>
                          updateState(activeWorkflowId, activeState.id, { description: e.target.value })
                        }
                        placeholder="Explain purpose of this state..."
                        className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-200 outline-none focus:border-cyan-400 resize-none text-xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <button
                        onClick={() => duplicateState(activeWorkflowId, activeState.id)}
                        className="flex-1 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Duplicate</span>
                      </button>
                      <button
                        onClick={() => {
                          deleteState(activeWorkflowId, activeState.id);
                          setSelectedStateId(null);
                        }}
                        className="flex-1 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Node</span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === "actions" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 font-mono text-xs">State Executions</span>
                      <button
                        onClick={() => {
                          setEditingAction(undefined);
                          setActionPhase("active");
                          setIsActionModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-400 text-slate-950 font-bold flex items-center gap-1 hover:bg-cyan-300 transition-colors cursor-pointer text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Action</span>
                      </button>
                    </div>

                    {/* Entry Actions */}
                    <div>
                      <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold mb-1.5">
                        ON ENTRY ({activeState.entryActions?.length || 0})
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
                              className="text-slate-400 hover:text-rose-400 cursor-pointer p-1"
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
                        WHILE ACTIVE ({activeState.activeActions?.length || 0})
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
                              className="text-slate-400 hover:text-rose-400 cursor-pointer p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "transitions" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">Outgoing Routes</span>
                      <button
                        onClick={() => {
                          const targetState = activeWorkflow?.states.find((s) => s.id !== activeState.id);
                          if (targetState) {
                            addTransition(activeWorkflowId, {
                              id: `tr-${Date.now()}`,
                              sourceStateId: activeState.id,
                              targetStateId: targetState.id,
                              event: "NEXT_EVENT",
                              priority: 10,
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-400 text-slate-950 font-bold flex items-center gap-1 hover:bg-cyan-300 transition-colors cursor-pointer text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Route</span>
                      </button>
                    </div>

                    <div className="space-y-2">
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
                              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-400 cursor-pointer transition-all space-y-1.5 group hover:bg-white/[0.07]"
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

                {activeTab === "guards" && (
                  <div className="space-y-3">
                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      Configure conditional guards on outgoing transitions for state "{activeState.name}".
                    </p>
                    {activeState.transitions?.map((tr) => (
                      <div key={tr.id} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
                        <div className="font-mono text-cyan-400 font-bold">
                          Route to {tr.targetStateId} (Trigger: {tr.event})
                        </div>
                        <GuardBuilder
                          guard={tr.guard}
                          onChange={(guard) => updateTransition(activeWorkflowId, tr.id, { guard })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "policies" && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-200">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>SLA Timeout Policy</span>
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

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-slate-200">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span>Audit & Governance Policy</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Immutable Audit Trail</span>
                        <input
                          type="checkbox"
                          checked={activeState.audit?.immutable ?? true}
                          onChange={(e) =>
                            updateState(activeWorkflowId, activeState.id, {
                              audit: { enabled: true, immutable: e.target.checked },
                            })
                          }
                          className="w-4 h-4 accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "data" && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <span className="text-cyan-400 font-semibold">Workflow Context Keys</span>
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
            </>
          )}

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
        </>
      )}
    </div>
  );
};
