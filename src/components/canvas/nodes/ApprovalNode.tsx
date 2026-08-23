import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { UserCheck, Clock, Settings } from "lucide-react";
import { WorkflowState } from "../../../types/workflow";
import { useWorkflowStore } from "../../../store/workflowStore";

export const ApprovalNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as WorkflowState;
  const selected = props.selected;
  const setSelectedStateId = useWorkflowStore((state) => state.setSelectedStateId);

  const humanTask = data?.entryActions?.find((a) => a.type === "human_task")?.humanTaskConfig ||
    data?.activeActions?.find((a) => a.type === "human_task")?.humanTaskConfig;

  return (
    <div
      className={`relative w-[260px] rounded-xl bg-slate-950/80 backdrop-blur-xl border-2 transition-all shadow-2xl p-4 ${
        selected
          ? "border-indigo-400 ring-4 ring-indigo-500/20 shadow-[0_0_20px_rgba(129,140,248,0.25)]"
          : "border-white/10 hover:border-indigo-400/60"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-950"
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-indigo-400 font-bold">
            HUMAN APPROVAL
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedStateId(props.id);
          }}
          className="p-1 rounded-md bg-white/10 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-400 border border-white/10 hover:border-indigo-400/50 transition-all cursor-pointer shadow-sm group/btn"
          title="Configure State Settings"
          aria-label="Configure State"
        >
          <Settings className="w-3.5 h-3.5 transition-transform group-hover/btn:rotate-45" />
        </button>
      </div>

      <div className="font-bold text-sm text-slate-100 mb-1">{data?.name}</div>
      <div className="text-xs text-slate-400 mb-2">
        Assignee Role: <strong className="text-slate-200">{humanTask?.assigneeRole || "Reviewer"}</strong>
      </div>

      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1 text-amber-400 font-semibold">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Due: {humanTask?.dueHours || 24}h</span>
        </div>
        <span className="text-emerald-400 font-bold">3 Options</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-950"
      />
    </div>
  );
};
