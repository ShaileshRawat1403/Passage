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
  toggleAdvancedMode: () => void;

  // Workflow CRUD
  createWorkflow: (name: string, description: string) => string;
  updateWorkflow: (workflowId: string, updater: (draft: WorkflowDefinition) => void) => void;
  deleteWorkflow: (workflowId: string) => void;
  importWorkflowJson: (jsonText: string) => string;

  // State & Transition Mutations (P1.1 Domain Operations)
  addState: (workflowId: string, state: WorkflowState) => void;
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
        selectedTransitionId: null,
        validationIssues: issues,
      });
    }
  },

  setSelectedStateId: (id) => set({ selectedStateId: id, selectedTransitionId: null }),
  setSelectedTransitionId: (id) => set({ selectedTransitionId: id, selectedStateId: null }),
  toggleAdvancedMode: () => set((s) => ({ isAdvancedMode: !s.isAdvancedMode })),

  createWorkflow: (name, description) => {
    const newId = `wf-${Date.now()}`;
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

      return {
        workflows: updated,
        validationIssues: issues,
      };
    });
  },

  deleteWorkflow: (id) => {
    set((state) => {
      const next = state.workflows.filter((w) => w.id !== id);
      const nextActive = next[0]?.id || "";
      return {
        workflows: next,
        activeWorkflowId: nextActive,
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
    set((state) => ({
      workflows: [workflow, ...state.workflows],
      activeWorkflowId: workflow.id,
      activeTab: "designer",
      validationIssues: parseResult.issues,
    }));
    return workflow.id;
  },

  addState: (workflowId, newState) => {
    get().updateWorkflow(workflowId, (draft) => {
      draft.states.push(newState);
    });
    set({ selectedStateId: newState.id, selectedTransitionId: null });
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
    get().updateWorkflow(workflowId, (draft) => {
      const srcState = draft.states.find((s) => s.id === stateId);
      if (!srcState) return;

      const newId = `${srcState.id}-copy-${Date.now().toString().slice(-4)}`;
      const newPos = {
        x: (srcState.position?.x ?? 100) + 40,
        y: (srcState.position?.y ?? 100) + 40,
      };

      const remapAction = (a: ActionDefinition): ActionDefinition => ({
        ...a,
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      });

      const entryActions = (srcState.entryActions || []).map(remapAction);
      const activeActions = (srcState.activeActions || []).map(remapAction);
      const exitActions = (srcState.exitActions || []).map(remapAction);

      const transitions: TransitionDefinition[] = (srcState.transitions || []).map((t) => ({
        ...t,
        id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sourceStateId: newId,
        targetStateId: t.targetStateId === srcState.id ? newId : t.targetStateId,
      }));

      const newState: WorkflowState = {
        ...JSON.parse(JSON.stringify(srcState)),
        id: newId,
        name: `${srcState.name} (Copy)`,
        type: srcState.type === "start" ? "atomic" : srcState.type,
        position: newPos,
        entryActions,
        activeActions,
        exitActions,
        transitions,
      };

      draft.states.push(newState);
      set({ selectedStateId: newId, selectedTransitionId: null });
    });
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
    });

    if (get().selectedStateId === stateId) {
      set({ selectedStateId: null });
    }
  },

  updateStatePosition: (workflowId, stateId, pos) => {
    get().updateWorkflow(workflowId, (draft) => {
      const st = draft.states.find((s) => s.id === stateId);
      if (st) st.position = pos;
    });
  },

  addTransition: (workflowId, transition) => {
    const trWithDefaults: TransitionDefinition = {
      ...transition,
      id: transition.id || `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      event: transition.event || "EVENT_REQUIRED",
      priority: transition.priority ?? 10,
    };

    get().updateWorkflow(workflowId, (draft) => {
      const srcState = draft.states.find((s) => s.id === trWithDefaults.sourceStateId);
      if (srcState) {
        srcState.transitions = [...(srcState.transitions || []), trWithDefaults];
      }
    });

    set({ selectedTransitionId: trWithDefaults.id, selectedStateId: null });
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

      // Check if sourceStateId is being changed
      if (partial.sourceStateId && partial.sourceStateId !== currentSrcId) {
        // Remove from old state
        const oldState = draft.states.find((s) => s.id === currentSrcId);
        if (oldState) {
          oldState.transitions = (oldState.transitions || []).filter((t) => t.id !== transitionId);
        }

        // Update transition
        const updatedTr: TransitionDefinition = { ...currentTr, ...partial, id: currentTr.id };

        // Add to new source state
        const newSrcState = draft.states.find((s) => s.id === partial.sourceStateId);
        if (newSrcState) {
          newSrcState.transitions = [...(newSrcState.transitions || []), updatedTr];
        }
      } else {
        // Simple property update in existing source state
        const srcState = draft.states.find((s) => s.id === currentSrcId);
        if (srcState && srcState.transitions) {
          const idx = srcState.transitions.findIndex((t) => t.id === transitionId);
          const existingTr = srcState.transitions[idx];
          if (idx >= 0 && existingTr) {
            srcState.transitions[idx] = {
              ...existingTr,
              ...partial,
              id: existingTr.id,
              sourceStateId: partial.sourceStateId ?? existingTr.sourceStateId,
              targetStateId: partial.targetStateId ?? existingTr.targetStateId,
            };
          }
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

    if (get().selectedTransitionId === transitionId) {
      set({ selectedTransitionId: null });
    }
  },

  copySelection: (workflowId, stateIds, transitionIds) => {
    const wf = get().workflows.find((w) => w.id === workflowId);
    if (!wf) return;

    const targetStates = wf.states.filter((s) => stateIds.includes(s.id));
    const targetStateIdSet = new Set(targetStates.map((s) => s.id));

    // Transitions are copied ONLY when both source AND target states are inside the copied selection
    const targetTransitions: TransitionDefinition[] = [];
    for (const st of wf.states) {
      for (const tr of st.transitions || []) {
        if (
          (transitionIds.includes(tr.id) || targetStateIdSet.has(tr.sourceStateId)) &&
          targetStateIdSet.has(tr.sourceStateId) &&
          targetStateIdSet.has(tr.targetStateId)
        ) {
          targetTransitions.push(tr);
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

    get().updateWorkflow(workflowId, (draft) => {
      const stateIdMap = new Map<string, string>();
      const createdStates: WorkflowState[] = [];

      for (const st of clip.states) {
        const newId = `${st.id}-paste-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 5)}`;
        stateIdMap.set(st.id, newId);

        const remapAction = (a: ActionDefinition): ActionDefinition => ({
          ...a,
          id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        });

        const newPos = {
          x: (st.position?.x ?? 100) + offset.x,
          y: (st.position?.y ?? 100) + offset.y,
        };

        const clonedState: WorkflowState = {
          ...JSON.parse(JSON.stringify(st)),
          id: newId,
          name: `${st.name} (Copy)`,
          type: st.type === "start" ? "atomic" : st.type,
          position: newPos,
          entryActions: (st.entryActions || []).map(remapAction),
          activeActions: (st.activeActions || []).map(remapAction),
          exitActions: (st.exitActions || []).map(remapAction),
          transitions: [],
        };

        createdStates.push(clonedState);
      }

      // Remap transitions
      for (const tr of clip.transitions) {
        const newSourceId = stateIdMap.get(tr.sourceStateId);
        const newTargetId = stateIdMap.get(tr.targetStateId);

        if (newSourceId && newTargetId) {
          const newTr: TransitionDefinition = {
            ...JSON.parse(JSON.stringify(tr)),
            id: `tr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sourceStateId: newSourceId,
            targetStateId: newTargetId,
          };

          const srcState = createdStates.find((s) => s.id === newSourceId);
          if (srcState) {
            srcState.transitions.push(newTr);
          }
        }
      }

      draft.states.push(...createdStates);

      const firstCreated = createdStates[0];
      if (firstCreated) {
        set({ selectedStateId: firstCreated.id, selectedTransitionId: null });
      }
    });
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
    });

    const currSelState = get().selectedStateId;
    const currSelTr = get().selectedTransitionId;

    if (currSelState && stateIds.includes(currSelState)) {
      set({ selectedStateId: null });
    }
    if (currSelTr && transitionIds.includes(currSelTr)) {
      set({ selectedTransitionId: null });
    }
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
