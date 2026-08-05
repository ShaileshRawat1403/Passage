import { WorkflowDefinition } from "../../types/workflow";

export type LayoutDirection = "LR" | "TB";

export interface WorkflowLayoutOptions {
  direction: LayoutDirection;
  nodeSpacing: number;
  rankSpacing: number;
  componentSpacing: number;
  finalStateAlignment: boolean;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface WorkflowLayoutResult {
  positions: Record<string, LayoutPoint>;
  edgeKinds: Record<
    string,
    "forward" | "branch" | "loopback" | "self_loop" | "cross_component"
  >;
  warnings: WorkflowLayoutWarning[];
}

export interface WorkflowLayoutWarning {
  code: string;
  message: string;
  stateId?: string;
  transitionId?: string;
}

export interface WorkflowLayoutGraph {
  states: any[];
  initialStateId?: string;
  transitions: any[];
}

export interface WorkflowLayoutEngine {
  layout(
    graph: WorkflowLayoutGraph,
    options: WorkflowLayoutOptions
  ): Promise<WorkflowLayoutResult>;
}
