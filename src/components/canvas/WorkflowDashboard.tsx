import React from "react";
import { useWorkflowStore } from "../../store/workflowStore";
import { Activity, GitMerge, Clock } from "lucide-react";

export const WorkflowDashboard: React.FC = () => {
  const { workflows, activeWorkflowId } = useWorkflowStore();
  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];

  if (!activeWorkflow) return null;

  const nodeCount = activeWorkflow.states?.length || 0;
  
  let edgeCount = 0;
  activeWorkflow.states?.forEach((state) => {
    edgeCount += state.transitions?.length || 0;
  });

  const lastUpdated = activeWorkflow.updatedAt
    ? new Date(activeWorkflow.updatedAt).toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    : "Unknown";

  return (
    <div className="absolute top-4 left-4 z-40 bg-slate-950/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[200px] font-sans">
      <div className="text-sm font-semibold text-slate-100 mb-3 font-mono tracking-tight">
        Workflow Overview
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Activity className="w-3.5 h-3.5" />
            <span>Total Nodes</span>
          </div>
          <span className="text-sm font-mono font-bold text-cyan-400">
            {nodeCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <GitMerge className="w-3.5 h-3.5" />
            <span>Total Edges</span>
          </div>
          <span className="text-sm font-mono font-bold text-indigo-400">
            {edgeCount}
          </span>
        </div>
        <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>Last Modified</span>
          </div>
          <span className="text-xs font-mono text-slate-300">
            {lastUpdated}
          </span>
        </div>
      </div>
    </div>
  );
};
