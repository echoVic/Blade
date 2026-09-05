import { describe, expect, it } from 'vitest';
import {
  createGoalExecutionHostFailureAccumulator,
  executionHostFailureForTerminalFailure,
  observeGoalExecutionHostToolResult,
  resolveGoalExecutionHostFailure,
} from '../../../../src/goals/executionHostFailure.js';
import { ToolErrorType, type ToolResult } from '../../../../src/tools/types/index.js';

function result(input: {
  success: boolean;
  category?: string;
  exitCode?: number;
}): ToolResult {
  return {
    success: input.success,
    llmContent: input.success ? 'ok' : 'private failure',
    ...(input.success
      ? {}
      : {
          error: {
            type: ToolErrorType.EXECUTION_ERROR,
            message: 'private failure',
          },
        }),
    metadata: {
      ...(input.category ? { execution_host_failure: input.category } : {}),
      ...(input.exitCode !== undefined ? { exit_code: input.exitCode } : {}),
    },
  };
}

describe('goal execution host failure accumulator', () => {
  it('maps only infrastructure terminal failures to goal categories', () => {
    expect(executionHostFailureForTerminalFailure('timeout')).toBe('timeout');
    expect(executionHostFailureForTerminalFailure('admission')).toBe('admission');
    expect(executionHostFailureForTerminalFailure('spawn')).toBe('spawn');
    expect(executionHostFailureForTerminalFailure('finalization')).toBe(
      'finalization'
    );
    expect(executionHostFailureForTerminalFailure('unavailable')).toBe('terminal');
    expect(executionHostFailureForTerminalFailure('aborted')).toBeUndefined();
    expect(executionHostFailureForTerminalFailure('unknown')).toBeUndefined();
  });

  it('accepts only a typed Bash execution-host failure marker', () => {
    const state = createGoalExecutionHostFailureAccumulator();

    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, category: 'spawn' })
    );

    expect(resolveGoalExecutionHostFailure(state)).toBe('spawn');
  });

  it('does not infer host failures from exit codes, errors, or other tools', () => {
    const state = createGoalExecutionHostFailureAccumulator();

    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, exitCode: 7 })
    );
    observeGoalExecutionHostToolResult(
      state,
      'Task',
      result({ success: false, category: 'spawn' })
    );
    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, category: 'unknown' })
    );

    expect(resolveGoalExecutionHostFailure(state)).toBeUndefined();
  });

  it('uses the last typed failure when Bash never succeeds', () => {
    const state = createGoalExecutionHostFailureAccumulator();

    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, category: 'timeout' })
    );
    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, category: 'terminal' })
    );

    expect(resolveGoalExecutionHostFailure(state)).toBe('terminal');
  });

  it('suppresses the entire turn after any successful Bash result', () => {
    const state = createGoalExecutionHostFailureAccumulator();

    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, category: 'admission' })
    );
    observeGoalExecutionHostToolResult(state, 'Bash', result({ success: true }));
    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, category: 'finalization' })
    );

    expect(resolveGoalExecutionHostFailure(state)).toBeUndefined();
  });

  it('does not let another successful tool suppress a Bash host failure', () => {
    const state = createGoalExecutionHostFailureAccumulator();

    observeGoalExecutionHostToolResult(
      state,
      'Bash',
      result({ success: false, category: 'sandbox_start' })
    );
    observeGoalExecutionHostToolResult(state, 'Read', result({ success: true }));

    expect(resolveGoalExecutionHostFailure(state)).toBe('sandbox_start');
  });
});
