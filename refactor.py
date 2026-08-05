import re

with open("src/store/workflowStore.ts", "r") as f:
    code = f.read()

# 1. Define types at the top
type_defs = """
export type DesignerOperation =
  | "STATE_ADDED"
  | "STATE_MOVED"
  | "STATE_UPDATED"
  | "STATE_DELETED"
  | "TRANSITION_ADDED"
  | "TRANSITION_UPDATED"
  | "TRANSITION_DELETED"
  | "ACTION_ADDED"
  | "ACTION_REMOVED"
  | "GUARD_UPDATED"
  | "SUBGRAPH_PASTED"
  | "AUTO_LAYOUT_APPLIED"
  | "CANVAS_CLEARED"
  | "WORKFLOW_UPDATED";

export interface DesignerHistorySnapshot {
  workflowId: string;
  workflowDefinition: WorkflowDefinition;
  selectedStateId: string | null;
  selectedTransitionId: string | null;
  selectedStateIds: string[];
  selectedTransitionIds: string[];
  operation: DesignerOperation;
  timestamp: number;
  groupKey?: string;
}

export interface WorkflowHistory {
  past: DesignerHistorySnapshot[];
  future: DesignerHistorySnapshot[];
}

export type NavigationTab =
"""
code = code.replace("export type NavigationTab =", type_defs)

# 2. Update interface WorkflowStateStore
interface_replacement = """
  // History
  historyByWorkflowId: Record<string, WorkflowHistory>;
  undo: () => void;
  redo: () => void;
  commitDraftOperation: (
    workflowId: string,
    operation: DesignerOperation,
    groupKey: string | undefined,
    updater: (draft: WorkflowDefinition) => void
  ) => void;
"""
code = re.sub(r'// History\s+pastWorkflows: WorkflowDefinition\[\]\[\];\s+futureWorkflows: WorkflowDefinition\[\]\[\];\s+lastEditTime: number;\s+undo: \(\) => void;\s+redo: \(\) => void;', interface_replacement.strip(), code)

# 3. Update store initialization
init_replacement = """
  copiedSelection: null,

  historyByWorkflowId: {},
"""
code = re.sub(r'copiedSelection: null,\s+pastWorkflows: \[\],\s+futureWorkflows: \[\],\s+lastEditTime: 0,', init_replacement.strip(), code)

