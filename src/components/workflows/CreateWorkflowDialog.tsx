import React, { useState } from "react";
import { Plus, X, AlertCircle } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

interface CreateWorkflowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workflowId: string) => void;
}

export const CreateWorkflowDialog: React.FC<CreateWorkflowDialogProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { createWorkflow, setActiveWorkflowId, setActiveTab } = useWorkflowStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Workflow name is required and cannot be blank.");
      return;
    }

    try {
      setError(null);
      const newId = createWorkflow(
        trimmedName,
        description.trim() || "Custom Passage Process"
      );
      setActiveWorkflowId(newId);
      setActiveTab("designer");
      setName("");
      setDescription("");
      onClose();
      if (onCreated) {
        onCreated(newId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create workflow.";
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="p-6 rounded-2xl bg-slate-950 border border-white/10 w-full max-w-md space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-100 uppercase font-mono tracking-wider">
              Create New Workflow
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Workflow Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Employee Onboarding Process"
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-100 outline-none font-semibold text-xs focus:border-cyan-400 transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Multi-step orchestration for user verification and setup."
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 outline-none font-sans text-xs focus:border-cyan-400 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            Create Workflow
          </button>
        </div>
      </div>
    </div>
  );
};
