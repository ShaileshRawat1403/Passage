import { describe, it, expect, beforeEach } from "vitest";
import { useWorkflowStore, resetWorkflowStore } from "./src/store/workflowStore.ts";

resetWorkflowStore();
const store = useWorkflowStore.getState();
const wf = store.workflows[0];
console.log("HISTORY IS:", store.historyByWorkflowId);
useWorkflowStore.getState().updateState(wf.id, wf.states[0].id, { name: wf.states[0].name });
const h = useWorkflowStore.getState().historyByWorkflowId[wf.id];
console.log("HISTORY AFTER UPDATE IS:", h ? h.past : "undefined");
