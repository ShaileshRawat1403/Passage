import React, { useState } from "react";
import { RotateCcw, Send } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";

export const SimulationBar: React.FC = () => {
  const {
    activeRuns,
    activeRunId,
    activeWorkflowId,
    workflows,
    dispatchEventToRun,
    startNewRun,
  } = useWorkflowStore();

  const [customEvent, setCustomEvent] = useState("VALIDATION_PASSED");
  const [customAmount, setCustomAmount] = useState<number>(82400);

  const activeRun = activeRuns.find((r) => r.id === activeRunId) || activeRuns[0];
  const activeWf = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];

  if (!activeRun) {
    return (
      <div className="bg-black/40 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-2 text-xs text-slate-400 flex items-center justify-between z-10">
        <span className="font-mono text-[11px]">No active simulation case running.</span>
        <button
          onClick={() => startNewRun(activeWorkflowId)}
          className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 font-mono font-bold uppercase tracking-wider text-xs shadow-[0_0_12px_rgba(34,211,238,0.3)] cursor-pointer"
        >
          Initialize Case
        </button>
      </div>
    );
  }

  const handleEmit = (eventName: string) => {
    const inv = (activeRun.context.invoice as Record<string, unknown>) || {};
    dispatchEventToRun(activeRun.id, eventName, {
      invoice: {
        ...inv,
        amount: customAmount,
      },
    });
  };

  const handleRestart = () => {
    startNewRun(activeWorkflowId, {
      invoice: {
        id: "INV-2026-SIM",
        amount: customAmount,
        currency: "INR",
        vendorId: "VEND-991",
        vendorName: "Simulated Logistics",
      },
    });
  };

  const currentState = activeWf?.states.find((s) => s.id === activeRun.currentStateId);

  return (
    <div className="bg-black/40 backdrop-blur-xl border-b border-white/10 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs select-none z-10">
      {/* Current Run Status Badge */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <span className="font-mono font-bold text-cyan-400 uppercase tracking-widest text-[11px]">
            SIMULATOR
          </span>
        </div>

        <div className="h-4 w-px bg-white/10 hidden sm:block" />

        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-slate-400 text-[10px] uppercase">CASE:</span>
          <span className="font-bold text-slate-200 bg-white/5 px-2 py-0.5 rounded border border-white/10 text-[11px]">
            {activeRun.caseId}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <span className="text-slate-400 text-[10px] uppercase">STATE:</span>
          <span className="font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30 text-[11px] uppercase tracking-wider truncate max-w-[150px]">
            {currentState?.name || activeRun.currentStateId}
          </span>
        </div>
      </div>

      {/* Quick Event Trigger Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
          <span className="text-slate-400 font-mono text-[10px] uppercase">Amount:</span>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(Number(e.target.value))}
            className="w-16 sm:w-20 bg-transparent text-slate-100 font-mono font-bold outline-none text-xs"
          />
        </div>

        <div className="hidden lg:flex gap-1.5">
          {["WORKFLOW_STARTED", "VALIDATION_PASSED", "APPROVAL_RECEIVED", "REJECTION_RECEIVED"].map(
            (evt) => (
              <button
                key={evt}
                onClick={() => handleEmit(evt)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-cyan-500/40 font-mono text-[11px] transition-all cursor-pointer"
              >
                Emit {evt.split("_")[0]}
              </button>
            )
          )}
        </div>

        {/* Custom Event Trigger */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={customEvent}
            onChange={(e) => setCustomEvent(e.target.value)}
            placeholder="EVENT_NAME"
            className="w-28 sm:w-36 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-cyan-400 font-mono uppercase text-xs outline-none focus:border-cyan-400"
          />
          <button
            onClick={() => handleEmit(customEvent)}
            className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-[0_0_12px_rgba(34,211,238,0.25)] transition-all cursor-pointer shrink-0"
          >
            <Send className="w-3 h-3" />
            <span>Emit</span>
          </button>
        </div>

        <button
          onClick={handleRestart}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-100 border border-white/10 cursor-pointer shrink-0"
          title="Reset Simulation Run"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
