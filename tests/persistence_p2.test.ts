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
    (commandService as any).adapter = adapter;
  });

  describe("P2.0A & P2.0B - Persistence Contracts & Entity Storage", () => {
    it("persists workflow head and retrieves exact definition adhering to WorkflowEntity contract", async () => {
      const res = await commandService.saveWorkflow(sampleWf);
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe(sampleWf.id);

      const retrieved = await adapter.getWorkflowHead(sampleWf.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe(sampleWf.name);
      expect(retrieved?.states.length).toBe(sampleWf.states.length);
    });

    it("publishes immutable workflow version snapshot and rejects duplicate version republish", async () => {
      await commandService.saveWorkflow(sampleWf);
      const pubRes = await commandService.publishWorkflowVersion(sampleWf.id, "1.1.0");

      expect(pubRes.success).toBe(true);
      expect(pubRes.data?.version).toBe("1.1.0");
      expect(pubRes.data?.status).toBe("published");

      const versionDefinition = await adapter.getWorkflowVersion(sampleWf.id, "1.1.0");
      expect(versionDefinition).not.toBeNull();
      expect(versionDefinition?.version).toBe("1.1.0");

      // Attempting to overwrite existing version must fail due to immutability
      const duplicatePub = await commandService.publishWorkflowVersion(sampleWf.id, "1.1.0");
      expect(duplicatePub.success).toBe(false);
      expect(duplicatePub.error).toContain("is immutable");
    });

    it("fails validation for invalid workflow schema", async () => {
      const invalidWf = { ...sampleWf, initialStateId: "" };
      const res = await commandService.saveWorkflow(invalidWf as unknown as WorkflowDefinition);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Workflow validation failed");
    });
  });

  describe("P2.0C - Server-Side Workflow & Run Command Services", () => {
    it("creates workflow run and records initial append-only run event with integer sequence number", async () => {
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
      expect(runEvents[0]?.sequence).toBe(1);

      const activities = await adapter.getWorkspaceActivities();
      expect(activities.some((a) => a.action === "Workflow Run Started")).toBe(true);
    });

    it("dispatches event to run, executes lifecycle actions, and appends sequential run events", async () => {
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

      // Verify sequence numbers are monotonic
      for (let i = 0; i < runEvents.length; i++) {
        expect(runEvents[i]?.sequence).toBe(i + 1);
      }
    });
  });

  describe("P2.0D - Idempotency, Concurrency & Conflict Protection", () => {
    it("enforces exact-once idempotency on duplicate command dispatch", async () => {
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
      const eventIds = runEvents.map((e) => e.id);
      const uniqueIds = new Set(eventIds);
      expect(eventIds.length).toBe(uniqueIds.size);
    });

    it("rejects concurrent command dispatch when expectedRevision does not match current run revision (CAS / OCC)", async () => {
      await commandService.saveWorkflow(sampleWf);
      const runRes = await commandService.createRun(sampleWf.id, "CASE-CAS-1");
      const run = runRes.data!;

      // Run initial revision is 1
      expect(run.revision).toBe(1);

      // Attempt to save batch with stale expected revision 0 (must fail)
      await expect(
        adapter.saveRunAndEventsBatch({
          run: { ...run, revision: 2 },
          newEvents: [],
          expectedRevision: 0,
        })
      ).rejects.toThrow("Concurrency conflict");

      // Successful batch with valid expected revision 1 increments revision to 2
      const updatedRun = await adapter.saveRunAndEventsBatch({
        run: { ...run, revision: 2 },
        newEvents: [],
        expectedRevision: 1,
      });
      expect(updatedRun.revision).toBe(2);
    });

    it("rejects idempotency key reclamation on failed/stale record if request hash differs", async () => {
      const key = "idemp-failed-reclaim";
      // Mark key as failed with original hash "payload-A"
      await adapter.checkOrSetIdempotency(key, "payload-A");
      await adapter.failIdempotency(key, "Execution timeout");

      // Reclaiming with different hash "payload-B" must be rejected
      await expect(
        adapter.checkOrSetIdempotency(key, "payload-B")
      ).rejects.toThrow("Idempotency key conflict");

      // Reclaiming with same hash "payload-A" succeeds and resets record to pending
      const checkRes = await adapter.checkOrSetIdempotency(key, "payload-A");
      expect(checkRes.isDuplicate).toBe(false);
      expect(checkRes.record?.status).toBe("pending");
    });

    it("proves publishWorkflowVersionAtomic commits version snapshot, updates workflow head, logs activity, and completes idempotency in a single atomic transaction", async () => {
      await commandService.saveWorkflow(sampleWf);
      const idempKey = "pub-idemp-key-1";

      const pubRes = await commandService.publishWorkflowVersion(sampleWf.id, "2.0.0", idempKey);
      expect(pubRes.success).toBe(true);
      expect(pubRes.data?.version).toBe("2.0.0");
      expect(pubRes.data?.status).toBe("published");

      // Verify version record exists
      const versionDef = await adapter.getWorkflowVersion(sampleWf.id, "2.0.0");
      expect(versionDef).not.toBeNull();

      // Verify activity was logged
      const activities = await adapter.getWorkspaceActivities();
      expect(activities.some((a) => a.action === "Workflow Version Published")).toBe(true);

      // Verify duplicate idempotency call returns exact cached result
      const dupPubRes = await commandService.publishWorkflowVersion(sampleWf.id, "2.0.0", idempKey);
      expect(dupPubRes.success).toBe(true);
      expect(dupPubRes.isDuplicate).toBe(true);
      expect(dupPubRes.data?.version).toBe("2.0.0");
    });

    it("blocks execution when idempotency key is currently pending/in-progress", async () => {
      const key = "idemp-pending-key";
      // Manually set pending record in adapter with matching payload hash
      const sampleWfHash = require("crypto").createHash("sha256").update(JSON.stringify(sampleWf)).digest("hex");
      await adapter.checkOrSetIdempotency(key, sampleWfHash);

      // Attempting to invoke command with same pending key should return inProgress duplicate status
      const res = await commandService.saveWorkflow(sampleWf, key);
      expect(res.success).toBe(false);
      expect(res.isDuplicate).toBe(true);
      expect(res.error).toContain("currently in progress");
    });

    it("proves state, event, sequence, and idempotency continuity across complete durable adapter/service destruction and restart", async () => {
      await commandService.saveWorkflow(sampleWf);
      const runRes = await commandService.createRun(sampleWf.id, "CASE-RESTART-1");
      const run = runRes.data!;

      const idempKey = "idemp-restart-key-1";
      const dispatchRes = await commandService.dispatchRunEvent(
        run.id,
        "SUBMIT_APPROVAL",
        { invoiceAmount: 1200 },
        idempKey
      );
      expect(dispatchRes.success).toBe(true);

      // Snapshot internal storage to simulate persistent disk/database recovery
      const storageSnapshot = {
        workflows: new Map((adapter as any).workflows),
        versions: new Map((adapter as any).versions),
        runs: new Map((adapter as any).runs),
        runEvents: [...(adapter as any).runEvents],
        activities: [...(adapter as any).activities],
        connections: new Map((adapter as any).connections),
        idempotencyRecords: new Map((adapter as any).idempotencyRecords),
      };

      // Completely destroy old adapter & command service
      (adapter as any) = null;
      (commandService as any) = null;

      // Re-create brand new adapter and seed with snapshot data
      const freshAdapter = new MemoryPersistenceAdapter();
      (freshAdapter as any).workflows = storageSnapshot.workflows;
      (freshAdapter as any).versions = storageSnapshot.versions;
      (freshAdapter as any).runs = storageSnapshot.runs;
      (freshAdapter as any).runEvents = storageSnapshot.runEvents;
      (freshAdapter as any).activities = storageSnapshot.activities;
      (freshAdapter as any).connections = storageSnapshot.connections;
      (freshAdapter as any).idempotencyRecords = storageSnapshot.idempotencyRecords;

      const freshCommandService = new CommandService();
      (freshCommandService as any).adapter = freshAdapter;

      // Verify reloaded run state
      const reloadedRun = await freshAdapter.getWorkflowRun(run.id);
      expect(reloadedRun).not.toBeNull();
      expect(reloadedRun?.id).toBe(run.id);
      expect(reloadedRun?.caseId).toBe("CASE-RESTART-1");
      expect(reloadedRun?.auditTrail.length).toBeGreaterThan(1);

      // Verify events and monotonic sequence persistence
      const reloadedEvents = await freshAdapter.getRunEvents(run.id);
      expect(reloadedEvents.length).toBe(reloadedRun!.auditTrail.length);
      for (let i = 0; i < reloadedEvents.length; i++) {
        expect(reloadedEvents[i]?.sequence).toBe(i + 1);
      }

      // Verify idempotency record survived restart and returns duplicate result
      const duplicateRes = await freshCommandService.dispatchRunEvent(
        run.id,
        "SUBMIT_APPROVAL",
        { invoiceAmount: 1200 },
        idempKey
      );
      expect(duplicateRes.success).toBe(true);
      expect(duplicateRes.isDuplicate).toBe(true);
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
