import React from "react";
import { Plus, Trash2, ShieldCheck, Code, Eye } from "lucide-react";
import { GuardDefinition, ConditionRule, ComparisonOperator, LogicGroup } from "../../types/workflow";
import { useWorkflowStore } from "../../store/workflowStore";

interface GuardBuilderProps {
  guard?: GuardDefinition;
  onChange: (guard: GuardDefinition) => void;
}

const OPERATORS: { label: string; value: ComparisonOperator }[] = [
  { label: "equals", value: "equals" },
  { label: "does not equal", value: "not_equals" },
  { label: "is greater than (>)", value: "greater_than" },
  { label: "is greater than or equal (>=)", value: "greater_than_or_equal" },
  { label: "is less than (<)", value: "less_than" },
  { label: "is less than or equal (<=)", value: "less_than_or_equal" },
  { label: "contains", value: "contains" },
  { label: "does not contain", value: "does_not_contain" },
  { label: "exists (not empty)", value: "exists" },
  { label: "is true", value: "is_true" },
  { label: "is false", value: "is_false" },
];

export const GuardBuilder: React.FC<GuardBuilderProps> = ({ guard, onChange }) => {
  const { isAdvancedMode, toggleAdvancedMode } = useWorkflowStore();

  const currentGuard: GuardDefinition = guard || {
    id: `guard-${Date.now()}`,
    name: "Custom Guard Condition",
    logic: "ALL",
    conditions: [
      {
        id: `cond-1`,
        field: "$.invoice.amount",
        operator: "greater_than",
        value: 50000,
      },
    ],
  };

  const handleLogicChange = (logic: LogicGroup) => {
    onChange({ ...currentGuard, logic });
  };

  const handleAddCondition = () => {
    const newCond: ConditionRule = {
      id: `cond-${Date.now()}`,
      field: "$.validation.vendorActive",
      operator: "is_true",
    };
    onChange({
      ...currentGuard,
      conditions: [...currentGuard.conditions, newCond],
    });
  };

  const handleUpdateCondition = (condId: string, partial: Partial<ConditionRule>) => {
    const updated = currentGuard.conditions.map((c) => (c.id === condId ? { ...c, ...partial } : c));
    onChange({ ...currentGuard, conditions: updated });
  };

  const handleRemoveCondition = (condId: string) => {
    onChange({
      ...currentGuard,
      conditions: currentGuard.conditions.filter((c) => c.id !== condId),
    });
  };

  const handleRawExpressionChange = (expr: string) => {
    onChange({ ...currentGuard, rawExpression: expr });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header & Mode Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-[#253047]">
        <div className="flex items-center gap-1.5 font-semibold text-[#eef3ff]">
          <ShieldCheck className="w-4 h-4 text-[#ffc766]" />
          <span>Guard Rule Builder</span>
        </div>
        <button
          onClick={toggleAdvancedMode}
          className="px-2 py-1 rounded bg-[#131a28] hover:bg-[#253047] text-[#8c98ae] hover:text-[#eef3ff] border border-[#253047] flex items-center gap-1 font-mono transition-colors"
        >
          {isAdvancedMode ? <Eye className="w-3 h-3 text-[#45e0d1]" /> : <Code className="w-3 h-3 text-[#ffc766]" />}
          <span>{isAdvancedMode ? "Visual Mode" : "YAML Expression"}</span>
        </button>
      </div>

      {/* Guard Name */}
      <div>
        <label className="block text-[#8c98ae] mb-1 font-mono">Guard Name</label>
        <input
          type="text"
          value={currentGuard.name}
          onChange={(e) => onChange({ ...currentGuard, name: e.target.value })}
          className="w-full px-3 py-2 rounded bg-[#131a28] border border-[#253047] text-[#eef3ff] focus:border-[#ffc766] outline-none font-semibold"
          placeholder="e.g. Vendor Active & Amount > 50,000"
        />
      </div>

      {!isAdvancedMode ? (
        /* SIMPLE VISUAL MODE */
        <div className="space-y-3">
          {/* Group Logic selection */}
          <div className="flex items-center gap-2 bg-[#131a28] p-2 rounded-lg border border-[#253047]">
            <span className="text-[#8c98ae] font-mono">Logic Group:</span>
            <div className="flex gap-1">
              {(["ALL", "ANY", "NOT"] as LogicGroup[]).map((lg) => (
                <button
                  key={lg}
                  onClick={() => handleLogicChange(lg)}
                  className={`px-2.5 py-1 rounded font-mono font-bold transition-all ${
                    currentGuard.logic === lg
                      ? "bg-[#ffc766] text-[#080b12]"
                      : "bg-[#0f1420] text-[#8c98ae] hover:text-[#eef3ff]"
                  }`}
                >
                  {lg}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-[#8c98ae] ml-auto">
              {currentGuard.logic === "ALL" && "Every condition must pass"}
              {currentGuard.logic === "ANY" && "At least one condition passes"}
              {currentGuard.logic === "NOT" && "Inverts result"}
            </span>
          </div>

          {/* Condition list */}
          <div className="space-y-2">
            {currentGuard.conditions.map((cond, idx) => (
              <div
                key={cond.id || idx}
                className="p-3 rounded-lg bg-[#131a28] border border-[#253047] space-y-2 hover:border-[#384869] transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#ffc766] font-semibold">
                    Condition #{idx + 1}
                  </span>
                  <button
                    onClick={() => handleRemoveCondition(cond.id)}
                    className="p-1 rounded text-[#8c98ae] hover:text-[#ff6b7a] hover:bg-[#253047]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">
                      Context Field (JSONPath)
                    </label>
                    <input
                      type="text"
                      value={cond.field}
                      onChange={(e) => handleUpdateCondition(cond.id, { field: e.target.value })}
                      placeholder="e.g. $.invoice.amount or $.validation.vendorActive"
                      className="w-full px-2.5 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] font-mono focus:border-[#ffc766] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">
                        Operator
                      </label>
                      <select
                        value={cond.operator}
                        onChange={(e) =>
                          handleUpdateCondition(cond.id, {
                            operator: e.target.value as ComparisonOperator,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] font-mono focus:border-[#ffc766] outline-none"
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {!["exists", "does_not_exist", "is_true", "is_false"].includes(cond.operator) && (
                      <div>
                        <label className="block text-[10px] text-[#8c98ae] font-mono mb-0.5">
                          Target Value
                        </label>
                        <input
                          type="text"
                          value={cond.value !== undefined ? String(cond.value) : ""}
                          onChange={(e) =>
                            handleUpdateCondition(cond.id, {
                              value: isNaN(Number(e.target.value))
                                ? e.target.value
                                : Number(e.target.value),
                            })
                          }
                          placeholder="e.g. 50000 or 'active'"
                          className="w-full px-2.5 py-1.5 rounded bg-[#0f1420] border border-[#253047] text-[#eef3ff] font-mono focus:border-[#ffc766] outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddCondition}
            className="w-full py-2 rounded-lg border border-dashed border-[#253047] hover:border-[#ffc766] text-[#ffc766] flex items-center justify-center gap-1.5 font-mono font-semibold transition-all hover:bg-[#131a28]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Guard Condition</span>
          </button>
        </div>
      ) : (
        /* ADVANCED YAML / EXPRESSION MODE */
        <div>
          <label className="block text-[#8c98ae] font-mono mb-1">
            YAML Expression Guard Override
          </label>
          <textarea
            rows={8}
            value={
              currentGuard.rawExpression ||
              `all:\n  - invoice.amount > 50000\n  - validation.vendorActive == true`
            }
            onChange={(e) => handleRawExpressionChange(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#0f1420] border border-[#253047] text-[#45e0d1] font-mono text-xs focus:border-[#ffc766] outline-none leading-relaxed"
          />
          <span className="text-[10px] text-[#8c98ae] mt-1 block">
            Technical YAML expressions take precedence over visual condition blocks.
          </span>
        </div>
      )}
    </div>
  );
};
