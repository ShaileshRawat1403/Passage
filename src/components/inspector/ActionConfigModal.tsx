import React, { useState } from "react";
import { X, Bot, Globe, UserCheck, Shield, Clock, Layers, Sparkles } from "lucide-react";
import { ActionDefinition, ActionType } from "../../types/workflow";

interface ActionConfigModalProps {
  action?: ActionDefinition;
  isOpen: boolean;
  onClose: () => void;
  onSave: (action: ActionDefinition) => void;
}

export const ActionConfigModal: React.FC<ActionConfigModalProps> = ({
  action,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(action?.name || "New Action Execution");
  const [type, setType] = useState<ActionType>(action?.type || "agent");
  const [description, setDescription] = useState(action?.description || "");

  // Agent config
  const [agentName, setAgentName] = useState(action?.agentConfig?.agentName || "Risk Analyst Bot");
  const [model, setModel] = useState(action?.agentConfig?.model || "gemini-3.6-flash");
  const [instructions, setInstructions] = useState(
    action?.agentConfig?.systemInstructions || "Evaluate invoice history and check fraud risk."
  );

  // HTTP config
  const [httpMethod, setHttpMethod] = useState<"GET" | "POST" | "PUT" | "DELETE" | "PATCH">(
    action?.httpConfig?.method || "POST"
  );
  const [httpUrl, setHttpUrl] = useState(action?.httpConfig?.url || "/api/v1/service");

  // Human task config
  const [assigneeRole, setAssigneeRole] = useState(
    action?.humanTaskConfig?.assigneeRole || "Finance Manager"
  );
  const [dueHours, setDueHours] = useState(action?.humanTaskConfig?.dueHours || 24);

  // Policies
  const [maxAttempts, setMaxAttempts] = useState(action?.retryPolicy?.maxAttempts || 3);
  const [timeoutMs, setTimeoutMs] = useState(action?.timeoutMs || 30000);

  const handleSave = () => {
    const newAction: ActionDefinition = {
      id: action?.id || `act-${Date.now()}`,
      name,
      type,
      description,
      timeoutMs,
      retryPolicy: {
        maxAttempts,
        initialDelayMs: 5000,
        backoffMultiplier: 2,
      },
    };

    if (type === "agent") {
      newAction.agentConfig = {
        agentName,
        modelProvider: "Google DeepMind",
        model,
        systemInstructions: instructions,
      };
    } else if (type === "http") {
      newAction.httpConfig = {
        method: httpMethod,
        url: httpUrl,
      };
    } else if (type === "human_task") {
      newAction.humanTaskConfig = {
        assigneeRole,
        dueHours,
        options: ["APPROVE", "REJECT", "REQUEST_CHANGES"],
      };
    }

    onSave(newAction);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0f1420] border border-[#253047] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#253047] flex items-center justify-between bg-[#131a28]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#ffc766]" />
            <h3 className="font-semibold text-base text-[#eef3ff]">
              {action ? "Edit Action Configuration" : "Add Action to State"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8c98ae] hover:text-[#eef3ff] hover:bg-[#253047]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Action Type Picker */}
          <div>
            <label className="block text-[#8c98ae] font-mono mb-1.5">Action Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: "agent", label: "AI Agent", icon: Bot, color: "text-[#ff5db1]" },
                { type: "http", label: "External API", icon: Globe, color: "text-[#71a7ff]" },
                { type: "human_task", label: "Human Task", icon: UserCheck, color: "text-[#45e0d1]" },
                { type: "audit", label: "Audit Log", icon: Shield, color: "text-[#ffc766]" },
                { type: "transform", label: "Transform", icon: Layers, color: "text-[#5ee28a]" },
                { type: "wait", label: "Timer Delay", icon: Clock, color: "text-[#8c98ae]" },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = type === item.type;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setType(item.type as ActionType)}
                    className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                      isSelected
                        ? "bg-[#131a28] border-[#45e0d1] ring-2 ring-[#45e0d1]/20 font-semibold"
                        : "bg-[#080b12] border-[#253047] text-[#8c98ae] hover:border-[#384869]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-[11px] text-[#eef3ff]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Name */}
          <div>
            <label className="block text-[#8c98ae] font-mono mb-1">Action Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#131a28] border border-[#253047] text-[#eef3ff] focus:border-[#45e0d1] outline-none font-semibold"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[#8c98ae] font-mono mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief explanation of action purpose..."
              className="w-full px-3 py-2 rounded-lg bg-[#131a28] border border-[#253047] text-[#eef3ff] focus:border-[#45e0d1] outline-none"
            />
          </div>

          {/* Type Specific Fields */}
          {type === "agent" && (
            <div className="p-3.5 rounded-xl bg-[#131a28] border border-[#253047] space-y-3">
              <div className="font-mono text-[#ff5db1] font-semibold flex items-center gap-1.5">
                <Bot className="w-4 h-4" />
                <span>AI Agent Settings</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-2 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] outline-none"
                  >
                    <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">
                  System Instructions
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full p-2.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] outline-none font-mono text-[11px]"
                />
              </div>
            </div>
          )}

          {type === "http" && (
            <div className="p-3.5 rounded-xl bg-[#131a28] border border-[#253047] space-y-3">
              <div className="font-mono text-[#71a7ff] font-semibold flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                <span>HTTP REST Configuration</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] outline-none"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">Endpoint URL</label>
                  <input
                    type="text"
                    value={httpUrl}
                    onChange={(e) => setHttpUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {type === "human_task" && (
            <div className="p-3.5 rounded-xl bg-[#131a28] border border-[#253047] space-y-3">
              <div className="font-mono text-[#45e0d1] font-semibold flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" />
                <span>Human Review Settings</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">Assignee Role</label>
                  <input
                    type="text"
                    value={assigneeRole}
                    onChange={(e) => setAssigneeRole(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">SLA Hours</label>
                  <input
                    type="number"
                    value={dueHours}
                    onChange={(e) => setDueHours(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Retry Policy */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[#8c98ae] font-mono mb-1">Max Retry Attempts</label>
              <input
                type="number"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-[#131a28] border border-[#253047] text-[#eef3ff] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[#8c98ae] font-mono mb-1">Timeout (ms)</label>
              <input
                type="number"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-[#131a28] border border-[#253047] text-[#eef3ff] outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#253047] bg-[#131a28] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#080b12] hover:bg-[#253047] text-[#8c98ae] hover:text-[#eef3ff] font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[#45e0d1] hover:bg-[#38c9bb] text-[#080b12] font-bold shadow-lg shadow-[#45e0d1]/20 transition-all"
          >
            Save Action
          </button>
        </div>
      </div>
    </div>
  );
};
