import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Layers, ShieldCheck, ArrowRight, Zap } from "lucide-react";
import { WorkflowState } from "../../../types/workflow";

export const AtomicNode: React.FC<NodeProps> = (props) => {
  const data = props.data as unknown as WorkflowState;
  const selected = props.selected;

  const actionCount = (data?.entryActions?.length || 0) + (data?.activeActions?.length || 0) + (data?.exitActions?.length || 0);
  const transitionCount = data?.transitions?.length || 0;
  const guardCount = data?.transitions?.filter((t) => t.guard)?.length || 0;

  return (
    <div
      className={`relative w-[260px] rounded-xl bg-slate-950/80 backdrop-blur-xl border transition-all shadow-2xl p-4 ${
        selected
          ? "border-blue-400 ring-4 ring-blue-500/20 shadow-[0_0_20px_rgba(96,165,250,0.25)]"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-slate-950"
      />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-blue-400 font-bold">
            STATE
          </span>
        </div>
        {actionCount > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-amber-300 border border-white/10 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            {actionCount} {actionCount === 1 ? "action" : "actions"}
          </span>
        )}
      </div>

      <div className="font-bold text-sm text-slate-100 mb-1 leading-tight">{data?.name}</div>
      {data?.description && (
        <div className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
          {data.description}
        </div>
      )}

      {/* Footer Indicators */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/10 text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1">
          <ArrowRight className="w-3 h-3 text-cyan-400" />
          <span>{transitionCount} {transitionCount === 1 ? "route" : "routes"}</span>
        </div>
        {guardCount > 0 && (
          <div className="flex items-center gap-1 text-amber-400 ml-auto font-semibold">
            <ShieldCheck className="w-3 h-3" />
            <span>{guardCount} {guardCount === 1 ? "guard" : "guards"}</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-slate-950"
      />
    </div>
  );
};
