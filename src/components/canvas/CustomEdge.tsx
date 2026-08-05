import React from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, EdgeProps } from "@xyflow/react";

export interface CustomEdgeData {
  event?: string;
  guardName?: string;
  priority?: number;
  label?: string;
}

export const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });

  const edgeData = (data || {}) as CustomEdgeData;
  const eventText = edgeData.event || edgeData.label || "TRIGGER";
  const guardText = edgeData.guardName;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? "#22d3ee" : "rgba(255, 255, 255, 0.25)",
          filter: selected ? "drop-shadow(0 0 8px rgba(var(--primary-rgb),0.6))" : "none",
          ...style,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className={`flex flex-col items-center gap-0.5 cursor-pointer transition-all ${
            selected ? "scale-105" : "hover:scale-105"
          }`}
        >
          <div
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border backdrop-blur-xl shadow-lg flex items-center gap-1 whitespace-nowrap ${
              selected
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)]"
                : "bg-slate-950/90 text-cyan-400 border-white/15 hover:border-cyan-500/50"
            }`}
          >
            <span className="opacity-60 text-[9px] uppercase">WHEN</span>
            <span className="font-bold">{eventText}</span>
          </div>

          {guardText && (
            <div className="px-2 py-0.5 rounded bg-black/80 text-[9px] font-mono text-amber-400 border border-amber-500/30 backdrop-blur-md whitespace-nowrap max-w-[160px] truncate shadow-sm">
              IF {guardText}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
