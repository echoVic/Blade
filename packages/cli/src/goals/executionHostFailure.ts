import type { ToolResult } from '../tools/types/index.js';

export const GOAL_EXECUTION_HOST_FAILURE_CATEGORIES = [
  'timeout',
  'admission',
  'spawn',
  'finalization',
  'sandbox_start',
  'terminal',
] as const;

export type GoalExecutionHostFailureCategory =
  (typeof GOAL_EXECUTION_HOST_FAILURE_CATEGORIES)[number];

export interface GoalExecutionHostFailureAccumulator {
  successfulBash: boolean;
  category?: GoalExecutionHostFailureCategory;
}

export function createGoalExecutionHostFailureAccumulator(): GoalExecutionHostFailureAccumulator {
  return { successfulBash: false };
}

export function isGoalExecutionHostFailureCategory(
  value: unknown
): value is GoalExecutionHostFailureCategory {
  return (
    typeof value === 'string' &&
    GOAL_EXECUTION_HOST_FAILURE_CATEGORIES.some((category) => category === value)
  );
}

export function executionHostFailureForTerminalFailure(
  value: unknown
): GoalExecutionHostFailureCategory | undefined {
  switch (value) {
    case 'timeout':
    case 'admission':
    case 'spawn':
    case 'finalization':
      return value;
    case 'unavailable':
      return 'terminal';
    default:
      return undefined;
  }
}

export function observeGoalExecutionHostToolResult(
  state: GoalExecutionHostFailureAccumulator,
  toolName: string,
  result: ToolResult
): void {
  if (toolName !== 'Bash') return;
  if (result.success) {
    state.successfulBash = true;
    return;
  }

  const category = result.metadata?.execution_host_failure;
  if (isGoalExecutionHostFailureCategory(category)) {
    state.category = category;
  }
}

export function resolveGoalExecutionHostFailure(
  state: GoalExecutionHostFailureAccumulator
): GoalExecutionHostFailureCategory | undefined {
  return state.successfulBash ? undefined : state.category;
}