# 4. Implement undo, redo, commitDraftOperation
commit_impl = """
  commitDraftOperation: (workflowId, operation, groupKey, updater) => {
    set((state) => {
      const w = state.workflows.find((w) => w.id === workflowId);
      if (!w) return state;

      const snapshot: DesignerHistorySnapshot = {
        workflowId: w.id,
        workflowDefinition: JSON.parse(JSON.stringify(w)),
        selectedStateId: state.selectedStateId,
        selectedTransitionId: state.selectedTransitionId,
        selectedStateIds: state.selectedStateIds,
        selectedTransitionIds: state.selectedTransitionIds,
        operation,
        timestamp: Date.now(),
        groupKey,
      };

      const history = state.historyByWorkflowId[workflowId] || { past: [], future: [] };
      let newPast = [...history.past];

      if (groupKey && newPast.length > 0) {
        const last = newPast[newPast.length - 1];
        if (
          last.groupKey === groupKey &&
          last.operation === operation &&
          snapshot.timestamp - last.timestamp < 1000
        ) {
          // Coalesce edits: do not push a new snapshot, keep the old one as the "before" state
        } else {
          newPast.push(snapshot);
        }
      } else {
        newPast.push(snapshot);
      }

      if (newPast.length > 100) {
        newPast = newPast.slice(newPast.length - 100);
      }

      const updated = state.workflows.map((wf) => {
        if (wf.id === workflowId) {
          const draft = JSON.parse(JSON.stringify(wf)) as WorkflowDefinition;
          updater(draft);
          draft.updatedAt = new Date().toISOString();
          return draft;
        }
        return wf;
      });

      const active = updated.find((wf) => wf.id === state.activeWorkflowId);
      const issues = active ? validateWorkflow(active) : [];

      let nextSelStateIds = state.selectedStateIds;
      let nextSelTrIds = state.selectedTransitionIds;
      let nextSelStateId = state.selectedStateId;
      let nextSelTrId = state.selectedTransitionId;

      if (active) {
        const validStateIds = new Set(active.states.map((s) => s.id));
        const validTrIds = new Set<string>();
        for (const s of active.states) {
          for (const t of s.transitions || []) validTrIds.add(t.id);
        }

        nextSelStateIds = state.selectedStateIds.filter((id) => validStateIds.has(id));
        nextSelTrIds = state.selectedTransitionIds.filter((id) => validTrIds.has(id));

        if (nextSelStateId && !validStateIds.has(nextSelStateId)) {
          nextSelStateId = nextSelStateIds[0] || null;
        }
        if (nextSelTrId && !validTrIds.has(nextSelTrId)) {
          nextSelTrId = nextSelTrIds[0] || null;
        }
      }

      return {
        workflows: updated,
        validationIssues: issues,
        selectedStateIds: nextSelStateIds,
        selectedTransitionIds: nextSelTrIds,
        selectedStateId: nextSelStateId,
        selectedTransitionId: nextSelTrId,
        historyByWorkflowId: {
          ...state.historyByWorkflowId,
          [workflowId]: {
            past: newPast,
            future: [],
          },
        },
      };
    });
  },

  undo: () => {
    set((state) => {
      const activeId = state.activeWorkflowId;
      const history = state.historyByWorkflowId[activeId];
      if (!history || history.past.length === 0) return state;

      const last = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, -1);
      
      const currentWf = state.workflows.find(w => w.id === activeId);
      if (!currentWf) return state;

      const currentSnapshot: DesignerHistorySnapshot = {
        workflowId: activeId,
        workflowDefinition: JSON.parse(JSON.stringify(currentWf)),
        selectedStateId: state.selectedStateId,
        selectedTransitionId: state.selectedTransitionId,
        selectedStateIds: state.selectedStateIds,
        selectedTransitionIds: state.selectedTransitionIds,
        operation: last.operation,
        timestamp: Date.now(),
        groupKey: last.groupKey,
      };

      const newFuture = [currentSnapshot, ...history.future];
      
      const updatedWorkflows = state.workflows.map(w => w.id === activeId ? last.workflowDefinition : w);
      const active = updatedWorkflows.find(w => w.id === activeId);
      const issues = active ? validateWorkflow(active) : [];

      return {
        workflows: updatedWorkflows,
        selectedStateId: last.selectedStateId,
        selectedTransitionId: last.selectedTransitionId,
        selectedStateIds: last.selectedStateIds,
        selectedTransitionIds: last.selectedTransitionIds,
        validationIssues: issues,
        historyByWorkflowId: {
          ...state.historyByWorkflowId,
          [activeId]: {
            past: newPast,
            future: newFuture,
          }
        }
      };
    });
  },
  redo: () => {
    set((state) => {
      const activeId = state.activeWorkflowId;
      const history = state.historyByWorkflowId[activeId];
      if (!history || history.future.length === 0) return state;

      const next = history.future[0];
      const newFuture = history.future.slice(1);
      
      const currentWf = state.workflows.find(w => w.id === activeId);
      if (!currentWf) return state;

      const currentSnapshot: DesignerHistorySnapshot = {
        workflowId: activeId,
        workflowDefinition: JSON.parse(JSON.stringify(currentWf)),
        selectedStateId: state.selectedStateId,
        selectedTransitionId: state.selectedTransitionId,
        selectedStateIds: state.selectedStateIds,
        selectedTransitionIds: state.selectedTransitionIds,
        operation: next.operation,
        timestamp: Date.now(),
        groupKey: next.groupKey,
      };

      const newPast = [...history.past, currentSnapshot];
      
      const updatedWorkflows = state.workflows.map(w => w.id === activeId ? next.workflowDefinition : w);
      const active = updatedWorkflows.find(w => w.id === activeId);
      const issues = active ? validateWorkflow(active) : [];

      return {
        workflows: updatedWorkflows,
        selectedStateId: next.selectedStateId,
        selectedTransitionId: next.selectedTransitionId,
        selectedStateIds: next.selectedStateIds,
        selectedTransitionIds: next.selectedTransitionIds,
        validationIssues: issues,
        historyByWorkflowId: {
          ...state.historyByWorkflowId,
          [activeId]: {
            past: newPast,
            future: newFuture,
          }
        }
      };
    });
  },
"""

code = re.sub(r'undo: \(\) => \{[\s\S]*?\},[\s]*redo: \(\) => \{[\s\S]*?\},', commit_impl.strip() + ',', code)

