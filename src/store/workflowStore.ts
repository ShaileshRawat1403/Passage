import { create } from "zustand";
import {
  WorkflowDefinition,
  WorkflowState,
  TransitionDefinition,
  WorkflowRun,
  ValidationIssue,
  ConnectionCredential,
  ActionDefinition,
} from "../types/workflow";
import { sampleWorkflows, vendorInvoiceWorkflow } from "../domain/sampleWorkflows";
import { validateWorkflow } from "../domain/validation";
import { parseWorkflowDefinition } from "../domain/parser";
import { createWorkflowRun, dispatchWorkflowEvent } from "../domain/runtime";
import { cloneWorkflowSubgraph } from "../domain/clone";
import { generateDesignerId, resetDesignerIdFactory } from "../domain/idFactory";

export type NavigationTab =
  | "workflows"
  | "designer"
  | "runs"
  | "connections"
  | "components"
  | "settings";

interface WorkflowStateStore {
  workflows: WorkflowDefinition[];
  activeWorkflowId: string;
  activeTab: NavigationTab;

  selectedStateId: string | null;
  selectedTransitionId: string | null;
  selectedStateIds: string[];
  selectedTransitionIds: string[];

  isAdvancedMode: boolean;
  validationIssues: ValidationIssue[];

  // Simulation & Runs
  activeRuns: WorkflowRun[];
  activeRunId: string | null;
  simulationActive: boolean;

  // Saved Connections
  connections: ConnectionCredential[];

  // Clipboard
  copiedSelection: { states: WorkflowState[]; transitions: TransitionDefinition[] } | null;

  // Actions
  setActiveTab: (tab: NavigationTab) => void;
  setActiveWorkflowId: (id: string) => void;
  setSelectedStateId: (id: string | null) => void;
  setSelectedTransitionId: (id: string | null) => void;
  setSelectedStateIds: (ids: string[]) => void;
  setSelectedTransitionIds: (ids: string[]) => void;
  setSelectedSelection: (stateIds: string[], transitionIds: string[]) => void;
  toggleAdvancedMode: () => void;

  // Workflow CRUD
  createWorkflow: (name: string, description: string) => string;
  updateWorkflow: (workflowId: string, updater: (draft: WorkflowDefinition) => void) => void;
  deleteWorkflow: (workflowId: string) => void;
  importWorkflowJson: (jsonText: string) => string;

  // State & Transition Mutations (P1.1 Domain Operations)
  addState: (workflowId: string, state: Omit<WorkflowState, "id"> & { id?: string }) => void;
  updateState: (workflowId: string, stateId: string, partial: Partial<WorkflowState>) => void;
  duplicateState: (workflowId: string, stateId: string) => void;
  deleteState: (workflowId: string, stateId: string) => void;
  updateStatePosition: (workflowId: string, stateId: string, pos: { x: number; y: number }) => void;

  addTransition: (workflowId: string, transition: TransitionDefinition) => void;
  updateTransition: (
    workflowId: string,
    transitionId: string,
    partial: Partial<TransitionDefinition>
  ) => void;
  moveTransitionSource: (workflowId: string, transitionId: string, newSourceStateId: string) => void;
  deleteTransition: (workflowId: string, transitionId: string) => void;

  copySelection: (workflowId: string, stateIds: string[], transitionIds: string[]) => void;
  pasteSelection: (workflowId: string, offset?: { x: number; y: number }) => void;
  deleteSelection: (workflowId: string, stateIds: string[], transitionIds: string[]) => void;

  addActionToState: (
    workflowId: string,
    stateId: string,
    phase: "entry" | "active" | "exit",
    action: ActionDefinition
  ) => void;
  removeActionFromState: (
    workflowId: string,
    stateId: string,
    phase: "entry" | "active" | "exit",
    actionId: string
  ) => void;

  // Validation
  runValidation: (workflowId?: string) => ValidationIssue[];

  // Simulation & Runtime execution
  startNewRun: (workflowId: string, customContext?: Record<string, unknown>) => WorkflowRun;
  dispatchEventToRun: (runId: string, eventName: string, payload?: Record<string, unknown>) => void;
  setActiveRunId: (runId: string | null) => void;

