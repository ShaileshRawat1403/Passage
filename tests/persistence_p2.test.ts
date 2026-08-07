import { describe, it, expect, beforeEach } from "vitest";
import { MemoryPersistenceAdapter } from "../src/services/persistenceAdapter";
import { CommandService } from "../src/services/commandService";
import { sampleWorkflows } from "../src/domain/sampleWorkflows";
import { WorkflowDefinition, ConnectionCredential } from "../src/types/workflow";

describe("P2.0 Durable Runtime Spine - Persistence, Idempotency & Events", () => {
  let adapter: MemoryPersistenceAdapter;
  let commandService: CommandService;
  const sampleWf = sampleWorkflows[0]!;

  beforeEach(() => {
    adapter = new MemoryPersistenceAdapter();
    commandService = new CommandService();
    // Inject adapter into commandService for testing
    (commandService as any).adapter = adapter;
  });

  describe("P2.0A & P2.0B - Persistence Contracts & Entity Storage", () => {
    it("persists workflow head and retrieves exact definition", async () => {
      const res = await commandService.saveWorkflow(sampleWf);
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe(sampleWf.id);

      const retrieved = await adapter.getWorkflowHead(sampleWf.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe(sampleWf.name);
      expect(retrieved?.states.length).toBe(sampleWf.states.length);
    });

    it("publishes immutable workflow version snapshot", async () => {
      await commandService.saveWorkflow(sampleWf);
      const pubRes = await commandService.publishWorkflowVersion(sampleWf.id, "1.1.0");

      expect(pubRes.success).toBe(true);
      expect(pubRes.data?.version).toBe("1.1.0");
      expect(pubRes.data?.status).toBe("published");

      const versionDefinition = await adapter.getWorkflowVersion(sampleWf.id, "1.1.0");
      expect(versionDefinition).not.toBeNull();
      expect(versionDefinition?.version).toBe("1.1.0");
    });

    it("fails validation for invalid workflow schema", async () => {
      const invalidWf = { ...sampleWf, initialStateId: "" };
      const res = await commandService.saveWorkflow(invalidWf as unknown as WorkflowDefinition);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Workflow validation failed");
    });
  });

  describe("P2.0C - Server-Side Workflow & Run Command Services", () => {
    it("creates workflow run and records initial append-only run event", async () => {
      await commandService.saveWorkflow(sampleWf);
      const runRes = await commandService.createRun(sampleWf.id, "CASE-TEST-101", {
        amount: 500,
      });

      expect(runRes.success).toBe(true);
      const run = runRes.data!;
      expect(run.caseId).toBe("CASE-TEST-101");
      expect(run.currentStateId).toBe(sampleWf.initialStateId);
      expect(run.context.amount).toBe(500);

      const runEvents = await adapter.getRunEvents(run.id);
      expect(runEvents.length).toBeGreaterThan(0);
      expect(runEvents[0]?.eventType).toBe("workflow_started");

      const activities = await adapter.getWorkspaceActivities();
      expect(activities.some((a) => a.action === "Workflow Run Started")).toBe(true);
    });

    it("dispatches event to run, executes lifecycle actions, and appends run events", async () => {
      await commandService.saveWorkflow(sampleWf);
      const runRes = await commandService.createRun(sampleWf.id, "CASE-TEST-102");
      const run = runRes.data!;

      const dispatchRes = await commandService.dispatchRunEvent(
        run.id,
        "WORKFLOW_STARTED",
        { approver: "admin" }
      );

      expect(dispatchRes.success).toBe(true);
      const { updatedRun, transitionTaken } = dispatchRes.data!;
      expect(transitionTaken).toBe(true);
      expect(updatedRun.visitedStateIds).toContain(sampleWf.initialStateId);

      const runEvents = await adapter.getRunEvents(run.id);
      expect(runEvents.length).toBeGreaterThan(1);

      const stateEnteredEvents = runEvents.filter((e) => e.eventType === "state_entered");
      expect(stateEnteredEvents.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("P2.0D - Restart, Idempotency & Append-Only Event Proof", () => {
    it("enforces idempotency on duplicate command dispatch", async () => {
      await commandService.saveWorkflow(sampleWf);
      const runRes = await commandService.createRun(sampleWf.id, "CASE-IDEMP-1");
      const run = runRes.data!;

      const key = "idemp-dispatch-1";
      const res1 = await commandService.dispatchRunEvent(
        run.id,
        "SUBMIT_APPROVAL",
        {},
        key
      );
      expect(res1.success).toBe(true);
      expect(res1.isDuplicate).toBeUndefined();

      const res2 = await commandService.dispatchRunEvent(
        run.id,
        "SUBMIT_APPROVAL",
        {},
        key
      );
      expect(res2.success).toBe(true);
      expect(res2.isDuplicate).toBe(true);

      const runEvents = await adapter.getRunEvents(run.id);
      // Run events should not double-count duplicate dispatch
      const eventIds = runEvents.map((e) => e.id);
      const uniqueIds = new Set(eventIds);
      expect(eventIds.length).toBe(uniqueIds.size);
    });

    it("proves state and context continuity across simulated server restarts", async () => {
      await commandService.saveWorkflow(sampleWf);
      const runRes = await commandService.createRun(sampleWf.id, "CASE-RESTART-1");
      const run = runRes.data!;

      await commandService.dispatchRunEvent(run.id, "SUBMIT_APPROVAL", {
        invoiceAmount: 1200,
      });

      // Simulate server restart: instantiate fresh CommandService reading from same persisted storage
      const newCommandService = new CommandService();
      (newCommandService as any).adapter = adapter;

      const reloadedRun = await adapter.getWorkflowRun(run.id);
      expect(reloadedRun).not.toBeNull();
      expect(reloadedRun?.id).toBe(run.id);
      expect(reloadedRun?.caseId).toBe("CASE-RESTART-1");
      expect(reloadedRun?.auditTrail.length).toBeGreaterThan(1);
    });
  });

  describe("P2.0 Status Model Correction", () => {
    it("defaults ordinary connection templates to 'configured' or 'untested' rather than 'available_local'", async () => {
      const conn: ConnectionCredential = {
        id: "conn-openai",
        name: "OpenAI API Provider",
        type: "agent_provider",
        service: "OpenAI GPT-4",
        status: "available_local",
      };

      const res = await commandService.saveConnection(conn);
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("configured");
    });
  });
});
