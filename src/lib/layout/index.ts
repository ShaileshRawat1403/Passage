import { WorkflowDefinition } from "../../types/workflow";
import { ElkLayoutEngine } from "./elkEngine";
import { WorkflowLayoutEngine, WorkflowLayoutOptions, WorkflowLayoutResult } from "./types";

export * from "./types";
export * from "./dimensions";
export { ElkLayoutEngine };

export async function computeWorkflowLayout(
  workflow: WorkflowDefinition,
  options: WorkflowLayoutOptions,
  customEngine?: WorkflowLayoutEngine
): Promise<WorkflowLayoutResult> {
  const engine = customEngine || new ElkLayoutEngine();

  // 1. Sort states by stable state ID
  const states = [...workflow.states].sort((a, b) => a.id.localeCompare(b.id));

  // 2. Sort transitions deterministically
  const transitions = [];
  for (const state of workflow.states) {
    if (state.transitions) {
      transitions.push(...state.transitions);
    }
  }
  transitions.sort((a, b) => {
    if (a.sourceStateId !== b.sourceStateId) return a.sourceStateId.localeCompare(b.sourceStateId);
    const prioA = a.priority ?? 10;
    const prioB = b.priority ?? 10;
    if (prioA !== prioB) return prioB - prioA; // descending
    if (a.targetStateId !== b.targetStateId) return a.targetStateId.localeCompare(b.targetStateId);
    return a.id.localeCompare(b.id);
  });

  const graph = {
    initialStateId: workflow.initialStateId,
    states,
    transitions,
  };

  return engine.layout(graph, options);
}
