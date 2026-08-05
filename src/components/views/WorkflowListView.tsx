import React, { useState } from "react";
import { Plus, Download, Upload, ArrowRight } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { CreateWorkflowDialog } from "../workflows/CreateWorkflowDialog";
import { ImportWorkflowDialog } from "../workflows/ImportWorkflowDialog";

export const WorkflowListView: React.FC = () => {
  const { workflows, setActiveWorkflowId, setActiveTab } = useWorkflowStore();

  const [showImport, setShowImport] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

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
            onClick={() => setShowImport(true)}
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

      <CreateWorkflowDialog isOpen={showNewModal} onClose={() => setShowNewModal(false)} />
      <ImportWorkflowDialog isOpen={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
};
