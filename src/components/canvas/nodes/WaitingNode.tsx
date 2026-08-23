import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Hourglass, Clock, Settings } from "lucide-react";
import { WorkflowState } from "../../../types/workflow";
import { useWorkflowStore } from "../../../store/workflowStore";

export const WaitingNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as WorkflowState;
  const selected = props.selected;
  const setSelectedStateId = useWorkflowStore((state) => state.setSelectedStateId);
  const timeoutHours = data?.timeout?.durationMs ? Math.round(data.timeout.durationMs / 3600000) : null;

  return (
    <div
      className={`relative w-[260px] rounded-xl bg-slate-950/80 backdrop-blur-xl border-2 transition-all shadow-2xl p-4 ${
        selected
          ? "border-cyan-400 ring-4 ring-cyan-500/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.25)]"
          : "border-white/10 hover:border-cyan-500/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-slate-950"
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
            <Hourglass className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-400 font-bold">
            WAITING STATE
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedStateId(props.id);
          }}
          className="p-1 rounded-md bg-white/10 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 border border-white/10 hover:border-cyan-400/50 transition-all cursor-pointer shadow-sm group/btn"
          title="Configure State Settings"
          aria-label="Configure State"
        >
          <Settings className="w-3.5 h-3.5 transition-transform group-hover/btn:rotate-45" />
        </button>
      </div>

      <div className="font-bold text-sm text-slate-100 mb-1">{data?.name}</div>
      <div className="text-xs text-slate-400 mb-2">
        Pauses for external event signal or SLA timer.
      </div>

      {timeoutHours && (
        <div className="pt-2 border-t border-white/10 text-[10px] font-mono text-amber-400 flex items-center gap-1 font-semibold">
          <Clock className="w-3 h-3" />
          <span>Timeout SLA: {timeoutHours} Hours</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-slate-950"
      />
    </div>
  );
};
