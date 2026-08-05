import { StateType } from "../../types/workflow";

export const STATE_LAYOUT_DIMENSIONS: Record<StateType, { width: number; height: number }> = {
  start: { width: 160, height: 60 },
  atomic: { width: 220, height: 80 },
  decision: { width: 200, height: 100 },
  parallel: { width: 240, height: 90 },
  compound: { width: 260, height: 120 },
  waiting: { width: 180, height: 70 },
  approval: { width: 220, height: 80 },
  final: { width: 160, height: 60 },
};
