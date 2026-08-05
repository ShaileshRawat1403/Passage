// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { useWorkflowStore } from "../src/store/workflowStore";
import { Header } from "../src/components/layout/Header";
import { HomeView } from "../src/components/views/HomeView";
import { WorkflowDefinition } from "../src/types/workflow";

const sampleExecutableWorkflow: WorkflowDefinition = {
  id: "wf-test-1",
  name: "Invoice Processing",
  description: "Automated invoice collection process",
  version: "1.0.0",
  status: "published",
  initialStateId: "start",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-10T00:00:00.000Z",
  states: [
    {
      id: "start",
      name: "Start",
      type: "start",
      position: { x: 0, y: 0 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "t1",
          sourceStateId: "start",
          targetStateId: "end",
          event: "SUBMIT",
        },
      ],
    },
    {
      id: "end",
      name: "End",
      type: "final",
      position: { x: 100, y: 0 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },
  ],
};

const sampleInvalidWorkflow: WorkflowDefinition = {
  id: "wf-test-2",
  name: "Draft Onboarding",
  description: "Incomplete onboarding workflow",
  version: "0.1.0",
  status: "draft",
  initialStateId: "s1",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-12T00:00:00.000Z",
  states: [
    {
      id: "s1",
      name: "Start",
      type: "start",
      position: { x: 0, y: 0 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "t-invalid",
          sourceStateId: "s1",
          targetStateId: "non-existent-state",
          event: "GOTO",
        },
      ],
    },
  ],
};

