import { WorkflowState, TransitionDefinition, ActionDefinition } from "../types/workflow";

export interface CloneSubgraphOptions {
  offset?: { x: number; y: number };
  idGenerator?: (prefix: string) => string;
}

/**
 * Pure domain function to clone a subgraph of states and transitions.
 * Guarantees complete referential integrity across:
 * - State IDs
 * - Transition IDs
 * - State action IDs (entryActions, activeActions, exitActions)
 * - Transition action IDs
 * - Compensation action IDs (compensationActionId)
 * - Parallel policy required action IDs (parallelPolicy.requiredActionIds)
 */
export function cloneWorkflowSubgraph(
  statesToClone: WorkflowState[],
  transitionsToClone: TransitionDefinition[],
  options: CloneSubgraphOptions = {}
): { states: WorkflowState[]; transitions: TransitionDefinition[] } {
  const offset = options.offset ?? { x: 40, y: 40 };
  const genId =
    options.idGenerator ??
    ((prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`);

  const stateIdMap = new Map<string, string>();
  const actionIdMap = new Map<string, string>();
  const transitionIdMap = new Map<string, string>();

  // Pass 1: Build ID maps for all states, actions, and transitions in the clone set
  for (const st of statesToClone) {
    stateIdMap.set(st.id, genId("st"));
    const allStateActions = [
      ...(st.entryActions || []),
      ...(st.activeActions || []),
      ...(st.exitActions || []),
    ];
    for (const act of allStateActions) {
      if (act.id) actionIdMap.set(act.id, genId("act"));
    }
  }

  for (const tr of transitionsToClone) {
    transitionIdMap.set(tr.id, genId("tr"));
    for (const act of tr.actions || []) {
      if (act.id) actionIdMap.set(act.id, genId("act"));
    }
  }

  const remapAction = (action: ActionDefinition): ActionDefinition => {
    const newId = actionIdMap.get(action.id) || genId("act");
    const newCompId = action.compensationActionId
      ? actionIdMap.get(action.compensationActionId) || action.compensationActionId
      : undefined;
    return {
      ...action,
      id: newId,
      compensationActionId: newCompId,
    };
  };

  const clonedStates: WorkflowState[] = [];

  for (const st of statesToClone) {
    const newId = stateIdMap.get(st.id)!;
    const newPos = st.position
      ? { x: st.position.x + offset.x, y: st.position.y + offset.y }
      : { x: 100, y: 100 };

    const remappedParallelPolicy = st.parallelPolicy
      ? {
          ...st.parallelPolicy,
          requiredActionIds: st.parallelPolicy.requiredActionIds?.map(
            (id) => actionIdMap.get(id) || id
          ),
        }
      : undefined;

    const clonedState: WorkflowState = {
      ...JSON.parse(JSON.stringify(st)),
      id: newId,
      name: `${st.name} (Copy)`,
      type: st.type === "start" ? "atomic" : st.type,
      position: newPos,
      entryActions: (st.entryActions || []).map(remapAction),
      activeActions: (st.activeActions || []).map(remapAction),
      exitActions: (st.exitActions || []).map(remapAction),
      parallelPolicy: remappedParallelPolicy,
      transitions: [], // Populated in Pass 2
    };

    clonedStates.push(clonedState);
  }

  const clonedTransitions: TransitionDefinition[] = [];

  for (const tr of transitionsToClone) {
    const newSrcId = stateIdMap.get(tr.sourceStateId) || tr.sourceStateId;
    const newTargetId = stateIdMap.get(tr.targetStateId) || tr.targetStateId;
    const newTrId = transitionIdMap.get(tr.id) || genId("tr");

    const remappedActions = (tr.actions || []).map(remapAction);

    const clonedTr: TransitionDefinition = {
      ...JSON.parse(JSON.stringify(tr)),
      id: newTrId,
      sourceStateId: newSrcId,
      targetStateId: newTargetId,
      actions: remappedActions,
    };

    clonedTransitions.push(clonedTr);

    // Attach to cloned source state if it was included in the clone set
    const srcState = clonedStates.find((s) => s.id === newSrcId);
    if (srcState) {
      srcState.transitions.push(clonedTr);
    }
  }

  return { states: clonedStates, transitions: clonedTransitions };
}
