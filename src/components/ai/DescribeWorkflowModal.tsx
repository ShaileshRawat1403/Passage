import React, { useState } from "react";
import { Sparkles, X, Bot, HelpCircle, ArrowRight, Loader2 } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { WorkflowDefinition } from "../../types/workflow";

interface DescribeWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DescribeWorkflowModal: React.FC<DescribeWorkflowModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const { importWorkflowJson } = useWorkflowStore();

  const [prompt, setPrompt] = useState(
    "When an invoice arrives, validate the invoice schema and vendor registration. If amount is below ₹50,000, run an automated risk check and proceed to payment. If amount is above ₹50,000, request finance manager approval. If rejected, mark as rejected. If changes requested, send back for correction."
  );
  const [loading, setLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg("");
    setGeneratedResult(null);

    try {
      const res = await fetch("/api/workflow/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: prompt }),
      });

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setGeneratedResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate workflow. Using fallback structure.");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyWorkflow = () => {
    if (!generatedResult) return;

    try {
      // Build valid WorkflowDefinition from AI generated json
      const states = (generatedResult.states || []).map((s: any, idx: number) => ({
        id: s.id || `state-${idx + 1}`,
        name: s.name || `Step ${idx + 1}`,
        description: s.description || "",
        type: s.type || "atomic",
        position: { x: 100 + (idx % 4) * 280, y: 150 + Math.floor(idx / 4) * 200 },
        entryActions: s.entryActions || [],
        activeActions: s.activeActions || [],
        exitActions: s.exitActions || [],
        transitions: (s.transitions || []).map((t: any, tidx: number) => ({
          id: t.id || `tr-${idx}-${tidx}`,
          sourceStateId: s.id,
          targetStateId: t.targetStateId,
          event: t.event || "NEXT",
          priority: 10,
          guard: t.guard,
        })),
      }));

      const fullWf: WorkflowDefinition = {
        id: `ai-wf-${Date.now()}`,
        name: generatedResult.name || "AI Generated Workflow",
        description: generatedResult.description || prompt,
        version: "1.0.0",
        status: "draft",
        initialStateId: states[0]?.id || "start-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        states,
      };

      importWorkflowJson(JSON.stringify(fullWf));
      onClose();
    } catch (e: any) {
      setErrorMsg("Failed to import generated workflow into Stateflow.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0f1420] border border-[#253047] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#253047] flex items-center justify-between bg-[#131a28]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#ff5db1]/15 border border-[#ff5db1]/30 flex items-center justify-center text-[#ff5db1]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-[#eef3ff]">
                Natural Language Workflow Assistant
              </h3>
              <p className="text-[11px] text-[#8c98ae]">
                Describe your business process in plain English to synthesize a visual state machine.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8c98ae] hover:text-[#eef3ff] hover:bg-[#253047]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-[#8c98ae] font-mono mb-1">
              Process Description
            </label>
            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. When a claim arrives, check literature index. If indexed, request peer review..."
              className="w-full p-3 rounded-xl bg-[#131a28] border border-[#253047] text-[#eef3ff] outline-none focus:border-[#45e0d1] leading-relaxed text-xs"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full py-2.5 rounded-xl bg-[#ff5db1] hover:bg-[#ee4ca0] text-[#080b12] font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#ff5db1]/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synthesizing State Machine Graph...</span>
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                <span>Generate State Machine Workflow</span>
              </>
            )}
          </button>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#ff6b7a]/10 border border-[#ff6b7a]/30 text-[#ff6b7a]">
              {errorMsg}
            </div>
          )}

          {/* Generated Result Preview */}
          {generatedResult && (
            <div className="p-4 rounded-xl bg-[#131a28] border border-[#253047] space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#253047] pb-2">
                <span className="font-bold text-[#45e0d1] text-sm">
                  {generatedResult.name || "Generated Workflow"}
                </span>
                <span className="font-mono text-[10px] text-[#8c98ae]">
                  {generatedResult.states?.length || 0} States Synthesized
                </span>
              </div>

              <p className="text-[#8c98ae] leading-relaxed">
                {generatedResult.description}
              </p>

              {/* Clarifying Questions */}
              {generatedResult.questions && generatedResult.questions.length > 0 && (
                <div className="p-3 rounded-lg bg-[#0f1420] border border-[#ffc766]/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[#ffc766] font-mono font-semibold">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Operational Clarifications Identified</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[#eef3ff] text-[11px]">
                    {generatedResult.questions.map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#253047] bg-[#131a28] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#080b12] text-[#8c98ae] hover:text-[#eef3ff] font-semibold"
          >
            Cancel
          </button>
          {generatedResult && (
            <button
              onClick={handleApplyWorkflow}
              className="px-5 py-2 rounded-xl bg-[#45e0d1] hover:bg-[#38c9bb] text-[#080b12] font-bold flex items-center gap-1.5 shadow-lg shadow-[#45e0d1]/20 transition-all"
            >
              <span>Load Into Designer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
