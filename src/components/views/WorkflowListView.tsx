import React, { useState } from "react";
import { Plus, Download, Upload, ArrowRight } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export const WorkflowListView: React.FC = () => {
  const {
    workflows,
    setActiveWorkflowId,
    setActiveTab,
    createWorkflow,
    importWorkflowJson,
  } = useWorkflowStore();

  const [jsonInput, setJsonInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);

  const handleCreateNew = () => {
    if (!newWfName.trim()) return;
    createWorkflow(newWfName, "Custom Passage Process");
    setNewWfName("");
    setShowNewModal(false);
  };

  const handleExport = (wfId: string) => {
    const wf = workflows.find((w) => w.id === wfId);
    if (!wf) return;
    const jsonStr = JSON.stringify(wf, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${wf.id}.json`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-mono text-slate-100 uppercase tracking-wider">
            Workflow Process Directory
          </h1>
          <p className="text-slate-400 mt-0.5 text-xs">
            Manage versioned state machine workflows, import JSON schemas, or export definitions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import JSON</span>
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      {showImport && (
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3 backdrop-blur-xl">
          <label className="block text-slate-400 font-mono text-[10px] uppercase tracking-wider">
            Paste Workflow JSON Definition
          </label>
          <textarea
            rows={5}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste exported Passage JSON schema here..."
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-cyan-400 font-mono text-xs outline-none focus:border-cyan-400"
          />
          <button
            onClick={() => {
              importWorkflowJson(jsonInput);
              setJsonInput("");
              setShowImport(false);
            }}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
          >
            Import Into Designer
          </button>
        </div>
      )}

      {/* Workflows List */}
      <div className="space-y-3">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="p-5 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-slate-100">{wf.name}</span>
                <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-cyan-400 border border-white/10">
                  v{wf.version}
                </span>
                <span className="text-[10px] text-emerald-400 capitalize font-mono font-semibold">
                  {wf.status}
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{wf.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleExport(wf.id)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-100 border border-white/10 cursor-pointer"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setActiveWorkflowId(wf.id);
                  setActiveTab("designer");
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Edit in Designer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for new workflow */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="p-6 rounded-2xl bg-slate-950 border border-white/10 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm text-slate-100 uppercase font-mono tracking-wider">Create New Workflow Map</h3>
            <input
              type="text"
              value={newWfName}
              onChange={(e) => setNewWfName(e.target.value)}
              placeholder="e.g. Employee Onboarding State Machine"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none font-semibold text-xs focus:border-cyan-400"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
