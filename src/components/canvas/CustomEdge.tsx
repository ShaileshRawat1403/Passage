import React from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, EdgeProps } from "@xyflow/react";

export interface CustomEdgeData {
  event?: string;
  guardName?: string;
  priority?: number;
  label?: string;
  kind?: "forward" | "branch" | "loopback" | "self_loop" | "cross_component";
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
  const kind = edgeData.kind || "forward";
  const priority = edgeData.priority;

  // Determine stroke styling based on edge classification kind
  let strokeColor = "rgba(255, 255, 255, 0.3)";
  let strokeDash: string | undefined = undefined;
  let strokeWidth = selected ? 3 : 2;

  if (selected) {
    strokeColor = "#22d3ee";
  } else {
    switch (kind) {
      case "loopback":
        strokeColor = "#f59e0b"; // amber
        strokeDash = "6 3";
        strokeWidth = 2.5;
        break;
      case "branch":
        strokeColor = "#c084fc"; // purple
        strokeWidth = 2.5;
        break;
      case "self_loop":
        strokeColor = "#f43f5e"; // rose/pink
        strokeDash = "4 2";
        strokeWidth = 2;
        break;
      case "cross_component":
        strokeColor = "#38bdf8"; // sky blue
        strokeDash = "5 5";
        strokeWidth = 2;
        break;
      case "forward":
      default:
        strokeColor = "rgba(255, 255, 255, 0.35)";
        break;
    }
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth,
          stroke: strokeColor,
          strokeDasharray: strokeDash,
          filter: selected ? "drop-shadow(0 0 8px rgba(34, 211, 238, 0.6))" : "none",
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
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border backdrop-blur-xl shadow-lg flex items-center gap-1.5 whitespace-nowrap ${
              selected
                ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                : kind === "loopback"
                ? "bg-slate-950/95 text-amber-400 border-amber-500/50 hover:border-amber-400"
                : kind === "branch"
                ? "bg-slate-950/95 text-purple-300 border-purple-500/50 hover:border-purple-400"
                : kind === "self_loop"
                ? "bg-slate-950/95 text-rose-400 border-rose-500/50 hover:border-rose-400"
                : kind === "cross_component"
                ? "bg-slate-950/95 text-sky-400 border-sky-500/50 hover:border-sky-400"
                : "bg-slate-950/90 text-cyan-400 border-white/15 hover:border-cyan-500/50"
            }`}
          >
            {kind === "loopback" && (
              <span className="px-1 py-0.2 text-[8px] font-bold tracking-wider uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                LOOPBACK
              </span>
            )}
            {kind === "branch" && (
              <span className="px-1 py-0.2 text-[8px] font-bold tracking-wider uppercase rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                BRANCH{priority !== undefined ? ` [P${priority}]` : ""}
              </span>
            )}
            {kind === "self_loop" && (
              <span className="px-1 py-0.2 text-[8px] font-bold tracking-wider uppercase rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                SELF LOOP
              </span>
            )}
            {kind === "cross_component" && (
              <span className="px-1 py-0.2 text-[8px] font-bold tracking-wider uppercase rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                CROSS
              </span>
            )}
            {kind === "forward" && <span className="opacity-60 text-[9px] uppercase">WHEN</span>}
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
