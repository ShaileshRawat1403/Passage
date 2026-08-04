import React from "react";
import { Package, Bot, ShieldCheck, Layers, Plus } from "lucide-react";

export const ComponentsView: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-xs">
      <div>
        <h1 className="text-xl font-bold font-mono text-[#eef3ff]">
          Reusable Components & Subflow Library
        </h1>
        <p className="text-[#8c98ae] mt-0.5">
          Shareable actions, guard templates, and nested subflows across Stateflow workflows.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            title: "Risk Analysis AI Agent",
            type: "Action Component",
            desc: "Pre-configured Gemini agent for vendor anomaly and fraud verification.",
            icon: Bot,
            color: "text-[#ff5db1]",
          },
          {
            title: "Amount > ₹50,000 Threshold",
            type: "Guard Template",
            desc: "Reusable logic group for high-value financial review routing.",
            icon: ShieldCheck,
            color: "text-[#ffc766]",
          },
          {
            title: "Vendor Onboarding Subflow",
            type: "Nested Subflow",
            desc: "Complete multi-step subprocess state machine for new vendor verification.",
            icon: Layers,
            color: "text-[#45e0d1]",
          },
        ].map((c, idx) => {
          const Icon = c.icon;
          return (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-[#0f1420] border border-[#253047] shadow-xl space-y-3"
            >
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#131a28] border border-[#253047]">
                  <Icon className={`w-4 h-4 ${c.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#eef3ff]">{c.title}</h3>
                  <span className="text-[10px] font-mono text-[#8c98ae]">{c.type}</span>
                </div>
              </div>

              <p className="text-[#8c98ae] leading-relaxed">{c.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
