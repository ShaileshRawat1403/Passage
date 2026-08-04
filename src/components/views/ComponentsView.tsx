import React from "react";
import { Bot, ShieldCheck, Layers } from "lucide-react";

export const ComponentsView: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-xl font-bold font-mono text-slate-100 uppercase tracking-wider">
          Reusable Components & Subflow Library
        </h1>
        <p className="text-slate-400 mt-0.5 text-xs">
          Shareable actions, guard templates, and nested subflows across Passage workflows.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            title: "Risk Analysis AI Agent",
            type: "Action Component",
            desc: "Pre-configured Gemini agent for vendor anomaly and fraud verification.",
            icon: Bot,
            color: "text-pink-400",
          },
          {
            title: "Amount > ₹50,000 Threshold",
            type: "Guard Template",
            desc: "Reusable logic group for high-value financial review routing.",
            icon: ShieldCheck,
            color: "text-amber-400",
          },
          {
            title: "Vendor Onboarding Subflow",
            type: "Nested Subflow",
            desc: "Complete multi-step subprocess state machine for new vendor verification.",
            icon: Layers,
            color: "text-cyan-400",
          },
        ].map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10 shadow-xl space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                  <Icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">{c.title}</h3>
                  <span className="text-[10px] font-mono text-slate-400">{c.type}</span>
                </div>
              </div>

              <p className="text-slate-400 leading-relaxed text-xs">{c.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