describe("HomeView & Header Component Integration (P1.5)", () => {
  beforeEach(() => {
    // Reset store state
    useWorkflowStore.setState({
      workflows: [sampleExecutableWorkflow, sampleInvalidWorkflow],
      activeWorkflowId: "wf-test-1",
      activeTab: "home",
      activeRuns: [],
      activeRunId: null,
      historyByWorkflowId: {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("1. Header renders 'Home' as the first navigation tab and defaults activeTab to 'home'", () => {
    render(<Header />);
    const state = useWorkflowStore.getState();
    expect(state.activeTab).toBe("home");

    const homeTabBtn = screen.getByRole("button", { name: /Home/i });
    expect(homeTabBtn).not.toBeNull();

    // Verify 'Home' is the first tab in navigation order
    const navButtons = screen.getAllByRole("button").filter((btn) =>
      ["Home", "Designer", "Runs", "Cases", "Audit Trail"].some((label) =>
        btn.textContent?.includes(label)
      )
    );
    expect(navButtons.length).toBeGreaterThan(0);
    expect(navButtons[0]?.textContent).toContain("Home");
  });

  it("2. Contextual controls (workflow select, Simulate Case, Describe AI) are hidden on Home tab, but brand click returns Home", () => {
    render(<Header />);

    // Workflow dropdown, Simulate Case, and Header Describe (AI) button should be hidden on Home
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/Simulate Case/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Describe \(AI\)/i })).toBeNull();

    // Switch to designer
    act(() => {
      useWorkflowStore.setState({ activeTab: "designer" });
    });
    cleanup();
    render(<Header />);

    // Now contextual controls and Describe (AI) should be visible in Header
    expect(screen.getByRole("combobox")).not.toBeNull();
    expect(screen.getByText(/Simulate Case/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Describe \(AI\)/i })).not.toBeNull();

    // Clicking brand logo returns to Home
    const brandBtn = screen.getByTitle("Return to Passage Home");
    fireEvent.click(brandBtn);

    expect(useWorkflowStore.getState().activeTab).toBe("home");
  });

  it("3. Empty workspace suppresses metric strip, Needs Attention, duplicate Quick Start, and Recent Workflows", () => {
    useWorkflowStore.setState({
      workflows: [],
      activeWorkflowId: "",
      activeTab: "home",
    });

    render(<HomeView />);

    // Onboarding card should be visible
    expect(screen.getByText("Build your first Passage workflow.")).not.toBeNull();

    // Deduplicated single action surface for empty onboarding
    expect(screen.getAllByRole("button", { name: /Create Workflow/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Import Definition/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Describe Workflow with AI/i })).toHaveLength(1);

    // Sections that MUST be suppressed when empty:
    expect(screen.queryByText("Needs Attention")).toBeNull();
    expect(screen.queryByText("Quick Start")).toBeNull();
    expect(screen.queryByText("Recent Workflows")).toBeNull();
    expect(screen.queryByText("Drafts")).toBeNull(); // part of summary metric strip
  });

  it("4. Non-empty workspace renders metric strip, Needs Attention, Quick Start, Recent Workflows, and Issue counts", () => {
    render(<HomeView />);

    // Header and metrics
    expect(screen.getByText("Passage Home")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Needs Attention" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Quick Start" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Recent Workflows" })).not.toBeNull();

    // Deduplicated single action surface in Quick Start panel
    expect(screen.getAllByRole("button", { name: /Create Workflow/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Import Definition/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Describe Workflow with AI/i })).toHaveLength(1);

    // Check recent workflow issue counts
    expect(screen.getAllByText("0 issues").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/error/i).length).toBeGreaterThan(0);
  });

  it("5. Attention items are keyboard accessible native buttons with clear descriptions", () => {
    render(<HomeView />);

    // Draft Onboarding has 1 validation error, so an attention card button is rendered
    const attentionBtn = screen.getByRole("button", { name: /Draft Onboarding/i });
    expect(attentionBtn).not.toBeNull();

    // Clicking attention card opens designer for that workflow
    fireEvent.click(attentionBtn);

    const state = useWorkflowStore.getState();
    expect(state.activeWorkflowId).toBe("wf-test-2");
    expect(state.activeTab).toBe("designer");
  });

  it("6. Shared Create Workflow dialog enforces non-blank name and creates workflow", () => {
    render(<HomeView />);

    // Open Create Workflow modal from header quick action
    const createBtn = screen.getAllByRole("button", { name: /Create Workflow/i })[0];
    expect(createBtn).toBeDefined();
    fireEvent.click(createBtn!);

    // Modal title should appear
    expect(screen.getByText("Create New Workflow")).not.toBeNull();

    // Close button should have accessible name
    const closeBtn = screen.getByRole("button", { name: "Close create workflow dialog" });
    expect(closeBtn).not.toBeNull();

    // Submit with empty name
    const createBtns = screen.getAllByRole("button", { name: "Create Workflow" });
    const submitBtn = createBtns[createBtns.length - 1];
    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn!);

    // Error message must be shown
    expect(screen.getByText("Workflow name is required and cannot be blank.")).not.toBeNull();

    // Fill valid name
    const input = screen.getByPlaceholderText("e.g. Employee Onboarding Process");
    fireEvent.change(input, { target: { value: "Customer Verification Flow" } });

    fireEvent.click(submitBtn!);

    // Store updated with new workflow and switched tab to designer
    const state = useWorkflowStore.getState();
    const created = state.workflows.find((w) => w.name === "Customer Verification Flow");
    expect(created).toBeDefined();
    expect(state.activeWorkflowId).toBe(created?.id);
    expect(state.activeTab).toBe("designer");
  });

  it("7. Shared Import Workflow dialog rejects malformed JSON without mutating store", () => {
    const initialWorkflowsCount = useWorkflowStore.getState().workflows.length;

    render(<HomeView />);

    // Open Import Modal
    const importBtn = screen.getAllByRole("button", { name: /Import/i })[0];
    expect(importBtn).toBeDefined();
    fireEvent.click(importBtn!);

    expect(screen.getByText("Import Workflow Definition")).not.toBeNull();

    // Close button accessible name
    const closeBtn = screen.getByRole("button", { name: "Close import workflow dialog" });
    expect(closeBtn).not.toBeNull();

    // Enter bad JSON
    const textarea = screen.getByPlaceholderText("Paste exported Passage JSON schema here...");
    fireEvent.change(textarea, { target: { value: '{"invalid": "schema"}' } });

    const submitImportBtn = screen.getByRole("button", { name: "Import Into Designer" });
    fireEvent.click(submitImportBtn);

    // Contract validation error presented in UI
    expect(screen.getByText(/contract validation errors/i)).not.toBeNull();

    // Store was NOT mutated
    expect(useWorkflowStore.getState().workflows.length).toBe(initialWorkflowsCount);
  });

  it("8. View All Workflows button navigates to 'workflows' tab", () => {
    render(<HomeView />);

    const viewAllBtn = screen.getByRole("button", { name: /View All Workflows/i });
    fireEvent.click(viewAllBtn);

    expect(useWorkflowStore.getState().activeTab).toBe("workflows");
  });
});
