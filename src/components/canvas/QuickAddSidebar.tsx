import React from "react";
import { Network, Split, Workflow } from "lucide-react";
import { StateType, ActionDefinition } from "../../types/workflow";

export interface DraggedTemplate {
  type: StateType;
  name: string;
  entryActions?: ActionDefinition[];
}

export const QuickAddSidebar: React.FC = () => {
  const onDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    template: DraggedTemplate
  ) => {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify(template)
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="absolute left-4 top-48 z-40 bg-slate-950/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl w-48 flex flex-col gap-2 font-sans select-none">
      <div className="text-xs font-semibold text-slate-400 mb-2 font-mono uppercase tracking-widest pl-1">
        Quick Add
      </div>
      
      <div
        className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors"
        draggable
        onDragStart={(e) =>
          onDragStart(e, {
            type: "atomic",
            name: "API Call",
            entryActions: [
              {
                // id will be generated on drop
                id: "",
                name: "HTTP Request",
                type: "http",
                httpConfig: { method: "GET", url: "https://api.example.com/data" },
              },
            ],
          })
        }
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Network className="w-4 h-4" />
        </div>
        <div className="text-sm font-medium text-slate-200">API Call</div>
      </div>

      <div
        className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors"
        draggable
        onDragStart={(e) =>
          onDragStart(e, {
            type: "decision",
            name: "Conditional Switch",
          })
        }
      >
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
          <Split className="w-4 h-4" />
        </div>
        <div className="text-sm font-medium text-slate-200">Conditional Switch</div>
      </div>

      <div
        className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-slate-900/50 hover:bg-slate-800/80 cursor-grab active:cursor-grabbing transition-colors"
        draggable
        onDragStart={(e) =>
          onDragStart(e, {
            type: "parallel",
            name: "Parallel Split",
          })
        }
      >
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <Workflow className="w-4 h-4" />
        </div>
        <div className="text-sm font-medium text-slate-200">Parallel Split</div>
      </div>
    </div>
  );
};
