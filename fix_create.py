import re

with open("src/store/workflowStore.ts", "r") as f:
    code = f.read()

correct_create = """
  createWorkflow: (name, description) => {
    const newId = generateDesignerId("workflow", get().workflows.map(w => w.id));
    const newWf: WorkflowDefinition = {
      id: newId,
      name,
      description,
      status: "draft",
      initialStateId: "start-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      states: [
        {
          id: "start-1",
          name: "Start State",
          type: "start",
          position: { x: 250, y: 150 },
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [
            {
              id: "tr-init",
              name: "Initialize",
              sourceStateId: "start-1",
              targetStateId: "step-1",
              event: "WORKFLOW_STARTED",
              priority: 10,
            }
          ],
        },
        {
          id: "step-1",
          name: "Process Step",
          type: "atomic",
          position: { x: 250, y: 300 },
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [
            {
              id: "tr-finish",
              name: "Finish",
              sourceStateId: "step-1",
              targetStateId: "end-1",
              event: "STEP_COMPLETED",
              priority: 10,
            }
          ],
        },
        {
          id: "end-1",
          name: "End State",
          type: "final",
          position: { x: 250, y: 450 },
          entryActions: [],
          activeActions: [],
          exitActions: [],
          transitions: [],
        }
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
      historyByWorkflowId: {
        ...state.historyByWorkflowId,
        [newId]: { past: [], future: [] }
      }
    }));

    return newId;
  },
"""

code = re.sub(r'createWorkflow: \(name, description\) => \{[\s\S]*?\},[\s]*updateWorkflow: \(workflowId, updater\)', correct_create.strip() + '\n\n  updateWorkflow: (workflowId, updater)', code)

with open("src/store/workflowStore.ts", "w") as f:
    f.write(code)

