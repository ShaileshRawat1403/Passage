import { WorkflowDefinition } from "../../types/workflow";

export function classifyWorkflowEdges(workflow: WorkflowDefinition): Record<string, "forward" | "branch" | "loopback" | "self_loop" | "cross_component"> {
  const edgeKinds: Record<string, "forward" | "branch" | "loopback" | "self_loop" | "cross_component"> = {};
  
  const stateIds = new Set(workflow.states.map(s => s.id));
  const transitions = workflow.states.flatMap(s => s.transitions || []);

  const adj = new Map<string, string[]>();
  for (const id of stateIds) adj.set(id, []);
  
  for (const transition of transitions) {
    if (stateIds.has(transition.sourceStateId) && stateIds.has(transition.targetStateId)) {
      adj.get(transition.sourceStateId)!.push(transition.targetStateId);
      adj.get(transition.targetStateId)!.push(transition.sourceStateId); // undirected
    }
  }

  const componentMap = new Map<string, number>();
  let compIndex = 0;
  for (const id of stateIds) {
    if (!componentMap.has(id)) {
      const q = [id];
      componentMap.set(id, compIndex);
      while (q.length > 0) {
        const curr = q.shift()!;
        for (const nxt of adj.get(curr)!) {
          if (!componentMap.has(nxt)) {
            componentMap.set(nxt, compIndex);
            q.push(nxt);
          }
        }
      }
      compIndex++;
    }
  }

  const outDegree = new Map<string, number>();
  for (const t of transitions) {
     outDegree.set(t.sourceStateId, (outDegree.get(t.sourceStateId) || 0) + 1);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const loopbackEdges = new Set<string>();

  const dfs = (node: string) => {
    visited.add(node);
    recStack.add(node);
    for (const t of transitions.filter(tr => tr.sourceStateId === node)) {
      if (t.sourceStateId === t.targetStateId) continue;
      const nxt = t.targetStateId;
      if (!visited.has(nxt)) {
        dfs(nxt);
      } else if (recStack.has(nxt)) {
        loopbackEdges.add(t.id);
      }
    }
    recStack.delete(node);
  };

  for (const id of stateIds) {
    if (!visited.has(id)) dfs(id);
  }

  for (const transition of transitions) {
    let kind: "forward" | "branch" | "loopback" | "self_loop" | "cross_component" = "forward";
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
