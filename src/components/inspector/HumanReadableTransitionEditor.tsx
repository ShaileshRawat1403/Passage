import React, { useState } from "react";
import {
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Sliders,
  FileText,
} from "lucide-react";
import { TransitionDefinition, WorkflowDefinition, ValidationIssue } from "../../types/workflow";
import { useWorkflowStore } from "../../store/workflowStore";
import { describeTransition, formatGuard } from "../../domain/transitionFormatter";
import { GuardBuilder } from "./GuardBuilder";

interface HumanReadableTransitionEditorProps {
  workflow: WorkflowDefinition;
  transition: TransitionDefinition;
  validationIssues?: ValidationIssue[];
}

export const HumanReadableTransitionEditor: React.FC<HumanReadableTransitionEditorProps> = ({
  workflow,
  transition,
  validationIssues = [],
}) => {
  const {
    updateTransition,
    moveTransitionSource,
    deleteTransition,
  } = useWorkflowStore();

  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const desc = describeTransition(transition, workflow);

  // Filter validation issues for this transition
  const transitionIssues = validationIssues.filter(
    (issue) => issue.transitionId === transition.id
  );

  const handlePriorityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      updateTransition(workflow.id, transition.id, { priority: 0 });
      return;
    }
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      updateTransition(workflow.id, transition.id, { priority: parsed });
    }
  };

  const isGuardIncomplete =
    transition.guard &&
    transition.guard.conditions &&
    transition.guard.conditions.length > 0 &&
    transition.guard.conditions.some((c) => !c.field || !c.field.trim() || !c.operator);

  return (
    <div className="space-y-4 text-xs select-none">
      {/* 1. Route Overview Card */}
      <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-2 font-mono text-[11px] text-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold uppercase text-[10px] w-12 shrink-0">FROM</span>
          <span className="font-semibold text-slate-100">{desc.sourceLabel}</span>
          <span className="text-[10px] text-slate-400 font-normal">({transition.sourceStateId})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold uppercase text-[10px] w-12 shrink-0">WHEN</span>
          <span className="font-semibold text-cyan-300 font-mono font-bold">{desc.eventLabel}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-400 font-bold uppercase text-[10px] w-12 shrink-0 pt-0.5">IF</span>
          <span className="font-semibold text-amber-200 leading-tight">
            {isGuardIncomplete ? (
              <span className="text-amber-400 italic">Incomplete condition — fill in condition rules below</span>
            ) : desc.guardSummary ? (
              desc.guardSummary
            ) : (
              <span className="text-slate-400 font-normal font-sans text-[11px]">
                No condition. This route is eligible whenever its event occurs.
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-bold uppercase text-[10px] w-12 shrink-0">THEN</span>
          <span className="font-semibold text-slate-100">{desc.targetLabel}</span>
          <span className="text-[10px] text-slate-400 font-normal">({transition.targetStateId})</span>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-[10px]">
          <span className="text-purple-400 font-bold uppercase w-12 shrink-0">ORDER</span>
          <span className="text-purple-300 font-bold">{desc.priorityLabel}</span>
          <span className="text-slate-400 ml-auto font-mono text-[10px]">{desc.typeLabel}</span>
        </div>
      </div>

      {/* Inline Validation Issues */}
      {transitionIssues.length > 0 && (
        <div className="space-y-1.5">
          {transitionIssues.map((issue) => (
            <div
              key={issue.id}
              className={`p-2.5 rounded-lg border text-[11px] font-sans flex items-start gap-2 ${
                issue.severity === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <div className="font-semibold uppercase font-mono text-[10px] mb-0.5">
                  {issue.severity}
                </div>
                <div>{issue.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Basic Fields Form */}
      <div className="space-y-3 pt-1">
        <div>
          <label className="block text-slate-400 font-sans text-[11px] font-medium mb-1">
            Transition name
          </label>
          <input
            type="text"
            value={transition.name || ""}
            onChange={(e) =>
              updateTransition(workflow.id, transition.id, { name: e.target.value })
            }
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 font-medium text-xs outline-none focus:border-cyan-400 transition-colors"
            placeholder="e.g. Approve Invoice Route"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-sans text-[11px] font-medium mb-1">
            Description
          </label>
          <textarea
            rows={2}
            value={transition.description || ""}
            onChange={(e) =>
              updateTransition(workflow.id, transition.id, { description: e.target.value })
            }
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-100 font-medium text-xs outline-none focus:border-cyan-400 transition-colors resize-none"
            placeholder="Describe what triggers this route and why..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-400 font-sans text-[11px] font-medium mb-1">
              Move from
            </label>
            <select
              value={transition.sourceStateId}
              onChange={(e) =>
                moveTransitionSource(workflow.id, transition.id, e.target.value)
              }
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold text-xs outline-none focus:border-cyan-400 transition-colors"
            >
              {workflow.states.map((st) => (
                <option key={st.id} value={st.id} className="bg-[#020617] text-slate-200">
                  {st.name} ({st.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-sans text-[11px] font-medium mb-1">
              Move to
            </label>
            <select
              value={transition.targetStateId}
              onChange={(e) =>
                updateTransition(workflow.id, transition.id, { targetStateId: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-semibold text-xs outline-none focus:border-cyan-400 transition-colors"
            >
              {workflow.states.map((st) => (
                <option key={st.id} value={st.id} className="bg-[#020617] text-slate-200">
                  {st.name} ({st.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-400 font-sans text-[11px] font-medium mb-1">
            What event activates this route?
          </label>
          <input
            type="text"
            value={transition.event}
            onChange={(e) =>
              updateTransition(workflow.id, transition.id, { event: e.target.value })
            }
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-cyan-400 font-mono font-bold text-xs outline-none focus:border-cyan-400 transition-colors"
            placeholder="e.g. INVOICE_VALIDATED"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-slate-400 font-sans text-[11px] font-medium">
              Evaluation priority
            </label>
            <span className="text-[10px] text-purple-400 font-mono font-bold">
              Current: {transition.priority ?? 10}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mb-1.5 leading-tight">
            When multiple routes are eligible, higher-priority routes are considered first.
          </p>
          <input
            type="number"
            value={transition.priority ?? 0}
            onChange={handlePriorityChange}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-purple-300 font-mono font-bold text-xs outline-none focus:border-purple-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-sans text-[11px] font-medium mb-1">
            Transition behaviour
          </label>
          <select
            value={transition.type || "external"}
            onChange={(e) =>
              updateTransition(workflow.id, transition.id, {
                type: e.target.value as "external" | "internal",
              })
            }
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-200 font-medium text-xs outline-none focus:border-cyan-400 transition-colors"
          >
            <option value="external" className="bg-[#020617] text-slate-200">
              External Route (moves state to target)
            </option>
            <option value="internal" className="bg-[#020617] text-slate-200">
              Internal Transition (executes actions within state)
            </option>
          </select>
        </div>
      </div>

      {/* 3. Guard Section */}
      <div className="pt-3 border-t border-white/10 space-y-2">
        <div className="text-[11px] font-bold text-slate-200 uppercase font-mono tracking-wider flex items-center justify-between">
          <span>Route Conditions & Guard</span>
        </div>

        {/* Guard Summary Banner above builder */}
        {isGuardIncomplete ? (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
            ⚠️ Guard condition is incomplete. Provide field name and operator.
          </div>
        ) : desc.guardSummary ? (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono leading-relaxed">
            <span className="font-bold text-amber-400">IF </span>
            {desc.guardSummary}
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-sans leading-relaxed">
            No condition. This route is eligible whenever its event occurs.
          </div>
        )}

        <GuardBuilder
          guard={transition.guard}
          onChange={(guard) =>
            updateTransition(workflow.id, transition.id, { guard })
          }
        />
      </div>

      {/* 4. Advanced / Technical Details (Collapsible) */}
      <div className="pt-3 border-t border-white/10">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 text-[11px] font-mono font-semibold flex items-center justify-between transition-all cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Technical Details</span>
          </div>
          {showTechnicalDetails ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="mt-2 p-3 rounded-xl bg-black/50 border border-white/10 space-y-2 text-[11px] font-mono text-slate-400 shadow-inner animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span>Transition ID:</span>
              <span className="text-slate-200 font-bold">{transition.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Source State ID:</span>
              <span className="text-slate-200">{transition.sourceStateId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Target State ID:</span>
              <span className="text-slate-200">{transition.targetStateId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Exact Event Token:</span>
              <span className="text-cyan-400 font-bold">{transition.event}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Permissions:</span>
              <span className="text-slate-200">
                {transition.permissions && transition.permissions.length > 0
                  ? transition.permissions.join(", ")
                  : "None (Public)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Transition Actions:</span>
              <span className="text-slate-200 font-bold">
                {transition.actions?.length || 0}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Delete Route Button */}
      <button
        type="button"
        onClick={() => deleteTransition(workflow.id, transition.id)}
        className="w-full py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-4"
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete Route Transition</span>
      </button>
    </div>
  );
};
