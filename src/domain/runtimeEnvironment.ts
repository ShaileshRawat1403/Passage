import { ActionDefinition } from "../types/workflow";
import { ActionExecutionResult } from "./actionExecutor";

export interface RuntimeEnvironment {
  /** Returns an ISO timestamp string */
  now(): string;
  /** Creates a unique deterministic or random identifier for a given namespace */
  createId(namespace: string): string;
  /** Adds duration in milliseconds to an ISO timestamp and returns updated ISO string */
  addMilliseconds(timestamp: string, durationMs: number): string;
  /** Optional custom action execution handler */
  executeAction?: (
    action: ActionDefinition,
    context: Record<string, unknown>,
    env: RuntimeEnvironment
  ) => ActionExecutionResult;
}

/**
 * Production environment using real wall-clock time and crypto-random IDs
 */
export const defaultProductionEnv: RuntimeEnvironment = {
  now: () => new Date().toISOString(),
  createId: (namespace: string) => {
    const randomPart = Math.random().toString(36).substring(2, 9).toUpperCase();
    return `${namespace.toUpperCase()}-${Date.now()}-${randomPart}`;
  },
  addMilliseconds: (timestamp: string, durationMs: number) => {
    const date = new Date(timestamp);
    return new Date(date.getTime() + durationMs).toISOString();
  },
};

/**
 * Creates a deterministic runtime environment for reproducible test execution and simulation
 */
export function createTestEnvironment(
  fixedTime: string = "2026-08-04T12:00:00.000Z"
): RuntimeEnvironment {
  let counter = 0;
  return {
    now: () => fixedTime,
    createId: (namespace: string) => {
      counter += 1;
      return `${namespace.toUpperCase()}-TEST-${String(counter).padStart(4, "0")}`;
    },
    addMilliseconds: (timestamp: string, durationMs: number) => {
      const date = new Date(timestamp);
      return new Date(date.getTime() + durationMs).toISOString();
    },
  };
}
