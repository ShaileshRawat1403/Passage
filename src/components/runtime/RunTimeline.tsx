import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  Activity,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export const RunTimeline: React.FC = () => {
  const { activeRuns, activeRunId, dispatchEventToRun } = useWorkflowStore();
  const run = activeRuns.find((r) => r.id === activeRunId) || activeRuns[0];

  if (!run) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs font-mono">
        No active workflow execution run selected.
      </div>
    );
  }

  const handleHumanDecision = (decisionEvent: string) => {
    dispatchEventToRun(run.id, decisionEvent, {
      approval: {
        status: decisionEvent,
        reviewerId: "USER-FINANCE-MGR",
        decidedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-xs">
      {/* Run Overview Header */}
      <div className="p-5 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className="text-base sm:text-lg font-bold font-mono text-slate-100">
              Case {run.caseId}
            </span>
            <span
              className={`px-3 py-0.5 rounded-full font-mono text-xs font-bold uppercase ${
                run.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                  : run.status === "waiting"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/40"
                  : run.status === "failed"
                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/40"
                  : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/40"
              }`}
            >
              {run.status}
            </span>
          </div>
          <p className="text-slate-400 text-xs">
            Workflow: <strong className="text-slate-200">{run.workflowId}</strong> (v{run.workflowVersion}) • Started {new Date(run.startedAt).toLocaleTimeString()}
          </p>
        </div>

        {/* Health Stats */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-6 font-mono">
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Visited States</div>
            <div className="text-base font-bold text-cyan-400">{run.visitedStateIds.length}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Completed Actions</div>
            <div className="text-base font-bold text-emerald-400">{run.completedActionCount}</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Audit Events</div>
            <div className="text-base font-bold text-blue-400">{run.auditTrail.length}</div>
          </div>
        </div>
      </div>

      {/* Human Approval Interaction Card (if pending) */}
      {run.status === "waiting" && run.pendingApproval && (
        <div className="p-5 rounded-2xl bg-black/40 border-2 border-amber-400 shadow-2xl space-y-3 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <h4 className="font-bold text-sm text-slate-100">
                Awaiting Human Approval: {run.pendingApproval.assigneeRole}
              </h4>
            </div>
            <span className="text-xs font-mono text-amber-400 flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5" />
              SLA Due: {new Date(run.pendingApproval.dueAt).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-slate-300 leading-relaxed text-xs">
            Invoice amount (₹{((run.context.invoice as Record<string, unknown>)?.amount as number)?.toLocaleString()}) exceeds standard threshold. Select an action decision:
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              onClick={() => handleHumanDecision("APPROVAL_RECEIVED")}
              className="px-5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Invoice</span>
            </button>
            <button
              onClick={() => handleHumanDecision("REJECTION_RECEIVED")}
              className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Reject Invoice</span>
            </button>
            <button
              onClick={() => handleHumanDecision("CHANGES_REQUESTED")}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-400 font-semibold border border-amber-400/30 transition-colors cursor-pointer"
            >
              Request Changes
            </button>
          </div>
        </div>
      )}

      {/* Timeline Audit Logs */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 font-mono uppercase tracking-wider">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Execution Activity Timeline</span>
        </h3>

        <div className="space-y-2.5 border-l-2 border-white/10 ml-3 pl-4">
          {run.auditTrail.map((item, idx) => (
            <div
              key={item.id || idx}
              className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1.5 relative hover:border-cyan-400/40 transition-all backdrop-blur-sm"
            >
              <div className="absolute -left-[23px] top-4 w-3 h-3 rounded-full bg-cyan-400 border-2 border-slate-950 shadow-[0_0_8px_#22d3ee]" />

              <div className="flex flex-wrap items-center justify-between gap-1 font-mono">
                <span className="font-bold text-cyan-400 uppercase text-[11px]">
                  {item.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {item.stateId && (
                <div className="text-slate-400">
                  State: <strong className="text-slate-200">{item.stateId}</strong>
                </div>
              )}

              {item.guardResult && (
                <div className="p-2 rounded-lg bg-black/40 text-[11px] font-mono text-amber-400 border border-amber-400/20">
                  Guard Evaluation: {item.guardResult.reason}
                </div>
              )}

              {Boolean(item.metadata?.guardReason) && (
                <div className="text-[11px] text-emerald-400 font-mono">
                  Transition Condition: {String(item.metadata?.guardReason)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
