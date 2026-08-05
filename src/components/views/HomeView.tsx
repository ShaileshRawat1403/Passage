import React, { useState } from "react";
import {
  Play,
  Plus,
  Upload,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  List,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { deriveWorkspaceOverview } from "../../domain/workspaceOverview";
import { CreateWorkflowDialog } from "../workflows/CreateWorkflowDialog";
import { ImportWorkflowDialog } from "../workflows/ImportWorkflowDialog";
import { DescribeWorkflowModal } from "../ai/DescribeWorkflowModal";

export const HomeView: React.FC = () => {
  const {
    workflows,
    activeWorkflowId,
    activeRuns,
    setActiveWorkflowId,
    setActiveTab,
    setActiveRunId,
  } = useWorkflowStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Pure derivation overview
  const overview = deriveWorkspaceOverview({
    workflows,
    activeWorkflowId,
    activeRuns,
  });

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Unknown";
    const parsed = new Date(isoString);
    if (isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderReadinessBadge = (readiness: string) => {
    if (readiness === "executable") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] uppercase font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          <span>Executable</span>
        </span>
      );
    }
    if (readiness === "structurally_valid") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono text-[10px] uppercase font-semibold">
          <CheckCircle2 className="w-3 h-3 text-amber-400" />
          <span>Structurally Valid</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono text-[10px] uppercase font-semibold">
        <AlertTriangle className="w-3 h-3" />
        <span>Incomplete Draft</span>
      </span>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 text-xs font-sans">
      {/* A. Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-100 tracking-wider uppercase">
            Passage Home
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Continue your workflows, resolve structural issues, and start new process definitions.
          </p>
        </div>

        {/* Quick Actions Header Cluster */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workflow</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-mono font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import</span>
          </button>
          <button
            onClick={() => setShowAiModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Describe (AI)</span>
          </button>
        </div>
      </div>

      {/* When workspace is completely empty (0 workflows), render only onboarding state */}
      {workflows.length === 0 ? (
        <div className="p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-lg font-bold font-mono text-slate-100 tracking-wide">
              Build your first Passage workflow.
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Create a workflow from scratch, import a definition, or describe the process you want to model.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Plus className="w-4 h-4" />
              <span>Create Workflow</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-mono font-semibold text-xs flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Import Definition</span>
            </button>
            <button
              onClick={() => setShowAiModal(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold text-xs flex items-center gap-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Describe with AI</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Workspace Status Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Workflows</div>
              <div className="text-xl font-bold font-mono text-slate-100">{overview.counts.workflows}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Drafts</div>
              <div className="text-xl font-bold font-mono text-slate-300">{overview.counts.drafts}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/30 border border-emerald-500/20 space-y-1">
              <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Executable</div>
              <div className="text-xl font-bold font-mono text-emerald-400">{overview.counts.executable}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/30 border border-rose-500/20 space-y-1">
              <div className="text-[10px] font-mono text-rose-400 uppercase tracking-wider">Needs Attention</div>
              <div className="text-xl font-bold font-mono text-rose-400">{overview.counts.needingAttention}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/30 border border-blue-500/20 space-y-1">
              <div className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">Active Runs</div>
              <div className="text-xl font-bold font-mono text-blue-400">{overview.counts.activeRuns}</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/30 border border-amber-500/20 space-y-1">
              <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">Waiting Runs</div>
              <div className="text-xl font-bold font-mono text-amber-400">{overview.counts.waitingRuns}</div>
            </div>
          </div>

          {/* B. Continue Working Card */}
          {overview.continueWorkflow && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-black/60 to-black/30 border border-cyan-500/30 backdrop-blur-2xl shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-cyan-400 tracking-wider font-bold">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Continue Working</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-100 font-mono tracking-wide">
                    {overview.continueWorkflow.name}
                  </h2>
                </div>

                <button
                  onClick={() => {
                    setActiveWorkflowId(overview.continueWorkflow!.workflowId);
                    setActiveTab("designer");
                  }}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] transition-all text-xs cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Open Designer</span>
                </button>
              </div>

              {overview.continueWorkflow.description && (
                <p className="text-slate-300 text-xs leading-relaxed max-w-3xl">
                  {overview.continueWorkflow.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono text-[10px]">
                  v{overview.continueWorkflow.version}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-mono text-[10px] uppercase">
                  Status: {overview.continueWorkflow.lifecycleStatus}
                </span>
                {renderReadinessBadge(overview.continueWorkflow.readiness)}

                <div className="ml-auto flex items-center gap-4 text-[11px] font-mono text-slate-400">
                  <span>{overview.continueWorkflow.stateCount} States</span>
                  <span>•</span>
                  <span>{overview.continueWorkflow.transitionCount} Transitions</span>
                  <span>•</span>
                  {overview.continueWorkflow.errorCount > 0 && (
                    <span className="text-rose-400 font-semibold">
                      {overview.continueWorkflow.errorCount} Errors
                    </span>
                  )}
                  {overview.continueWorkflow.errorCount === 0 && overview.continueWorkflow.warningCount > 0 && (
                    <span className="text-amber-400 font-semibold">
                      {overview.continueWorkflow.warningCount} Warnings
                    </span>
                  )}
                  {overview.continueWorkflow.errorCount === 0 && overview.continueWorkflow.warningCount === 0 && (
                    <span className="text-emerald-400 font-semibold">0 Issues</span>
                  )}
                  <span>•</span>
                  <span>Updated {formatDate(overview.continueWorkflow.updatedAt)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Grid Layout for C. Needs Attention & E. Quick Start */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* C. Needs Attention */}
            <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-black/30 border border-white/10 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="font-bold font-mono text-xs text-slate-100 uppercase tracking-wider">
                    Needs Attention
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                  {overview.attentionItems.length} Items
                </span>
              </div>

              {overview.attentionItems.length === 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>
                    No items require attention. All workflow process definitions are structurally sound and active cases are proceeding normally.
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {overview.attentionItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.kind === "workflow_errors" || item.kind === "workflow_warnings") {
                          setActiveWorkflowId(item.workflowId);
                          setActiveTab("designer");
                        } else {
                          if (item.runId) {
                            setActiveRunId(item.runId);
                          }
                          setActiveTab("runs");
                        }
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                        item.severity === "error"
                          ? "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30 text-rose-200"
                          : "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30 text-amber-200"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-bold text-xs text-slate-100">
                          <span>{item.title}</span>
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                              item.severity === "error"
                                ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                                : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                            }`}
                          >
                            {item.kind.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="shrink-0 pt-1">
                        <span className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 inline-flex items-center gap-1 font-mono text-[10px]">
                          <span>View</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* E. Quick Start */}
            <div className="p-5 sm:p-6 rounded-3xl bg-black/30 border border-white/10 backdrop-blur-xl space-y-4">
              <div className="border-b border-white/10 pb-3">
                <h3 className="font-bold font-mono text-xs text-slate-100 uppercase tracking-wider">
                  Quick Start
                </h3>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all group cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-100 group-hover:text-cyan-400 transition-colors">
                        Create Workflow
                      </div>
                      <div className="text-[10px] text-slate-400">Start a new state map from scratch</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => setShowImportModal(true)}
                  className="w-full p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all group cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-100 group-hover:text-cyan-400 transition-colors">
                        Import Definition
                      </div>
                      <div className="text-[10px] text-slate-400">Paste JSON schema to restore workflow</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                </button>

                <button
                  onClick={() => setShowAiModal(true)}
                  className="w-full p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all group cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-100 group-hover:text-indigo-400 transition-colors">
                        Describe Workflow with AI
                      </div>
                      <div className="text-[10px] text-slate-400">Generate process graph using natural language</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* F. Recent Workflows */}
          <div className="p-5 sm:p-6 rounded-3xl bg-black/30 border border-white/10 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <List className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold font-mono text-xs text-slate-100 uppercase tracking-wider">
                  Recent Workflows
                </h3>
              </div>

              <button
                onClick={() => setActiveTab("workflows")}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span>View All Workflows</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {overview.recentWorkflows.map((wf) => (
                <div
                  key={wf.workflowId}
                  className="p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-cyan-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{wf.name}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-300 border border-white/10">
                        v{wf.version}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">
                        {wf.lifecycleStatus}
                      </span>
                      {renderReadinessBadge(wf.readiness)}
                    </div>
                    {wf.description && (
                      <p className="text-slate-400 text-xs truncate max-w-xl">
                        {wf.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500 pt-0.5">
                      <span>{wf.stateCount} States</span>
                      <span>•</span>
                      <span>{wf.transitionCount} Transitions</span>
                      <span>•</span>
                      {wf.errorCount > 0 ? (
                        <span className="text-rose-400 font-semibold font-mono">
                          {wf.errorCount} {wf.errorCount === 1 ? "error" : "errors"}
                        </span>
                      ) : wf.warningCount > 0 ? (
                        <span className="text-amber-400 font-semibold font-mono">
                          {wf.warningCount} {wf.warningCount === 1 ? "warning" : "warnings"}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold font-mono">0 issues</span>
                      )}
                      <span>•</span>
                      <span>Updated {formatDate(wf.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setActiveWorkflowId(wf.workflowId);
                        setActiveTab("designer");
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Reusable Dialogs */}
      <CreateWorkflowDialog
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      <ImportWorkflowDialog
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      <DescribeWorkflowModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
      />
    </div>
  );
};
