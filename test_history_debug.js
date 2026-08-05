import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, resetWorkflowStore } from "./src/store/workflowStore.ts";

resetWorkflowStore();
const store = useWorkflowStore.getState();
const wf = store.workflows[0];

useWorkflowStore.getState().commitDraftOperation(wf.id, "STATE_UPDATED", "test", (draft) => {
    const idx = draft.states.findIndex((s) => s.id === wf.states[0].id);
    const existing = draft.states[idx];
    draft.states[idx] = { ...existing, name: wf.states[0].name };

    console.log("BEFORE:", JSON.stringify(wf));
    console.log("AFTER:", JSON.stringify(draft));
    console.log("EQUAL?", JSON.stringify(wf) === JSON.stringify(draft));
});
