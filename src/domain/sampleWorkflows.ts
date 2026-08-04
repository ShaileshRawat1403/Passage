import { WorkflowDefinition } from "../types/workflow";

export const vendorInvoiceWorkflow: WorkflowDefinition = {
  id: "vendor-invoice-review",
  name: "Vendor Invoice Review",
  description: "Durable invoice validation, risk analysis, amount-based threshold routing, and human approval state machine.",
  version: "1.4.0",
  status: "published",
  initialStateId: "invoice-received",
  createdAt: "2026-08-01T10:00:00Z",
  updatedAt: "2026-08-04T03:45:00Z",

  defaultContext: {
    caseId: "INV-2026-0142",
    invoice: {
      id: "INV-2026-0142",
      amount: 82400,
      currency: "INR",
      vendorId: "VEND-9942",
      vendorName: "Acme Logistics Pvt Ltd",
      purchaseOrderId: "PO-8831",
      submittedAt: "2026-08-04T03:30:00Z",
    },
    validation: {
      schemaValid: true,
      vendorActive: true,
      purchaseOrderOpen: true,
    },
    analysis: {
      riskScore: 12,
      recommendation: "Low risk vendor with verified purchase order match.",
    },
    approval: {
      status: "pending",
      reviewerId: undefined,
      comments: undefined,
    },
  },

  states: [
    {
      id: "invoice-received",
      name: "Invoice Received",
      description: "Initial state when invoice payload enters the Stateflow system.",
      type: "start",
      position: { x: 50, y: 220 },
      entryActions: [
        {
          id: "act-log-entry",
          name: "Record Workflow Entry Audit",
          type: "audit",
          description: "Persists initial payload hash and case ID to append-only log.",
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-start-to-validate",
          name: "Start Processing",
          sourceStateId: "invoice-received",
          targetStateId: "validate-invoice",
          event: "WORKFLOW_STARTED",
          priority: 10,
          description: "Triggers invoice schema and vendor verification.",
        },
      ],
    },

    {
      id: "validate-invoice",
      name: "Validate Invoice",
      description: "Verifies invoice schema, vendor registration, and purchase order status via API.",
      type: "atomic",
      position: { x: 340, y: 220 },
      entryActions: [
        {
          id: "act-check-schema",
          name: "Validate Invoice Schema",
          type: "transform",
          description: "Ensures required fields (amount, currency, vendor ID) exist.",
        },
      ],
      activeActions: [
        {
          id: "act-api-vendor",
          name: "Check Vendor Registry API",
          type: "http",
          description: "Calls vendor service to confirm active registration.",
          httpConfig: {
            method: "POST",
            url: "/api/vendor/check",
          },
        },
        {
          id: "act-api-po",
          name: "Validate Purchase Order Status",
          type: "http",
          description: "Ensures PO balance matches invoice total.",
          httpConfig: {
            method: "POST",
            url: "/api/po/validate",
          },
        },
      ],
      exitActions: [],
      transitions: [
        {
          id: "tr-val-passed",
          name: "Validation Passed",
          sourceStateId: "validate-invoice",
          targetStateId: "amount-decision",
          event: "VALIDATION_PASSED",
          priority: 10,
          guard: {
            id: "guard-val-pass",
            name: "Vendor & Schema Valid",
            logic: "ALL",
            conditions: [
              {
                id: "c-val-1",
                field: "$.validation.schemaValid",
                operator: "is_true",
              },
              {
                id: "c-val-2",
                field: "$.validation.vendorActive",
                operator: "is_true",
              },
            ],
          },
        },
        {
          id: "tr-val-failed",
          name: "Validation Failed",
          sourceStateId: "validate-invoice",
          targetStateId: "needs-correction",
          event: "VALIDATION_FAILED",
          priority: 5,
        },
      ],
    },

    {
      id: "amount-decision",
      name: "Amount Decision",
      description: "Evaluates invoice total to route high-value items to finance approval.",
      type: "decision",
      position: { x: 670, y: 220 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-amount-high",
          name: "Above ₹50,000 Threshold",
          sourceStateId: "amount-decision",
          targetStateId: "finance-approval",
          event: "EVALUATE_AMOUNT",
          priority: 20,
          guard: {
            id: "guard-above-50k",
            name: "Amount > ₹50,000",
            description: "Invoices over ₹50,000 require manual Finance Manager sign-off.",
            logic: "ALL",
            conditions: [
              {
                id: "c-amt-1",
                field: "$.invoice.amount",
                operator: "greater_than",
                value: 50000,
              },
            ],
          },
        },
        {
          id: "tr-amount-low",
          name: "Standard Invoice (<= ₹50,000)",
          sourceStateId: "amount-decision",
          targetStateId: "analyse-risk",
          event: "EVALUATE_AMOUNT",
          priority: 10,
          guard: {
            id: "guard-below-50k",
            name: "Amount <= ₹50,000",
            logic: "ALL",
            conditions: [
              {
                id: "c-amt-2",
                field: "$.invoice.amount",
                operator: "less_than_or_equal",
                value: 50000,
              },
            ],
          },
        },
      ],
    },

    {
      id: "analyse-risk",
      name: "Analyse Risk",
      description: "Runs AI risk analyst, fraud check API, and historical anomaly detection concurrently.",
      type: "parallel",
      position: { x: 980, y: 110 },
      parallelPolicy: {
        mode: "all",
      },
      entryActions: [],
      activeActions: [
        {
          id: "act-agent-risk",
          name: "Run Risk Analysis Agent",
          type: "agent",
          description: "Generates risk score and audit reasoning using Gemini.",
          agentConfig: {
            agentName: "Risk Analyst Bot",
            modelProvider: "Google DeepMind",
            model: "gemini-3.6-flash",
            systemInstructions: "Inspect vendor invoice history, bank account matching, and PO variance.",
          },
        },
        {
          id: "act-fraud-api",
          name: "External Fraud Risk API",
          type: "http",
          description: "Checks global watchlists and duplicate invoice database.",
          httpConfig: {
            method: "POST",
            url: "/api/fraud/verify",
          },
        },
      ],
      exitActions: [],
      transitions: [
        {
          id: "tr-risk-done",
          name: "Analysis Complete",
          sourceStateId: "analyse-risk",
          targetStateId: "ready-for-payment",
          event: "ANALYSIS_COMPLETED",
          priority: 10,
        },
      ],
    },

    {
      id: "finance-approval",
      name: "Finance Approval",
      description: "Suspends workflow execution until Finance Manager responds or 24h deadline expires.",
      type: "approval",
      position: { x: 980, y: 350 },
      timeout: {
        durationMs: 86400000,
        event: "TIMEOUT_REACHED",
      },
      entryActions: [
        {
          id: "act-approval-request",
          name: "Request Finance Sign-Off",
          type: "human_task",
          description: "Assigns review item to Finance Manager role.",
          humanTaskConfig: {
            assigneeRole: "Finance Manager",
            dueHours: 24,
            options: ["APPROVE", "REJECT", "REQUEST_CHANGES"],
          },
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-app-approved",
          name: "Approval Received",
          sourceStateId: "finance-approval",
          targetStateId: "ready-for-payment",
          event: "APPROVAL_RECEIVED",
          priority: 20,
        },
        {
          id: "tr-app-rejected",
          name: "Rejection Received",
          sourceStateId: "finance-approval",
          targetStateId: "rejected",
          event: "REJECTION_RECEIVED",
          priority: 15,
        },
        {
          id: "tr-app-changes",
          name: "Changes Requested",
          sourceStateId: "finance-approval",
          targetStateId: "needs-correction",
          event: "CHANGES_REQUESTED",
          priority: 10,
        },
        {
          id: "tr-app-timeout",
          name: "24h SLA Timeout",
          sourceStateId: "finance-approval",
          targetStateId: "needs-correction",
          event: "TIMEOUT_REACHED",
          priority: 5,
        },
      ],
    },

    {
      id: "needs-correction",
      name: "Needs Correction",
      description: "Awaiting vendor or submitter correction payload before re-attempting validation.",
      type: "waiting",
      position: { x: 670, y: 480 },
      entryActions: [
        {
          id: "act-notify-vendor",
          name: "Send Correction Notification",
          type: "notification",
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-resubmit",
          name: "Correction Resubmitted",
          sourceStateId: "needs-correction",
          targetStateId: "validate-invoice",
          event: "CORRECTION_SUBMITTED",
          priority: 10,
        },
      ],
    },

    {
      id: "ready-for-payment",
      name: "Ready for Payment",
      description: "Terminal state: Invoice is approved and scheduled for disbursement.",
      type: "final",
      position: { x: 1300, y: 220 },
      entryActions: [
        {
          id: "act-disburse",
          name: "Trigger ERP Disbursement API",
          type: "http",
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },

    {
      id: "rejected",
      name: "Rejected",
      description: "Terminal state: Invoice review was rejected.",
      type: "final",
      position: { x: 1300, y: 380 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },

    {
      id: "cancelled",
      name: "Cancelled",
      description: "Terminal state: Invoice processing was cancelled by operator.",
      type: "final",
      position: { x: 1300, y: 510 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },
  ],
};

export const researchClaimWorkflow: WorkflowDefinition = {
  id: "research-claim-validation",
  name: "Research Claim Validation",
  description: "Cross-checks academic claims with citation databases and peer review panel.",
  version: "1.0.0",
  status: "published",
  initialStateId: "claim-submitted",
  createdAt: "2026-08-02T12:00:00Z",
  updatedAt: "2026-08-02T12:00:00Z",
  defaultContext: {
    claimId: "CLM-901",
    author: "Dr. Evelyn Reed",
    subject: "Quantum Superconductivity at 280K",
  },
  states: [
    {
      id: "claim-submitted",
      name: "Claim Submitted",
      type: "start",
      position: { x: 50, y: 200 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-1",
          sourceStateId: "claim-submitted",
          targetStateId: "literature-check",
          event: "SUBMITTED",
        },
      ],
    },
    {
      id: "literature-check",
      name: "Literature Index Search",
      type: "atomic",
      position: { x: 350, y: 200 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-2",
          sourceStateId: "literature-check",
          targetStateId: "peer-review",
          event: "INDEXED",
        },
      ],
    },
    {
      id: "peer-review",
      name: "Peer Review Panel",
      type: "approval",
      position: { x: 650, y: 200 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-3",
          sourceStateId: "peer-review",
          targetStateId: "verified",
          event: "APPROVED",
        },
      ],
    },
    {
      id: "verified",
      name: "Claim Verified",
      type: "final",
      position: { x: 950, y: 200 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },
  ],
};

export const sampleWorkflows: WorkflowDefinition[] = [
  vendorInvoiceWorkflow,
  researchClaimWorkflow,
];
