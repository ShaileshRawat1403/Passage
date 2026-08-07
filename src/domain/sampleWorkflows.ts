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
          name: "Record Workflow Entry Activity",
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
          description: "Generates risk score and activity reasoning using Gemini.",
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
          httpConfig: {
            method: "POST",
            url: "/api/erp/disburse",
          },
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

export const customerOnboardingWorkflow: WorkflowDefinition = {
  id: "customer-onboarding-kyc",
  name: "Customer Onboarding & KYC Verification",
  description: "Durable customer identity verification, sanctions screening, automated risk assessment, and compliance sign-off.",
  version: "2.1.0",
  status: "published",
  initialStateId: "account-created",
  createdAt: "2026-08-03T09:00:00Z",
  updatedAt: "2026-08-04T01:15:00Z",
  defaultContext: {
    caseId: "KYC-2026-8812",
    customer: {
      id: "CUST-4921",
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      country: "IN",
      riskScore: 18,
    },
    verification: {
      documentVerified: true,
      sanctionsCleared: true,
      pepChecked: true,
    },
  },
  states: [
    {
      id: "account-created",
      name: "Account Created",
      description: "Triggered when a new user signs up for an enterprise account.",
      type: "start",
      position: { x: 50, y: 220 },
      entryActions: [
        {
          id: "act-kyc-log",
          name: "Initialize KYC Activity Trail",
          type: "audit",
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-kyc-start",
          name: "Start KYC Verification",
          sourceStateId: "account-created",
          targetStateId: "verify-identity",
          event: "SUBMIT_DOCUMENTS",
          priority: 10,
        },
      ],
    },
    {
      id: "verify-identity",
      name: "Verify Identity & Sanctions",
      description: "Queries identity verification API and global sanctions database concurrently.",
      type: "parallel",
      position: { x: 350, y: 220 },
      parallelPolicy: { mode: "all" },
      entryActions: [],
      activeActions: [
        {
          id: "act-id-check",
          name: "National ID Verification API",
          type: "http",
          httpConfig: { method: "POST", url: "/api/identity/verify" },
        },
        {
          id: "act-sanction-check",
          name: "Global Sanctions & PEP Lookup",
          type: "http",
          httpConfig: { method: "POST", url: "/api/sanctions/check" },
        },
      ],
      exitActions: [],
      transitions: [
        {
          id: "tr-verify-done",
          name: "Verification Complete",
          sourceStateId: "verify-identity",
          targetStateId: "risk-assessment-decision",
          event: "VERIFICATION_COMPLETE",
          priority: 10,
        },
      ],
    },
    {
      id: "risk-assessment-decision",
      name: "Risk Score Evaluation",
      description: "Routes high-risk profiles to compliance review panel.",
      type: "decision",
      position: { x: 670, y: 220 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-high-risk",
          name: "High Risk (Score > 50)",
          sourceStateId: "risk-assessment-decision",
          targetStateId: "compliance-manual-review",
          event: "EVALUATE_RISK",
          priority: 20,
          guard: {
            id: "guard-risk-high",
            name: "Risk Score > 50",
            logic: "ALL",
            conditions: [
              { id: "c-risk-1", field: "$.customer.riskScore", operator: "greater_than", value: 50 },
            ],
          },
        },
        {
          id: "tr-low-risk",
          name: "Low Risk Profile",
          sourceStateId: "risk-assessment-decision",
          targetStateId: "account-activated",
          event: "EVALUATE_RISK",
          priority: 10,
          guard: {
            id: "guard-risk-low",
            name: "Risk Score <= 50",
            logic: "ALL",
            conditions: [
              { id: "c-risk-2", field: "$.customer.riskScore", operator: "less_than_or_equal", value: 50 },
            ],
          },
        },
      ],
    },
    {
      id: "compliance-manual-review",
      name: "Compliance Manual Review",
      description: "Awaiting Compliance Officer manual clearance.",
      type: "approval",
      position: { x: 980, y: 350 },
      timeout: { durationMs: 43200000, event: "TIMEOUT_REACHED" },
      entryActions: [
        {
          id: "act-assign-compliance",
          name: "Assign to Compliance Officer",
          type: "human_task",
          humanTaskConfig: {
            assigneeRole: "Compliance Officer",
            dueHours: 12,
            options: ["CLEAR", "REJECT"],
          },
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-comp-approved",
          name: "Cleared by Compliance",
          sourceStateId: "compliance-manual-review",
          targetStateId: "account-activated",
          event: "COMPLIANCE_CLEARED",
          priority: 20,
        },
        {
          id: "tr-comp-rejected",
          name: "Compliance Rejected",
          sourceStateId: "compliance-manual-review",
          targetStateId: "onboarding-rejected",
          event: "COMPLIANCE_REJECTED",
          priority: 10,
        },
      ],
    },
    {
      id: "account-activated",
      name: "Account Activated",
      description: "Terminal State: User account provisioned and welcome email dispatched.",
      type: "final",
      position: { x: 1300, y: 220 },
      entryActions: [
        {
          id: "act-welcome-mail",
          name: "Dispatch Welcome Credentials",
          type: "notification",
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },
    {
      id: "onboarding-rejected",
      name: "Onboarding Rejected",
      description: "Terminal State: Application rejected due to compliance risk.",
      type: "final",
      position: { x: 1300, y: 380 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    },
  ],
};

export const incidentTriageWorkflow: WorkflowDefinition = {
  id: "incident-triage-escalation",
  name: "Infrastructure Incident Triage & SLA Escalation",
  description: "Automated alert diagnostic, severity classification, on-call engineer dispatch, and SLA escalation.",
  version: "1.1.0",
  status: "published",
  initialStateId: "alert-ingested",
  createdAt: "2026-08-03T18:00:00Z",
  updatedAt: "2026-08-04T02:00:00Z",
  defaultContext: {
    caseId: "INC-2026-0042",
    incident: {
      service: "Database Cluster Asia-East",
      metric: "Connection Timeout Rate > 45%",
      severity: "P1",
      latencyMs: 3400,
    },
  },
  states: [
    {
      id: "alert-ingested",
      name: "Alert Ingested",
      type: "start",
      position: { x: 50, y: 220 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-inc-start",
          sourceStateId: "alert-ingested",
          targetStateId: "ai-diagnostic-run",
          event: "ALERT_RECEIVED",
        },
      ],
    },
    {
      id: "ai-diagnostic-run",
      name: "AI SRE Diagnostic Run",
      description: "Gemini agent analyzes telemetry logs and recent deployment commits.",
      type: "atomic",
      position: { x: 350, y: 220 },
      entryActions: [],
      activeActions: [
        {
          id: "act-sre-agent",
          name: "Run Gemini SRE Diagnostic Agent",
          type: "agent",
          agentConfig: {
            agentName: "SRE Root-Cause Bot",
            modelProvider: "Google DeepMind",
            model: "gemini-3.6-flash",
            systemInstructions: "Inspect pod logs, memory pressure, and recent canary releases.",
          },
        },
      ],
      exitActions: [],
      transitions: [
        {
          id: "tr-diag-done",
          sourceStateId: "ai-diagnostic-run",
          targetStateId: "severity-routing",
          event: "DIAGNOSTIC_COMPLETE",
        },
      ],
    },
    {
      id: "severity-routing",
      name: "Severity Routing Decision",
      type: "decision",
      position: { x: 670, y: 220 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-p1-route",
          name: "Critical P1 Incident",
          sourceStateId: "severity-routing",
          targetStateId: "page-oncall-engineer",
          event: "EVALUATE_SEVERITY",
          priority: 20,
          guard: {
            id: "guard-p1",
            name: "Severity == P1",
            logic: "ALL",
            conditions: [
              { id: "c-sev-1", field: "$.incident.severity", operator: "equals", value: "P1" },
            ],
          },
        },
        {
          id: "tr-p3-route",
          name: "Standard P3 Warning",
          sourceStateId: "severity-routing",
          targetStateId: "auto-remediation",
          event: "EVALUATE_SEVERITY",
          priority: 10,
        },
      ],
    },
    {
      id: "page-oncall-engineer",
      name: "Page On-Call Engineer",
      description: "Pages primary SRE lead via PagerDuty webhook and Slack #incident-room.",
      type: "approval",
      position: { x: 980, y: 220 },
      timeout: { durationMs: 900000, event: "SLA_BREACH" },
      entryActions: [
        {
          id: "act-pagerduty",
          name: "Trigger PagerDuty High Alert",
          type: "http",
          httpConfig: {
            method: "POST",
            url: "/api/pagerduty/trigger",
          },
        },
      ],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-ack",
          sourceStateId: "page-oncall-engineer",
          targetStateId: "incident-resolved",
          event: "INCIDENT_ACKNOWLEDGED",
        },
        {
          id: "tr-sla-breach",
          name: "15m Unacknowledged SLA Breach",
          sourceStateId: "page-oncall-engineer",
          targetStateId: "escalate-to-vp",
          event: "SLA_BREACH",
        },
      ],
    },
    {
      id: "auto-remediation",
      name: "Auto-Remediation Script",
      type: "atomic",
      position: { x: 980, y: 420 },
      entryActions: [],
      activeActions: [
        {
          id: "act-restart-pods",
          name: "Restart Unhealthy Pod Replicas",
          type: "http",
          httpConfig: {
            method: "POST",
            url: "/api/k8s/restart-pods",
          },
        },
      ],
      exitActions: [],
      transitions: [
        {
          id: "tr-remediated",
          sourceStateId: "auto-remediation",
          targetStateId: "incident-resolved",
          event: "REMEDIATION_SUCCESS",
        },
      ],
    },
    {
      id: "escalate-to-vp",
      name: "VP Engineering Escalation",
      type: "approval",
      position: { x: 1280, y: 350 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [
        {
          id: "tr-vp-ack",
          sourceStateId: "escalate-to-vp",
          targetStateId: "incident-resolved",
          event: "MANUAL_INTERVENTION_COMPLETE",
        },
      ],
    },
    {
      id: "incident-resolved",
      name: "Incident Resolved",
      type: "final",
      position: { x: 1550, y: 220 },
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
  customerOnboardingWorkflow,
  incidentTriageWorkflow,
  researchClaimWorkflow,
];

