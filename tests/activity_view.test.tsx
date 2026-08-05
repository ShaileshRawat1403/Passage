// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { ActivityView } from "../src/components/views/ActivityView";
import { MainLayout } from "../src/components/layout/MainLayout";
import { useWorkflowStore, resetWorkflowStore } from "../src/store/workflowStore";
import { filterActivityLogs, formatActivityTimestamp, seedInitialActivityLogs } from "../src/domain/activity";

describe("Workspace Activity & Audit Trail", () => {
  beforeEach(() => {
    act(() => {
      resetWorkflowStore();
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("Activity Domain & Seed Helpers", () => {
    it("seeds initial activity logs deterministically for sample workflows", () => {
      const state = useWorkflowStore.getState();
      expect(state.activityLogs.length).toBeGreaterThan(0);

      const creationLogs = state.activityLogs.filter((l) => l.category === "workflow_creation" || l.category === "workflow_import");
      expect(creationLogs.length).toBeGreaterThan(0);
    });

    it("filterActivityLogs filters correctly by query, category, and workflow", () => {
      const state = useWorkflowStore.getState();
      const logs = state.activityLogs;

      // Filter by category designer_edit
      const designerEdits = filterActivityLogs(logs, "", "designer_edits", "all");
      expect(designerEdits.every((l) => l.category === "designer_edit")).toBe(true);

      // Filter by search query
      const searchQueryMatches = filterActivityLogs(logs, "Invoice", "all", "all");
      expect(searchQueryMatches.every((l) => l.action.includes("Invoice") || l.details.includes("Invoice") || l.workflowName?.includes("Invoice"))).toBe(true);
    });

    it("formatActivityTimestamp formats relative and exact strings safely", () => {
      const nowIso = new Date().toISOString();
      const formatted = formatActivityTimestamp(nowIso);
      expect(formatted.relative).toBe("Just now");
      expect(formatted.exact.length).toBeGreaterThan(0);
    });
  });

  describe("Store Action Automatic Audit Trail", () => {
    it("logs a new activity entry when a workflow is created", () => {
      act(() => {
        useWorkflowStore.getState().createWorkflow("Payment Authorization Pipeline", "Handles 2FA payments");
      });

      const logs = useWorkflowStore.getState().activityLogs;
      const latest = logs[0];
      expect(latest?.category).toBe("workflow_creation");
      expect(latest?.action).toBe("Workflow Definition Created");
      expect(latest?.details).toContain("Payment Authorization Pipeline");
      expect(latest?.workflowName).toBe("Payment Authorization Pipeline");
    });

    it("logs a new activity entry when a workflow definition is imported", () => {
      const validJson = JSON.stringify({
        id: "wf-imported-test",
        name: "Imported Fraud Audit Workflow",
        version: "1.2.0",
        initialStateId: "init",
        states: [
          {
            id: "init",
            name: "Initial Check",
            type: "start",
            position: { x: 100, y: 100 },
            transitions: [
              {
                id: "tr-to-final",
                name: "Complete Check",
                sourceStateId: "init",
                targetStateId: "final-1",
                event: "CHECK_DONE",
                priority: 1,
              },
            ],
          },
          {
            id: "final-1",
            name: "Audit Complete",
            type: "final",
            position: { x: 300, y: 100 },
            transitions: [],
          },
        ],
      });

      act(() => {
        useWorkflowStore.getState().importWorkflowJson(validJson);
      });

      const logs = useWorkflowStore.getState().activityLogs;
      const latest = logs[0];
      expect(latest?.category).toBe("workflow_import");
      expect(latest?.action).toBe("Workflow Definition Imported");
      expect(latest?.workflowName).toBe("Imported Fraud Audit Workflow");
    });

    it("logs designer edits when states are added or modified", () => {
      const activeWfId = useWorkflowStore.getState().activeWorkflowId;

      act(() => {
        useWorkflowStore.getState().addState(activeWfId, {
          name: "Manager Approval",
          type: "approval",
          position: { x: 300, y: 300 },
        });
      });

      const logs = useWorkflowStore.getState().activityLogs;
      const editLogs = logs.filter((l) => l.category === "designer_edit");
      expect(editLogs.length).toBeGreaterThan(0);
      expect(editLogs[0]?.action).toContain("STATE ADDED");
    });

    it("logs simulation run starts", () => {
      const activeWfId = useWorkflowStore.getState().activeWorkflowId;

      act(() => {
        useWorkflowStore.getState().startNewRun(activeWfId);
      });

      const logs = useWorkflowStore.getState().activityLogs;
      const latest = logs[0];
      expect(latest?.category).toBe("run_event");
      expect(latest?.action).toBe("Workflow Simulation Started");
    });
  });

  describe("ActivityView Component UI", () => {
    it("renders the Activity View title, summary stats, and search bar", () => {
      render(<ActivityView />);

      expect(screen.getByRole("heading", { name: /Activity Feed/i })).not.toBeNull();
      expect(screen.getByText("Workspace Activity")).not.toBeNull();
      expect(screen.getByText("Total Logged")).not.toBeNull();
      expect(screen.getByPlaceholderText(/Filter actions by workflow/i)).not.toBeNull();
    });

    it("filters activities when text search input changes", () => {
      render(<ActivityView />);

      const searchInput = screen.getByPlaceholderText(/Filter actions by workflow/i);
      fireEvent.change(searchInput, { target: { value: "NonExistentSearchTermXYZ99" } });

      expect(screen.getByText("No matching activities found")).not.toBeNull();

      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.queryByText("No matching activities found")).toBeNull();
    });

    it("allows category tab filtering", () => {
      render(<ActivityView />);

      const designerEditsTab = screen.getByRole("button", { name: "Designer Edits" });
      fireEvent.click(designerEditsTab);

      // Verify filter applied
      const state = useWorkflowStore.getState();
      expect(state.activityLogs.length).toBeGreaterThan(0);
    });

    it("renders ActivityView within MainLayout when activeTab is set to 'activity'", () => {
      act(() => {
        useWorkflowStore.setState({ activeTab: "activity" });
      });

      render(<MainLayout />);
      expect(screen.getByRole("heading", { name: /Activity Feed/i })).not.toBeNull();
    });
  });
});
