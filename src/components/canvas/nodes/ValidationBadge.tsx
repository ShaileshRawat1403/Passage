import React from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { useWorkflowStore } from "../../../store/workflowStore";

export const ValidationBadge: React.FC<{ stateId: string }> = ({ stateId }) => {
  const validationIssues = useWorkflowStore((state) => state.validationIssues);
  const issues = validationIssues.filter(i => i.stateId === stateId);

  if (issues.length === 0) return null;

  const hasError = issues.some(i => i.severity === "error");
  const hasWarning = issues.some(i => i.severity === "warning");

  if (hasError) {
    return (
      <div 
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 border-2 border-slate-950 flex items-center justify-center shadow-lg"
        title={`${issues.length} Validation Issue(s)`}
      >
        <XCircle className="w-4 h-4 text-white" />
      </div>
    );
  }

  if (hasWarning) {
    return (
      <div 
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 border-2 border-slate-950 flex items-center justify-center shadow-lg"
        title={`${issues.length} Validation Warning(s)`}
      >
        <AlertTriangle className="w-4 h-4 text-white" />
      </div>
    );
  }

  return null;
};
