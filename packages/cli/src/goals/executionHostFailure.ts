import type { ToolResult } from '../tools/types/index.js';
import {
  GOAL_EXECUTION_HOST_FAILURE_CATEGORIES,
  type GoalExecutionHostFailureCategory,
} from './types.js';

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

export function buildGoalExecutionHostFailurePrompt(state: {
  category: GoalExecutionHostFailureCategory;
  consecutiveCount: number;
}): string {
  const lines = [
    '<goal-execution-host-failure>',
    `Category: ${state.category}`,
    `Consecutive turns: ${state.consecutiveCount}/3`,
    '</goal-execution-host-failure>',
    '',
    'The execution host has failed in consecutive Goal turns. Do not blindly',
    'repeat the same command path. Validate shell, sandbox, and terminal',
    'availability, then switch to a different executable strategy or call',
    'UpdateGoal blocked with concrete evidence if external intervention is required.',
  ];
  return lines.join('\n');
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
