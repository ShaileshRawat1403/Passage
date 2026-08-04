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

  // State & Transition Mutations
  addState: (workflowId: string, state: WorkflowState) => void;
  updateState: (workflowId: string, stateId: string, partial: Partial<WorkflowState>) => void;
  deleteState: (workflowId: string, stateId: string) => void;
  updateStatePosition: (workflowId: string, stateId: string, pos: { x: number; y: number }) => void;

  addTransition: (workflowId: string, transition: TransitionDefinition) => void;
  updateTransition: (
    workflowId: string,
    transitionId: string,
    partial: Partial<TransitionDefinition>
  ) => void;
  deleteTransition: (workflowId: string, transitionId: string) => void;

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
    set({ selectedStateId: newState.id });
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

  deleteState: (workflowId, stateId) => {
    get().updateWorkflow(workflowId, (draft) => {
      draft.states = draft.states.filter((s) => s.id !== stateId);
      // Remove transitions pointing to this state or originating from it
      draft.states.forEach((s) => {
        s.transitions = (s.transitions || []).filter(
          (t) => t.sourceStateId !== stateId && t.targetStateId !== stateId
        );
      });
    });
    set({ selectedStateId: null });
  },

  updateStatePosition: (workflowId, stateId, pos) => {
    get().updateWorkflow(workflowId, (draft) => {
      const st = draft.states.find((s) => s.id === stateId);
      if (st) st.position = pos;
    });
  },

  addTransition: (workflowId, transition) => {
    get().updateWorkflow(workflowId, (draft) => {
      const srcState = draft.states.find((s) => s.id === transition.sourceStateId);
      if (srcState) {
        srcState.transitions = [...(srcState.transitions || []), transition];
      }
    });
    set({ selectedTransitionId: transition.id });
  },

  updateTransition: (workflowId, transitionId, partial) => {
    get().updateWorkflow(workflowId, (draft) => {
      for (const state of draft.states) {
        if (!state.transitions) continue;
        const idx = state.transitions.findIndex((t) => t.id === transitionId);
        const existingTr = state.transitions[idx];
        if (idx >= 0 && existingTr) {
          state.transitions[idx] = { ...existingTr, ...partial };
          break;
        }
      }
    });
  },

  deleteTransition: (workflowId, transitionId) => {
    get().updateWorkflow(workflowId, (draft) => {
      for (const state of draft.states) {
        state.transitions = (state.transitions || []).filter((t) => t.id !== transitionId);
      }
    });
    set({ selectedTransitionId: null });
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
