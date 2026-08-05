import { WorkflowLayoutGraph, WorkflowLayoutResult, WorkflowLayoutWarning, LayoutPoint } from "./types";

export function validateWorkflowLayoutResult(
  graph: WorkflowLayoutGraph,
  rawResult: WorkflowLayoutResult
): WorkflowLayoutResult {
  const warnings: WorkflowLayoutWarning[] = [...(rawResult.warnings || [])];
  const positions: Record<string, LayoutPoint> = { ...(rawResult.positions || {}) };

  const validStateIds = new Set(graph.states.map(s => s.id));

  // 1. Check for unknown state IDs returned by engine
  for (const returnedId of Object.keys(positions)) {
    if (!validStateIds.has(returnedId)) {
      if (!warnings.some(w => w.code === "UNKNOWN_STATE_ID" && w.stateId === returnedId)) {
        warnings.push({
          code: "UNKNOWN_STATE_ID",
          message: `Engine returned unknown state ID: ${returnedId}`,
          stateId: returnedId,
        });
      }
    }
  }

  // 2. Check for missing state IDs or invalid/non-finite coordinates
  for (const state of graph.states) {
    const pos = positions[state.id];
    if (!pos) {
      if (!warnings.some(w => w.code === "MISSING_RESULT")) {
        warnings.push({
          code: "MISSING_RESULT",
          message: `Engine did not return positions for all states: missing ${state.id}`,
          stateId: state.id,
        });
      }
      continue;
    }

    if (
      typeof pos.x !== "number" ||
      typeof pos.y !== "number" ||
      isNaN(pos.x) ||
      isNaN(pos.y) ||
      !isFinite(pos.x) ||
      !isFinite(pos.y)
    ) {
      if (!warnings.some(w => w.code === "INVALID_COORDINATES" && w.stateId === state.id)) {
        warnings.push({
          code: "INVALID_COORDINATES",
          message: `Invalid coordinates for state: ${state.id}`,
          stateId: state.id,
        });
      }
    }
  }

  return {
    positions,
    edgeKinds: rawResult.edgeKinds || {},
    warnings,
  };
}
