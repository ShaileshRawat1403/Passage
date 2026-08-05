import { useWorkflowStore, resetWorkflowStore } from "./src/store/workflowStore.ts";

useWorkflowStore.setState({ historyByWorkflowId: { "a": { past: ["hello"] } } });
console.log("Before:", useWorkflowStore.getState().historyByWorkflowId);
resetWorkflowStore();
console.log("After:", useWorkflowStore.getState().historyByWorkflowId);
