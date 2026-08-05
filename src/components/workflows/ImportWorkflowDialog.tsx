import React, { useState } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

interface ImportWorkflowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported?: (workflowId: string) => void;
}

export const ImportWorkflowDialog: React.FC<ImportWorkflowDialogProps> = ({
  isOpen,
  onClose,
  onImported,
}) => {
  const { importWorkflowJson, setActiveWorkflowId, setActiveTab } = useWorkflowStore();
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = () => {
    if (!jsonText.trim()) {
      setError("Please paste a JSON definition to import.");
      return;
    }

    try {
      setError(null);
      const newId = importWorkflowJson(jsonText);
      setActiveWorkflowId(newId);
      setActiveTab("designer");
      setJsonText("");
      onClose();
      if (onImported) {
        onImported(newId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import workflow JSON.";
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="p-6 rounded-2xl bg-slate-950 border border-white/10 w-full max-w-lg space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Upload className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-100 uppercase font-mono tracking-wider">
              Import Workflow Definition
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close import workflow dialog"
            className="text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 max-h-36 overflow-y-auto">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{error}</pre>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
            JSON Definition Schema
          </label>
          <textarea
            rows={8}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Paste exported Passage JSON schema here..."
            className="w-full p-3 rounded-xl bg-black/50 border border-white/10 text-cyan-400 font-mono text-xs outline-none focus:border-cyan-400 transition-colors resize-none"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-slate-200 text-xs font-mono transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            Import Into Designer
          </button>
        </div>
      </div>
    </div>
  );
};
