import { createStore } from "zustand/vanilla";
const store = createStore((set) => ({
    historyByWorkflowId: { "a": { past: ["STATE_ADDED"] } }
}));
console.log("Before:", store.getState().historyByWorkflowId);
store.setState({ historyByWorkflowId: {} });
console.log("After:", store.getState().historyByWorkflowId);
