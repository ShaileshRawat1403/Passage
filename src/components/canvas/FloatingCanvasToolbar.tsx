import React, { useState, useEffect } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  Save,
  Trash2,
  Download,
  Upload,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layout,
  Plus,
  Copy,
  Check,
  X,
  Sparkles,
  FileCode,
  Undo2,
  Redo2,
} from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { StateType } from "../../types/workflow";
import { generateDesignerId } from "../../domain/idFactory";

export const FloatingCanvasToolbar: React.FC = () => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const {
    workflows,
    activeWorkflowId,
    updateWorkflow,
    importWorkflowJson,
    addState,
    historyByWorkflowId,
    undo,
    redo,
  } = useWorkflowStore();

    const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];
  const history = activeWorkflow ? historyByWorkflowId[activeWorkflow.id] : undefined;
  const pastWorkflows = history?.past || [];
  const futureWorkflows = history?.future || [];

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);


  if (!activeWorkflow) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable = target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if (isEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          if (futureWorkflows.length > 0) redo();
        } else {
          e.preventDefault();
          if (pastWorkflows.length > 0) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (futureWorkflows.length > 0) redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pastWorkflows.length, futureWorkflows.length, undo, redo]);

  // 1. Save Handler
  const handleSave = () => {
    updateWorkflow(activeWorkflow.id, (draft) => {
      draft.updatedAt = new Date().toISOString();
    });
    showToast("Workflow state machine configuration saved!");
  };

  // 2. Clear Canvas Handler
  const handleClearCanvas = () => {
    if (
      window.confirm(
        `Are you sure you want to clear all states from "${activeWorkflow.name}"?`
      )
    ) {
      useWorkflowStore.getState().commitDraftOperation(
        activeWorkflow.id,
        "CANVAS_CLEARED",
        undefined,
        (draft) => {
          draft.states = [];
        }
      );
      showToast("Canvas cleared.");
    }
  };

  // 3. Export JSON Handler
  const handleExportJson = () => {
    setIsExportOpen(true);
  };

  const handleCopyJson = () => {
    if (!activeWorkflow) return;
    navigator.clipboard.writeText(JSON.stringify(activeWorkflow, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    if (!activeWorkflow) return;
    const blob = new Blob([JSON.stringify(activeWorkflow, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeWorkflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-workflow.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 4. Import JSON Handler
  const handleImportSubmit = () => {
    setImportError(null);
    try {
      const id = importWorkflowJson(importJsonText);
      setIsImportOpen(false);
      setImportJsonText("");
      showToast("Workflow JSON imported successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid JSON syntax or workflow structure.";
      setImportError(message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
    };
    reader.readAsText(file);
  };

  // 5. Auto-Layout Handler (Left-to-Right Column Layout)
  const handleAutoLayout = () => {
    if (!activeWorkflow || !activeWorkflow.states.length) return;

    // Simple topological rank-based auto layout
    const states = [...activeWorkflow.states];
    const columnMap = new Map<string, number>();

    // Initial state is column 0
    const startState = states.find((s) => s.type === "start") || states[0];
    if (!startState) return;
    columnMap.set(startState.id, 0);

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 10) {
      changed = false;
      iterations++;
      for (const st of states) {
        const currCol = columnMap.get(st.id) ?? 0;
        for (const tr of st.transitions || []) {
          const targetCol = columnMap.get(tr.targetStateId);
          if (targetCol === undefined || targetCol <= currCol) {
            columnMap.set(tr.targetStateId, currCol + 1);
            changed = true;
          }
        }
      }
    }

    // Group states by column
    const columns: Record<number, typeof states> = {};
    for (const st of states) {
      const col = columnMap.get(st.id) || 0;
      if (!columns[col]) columns[col] = [];
      columns[col].push(st);
    }

    // Apply X and Y coordinates
    useWorkflowStore.getState().commitDraftOperation(
      activeWorkflow.id,
      "AUTO_LAYOUT_APPLIED",
      undefined,
      (draft) => {
        Object.entries(columns).forEach(([colStr, colStates]) => {
          const colIdx = Number(colStr);
          colStates.forEach((st, rowIdx) => {
            const draftState = draft.states.find((s) => s.id === st.id);
            if (draftState) {
              draftState.position = {
                x: 80 + colIdx * 320,
                y: 120 + rowIdx * 180,
              };
            }
          });
        });
      }
    );

    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    showToast("Auto-layout applied!");
  };

  // 6. Quick Add State Handler
  const handleAddState = (type: StateType) => {
    const nameMap: Record<StateType, string> = {
      start: "Start Event",
      atomic: "Process Action",
      decision: "Decision Guard",
      parallel: "Parallel Branch",
      waiting: "Waiting Event SLA",
      approval: "Human Review",
      final: "Terminal State",
      compound: "Subflow State",
    };

    addState(activeWorkflow.id, {
      id: "", // Will be auto-generated by the store securely
      name: nameMap[type] || "New State",
      type,
      position: { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 },
      entryActions: [],
      activeActions: [],
      exitActions: [],
      transitions: [],
    });
    showToast(`Added new ${type} state node.`);
  };

  return (
    <>
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-mono text-xs font-bold shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] animate-in fade-in slide-in-from-top duration-200">
          {toastMessage}
        </div>
      )}

      {/* Floating Canvas Action Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/80 backdrop-blur-xl border border-white/15 shadow-2xl">
        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={pastWorkflows.length === 0}
          className="px-2 py-1.5 rounded-xl hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-mono font-bold flex items-center transition-all cursor-pointer"
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={futureWorkflows.length === 0}
          className="px-2 py-1.5 rounded-xl hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-mono font-bold flex items-center transition-all cursor-pointer"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-white/10 mx-0.5" />

        {/* Save */}
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]"
          title="Save state machine configuration"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Save</span>
        </button>

        <div className="h-4 w-px bg-white/10 mx-0.5" />

        {/* Clear */}
        <button
          onClick={handleClearCanvas}
          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
          title="Clear Canvas (Remove all states)"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Export JSON */}
        <button
          onClick={handleExportJson}
          className="p-1.5 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/5 transition-all cursor-pointer"
          title="Export State Machine JSON"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Import JSON */}
        <button
          onClick={() => setIsImportOpen(true)}
          className="p-1.5 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/5 transition-all cursor-pointer"
          title="Import JSON Configuration"
        >
          <Upload className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-white/10 mx-0.5" />

        {/* Zoom to Fit */}
        <button
          onClick={() => fitView({ padding: 0.2, duration: 400 })}
          className="p-1.5 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/5 transition-all cursor-pointer"
          title="Zoom to Fit Canvas"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Zoom In */}
        <button
          onClick={() => zoomIn({ duration: 200 })}
          className="p-1.5 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/5 transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={() => zoomOut({ duration: 200 })}
          className="p-1.5 rounded-xl text-slate-300 hover:text-cyan-400 hover:bg-white/5 transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Auto Layout */}
        <button
          onClick={handleAutoLayout}
          className="p-1.5 rounded-xl text-slate-300 hover:text-amber-400 hover:bg-white/5 transition-all cursor-pointer"
          title="Auto-Layout State Diagram"
        >
          <Layout className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-white/10 mx-0.5" />

        {/* Quick Add State Dropdown / Button */}
        <div className="relative group">
          <button className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Add State</span>
          </button>

          <div className="absolute right-0 top-full mt-2 w-48 py-1 bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50">
            <button
              onClick={() => handleAddState("atomic")}
              className="w-full px-3 py-1.5 text-left text-xs font-mono text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Standard Process</span>
            </button>
            <button
              onClick={() => handleAddState("decision")}
              className="w-full px-3 py-1.5 text-left text-xs font-mono text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Decision / Branch</span>
            </button>
            <button
              onClick={() => handleAddState("approval")}
              className="w-full px-3 py-1.5 text-left text-xs font-mono text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <span>Human Approval</span>
            </button>
            <button
              onClick={() => handleAddState("parallel")}
              className="w-full px-3 py-1.5 text-left text-xs font-mono text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-pink-400" />
              <span>Parallel Execution</span>
            </button>
            <button
              onClick={() => handleAddState("waiting")}
              className="w-full px-3 py-1.5 text-left text-xs font-mono text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Waiting / SLA Event</span>
            </button>
            <button
              onClick={() => handleAddState("final")}
              className="w-full px-3 py-1.5 text-left text-xs font-mono text-slate-200 hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center gap-2 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Terminal Final State</span>
            </button>
          </div>
        </div>
      </div>

      {/* Export JSON Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-white/15 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold font-mono text-sm uppercase tracking-wider text-slate-100">
                  Export State Machine JSON Configuration
                </h3>
              </div>
              <button
                onClick={() => setIsExportOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 font-sans">
              Below is the complete state machine definition for{" "}
              <strong className="text-slate-200">{activeWorkflow?.name}</strong>. This JSON schema encapsulates all states, transitions, guard rules, entry/active/exit actions, and default context.
            </p>

            <div className="relative">
              <pre className="w-full h-80 overflow-y-auto p-4 rounded-xl bg-black/60 border border-white/10 text-cyan-300 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(activeWorkflow, null, 2)}
              </pre>

              <button
                onClick={handleCopyJson}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 font-mono text-xs flex items-center gap-1.5 backdrop-blur-md border border-white/10 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsExportOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleDownloadJson}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download .json</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-950 border border-white/15 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold font-mono text-sm uppercase tracking-wider text-slate-100">
                  Import Workflow State Machine JSON
                </h3>
              </div>
              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Option 1: Upload JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-mono file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Option 2: Paste JSON Schema Below
                </label>
                <textarea
                  rows={8}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="Paste workflow JSON schema here..."
                  className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-slate-100 font-mono text-xs outline-none focus:border-cyan-400"
                />
              </div>

              {importError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                  {importError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsImportOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                disabled={!importJsonText.trim()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-mono font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)] cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import & Open</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
