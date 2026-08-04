import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  Layers,
  Bot,
  Globe,
  UserCheck,
  Shield,
  FileCode,
  History,
  Info,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { GuardBuilder } from "./GuardBuilder";
import { ActionConfigModal } from "./ActionConfigModal";
import { ActionDefinition, StateType } from "../../types/workflow";

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
  } = useWorkflowStore();

  const [activeTab, setActiveTab] = useState<InspectorTab>("state");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionPhase, setActionPhase] = useState<"entry" | "active" | "exit">("active");
  const [editingAction, setEditingAction] = useState<ActionDefinition | undefined>(undefined);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);
  const activeState = activeWorkflow?.states.find((s) => s.id === selectedStateId);

  // Find transition if transition is selected
  const activeTransition = activeWorkflow?.states
    .flatMap((s) => s.transitions || [])
    .find((t) => t.id === selectedTransitionId);

  if (!activeState && !activeTransition) {
    return (
      <div className="w-80 border-l border-white/10 bg-black/30 backdrop-blur-xl p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
          <Layers className="w-6 h-6" />
        </div>
        <p className="font-bold text-sm text-slate-100 tracking-wider font-mono uppercase">State Inspector</p>
        <p className="leading-relaxed font-sans text-slate-400">
          Click any state or transition arrow on the canvas to configure lifecycle actions, guards, and SLA rules.
        </p>
      </div>
    );
  }

  // IF TRANSITION IS SELECTED
  if (activeTransition) {
    return (
      <div className="w-80 border-l border-white/10 bg-black/30 backdrop-blur-xl flex flex-col h-full overflow-hidden text-xs z-20">
        <div className="px-4 py-3.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-100 font-mono">Route Inspector</span>
          </div>
          <button
            onClick={() => setSelectedTransitionId(null)}
            className="p-1 rounded text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-1">Route Event Trigger</label>
            <input
              type="text"
              value={activeTransition.event}
              onChange={(e) =>
                updateTransition(activeWorkflowId, activeTransition.id, { event: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-cyan-400 font-mono font-bold outline-none focus:border-cyan-400"
              placeholder="e.g. VALIDATION_PASSED"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-mono text-[10px] uppercase tracking-wider mb-1">Target State ID</label>
            <select
              value={activeTransition.targetStateId}
              onChange={(e) =>
                updateTransition(activeWorkflowId, activeTransition.id, { targetStateId: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold outline-none focus:border-cyan-400"
            >
              {activeWorkflow?.states.map((st) => (
                <option key={st.id} value={st.id} className="bg-[#020617] text-slate-200">
                  {st.name} ({st.id})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 border-t border-white/10">
            <GuardBuilder
              guard={activeTransition.guard}
              onChange={(guard) =>
                updateTransition(activeWorkflowId, activeTransition.id, { guard })
              }
            />
          </div>

          <button
            onClick={() => deleteTransition(activeWorkflowId, activeTransition.id)}
            className="w-full py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-4 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Route Transition</span>
          </button>
        </div>
      </div>
    );
  }

  // IF STATE IS SELECTED
  return (
    <div className="w-80 border-l border-white/10 bg-black/30 backdrop-blur-xl flex flex-col h-full overflow-hidden text-xs z-20">
      {/* State Inspector Header */}
      <div className="px-4 py-3.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-xs font-mono uppercase tracking-widest text-slate-100">State Inspector</span>
        </div>
        <button
          onClick={() => setSelectedStateId(null)}
          className="p-1 rounded text-slate-400 hover:text-slate-100"
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
              <label className="block text-[#8c98ae] font-mono mb-1">State Name</label>
              <input
                type="text"
                value={activeState.name}
                onChange={(e) => updateState(activeWorkflowId, activeState.id, { name: e.target.value })}
                className="w-full px-3 py-2 rounded bg-[#131a28] border border-[#253047] text-[#eef3ff] font-bold text-sm outline-none focus:border-[#45e0d1]"
              />
            </div>

            <div>
              <label className="block text-[#8c98ae] font-mono mb-1">State Type</label>
              <select
                value={activeState.type}
                onChange={(e) =>
                  updateState(activeWorkflowId, activeState.id, {
                    type: e.target.value as StateType,
                  })
                }
                className="w-full px-3 py-2 rounded bg-[#131a28] border border-[#253047] text-[#eef3ff] font-semibold outline-none"
              >
                <option value="start">Start State</option>
                <option value="atomic">Standard / Atomic State</option>
                <option value="decision">Decision State</option>
                <option value="parallel">Parallel State (Run Together)</option>
                <option value="waiting">Waiting State</option>
                <option value="approval">Human Approval State</option>
                <option value="final">Final / End State</option>
              </select>
            </div>

            <div>
              <label className="block text-[#8c98ae] font-mono mb-1">Description</label>
              <textarea
                rows={3}
                value={activeState.description || ""}
                onChange={(e) =>
                  updateState(activeWorkflowId, activeState.id, { description: e.target.value })
                }
                placeholder="Explain the purpose of this state step..."
                className="w-full p-2.5 rounded bg-[#131a28] border border-[#253047] text-[#eef3ff] outline-none"
              />
            </div>

            <button
              onClick={() => deleteState(activeWorkflowId, activeState.id)}
              className="w-full py-2.5 rounded-xl bg-[#ff6b7a]/10 hover:bg-[#ff6b7a]/20 border border-[#ff6b7a]/30 text-[#ff6b7a] font-bold flex items-center justify-center gap-1.5 transition-all mt-6"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete State</span>
            </button>
          </div>
        )}

        {activeTab === "actions" && activeState && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#eef3ff]">State Actions</span>
              <button
                onClick={() => {
                  setEditingAction(undefined);
                  setActionPhase("active");
                  setIsActionModalOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#45e0d1] text-[#080b12] font-bold flex items-center gap-1 hover:bg-[#38c9bb]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Action</span>
              </button>
            </div>

            {/* Entry Actions */}
            <div>
              <div className="text-[10px] font-mono uppercase text-[#45e0d1] font-bold mb-1.5">
                ON ENTRY ACTIONS ({activeState.entryActions?.length || 0})
              </div>
              <div className="space-y-1.5">
                {activeState.entryActions?.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-lg bg-[#131a28] border border-[#253047] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-[#45e0d1]" />
                      <span className="font-semibold text-[#eef3ff]">{act.name}</span>
                    </div>
                    <button
                      onClick={() => removeActionFromState(activeWorkflowId, activeState.id, "entry", act.id)}
                      className="text-[#8c98ae] hover:text-[#ff6b7a]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Actions */}
            <div>
              <div className="text-[10px] font-mono uppercase text-[#ffc766] font-bold mb-1.5">
                WHILE ACTIVE ACTIONS ({activeState.activeActions?.length || 0})
              </div>
              <div className="space-y-1.5">
                {activeState.activeActions?.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-lg bg-[#131a28] border border-[#253047] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {act.type === "agent" && <Bot className="w-3.5 h-3.5 text-[#ff5db1]" />}
                      {act.type === "http" && <Globe className="w-3.5 h-3.5 text-[#71a7ff]" />}
                      {act.type === "human_task" && <UserCheck className="w-3.5 h-3.5 text-[#45e0d1]" />}
                      {act.type === "audit" && <Shield className="w-3.5 h-3.5 text-[#ffc766]" />}
                      <span className="font-semibold text-[#eef3ff]">{act.name}</span>
                    </div>
                    <button
                      onClick={() => removeActionFromState(activeWorkflowId, activeState.id, "active", act.id)}
                      className="text-[#8c98ae] hover:text-[#ff6b7a]"
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
              <span className="font-semibold text-[#eef3ff]">Outgoing Routes</span>
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
                className="px-2.5 py-1 rounded-lg bg-[#45e0d1] text-[#080b12] font-bold flex items-center gap-1 hover:bg-[#38c9bb]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Route</span>
              </button>
            </div>

            <div className="space-y-2">
              {activeState.transitions?.map((tr) => (
                <div
                  key={tr.id}
                  onClick={() => setSelectedTransitionId(tr.id)}
                  className="p-3 rounded-xl bg-[#131a28] border border-[#253047] hover:border-[#45e0d1] cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#45e0d1] font-bold">WHEN {tr.event}</span>
                    <span className="text-[10px] text-[#8c98ae]">Priority: {tr.priority || 10}</span>
                  </div>
                  <div className="text-[#8c98ae] flex items-center gap-1.5 font-mono">
                    <span>THEN</span>
                    <ArrowRight className="w-3 h-3 text-[#45e0d1]" />
                    <span className="text-[#eef3ff] font-semibold">{tr.targetStateId}</span>
                  </div>
                  {tr.guard && (
                    <div className="text-[10px] text-[#ffc766] font-mono">
                      IF {tr.guard.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "guards" && activeState && (
          <div>
            <p className="text-[#8c98ae] mb-3">
              Guards evaluate conditions on outgoing transitions from state "{activeState.name}".
            </p>
            {activeState.transitions?.length === 0 ? (
              <p className="text-xs text-[#8c98ae] italic">No outgoing transitions to attach guards to.</p>
            ) : (
              activeState.transitions?.map((tr) => (
                <div key={tr.id} className="p-3 bg-[#131a28] border border-[#253047] rounded-xl mb-3 space-y-2">
                  <div className="font-mono text-[#45e0d1] font-bold">
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
            <div className="p-3.5 rounded-xl bg-[#131a28] border border-[#253047] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#eef3ff]">
                <Clock className="w-4 h-4 text-[#ffc766]" />
                <span>State Timeout SLA</span>
              </div>
              <div>
                <label className="block text-[10px] text-[#8c98ae] font-mono mb-1">
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
                  className="w-full px-3 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] font-mono outline-none"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#131a28] border border-[#253047] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#eef3ff]">
                <Shield className="w-4 h-4 text-[#45e0d1]" />
                <span>Audit & Governance Policy</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8c98ae]">Immutable Audit Logging</span>
                <input
                  type="checkbox"
                  checked={activeState.audit?.immutable ?? true}
                  onChange={(e) =>
                    updateState(activeWorkflowId, activeState.id, {
                      audit: { enabled: true, immutable: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#45e0d1]"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#131a28] border border-[#253047] space-y-2">
              <span className="text-[#45e0d1] font-semibold">Workflow Context References</span>
              <p className="text-[#8c98ae] text-[11px] leading-relaxed">
                Actions and guard conditions in this state inspect and mutate the workflow context:
              </p>
              <pre className="p-2.5 rounded bg-[#0f1420] text-[#eef3ff] text-[11px] overflow-x-auto leading-relaxed border border-[#253047]">
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
