import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Activity,
  Cpu,
  FileText,
  User,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export const RunTimeline: React.FC = () => {
  const { activeRuns, activeRunId, dispatchEventToRun } = useWorkflowStore();
  const run = activeRuns.find((r) => r.id === activeRunId) || activeRuns[0];

  if (!run) {
    return (
      <div className="p-8 text-center text-[#8c98ae] text-xs">
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
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-xs">
      {/* Run Overview Header */}
      <div className="p-5 rounded-2xl bg-[#0f1420] border border-[#253047] shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-lg font-bold font-mono text-[#eef3ff]">
              Case {run.caseId}
            </span>
            <span
              className={`px-3 py-0.5 rounded-full font-mono text-xs font-bold uppercase ${
                run.status === "completed"
                  ? "bg-[#5ee28a]/15 text-[#5ee28a] border border-[#5ee28a]/40"
                  : run.status === "waiting"
                  ? "bg-[#ffc766]/15 text-[#ffc766] border border-[#ffc766]/40"
                  : run.status === "failed"
                  ? "bg-[#ff6b7a]/15 text-[#ff6b7a] border border-[#ff6b7a]/40"
                  : "bg-[#45e0d1]/15 text-[#45e0d1] border border-[#45e0d1]/40"
              }`}
            >
              {run.status}
            </span>
          </div>
          <p className="text-[#8c98ae]">
            Workflow: <strong className="text-[#eef3ff]">{run.workflowId}</strong> (v{run.workflowVersion}) • Started {new Date(run.startedAt).toLocaleTimeString()}
          </p>
        </div>

        {/* Health Stats */}
        <div className="flex items-center gap-4 border-l border-[#253047] pl-6 font-mono">
          <div>
            <div className="text-[#8c98ae]">Visited States</div>
            <div className="text-base font-bold text-[#45e0d1]">{run.visitedStateIds.length}</div>
          </div>
          <div>
            <div className="text-[#8c98ae]">Completed Actions</div>
            <div className="text-base font-bold text-[#5ee28a]">{run.completedActionCount}</div>
          </div>
          <div>
            <div className="text-[#8c98ae]">Audit Events</div>
            <div className="text-base font-bold text-[#71a7ff]">{run.auditTrail.length}</div>
          </div>
        </div>
      </div>

      {/* Human Approval Interaction Card (if pending) */}
      {run.status === "waiting" && run.pendingApproval && (
        <div className="p-5 rounded-2xl bg-[#131a28] border-2 border-[#ffc766] shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#ffc766]" />
              <h4 className="font-bold text-sm text-[#eef3ff]">
                Awaiting Human Approval: {run.pendingApproval.assigneeRole}
              </h4>
            </div>
            <span className="text-xs font-mono text-[#ffc766] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              SLA Due: {new Date(run.pendingApproval.dueAt).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-[#8c98ae] leading-relaxed">
            Invoice amount (₹{run.context.invoice?.amount?.toLocaleString()}) exceeds standard threshold. Select an action decision:
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleHumanDecision("APPROVAL_RECEIVED")}
              className="px-5 py-2 rounded-xl bg-[#5ee28a] hover:bg-[#4dd378] text-[#080b12] font-bold flex items-center gap-2 shadow-lg shadow-[#5ee28a]/20 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve Invoice</span>
            </button>
            <button
              onClick={() => handleHumanDecision("REJECTION_RECEIVED")}
              className="px-5 py-2 rounded-xl bg-[#ff6b7a] hover:bg-[#ee5a69] text-[#eef3ff] font-bold flex items-center gap-2 shadow-lg shadow-[#ff6b7a]/20 transition-all"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Reject Invoice</span>
            </button>
            <button
              onClick={() => handleHumanDecision("CHANGES_REQUESTED")}
              className="px-4 py-2 rounded-xl bg-[#0f1420] hover:bg-[#253047] text-[#ffc766] font-semibold border border-[#ffc766]/30 transition-colors"
            >
              Request Changes
            </button>
          </div>
        </div>
      )}

      {/* Timeline Audit Logs */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-[#eef3ff] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#45e0d1]" />
          <span>Execution Activity Timeline</span>
        </h3>

        <div className="space-y-2 border-l-2 border-[#253047] ml-3 pl-4">
          {run.auditTrail.map((item, idx) => (
            <div
              key={item.id || idx}
              className="p-3.5 rounded-xl bg-[#0f1420] border border-[#253047] space-y-1.5 relative hover:border-[#384869] transition-all"
            >
              <div className="absolute -left-[23px] top-4 w-3 h-3 rounded-full bg-[#45e0d1] border-2 border-[#080b12]" />

              <div className="flex items-center justify-between font-mono">
                <span className="font-bold text-[#45e0d1] uppercase text-[11px]">
                  {item.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] text-[#8c98ae]">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {item.stateId && (
                <div className="text-[#8c98ae]">
                  State: <strong className="text-[#eef3ff]">{item.stateId}</strong>
                </div>
              )}

              {item.guardResult && (
                <div className="p-2 rounded bg-[#131a28] text-[11px] font-mono text-[#ffc766] border border-[#ffc766]/20">
                  Guard Evaluation: {item.guardResult.reason}
                </div>
              )}

              {item.metadata?.guardReason && (
                <div className="text-[11px] text-[#5ee28a] font-mono">
                  Transition Condition: {item.metadata.guardReason}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
