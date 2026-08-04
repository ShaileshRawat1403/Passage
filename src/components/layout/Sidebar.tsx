import React from "react";
import {
  Play,
  Layers,
  GitFork,
  Network,
  Hourglass,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { WorkflowState, StateType } from "../../types/workflow";

export const Sidebar: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    addState,
    validationIssues,
    setSelectedStateId,
  } = useWorkflowStore();

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId);

  const handleAddState = (type: StateType, name: string) => {
    if (!activeWorkflow) return;

    const existingCount = activeWorkflow.states.length;
    const newState: WorkflowState = {
      id: `state-${Date.now().toString().slice(-4)}`,
      name,
      type,
      position: { x: 250 + (existingCount % 3) * 280, y: 150 + Math.floor(existingCount / 3) * 180 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    };

    if (type === "approval") {
      newState.entryActions.push({
        id: `act-review-${Date.now()}`,
        name: "Request Review",
        type: "human_task",
        humanTaskConfig: {
          assigneeRole: "Finance Manager",
          dueHours: 24,
          options: ["APPROVE", "REJECT", "REQUEST_CHANGES"],
        },
      });
      newState.timeout = {
        durationMs: 86400000,
        event: "TIMEOUT_REACHED",
      };
    } else if (type === "decision") {
      newState.transitions.push({
        id: `tr-dec-1-${Date.now()}`,
        sourceStateId: newState.id,
        targetStateId: activeWorkflow.states[0]?.id || "",
        event: "EVALUATE_CONDITION",
        priority: 10,
        guard: {
          id: `guard-${Date.now()}`,
          name: "Sample Guard Rule",
          logic: "ALL",
          conditions: [
            { id: "c1", field: "$.invoice.amount", operator: "greater_than", value: 50000 },
          ],
        },
      });
    }

    addState(activeWorkflow.id, newState);
  };

  return (
    <aside className="w-64 bg-black/30 backdrop-blur-xl border-r border-white/10 flex flex-col h-full text-xs select-none z-20">
      {/* Palette Header */}
      <div className="p-4 border-b border-white/10 bg-white/5">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold font-mono">
          State Palette
        </h3>
        <p className="text-[10px] text-slate-400 mt-1 font-mono">
          Select or add state machine step
        </p>
      </div>

      {/* State Types List */}
      <div className="p-3 overflow-y-auto space-y-2 flex-1">
        {[
          {
            type: "start",
            label: "Start State",
            desc: "Workflow initialization point",
            icon: Play,
            color: "text-cyan-400",
            bg: "hover:border-cyan-400/60 hover:bg-cyan-500/10",
          },
          {
            type: "atomic",
            label: "Standard State",
            desc: "Executes API/agent actions",
            icon: Layers,
            color: "text-blue-400",
            bg: "hover:border-blue-400/60 hover:bg-blue-500/10",
          },
          {
            type: "decision",
            label: "Decision State",
            desc: "Evaluates guards & routes",
            icon: GitFork,
            color: "text-amber-400",
            bg: "hover:border-amber-400/60 hover:bg-amber-500/10",
          },
          {
            type: "parallel",
            label: "Parallel State",
            desc: "Runs concurrent actions",
            icon: Network,
            color: "text-pink-400",
            bg: "hover:border-pink-400/60 hover:bg-pink-500/10",
          },
          {
            type: "waiting",
            label: "Waiting State",
            desc: "Pauses for timer or signal",
            icon: Hourglass,
            color: "text-cyan-400",
            bg: "hover:border-cyan-400/60 hover:bg-cyan-500/10",
          },
          {
            type: "approval",
            label: "Human Approval",
            desc: "Reviewer SLA assignment",
            icon: UserCheck,
            color: "text-indigo-400",
            bg: "hover:border-indigo-400/60 hover:bg-indigo-500/10",
          },
          {
            type: "final",
            label: "Final State",
            desc: "Terminal state completion",
            icon: CheckCircle2,
            color: "text-emerald-400",
            bg: "hover:border-emerald-400/60 hover:bg-emerald-500/10",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              onClick={() => handleAddState(item.type as StateType, item.label)}
              className={`w-full p-2.5 rounded-xl bg-white/5 border border-white/10 ${item.bg} text-left transition-all flex items-center justify-between group backdrop-blur-sm cursor-pointer`}
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-black/40 border border-white/10">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <div className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">{item.desc}</div>
                </div>
              </div>
              <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
            </button>
          );
        })}
      </div>

      {/* Validation Health Telemetry Box */}
      <div className="p-3 border-t border-white/10 bg-white/5 backdrop-blur-md space-y-2">
        <div className="flex items-center justify-between font-mono font-semibold text-slate-300">
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Telemetry Health
          </span>
          <span className="text-cyan-400 text-[10px]">
            {validationIssues.length} {validationIssues.length === 1 ? "ISSUE" : "ISSUES"}
          </span>
        </div>

        {validationIssues.length === 0 ? (
          <div className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-mono bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Deterministic state clean</span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
            {validationIssues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => issue.stateId && setSelectedStateId(issue.stateId)}
                className={`p-2 rounded-lg border cursor-pointer text-[10px] font-mono leading-tight ${
                  issue.severity === "error"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                }`}
              >
                {issue.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
