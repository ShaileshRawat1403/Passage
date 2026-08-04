import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import { WorkflowState } from "../../../types/workflow";

export const StartNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as WorkflowState;
  const selected = props.selected;

  return (
    <div
      className={`px-5 py-3 rounded-full bg-slate-950/80 backdrop-blur-xl border-2 transition-all shadow-2xl flex items-center gap-3 text-sm min-w-[200px] ${
        selected
          ? "border-cyan-400 ring-4 ring-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.3)]"
          : "border-cyan-500/50 hover:border-cyan-400"
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
        <Play className="w-4 h-4 fill-cyan-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-mono tracking-widest uppercase text-cyan-400 font-bold">
          START STATE
        </div>
        <div className="font-bold text-slate-100 truncate text-xs">{data?.name || "Start"}</div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-cyan-400 !border-2 !border-slate-950"
      />
    </div>
  );
};