# 5. Clean up createWorkflow, updateWorkflow
update_wf = """
  updateWorkflow: (workflowId, updater) => {
    set((state) => {
      const updated = state.workflows.map((w) => {
        if (w.id === workflowId) {
          const draft = JSON.parse(JSON.stringify(w)) as WorkflowDefinition;
          updater(draft);
          draft.updatedAt = new Date().toISOString();
          return draft;
        }
        return w;
      });

      const active = updated.find((w) => w.id === state.activeWorkflowId);
      const issues = active ? validateWorkflow(active) : [];

      // Reconcile selection against updated active workflow
      let nextSelStateIds = state.selectedStateIds;
      let nextSelTrIds = state.selectedTransitionIds;
      let nextSelStateId = state.selectedStateId;
      let nextSelTrId = state.selectedTransitionId;

      if (active) {
        const validStateIds = new Set(active.states.map((s) => s.id));
        const validTrIds = new Set<string>();
        for (const s of active.states) {
          for (const t of s.transitions || []) validTrIds.add(t.id);
        }

        nextSelStateIds = state.selectedStateIds.filter((id) => validStateIds.has(id));
        nextSelTrIds = state.selectedTransitionIds.filter((id) => validTrIds.has(id));

        if (nextSelStateId && !validStateIds.has(nextSelStateId)) {
          nextSelStateId = nextSelStateIds[0] || null;
        }
        if (nextSelTrId && !validTrIds.has(nextSelTrId)) {
          nextSelTrId = nextSelTrIds[0] || null;
        }
      }

      return {
        workflows: updated,
        validationIssues: issues,
        selectedStateIds: nextSelStateIds,
        selectedTransitionIds: nextSelTrIds,
        selectedStateId: nextSelStateId,
        selectedTransitionId: nextSelTrId,
      };
    });
  },
"""

code = re.sub(r'updateWorkflow: \(workflowId, updater\) => \{[\s\S]*?\},[\s]*deleteWorkflow: \(id\)', update_wf.strip() + '\n\n  deleteWorkflow: (id)', code)


# Clean up deleteWorkflow
delete_wf = """
  deleteWorkflow: (id) => {
    set((state) => {
      const next = state.workflows.filter((w) => w.id !== id);
      const nextActive = next[0]?.id || "";
      const activeWf = next.find((w) => w.id === nextActive);
      const firstState = activeWf?.states[0]?.id || null;
      return {
        workflows: next,
        activeWorkflowId: nextActive,
        selectedStateId: firstState,
        selectedStateIds: firstState ? [firstState] : [],
        selectedTransitionId: null,
        selectedTransitionIds: [],
      };
    });
  },
"""

code = re.sub(r'deleteWorkflow: \(id\) => \{[\s\S]*?\},[\s]*importWorkflowJson: \(jsonText\)', delete_wf.strip() + '\n\n  importWorkflowJson: (jsonText)', code)


# Clean up createWorkflow
create_wf = """
  createWorkflow: (name, description) => {
    const newId = generateDesignerId("workflow", get().workflows.map(w => w.id));
    const newWf: WorkflowDefinition = {
      id: newId,
      name,
      description,
      initialStateId: "step-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      states: [
        {
          id: "step-1",
          name: "Initial Step",
          type: "start",
          position: { x: 250, y: 150 },
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [],
        },
      ],
    };

    set((state) => ({
      workflows: [...state.workflows, newWf],
      activeWorkflowId: newId,
      selectedStateId: "step-1",
      selectedStateIds: ["step-1"],
      selectedTransitionId: null,
      selectedTransitionIds: [],
      activeTab: "designer",
      validationIssues: validateWorkflow(newWf),
    }));

    return newId;
  },
"""

code = re.sub(r'createWorkflow: \(name, description\) => \{[\s\S]*?\},[\s]*updateWorkflow: \(workflowId, updater\)', create_wf.strip() + '\n\n  updateWorkflow: (workflowId, updater)', code)

# Clean up importWorkflowJson
import_wf = """
  importWorkflowJson: (jsonText) => {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      throw new Error("Invalid JSON: Unable to parse input text as JSON.");
    }

    const parseResult = parseWorkflowDefinition(raw);
    if (!parseResult.success || !parseResult.workflow) {
      throw new Error(
        `Workflow import rejected due to contract validation errors:\n${parseResult.errors.join("\\n")}`
      );
    }

    const workflow = parseResult.workflow;
    const firstState = workflow.states[0]?.id || null;
    
    // Ensure the imported workflow's IDs are added to occupied space by doing nothing strictly here 
    // but extractAllIds will pick them up later when operations are run.

    set((state) => ({
      workflows: [workflow, ...state.workflows],
      activeWorkflowId: workflow.id,
      selectedStateId: firstState,
      selectedStateIds: firstState ? [firstState] : [],
      selectedTransitionId: null,
      selectedTransitionIds: [],
      activeTab: "designer",
      validationIssues: parseResult.issues,
    }));
    return workflow.id;
  },
"""

