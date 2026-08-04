import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { GitFork, ArrowRight } from "lucide-react";
import { WorkflowState } from "../../../types/workflow";

export const DecisionNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as WorkflowState;
  const selected = props.selected;

  return (
    <div
      className={`relative w-[260px] rounded-xl bg-slate-950/80 backdrop-blur-xl border-2 transition-all shadow-2xl p-4 ${
        selected
          ? "border-amber-400 ring-4 ring-amber-500/20 shadow-[0_0_20px_rgba(251,191,36,0.25)]"
          : "border-amber-500/50 hover:border-amber-400"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-slate-950"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
          <GitFork className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] font-mono tracking-widest uppercase text-amber-400 font-bold">
          DECISION / BRANCH
        </span>
      </div>

      <div className="font-bold text-sm text-slate-100 mb-1">{data?.name}</div>
      <div className="text-xs text-slate-400 mb-3">
        Evaluates guard conditions to route event.
      </div>

      {/* Routes & Guards Summary */}
      <div className="space-y-1.5 pt-2 border-t border-white/10">
        {data?.transitions?.map((tr) => (
          <div
            key={tr.id}
            className="p-1.5 rounded-md bg-white/5 border border-white/10 flex items-center justify-between text-[10px] font-mono"
          >
            <span className="text-amber-400 font-bold">IF {tr.guard?.name || "TRUE"}</span>
            <div className="flex items-center gap-1 text-slate-200">
              <ArrowRight className="w-2.5 h-2.5 text-cyan-400" />
              <span>{tr.targetStateId}</span>
            </div>
          </div>
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-slate-950"
      />
    </div>
  );
};
