import React from "react";
import {
  Activity,
  Layers,
  Clock,
  Play,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export const DashboardView: React.FC = () => {
  const { workflows, activeRuns, setActiveWorkflowId, setActiveTab } = useWorkflowStore();

  const totalWorkflows = workflows.length;
  const runningCases = activeRuns.filter((r) => r.status === "active").length;
  const waitingApprovals = activeRuns.filter((r) => r.status === "waiting").length;
  const completedRuns = activeRuns.filter((r) => r.status === "completed").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 text-xs">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-100 tracking-wider uppercase">
            Passage Operational Dashboard
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 font-sans">
            Durable visual state-machine execution metrics and live case telemetry.
          </p>
        </div>

        <button
          onClick={() => setActiveTab("designer")}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] transition-all text-xs cursor-pointer shrink-0"
        >
          <Play className="w-4 h-4 fill-slate-950" />
          <span>Open Designer</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Active Workflows",
            value: totalWorkflows,
            sub: "Published & Draft",
            icon: Layers,
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/30",
          },
          {
            title: "Running Cases",
            value: runningCases,
            sub: "Executing states",
            icon: Activity,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/30",
          },
          {
            title: "Waiting Approvals",
            value: waitingApprovals,
            sub: "Pending SLA response",
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/30",
          },
          {
            title: "Completed Cases",
            value: completedRuns,
            sub: "Reached terminal state",
            icon: CheckCircle2,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/30",
          },
        ].map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              className={`p-4 sm:p-5 rounded-2xl bg-black/30 backdrop-blur-xl border ${m.border} shadow-2xl space-y-3`}
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wider">{m.title}</span>
                <div className={`p-2 rounded-xl ${m.bg} ${m.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-100">{m.value}</div>
              <div className="text-[11px] text-slate-400 font-mono">{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Workflow Process Cards */}
      <div className="space-y-4">
        <h2 className="font-bold font-mono text-sm uppercase tracking-wider text-slate-200">Configured Workflow Maps</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => {
                setActiveWorkflowId(wf.id);
                setActiveTab("designer");
              }}
              className="p-5 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 cursor-pointer transition-all shadow-2xl space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-100 group-hover:text-cyan-400 transition-colors">
                    {wf.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-cyan-400 border border-white/10">
                    v{wf.version}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              </div>

              <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 font-sans">
                {wf.description}
              </p>

              <div className="flex items-center gap-4 pt-2 border-t border-white/10 text-[11px] font-mono text-slate-400">
                <span>{wf.states?.length || 0} States</span>
                <span>•</span>
                <span>
                  {wf.states?.reduce((acc, s) => acc + (s.transitions?.length || 0), 0)} Transitions
                </span>
                <span className="ml-auto text-emerald-400 capitalize font-bold">{wf.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
