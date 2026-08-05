import React, { useState, useMemo } from "react";
import {
  History,
  Sparkles,
  Plus,
  Upload,
  Layers,
  Play,
  Plug,
  Search,
  Download,
  Trash2,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  Filter,
  ShieldCheck,
  Activity as ActivityIcon,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { WorkspaceActivity, WorkspaceActivityCategory } from "../../types/workflow";
import { filterActivityLogs, formatActivityTimestamp } from "../../domain/activity";

export const ActivityView: React.FC = () => {
  const {
    activityLogs,
    workflows,
    setActiveWorkflowId,
    setActiveTab,
    clearActivityLogs,
  } = useWorkflowStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // Filtered & Sorted Logs
  const filteredLogs = useMemo(() => {
    const logs = filterActivityLogs(
      activityLogs,
      searchQuery,
      selectedCategory,
      selectedWorkflow
    );

    return [...logs].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [activityLogs, searchQuery, selectedCategory, selectedWorkflow, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const total = activityLogs.length;
    const workflowOps = activityLogs.filter(
      (l) => l.category === "workflow_creation" || l.category === "workflow_import"
    ).length;
    const designerEdits = activityLogs.filter((l) => l.category === "designer_edit").length;
    const runEvents = activityLogs.filter((l) => l.category === "run_event").length;

    return { total, workflowOps, designerEdits, runEvents };
  }, [activityLogs]);

  // Toggle JSON details drawer
  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Export logs as JSON audit file
  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `passage-activity-audit-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getCategoryConfig = (category: WorkspaceActivityCategory) => {
    switch (category) {
      case "workflow_creation":
        return {
          icon: Plus,
          badgeBg: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
          iconBg: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
          label: "Workflow Creation",
        };
      case "workflow_import":
        return {
          icon: Upload,
          badgeBg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
          iconBg: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40",
          label: "Definition Import",
        };
      case "designer_edit":
        return {
          icon: Layers,
          badgeBg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
          iconBg: "bg-amber-500/20 text-amber-400 border-amber-500/40",
          label: "Designer Edit",
        };
      case "run_event":
        return {
          icon: Play,
          badgeBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
          iconBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
          label: "Runtime Execution",
        };
      case "connection":
        return {
          icon: Plug,
          badgeBg: "bg-blue-500/10 border-blue-500/30 text-blue-400",
          iconBg: "bg-blue-500/20 text-blue-400 border-blue-500/40",
          label: "Integration Connection",
        };
      case "system":
      default:
        return {
          icon: ShieldCheck,
          badgeBg: "bg-slate-500/10 border-slate-500/30 text-slate-400",
          iconBg: "bg-slate-500/20 text-slate-400 border-slate-500/40",
          label: "Workspace System",
        };
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 text-xs font-sans">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-cyan-400 tracking-wider font-bold mb-1">
            <History className="w-3.5 h-3.5" />
            <span>Workspace Audit & Provenance</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-100 tracking-wider uppercase flex items-center gap-2">
            Activity Log
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            Complete chronological audit trail of workflow definitions, imports, canvas edits, and runtime simulations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleExportJson}
            disabled={filteredLogs.length === 0}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-mono font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Export filtered activity log as JSON audit report"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Audit Log</span>
          </button>

          {activityLogs.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to clear all workspace activity logs?")) {
                  clearActivityLogs();
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              title="Clear all activity history entries"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Log</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Workspace Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-1 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Total Logged</span>
            <History className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-100">{stats.total}</div>
        </div>

        <div className="p-4 rounded-2xl bg-black/30 border border-cyan-500/20 space-y-1 backdrop-blur-xl">
          <div className="flex items-center justify-between text-cyan-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Workflow Ops</span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">{stats.workflowOps}</div>
        </div>

        <div className="p-4 rounded-2xl bg-black/30 border border-amber-500/20 space-y-1 backdrop-blur-xl">
          <div className="flex items-center justify-between text-amber-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Designer Edits</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{stats.designerEdits}</div>
        </div>

        <div className="p-4 rounded-2xl bg-black/30 border border-emerald-500/20 space-y-1 backdrop-blur-xl">
          <div className="flex items-center justify-between text-emerald-400 font-mono text-[10px] uppercase tracking-wider">
            <span>Execution Runs</span>
            <Play className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{stats.runEvents}</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter actions by workflow, details, operator, or category..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Workflow Filter & Sort Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              className="bg-white/5 border border-white/10 text-slate-200 font-mono text-xs px-3 py-2 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="all" className="bg-slate-950 text-slate-200">
                All Workflows ({workflows.length})
              </option>
              {workflows.map((wf) => (
                <option key={wf.id} value={wf.id} className="bg-slate-950 text-slate-200">
                  {wf.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Toggle sort order"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>{sortOrder === "newest" ? "Newest First" : "Oldest First"}</span>
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-white/5">
          {[
            { id: "all", label: "All Activities" },
            { id: "workflow_ops", label: "Workflow Ops" },
            { id: "designer_edits", label: "Designer Edits" },
            { id: "run_events", label: "Runtime Runs" },
            { id: "connections", label: "Connections" },
            { id: "system", label: "System Logs" },
          ].map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "bg-white/5 text-slate-400 border border-transparent hover:text-slate-200 hover:bg-white/10"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Activity Log Stream */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-black/30 border border-white/10 backdrop-blur-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <History className="w-6 h-6 text-slate-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold font-mono text-slate-200 uppercase tracking-wider">
                No matching activities found
              </h3>
              <p className="text-slate-400 text-xs max-w-md mx-auto">
                No activity log records match your current search query or active filter selections.
              </p>
            </div>
            {(searchQuery || selectedCategory !== "all" || selectedWorkflow !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setSelectedWorkflow("all");
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLogs.map((log) => {
              const cfg = getCategoryConfig(log.category);
              const Icon = cfg.icon;
              const time = formatActivityTimestamp(log.timestamp);
              const isExpanded = expandedLogIds.has(log.id);

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-black/40 border border-white/10 hover:border-white/20 transition-all backdrop-blur-xl space-y-3 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      {/* Icon */}
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${cfg.iconBg}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold font-mono text-slate-100 tracking-wide">
                            {log.action}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold border ${cfg.badgeBg}`}
                          >
                            {cfg.label}
                          </span>

                          {log.workflowName && (
                            <button
                              onClick={() => {
                                if (log.workflowId) {
                                  setActiveWorkflowId(log.workflowId);
                                  setActiveTab("designer");
                                }
                              }}
                              className="px-2 py-0.5 rounded-md bg-white/5 hover:bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                              title="Open workflow in Designer"
                            >
                              <span>{log.workflowName}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>

                        <p className="text-slate-300 text-xs leading-relaxed">{log.details}</p>
                      </div>
                    </div>

                    {/* Metadata Right Panel */}
                    <div className="flex items-center gap-3 sm:self-center self-end shrink-0 text-slate-400 font-mono text-[10px]">
                      <div className="text-right">
                        <div className="text-slate-200 font-semibold">{time.relative}</div>
                        <div className="text-slate-500 text-[9px]">{time.exact}</div>
                      </div>

                      {log.actor && (
                        <div
                          className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 flex items-center gap-1"
                          title="Action Actor"
                        >
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{log.actor}</span>
                        </div>
                      )}

                      {log.metadata && (
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                          title={isExpanded ? "Hide Metadata Details" : "Show Metadata Details"}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable JSON Metadata */}
                  {isExpanded && log.metadata && (
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-[11px] text-cyan-300/90 overflow-x-auto space-y-1">
                      <div className="text-[9px] text-slate-400 uppercase tracking-wider">Event Metadata Payload</div>
                      <pre className="whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
