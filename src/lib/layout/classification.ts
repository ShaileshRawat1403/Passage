import { WorkflowDefinition } from "../../types/workflow";
import { WorkflowLayoutGraph } from "./types";

export type EdgeKind = "forward" | "branch" | "loopback" | "self_loop" | "cross_component";

export type ClassifiableWorkflow = 
  | WorkflowDefinition
  | WorkflowLayoutGraph
  | {
      states: Array<{
        id: string;
        type?: string;
        transitions?: Array<{ id: string; sourceStateId: string; targetStateId: string; priority?: number; event?: string }>;
      }>;
      transitions?: Array<{ id: string; sourceStateId: string; targetStateId: string; priority?: number; event?: string }>;
    };

export function classifyWorkflowEdges(workflow: ClassifiableWorkflow): Record<string, EdgeKind> {
  const edgeKinds: Record<string, EdgeKind> = {};

  const sortedStateIds = workflow.states.map(s => s.id).sort((a, b) => a.localeCompare(b));
  const stateSet = new Set(sortedStateIds);

  // Extract all transitions whether directly on workflow/graph or on states
  let rawTransitions: Array<{ id: string; sourceStateId: string; targetStateId: string; priority?: number; event?: string }> = [];

  if ('transitions' in workflow && Array.isArray(workflow.transitions) && workflow.transitions.length > 0) {
    rawTransitions = [...workflow.transitions];
  } else {
    for (const state of workflow.states) {
      if ('transitions' in state && Array.isArray(state.transitions)) {
        rawTransitions.push(...state.transitions);
      }
    }
  }

  // Sort transitions deterministically
  const transitions = rawTransitions.sort((a, b) => {
    if (a.sourceStateId !== b.sourceStateId) return a.sourceStateId.localeCompare(b.sourceStateId);
    const prioA = a.priority ?? 10;
    const prioB = b.priority ?? 10;
    if (prioA !== prioB) return prioB - prioA; // higher priority first
    if (a.targetStateId !== b.targetStateId) return a.targetStateId.localeCompare(b.targetStateId);
    return a.id.localeCompare(b.id);
  });

  // Build component adjacency graph
  const adj = new Map<string, string[]>();
  for (const id of sortedStateIds) adj.set(id, []);

  for (const t of transitions) {
    if (stateSet.has(t.sourceStateId) && stateSet.has(t.targetStateId)) {
      adj.get(t.sourceStateId)!.push(t.targetStateId);
      adj.get(t.targetStateId)!.push(t.sourceStateId); // undirected
    }
  }

  // Connected components
  const componentMap = new Map<string, number>();
  let compIndex = 0;
  for (const id of sortedStateIds) {
    if (!componentMap.has(id)) {
      const q = [id];
      componentMap.set(id, compIndex);
      while (q.length > 0) {
        const curr = q.shift()!;
        for (const nxt of adj.get(curr) || []) {
          if (!componentMap.has(nxt)) {
            componentMap.set(nxt, compIndex);
            q.push(nxt);
          }
        }
      }
      compIndex++;
    }
  }

  // Out-degree count
  const outDegree = new Map<string, number>();
  for (const t of transitions) {
    outDegree.set(t.sourceStateId, (outDegree.get(t.sourceStateId) || 0) + 1);
  }

  // Cycle detection via deterministic DFS
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const loopbackEdges = new Set<string>();

  const dfs = (node: string) => {
    visited.add(node);
    recStack.add(node);

    // Transitions from this node in deterministic order
    const outgoing = transitions.filter(tr => tr.sourceStateId === node);
    for (const t of outgoing) {
      if (t.sourceStateId === t.targetStateId) continue; // self-loop handled separately
      const nxt = t.targetStateId;
      if (!stateSet.has(nxt)) continue;

      if (!visited.has(nxt)) {
        dfs(nxt);
      } else if (recStack.has(nxt)) {
        loopbackEdges.add(t.id);
      }
    }
    recStack.delete(node);
  };

  for (const id of sortedStateIds) {
    if (!visited.has(id)) dfs(id);
  }

  // Classify each transition
  for (const transition of transitions) {
    let kind: EdgeKind = "forward";
    if (transition.sourceStateId === transition.targetStateId) {
      kind = "self_loop";
    } else if (componentMap.get(transition.sourceStateId) !== componentMap.get(transition.targetStateId)) {
      kind = "cross_component";
    } else if (loopbackEdges.has(transition.id)) {
      kind = "loopback";
    } else if ((outDegree.get(transition.sourceStateId) || 0) > 1) {
      kind = "branch";
    }
    edgeKinds[transition.id] = kind;
  }

  return edgeKinds;
}
