import React, { useState } from "react";
import { Plus, Download, Upload, Trash2, Edit3, ArrowRight, Layers } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export const WorkflowListView: React.FC = () => {
  const {
    workflows,
    setActiveWorkflowId,
    setActiveTab,
    createWorkflow,
    deleteWorkflow,
    importWorkflowJson,
  } = useWorkflowStore();

  const [jsonInput, setJsonInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);

  const handleCreateNew = () => {
    if (!newWfName.trim()) return;
    const newId = createWorkflow(newWfName, "Custom Stateflow Process");
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
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono text-[#eef3ff]">
            Workflow Process Directory
          </h1>
          <p className="text-[#8c98ae] mt-0.5">
            Manage versioned state machine workflows, import JSON schemas, or export definitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-3.5 py-2 rounded-xl bg-[#131a28] hover:bg-[#253047] text-[#eef3ff] border border-[#253047] font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-[#45e0d1]" />
            <span>Import JSON</span>
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-4 py-2 rounded-xl bg-[#45e0d1] hover:bg-[#38c9bb] text-[#080b12] font-bold flex items-center gap-1.5 shadow-lg shadow-[#45e0d1]/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Workflow</span>
          </button>
        </div>
      </div>

      {showImport && (
        <div className="p-4 rounded-2xl bg-[#0f1420] border border-[#253047] space-y-3">
          <label className="block text-[#8c98ae] font-mono">
            Paste Workflow JSON Definition
          </label>
          <textarea
            rows={5}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste exported Stateflow JSON schema here..."
            className="w-full p-3 rounded-xl bg-[#131a28] border border-[#253047] text-[#45e0d1] font-mono text-xs outline-none"
          />
          <button
            onClick={() => {
              importWorkflowJson(jsonInput);
              setJsonInput("");
              setShowImport(false);
            }}
            className="px-4 py-2 rounded-xl bg-[#45e0d1] text-[#080b12] font-bold"
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
            className="p-5 rounded-2xl bg-[#0f1420] border border-[#253047] hover:border-[#384869] transition-all flex items-center justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#eef3ff]">{wf.name}</span>
                <span className="px-2 py-0.5 rounded bg-[#131a28] text-[10px] font-mono text-[#45e0d1] border border-[#253047]">
                  v{wf.version}
                </span>
                <span className="text-[10px] text-[#5ee28a] capitalize font-mono font-semibold">
                  {wf.status}
                </span>
              </div>
              <p className="text-[#8c98ae]">{wf.description}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport(wf.id)}
                className="p-2 rounded-lg bg-[#131a28] hover:bg-[#253047] text-[#8c98ae] hover:text-[#eef3ff] border border-[#253047]"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setActiveWorkflowId(wf.id);
                  setActiveTab("designer");
                }}
                className="px-4 py-2 rounded-xl bg-[#45e0d1] hover:bg-[#38c9bb] text-[#080b12] font-bold flex items-center gap-1.5 transition-all"
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="p-6 rounded-2xl bg-[#0f1420] border border-[#253047] w-full max-w-md space-y-4">
            <h3 className="font-bold text-sm text-[#eef3ff]">Create New Workflow Map</h3>
            <input
              type="text"
              value={newWfName}
              onChange={(e) => setNewWfName(e.target.value)}
              placeholder="e.g. Employee Onboarding State Machine"
              className="w-full px-3 py-2 rounded-xl bg-[#131a28] border border-[#253047] text-[#eef3ff] outline-none font-semibold text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 rounded-xl bg-[#080b12] text-[#8c98ae]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 rounded-xl bg-[#45e0d1] text-[#080b12] font-bold"
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