code = re.sub(r'importWorkflowJson: \(jsonText\) => \{[\s\S]*?\},[\s]*addState: \(workflowId, stateDef\)', import_wf.strip() + '\n\n  addState: (workflowId, stateDef)', code)

# Update domain operations to use commitDraftOperation instead of updateWorkflow

code = code.replace(
    'get().updateWorkflow(workflowId, (draft) => {', 
    'get().commitDraftOperation(workflowId, "WORKFLOW_UPDATED", undefined, (draft) => {'
)

code = re.sub(r'addState:\s*\(workflowId, stateDef\) => \{\s*let finalId = stateDef\.id;\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'addState: (workflowId, stateDef) => {\n    let finalId = stateDef.id;\n    get().commitDraftOperation(workflowId, "STATE_ADDED", undefined, (draft) => {', code)

code = re.sub(r'updateState:\s*\(workflowId, stateId, partial\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'updateState: (workflowId, stateId, partial) => {\n    get().commitDraftOperation(workflowId, "STATE_UPDATED", "state-update-" + stateId, (draft) => {', code)

code = re.sub(r'duplicateState:\s*\(workflowId, stateId\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'duplicateState: (workflowId, stateId) => {\n    get().commitDraftOperation(workflowId, "STATE_ADDED", undefined, (draft) => {', code)

code = re.sub(r'deleteState:\s*\(workflowId, stateId\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'deleteState: (workflowId, stateId) => {\n    get().commitDraftOperation(workflowId, "STATE_DELETED", undefined, (draft) => {', code)

code = re.sub(r'updateStatePosition:\s*\(workflowId, stateId, pos\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'updateStatePosition: (workflowId, stateId, pos) => {\n    get().commitDraftOperation(workflowId, "STATE_MOVED", "state-move-" + stateId, (draft) => {', code)

code = re.sub(r'addTransition:\s*\(workflowId, transition\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'addTransition: (workflowId, transition) => {\n    get().commitDraftOperation(workflowId, "TRANSITION_ADDED", undefined, (draft) => {', code)

code = re.sub(r'updateTransition:\s*\(workflowId, transitionId, partial\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'updateTransition: (workflowId, transitionId, partial) => {\n    get().commitDraftOperation(workflowId, "TRANSITION_UPDATED", "transition-update-" + transitionId, (draft) => {', code)

code = re.sub(r'deleteTransition:\s*\(workflowId, transitionId\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'deleteTransition: (workflowId, transitionId) => {\n    get().commitDraftOperation(workflowId, "TRANSITION_DELETED", undefined, (draft) => {', code)

code = re.sub(r'pasteSelection:\s*\(workflowId, offset = \{ x: 50, y: 50 \}\) => \{[\s\S]*?get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'pasteSelection: (workflowId, offset = { x: 50, y: 50 }) => {\n    const clip = get().copiedSelection;\n    if (!clip || clip.states.length === 0) return;\n    let createdStateIds: string[] = [];\n    get().commitDraftOperation(workflowId, "SUBGRAPH_PASTED", undefined, (draft) => {', code)

code = re.sub(r'deleteSelection:\s*\(workflowId, stateIds, transitionIds\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'deleteSelection: (workflowId, stateIds, transitionIds) => {\n    get().commitDraftOperation(workflowId, "STATE_DELETED", undefined, (draft) => {', code)

code = re.sub(r'addActionToState:\s*\(workflowId, stateId, phase, action\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'addActionToState: (workflowId, stateId, phase, action) => {\n    get().commitDraftOperation(workflowId, "ACTION_ADDED", undefined, (draft) => {', code)

code = re.sub(r'removeActionFromState:\s*\(workflowId, stateId, phase, actionId\) => \{\s*get\(\)\.commitDraftOperation\(workflowId, "WORKFLOW_UPDATED", undefined, \(draft\) => \{',
              r'removeActionFromState: (workflowId, stateId, phase, actionId) => {\n    get().commitDraftOperation(workflowId, "ACTION_REMOVED", undefined, (draft) => {', code)


# Clean up test store initialization
test_store_replacement = """
    copiedSelection: null,

    historyByWorkflowId: {},
"""
code = re.sub(r'copiedSelection: null,\s+pastWorkflows: \[\],\s+futureWorkflows: \[\],\s+lastEditTime: 0,', test_store_replacement.strip() + ',', code)

with open("src/store/workflowStore.ts", "w") as f:
    f.write(code)

