import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { CheckCircle2 } from "lucide-react";
import { WorkflowState } from "../../../types/workflow";

export const FinalNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as WorkflowState;
  const selected = props.selected;

  return (
    <div
      className={`px-5 py-3 rounded-full bg-slate-950/80 backdrop-blur-xl border-2 transition-all shadow-2xl flex items-center gap-3 text-sm min-w-[200px] ${
        selected
          ? "border-emerald-400 ring-4 ring-emerald-500/20 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
          : "border-emerald-500/50 hover:border-emerald-400"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3.5 !h-3.5 !bg-emerald-400 !border-2 !border-slate-950"
      />

      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
        <CheckCircle2 className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-mono tracking-widest uppercase text-emerald-400 font-bold">
          FINAL STATE
        </div>
        <div className="font-bold text-slate-100 truncate text-xs">{data?.name}</div>
      </div>
    </div>
  );
};