  // Connections
  addConnection: (conn: ConnectionCredential) => void;
}

export const useWorkflowStore = create<WorkflowStateStore>((set, get) => ({
  workflows: sampleWorkflows,
  activeWorkflowId: vendorInvoiceWorkflow.id,
  activeTab: "designer",

  selectedStateId: "validate-invoice",
  selectedTransitionId: null,
  selectedStateIds: ["validate-invoice"],
  selectedTransitionIds: [],

  copiedSelection: null,

  isAdvancedMode: false,
  validationIssues: validateWorkflow(vendorInvoiceWorkflow),

  activeRuns: [createWorkflowRun(vendorInvoiceWorkflow)],
  activeRunId: null,
  simulationActive: false,

  connections: [
    {
      id: "conn-gemini",
      name: "Google DeepMind Gemini API",
      type: "agent_provider",
      service: "Gemini 3.6 Flash",
      status: "connected",
      lastTestedAt: new Date().toISOString(),
    },
    {
      id: "conn-vendor-api",
      name: "ERP Vendor Registry API",
      type: "api_key",
      service: "REST Endpoint",
      status: "connected",
      lastTestedAt: new Date().toISOString(),
    },
    {
      id: "conn-slack",
      name: "Finance Slack Webhook",
      type: "webhook",
      service: "Slack Channels",
      status: "connected",
      lastTestedAt: new Date().toISOString(),
    },
  ],

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveWorkflowId: (id) => {
    const wf = get().workflows.find((w) => w.id === id);
    if (wf) {
      const issues = validateWorkflow(wf);
      const firstState = wf.states[0]?.id || null;
      set({
        activeWorkflowId: id,
        selectedStateId: firstState,
        selectedStateIds: firstState ? [firstState] : [],
        selectedTransitionId: null,
        selectedTransitionIds: [],
        validationIssues: issues,
      });
    }
  },

  setSelectedStateId: (id) => {
    const s = get();
    if (
      s.selectedStateId === id &&
      s.selectedStateIds.length === (id ? 1 : 0) &&
      s.selectedStateIds[0] === id &&
      s.selectedTransitionId === null &&
      s.selectedTransitionIds.length === 0
    ) {
      return;
    }
    set({
      selectedStateId: id,
      selectedStateIds: id ? [id] : [],
      selectedTransitionId: null,
      selectedTransitionIds: [],
    });
  },

  setSelectedTransitionId: (id) => {
    const s = get();
    if (
      s.selectedTransitionId === id &&
      s.selectedTransitionIds.length === (id ? 1 : 0) &&
      s.selectedTransitionIds[0] === id &&
      s.selectedStateId === null &&
      s.selectedStateIds.length === 0
    ) {
      return;
    }
    set({
      selectedTransitionId: id,
      selectedTransitionIds: id ? [id] : [],
      selectedStateId: null,
      selectedStateIds: [],
    });
  },

  setSelectedStateIds: (ids) => {
    const s = get();
    const sameStateIds =
      s.selectedStateIds.length === ids.length &&
      s.selectedStateIds.every((id, i) => id === ids[i]);
    if (sameStateIds && s.selectedTransitionIds.length === 0 && s.selectedTransitionId === null) {
      return;
    }
    set({
      selectedStateIds: ids,
      selectedStateId: ids.length === 1 ? ids[0] : null,
      selectedTransitionId: null,
      selectedTransitionIds: [],
    });
  },

  setSelectedTransitionIds: (ids) => {
    const s = get();
    const sameTrIds =
      s.selectedTransitionIds.length === ids.length &&
      s.selectedTransitionIds.every((id, i) => id === ids[i]);
    if (sameTrIds && s.selectedStateIds.length === 0 && s.selectedStateId === null) {
      return;
    }
    set({
      selectedTransitionIds: ids,
      selectedTransitionId: ids.length === 1 ? ids[0] : null,
      selectedStateId: null,
      selectedStateIds: [],
    });
  },

  setSelectedSelection: (stateIds, transitionIds) => {
    const s = get();
    const sameStates =
      s.selectedStateIds.length === stateIds.length &&
      s.selectedStateIds.every((id, i) => id === stateIds[i]);
    const sameTransitions =
      s.selectedTransitionIds.length === transitionIds.length &&
      s.selectedTransitionIds.every((id, i) => id === transitionIds[i]);

    if (sameStates && sameTransitions) {
      return;
    }

    set({
      selectedStateIds: stateIds,
      selectedTransitionIds: transitionIds,
      selectedStateId: stateIds.length === 1 ? stateIds[0] : null,
      selectedTransitionId: transitionIds.length === 1 ? transitionIds[0] : null,
    });
  },
  toggleAdvancedMode: () => set((s) => ({ isAdvancedMode: !s.isAdvancedMode })),

  createWorkflow: (name, description) => {
    const newId = generateDesignerId("wf");
    const newWf: WorkflowDefinition = {
      id: newId,
      name: name || "New Workflow Process",
      description: description || "Created in Stateflow",
      version: "1.0.0",
      status: "draft",
      initialStateId: "start-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultContext: { caseId: `CASE-${Date.now().toString().slice(-4)}` },
      states: [
        {
          id: "start-1",
          name: "Start State",
          type: "start",
          position: { x: 100, y: 200 },
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [
            {
              id: "tr-init",
              sourceStateId: "start-1",
              targetStateId: "step-1",
              event: "WORKFLOW_STARTED",
            },
          ],
        },
        {
          id: "step-1",
          name: "Process Step",
          type: "atomic",
          position: { x: 400, y: 200 },
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [
            {
              id: "tr-complete",
              sourceStateId: "step-1",
              targetStateId: "end-1",
              event: "COMPLETED",
            },
          ],
        },
        {
          id: "end-1",
          name: "Completed",
          type: "final",
          position: { x: 700, y: 200 },
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
        `Workflow import rejected due to contract validation errors:\n${parseResult.errors.join("\n")}`
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

  addState: (workflowId, stateDef) => {
    let finalId = stateDef.id;
    get().updateWorkflow(workflowId, (draft) => {
      if (!finalId) {
        const occupiedIds = extractAllIds(draft);
        finalId = generateDesignerId("state", occupiedIds);
      }
      draft.states.push({ ...stateDef, id: finalId } as WorkflowState);
    });
    set({
      selectedStateId: finalId,
      selectedStateIds: finalId ? [finalId] : [],
      selectedTransitionId: null,
      selectedTransitionIds: [],
    });
  },

  updateState: (workflowId, stateId, partial) => {
    get().updateWorkflow(workflowId, (draft) => {
      const idx = draft.states.findIndex((s) => s.id === stateId);
      const existing = draft.states[idx];
      if (idx >= 0 && existing) {
        draft.states[idx] = { ...existing, ...partial };
      }
    });
  },

  duplicateState: (workflowId, stateId) => {
    let dupId: string | null = null;
    get().updateWorkflow(workflowId, (draft) => {
      const srcState = draft.states.find((s) => s.id === stateId);
      if (!srcState) return;

      const { states: clonedStates } = cloneWorkflowSubgraph(
        [srcState],
        srcState.transitions || [],
        { offset: { x: 40, y: 40 }, occupiedIds: extractAllIds(draft) }
      );
      const dupState = clonedStates[0];
      if (dupState) {
        draft.states.push(dupState);
        dupId = dupState.id;
      }
    });

    if (dupId) {
      set({
        selectedStateId: dupId,
        selectedStateIds: [dupId],
        selectedTransitionId: null,
        selectedTransitionIds: [],
      });
    }
  },

  deleteState: (workflowId, stateId) => {
    get().updateWorkflow(workflowId, (draft) => {
      draft.states = draft.states.filter((s) => s.id !== stateId);

      // Remove incoming and outgoing transitions across all states
      draft.states.forEach((s) => {
        s.transitions = (s.transitions || []).filter(
          (t) => t.sourceStateId !== stateId && t.targetStateId !== stateId
        );

        if (s.timeout?.targetStateId === stateId) {
          s.timeout.targetStateId = undefined;
        }
      });

      // Handle initial state deletion explicitly
      if (draft.initialStateId === stateId) {
        const remainingStart = draft.states.find((s) => s.type === "start");
        if (remainingStart) {
          draft.initialStateId = remainingStart.id;
        } else if (draft.states.length > 0 && draft.states[0]) {
          draft.initialStateId = draft.states[0].id;
        } else {
          draft.initialStateId = "";
        }
      }
    });
  },

  updateStatePosition: (workflowId, stateId, pos) => {
    get().updateWorkflow(workflowId, (draft) => {
      const st = draft.states.find((s) => s.id === stateId);
      if (st) st.position = pos;
    });
  },

  addTransition: (workflowId, transition) => {
    const currentWf = get().workflows.find((w) => w.id === workflowId);
    const occupiedIds = currentWf ? extractAllIds(currentWf) : [];

    const trWithDefaults: TransitionDefinition = {
      ...transition,
      id: transition.id || generateDesignerId("tr", occupiedIds),
      event: transition.event || "EVENT_REQUIRED",
      priority: transition.priority ?? 10,
    };

    get().updateWorkflow(workflowId, (draft) => {
      const srcState = draft.states.find((s) => s.id === trWithDefaults.sourceStateId);
      const targetState = draft.states.find((s) => s.id === trWithDefaults.targetStateId);

      // Reject creation if either source or target state does not exist
      if (!srcState || !targetState) {
        return;
      }

      srcState.transitions = [...(srcState.transitions || []), trWithDefaults];
    });

    const currentWfAfter = get().workflows.find((w) => w.id === workflowId);
    const exists = currentWfAfter?.states.some((s) =>
      (s.transitions || []).some((t) => t.id === trWithDefaults.id)
    );
    if (exists) {
      set({
        selectedTransitionId: trWithDefaults.id,
        selectedTransitionIds: [trWithDefaults.id],
        selectedStateId: null,
        selectedStateIds: [],
      });
    }
  },

  updateTransition: (workflowId, transitionId, partial) => {
    get().updateWorkflow(workflowId, (draft) => {
      let currentTr: TransitionDefinition | undefined;
      let currentSrcId: string | undefined;

      for (const state of draft.states) {
        if (!state.transitions) continue;
        const idx = state.transitions.findIndex((t) => t.id === transitionId);
        if (idx >= 0) {
          currentTr = state.transitions[idx];
          currentSrcId = state.id;
          break;
        }
      }

      if (!currentTr || !currentSrcId) return;

      const requestedSourceId = partial.sourceStateId ?? currentTr.sourceStateId;
      const requestedTargetId = partial.targetStateId ?? currentTr.targetStateId;

      const requestedSource = draft.states.find((state) => state.id === requestedSourceId);
      const requestedTarget = draft.states.find((state) => state.id === requestedTargetId);

      // Validate both proposed source and target state endpoints exist before mutating
      if (!requestedSource || !requestedTarget) {
        return;
      }

      if (requestedSourceId !== currentSrcId) {
        // Remove from old source state
        const oldState = draft.states.find((s) => s.id === currentSrcId);
        if (oldState) {
          oldState.transitions = (oldState.transitions || []).filter((t) => t.id !== transitionId);
        }

        // Add updated transition to new source state
        const updatedTr: TransitionDefinition = {
          ...currentTr,
          ...partial,
          id: currentTr.id,
          sourceStateId: requestedSourceId,
          targetStateId: requestedTargetId,
        };

        requestedSource.transitions = [...(requestedSource.transitions || []), updatedTr];
      } else {
        // Simple property update in existing source state
        const idx = requestedSource.transitions.findIndex((t) => t.id === transitionId);
        if (idx >= 0 && requestedSource.transitions[idx]) {
          requestedSource.transitions[idx] = {
            ...requestedSource.transitions[idx],
            ...partial,
            id: currentTr.id,
            sourceStateId: requestedSourceId,
            targetStateId: requestedTargetId,
          };
        }
      }
    });
  },

  moveTransitionSource: (workflowId, transitionId, newSourceStateId) => {
    get().updateTransition(workflowId, transitionId, { sourceStateId: newSourceStateId });
  },

  deleteTransition: (workflowId, transitionId) => {
    get().updateWorkflow(workflowId, (draft) => {
      for (const state of draft.states) {
        state.transitions = (state.transitions || []).filter((t) => t.id !== transitionId);
      }
    });
  },

  copySelection: (workflowId, stateIds, transitionIds) => {
    const wf = get().workflows.find((w) => w.id === workflowId);
    if (!wf) return;

    const targetStateIdSet = new Set(stateIds);

    // If transitionIds were explicitly passed without their endpoints, include endpoints automatically
    for (const st of wf.states) {
      for (const tr of st.transitions || []) {
        if (transitionIds.includes(tr.id)) {
          targetStateIdSet.add(tr.sourceStateId);
          targetStateIdSet.add(tr.targetStateId);
        }
      }
    }

    const targetStates = wf.states.filter((s) => targetStateIdSet.has(s.id));
    const isTransitionOnlyCopy = stateIds.length === 0 && transitionIds.length > 0;

    // Transitions are included when both endpoints are in targetStateIdSet
    const targetTransitions: TransitionDefinition[] = [];
    for (const st of wf.states) {
      for (const tr of st.transitions || []) {
        if (
          targetStateIdSet.has(tr.sourceStateId) &&
          targetStateIdSet.has(tr.targetStateId)
        ) {
          if (isTransitionOnlyCopy) {
            if (transitionIds.includes(tr.id) && !targetTransitions.some((t) => t.id === tr.id)) {
              targetTransitions.push(tr);
            }
          } else {
            if (!targetTransitions.some((t) => t.id === tr.id)) {
              targetTransitions.push(tr);
            }
          }
        }
      }
    }

    set({
      copiedSelection: {
        states: JSON.parse(JSON.stringify(targetStates)),
        transitions: JSON.parse(JSON.stringify(targetTransitions)),
      },
    });
  },

  pasteSelection: (workflowId, offset = { x: 50, y: 50 }) => {
    const clip = get().copiedSelection;
    if (!clip || clip.states.length === 0) return;

    let createdStateIds: string[] = [];

    get().updateWorkflow(workflowId, (draft) => {
      const { states: clonedStates } = cloneWorkflowSubgraph(
        clip.states,
        clip.transitions,
        { offset, occupiedIds: extractAllIds(draft) }
      );

      draft.states.push(...clonedStates);
      createdStateIds = clonedStates.map((s) => s.id);
    });

    if (createdStateIds.length > 0) {
      set({
        selectedStateId: createdStateIds[0],
        selectedStateIds: createdStateIds,
        selectedTransitionId: null,
        selectedTransitionIds: [],
      });
    }
  },

  deleteSelection: (workflowId, stateIds, transitionIds) => {
    get().updateWorkflow(workflowId, (draft) => {
      const stateSet = new Set(stateIds);
      const transitionSet = new Set(transitionIds);

      // Remove states
      draft.states = draft.states.filter((s) => !stateSet.has(s.id));

      // Remove transitions matching transitionSet OR connected to removed states
      for (const s of draft.states) {
        s.transitions = (s.transitions || []).filter(
          (t) =>
            !transitionSet.has(t.id) &&
            !stateSet.has(t.sourceStateId) &&
            !stateSet.has(t.targetStateId)
        );

        if (s.timeout?.targetStateId && stateSet.has(s.timeout.targetStateId)) {
          s.timeout.targetStateId = undefined;
        }
      }

      // Handle initial state deletion explicitly
      if (stateSet.has(draft.initialStateId)) {
        const remainingStart = draft.states.find((s) => s.type === "start");
        if (remainingStart) {
          draft.initialStateId = remainingStart.id;
        } else if (draft.states.length > 0 && draft.states[0]) {
          draft.initialStateId = draft.states[0].id;
        } else {
          draft.initialStateId = "";
        }
      }
    });
  },

  addActionToState: (workflowId, stateId, phase, action) => {
    get().updateWorkflow(workflowId, (draft) => {
      const st = draft.states.find((s) => s.id === stateId);
      if (st) {
        if (phase === "entry") st.entryActions.push(action);
        else if (phase === "active") st.activeActions.push(action);
        else if (phase === "exit") st.exitActions.push(action);
      }
    });
  },

  removeActionFromState: (workflowId, stateId, phase, actionId) => {
    get().updateWorkflow(workflowId, (draft) => {
      const st = draft.states.find((s) => s.id === stateId);
      if (st) {
        if (phase === "entry") st.entryActions = st.entryActions.filter((a) => a.id !== actionId);
        else if (phase === "active") st.activeActions = st.activeActions.filter((a) => a.id !== actionId);
        else if (phase === "exit") st.exitActions = st.exitActions.filter((a) => a.id !== actionId);
      }
    });
  },

  runValidation: (workflowId) => {
    const id = workflowId || get().activeWorkflowId;
    const wf = get().workflows.find((w) => w.id === id);
    if (!wf) return [];
    const issues = validateWorkflow(wf);
    set({ validationIssues: issues });
    return issues;
  },

  startNewRun: (workflowId, customContext) => {
    const wf = get().workflows.find((w) => w.id === workflowId) || vendorInvoiceWorkflow;
    const newRun = createWorkflowRun(wf, customContext);
    set((state) => ({
      activeRuns: [newRun, ...state.activeRuns],
      activeRunId: newRun.id,
    }));
    return newRun;
  },

  dispatchEventToRun: (runId, eventName, payload) => {
    const runs = get().activeRuns;
    const run = runs.find((r) => r.id === runId);
    if (!run) return;

    const wf = get().workflows.find((w) => w.id === run.workflowId) || vendorInvoiceWorkflow;
    const { updatedRun } = dispatchWorkflowEvent(wf, run, {
      id: `EVT-${Date.now()}`,
      type: eventName,
      timestamp: new Date().toISOString(),
      source: "Manual Simulator",
      payload,
    });

    set((state) => ({
      activeRuns: state.activeRuns.map((r) => (r.id === runId ? updatedRun : r)),
    }));
  },

  setActiveRunId: (runId) => set({ activeRunId: runId }),

  addConnection: (conn) =>
    set((state) => ({
      connections: [...state.connections, conn],
    })),
}));

export function createInitialTestStore() {
  const initialWf = JSON.parse(JSON.stringify(vendorInvoiceWorkflow)) as WorkflowDefinition;
  const initialSamples = JSON.parse(JSON.stringify(sampleWorkflows)) as WorkflowDefinition[];
  return {
    workflows: initialSamples,
    activeWorkflowId: initialWf.id,
    activeTab: "designer" as NavigationTab,

    selectedStateId: "validate-invoice",
    selectedTransitionId: null,
    selectedStateIds: ["validate-invoice"],
    selectedTransitionIds: [],

    copiedSelection: null,

    isAdvancedMode: false,
    validationIssues: validateWorkflow(initialWf),

    activeRuns: [],
    activeRunId: null,
    simulationActive: false,

    connections: [
      {
        id: "conn-gemini",
        name: "Google DeepMind Gemini API",
        type: "agent_provider" as const,
        service: "Gemini 3.6 Flash",
        status: "connected" as const,
        lastTestedAt: new Date().toISOString(),
      },
      {
        id: "conn-vendor-api",
        name: "ERP Vendor Registry API",
        type: "api_key" as const,
        service: "REST Endpoint",
        status: "connected" as const,
        lastTestedAt: new Date().toISOString(),
      },
      {
        id: "conn-slack",
        name: "Finance Slack Webhook",
        type: "webhook" as const,
        service: "Slack Channels",
        status: "connected" as const,
        lastTestedAt: new Date().toISOString(),
      },
    ],
  };
}

export function resetWorkflowStore() {
  resetDesignerIdFactory();
  useWorkflowStore.setState(createInitialTestStore());
}

export function extractAllIds(workflow: WorkflowDefinition): string[] {
  const ids = new Set<string>([workflow.id]);
  for (const st of workflow.states) {
    ids.add(st.id);
    for (const t of st.transitions || []) {
      ids.add(t.id);
      for (const a of t.actions || []) {
        if (a.id) ids.add(a.id);
      }
    }
    const actions = [
      ...(st.entryActions || []),
      ...(st.activeActions || []),
      ...(st.exitActions || []),
    ];
    for (const a of actions) {
      if (a.id) ids.add(a.id);
    }
  }
  return Array.from(ids);
}
