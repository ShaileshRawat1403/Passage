import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Network } from "lucide-react";
import { WorkflowState } from "../../../types/workflow";

export const ParallelNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as WorkflowState;
  const selected = props.selected;
  const mode = data?.parallelPolicy?.mode || "all";

  return (
    <div
      className={`relative w-[260px] rounded-xl bg-slate-950/80 backdrop-blur-xl border-2 transition-all shadow-2xl p-4 ${
        selected
          ? "border-pink-400 ring-4 ring-pink-500/20 shadow-[0_0_20px_rgba(244,114,182,0.25)]"
          : "border-white/10 hover:border-pink-500/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-slate-950"
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-pink-400">
            <Network className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-pink-400 font-bold">
            PARALLEL FORK
          </span>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/5 text-pink-400 border border-pink-500/30 font-bold uppercase">
          {mode}
        </span>
      </div>

      <div className="font-bold text-sm text-slate-100 mb-1">{data?.name}</div>
      <div className="text-xs text-slate-400 mb-2">
        Executes parallel tasks simultaneously.
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-slate-950"
      />
    </div>
  );
};
