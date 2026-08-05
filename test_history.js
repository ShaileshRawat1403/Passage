import { useWorkflowStore, resetWorkflowStore } from "./src/store/workflowStore.ts";

resetWorkflowStore();
const store = useWorkflowStore.getState();
const wf = store.workflows[0];
const stateId = wf.states[0].id;
console.log("Initial state:", JSON.stringify(wf.states[0]));

useWorkflowStore.getState().updateState(wf.id, stateId, { name: wf.states[0].name });
let h1 = useWorkflowStore.getState().historyByWorkflowId[wf.id];
console.log("No op history length:", h1 ? h1.past.length : 0);

useWorkflowStore.getState().updateState(wf.id, stateId, { name: "Name 1" });
let h2 = useWorkflowStore.getState().historyByWorkflowId[wf.id];
console.log("History past length:", h2.past.length);
console.log("Last op:", h2.past[h2.past.length-1].operation, h2.past[h2.past.length-1].groupKey);

useWorkflowStore.getState().updateState(wf.id, stateId, { name: "Name 2" });
let h3 = useWorkflowStore.getState().historyByWorkflowId[wf.id];
console.log("History past length:", h3.past.length);
console.log("Last op:", h3.past[h3.past.length-1].operation, h3.past[h3.past.length-1].groupKey);
