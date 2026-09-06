// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../../src/i18n';

const sessionState = vi.hoisted(() => ({
  goal: {
    version: 1 as const,
    sessionId: 'goal-session',
    goalId: 'goal-1',
    objective: 'Finish the migration and verify every production caller.',
    status: 'paused' as const,
    tokenBudget: 10_000,
    tokensUsed: 1_250,
    timeUsedSeconds: 95,
    continuationCount: 3,
    statusReason: 'paused by user',
    completionVerification: undefined as
      | undefined
      | {
          attempt: number;
          status: 'pending' | 'pass' | 'fail' | 'partial';
          requestedAt: string;
          completedAt?: string;
          verifierSessionId?: string;
          summary?: string;
          evidenceSha256?: string;
        },
    prematureStop: undefined as
      | undefined
      | {
          pattern:
            | 'unable_to_proceed'
            | 'stopping_here'
            | 'internal_wait'
            | 'self_deferral'
            | 'handoff';
          consecutiveCount: number;
          detectedAt: string;
        },
    verificationStall: undefined as
      | undefined
      | {
          feedbackSha256: string;
          consecutiveCount: number;
          detectedAt: string;
        },
    executionFrontier: undefined as
      | undefined
      | {
          taskListId: string;
          total: number;
          completed: number;
          inProgress: number;
          pending: number;
          blocked: number;
          nextTask?: {
            id: string;
            subject: string;
            priority: 'high' | 'medium' | 'low';
          };
          digestSha256: string;
          observedAt: string;
        },
    frontierStall: undefined as
      | undefined
      | {
          category: 'waiting_dependency' | 'same_task_no_effect' | 'repeated_deferral';
          consecutiveCount: number;
          digestSha256: string;
          detectedAt: string;
        },
    executionHostFailure: undefined as
      | undefined
      | {
          category:
            | 'timeout'
            | 'admission'
            | 'spawn'
            | 'finalization'
            | 'sandbox_start'
            | 'terminal';
          consecutiveCount: number;
          detectedAt: string;
        },
    turnLineage: undefined as
      | undefined
      | {
          rootTurnId?: string;
          currentTurnId: string;
          parentTurnId?: string;
        },
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:01:35.000Z',
  },
  pauseGoal: vi.fn().mockResolvedValue(undefined),
  resumeGoal: vi.fn().mockResolvedValue(undefined),
  editGoal: vi.fn().mockResolvedValue(undefined),
  clearGoal: vi.fn().mockResolvedValue(undefined),
  historySurfaceSelection: null as null | { mode: 'history-only' },
  setError: vi.fn(),
}));

vi.mock('@/store/session', () => {
  const useSessionStore = Object.assign(
    (selector: (state: typeof sessionState) => unknown) => selector(sessionState),
    { getState: () => sessionState }
  );
  return { useSessionStore };
});

import { GoalControlBar } from '../../../src/components/chat/GoalControlBar';

describe('GoalControlBar', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    vi.clearAllMocks();
    setLocale('en');
    sessionState.historySurfaceSelection = null;
    (sessionState.goal as { status: string }).status = 'paused';
    sessionState.goal.statusReason = 'paused by user';
    sessionState.goal.completionVerification = undefined;
    sessionState.goal.prematureStop = undefined;
    sessionState.goal.verificationStall = undefined;
    sessionState.goal.executionFrontier = undefined;
    sessionState.goal.frontierStall = undefined;
    sessionState.goal.executionHostFailure = undefined;
    sessionState.goal.turnLineage = undefined;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the paused goal toolbar and expands usage details', async () => {
    act(() => {
      root.render(<GoalControlBar />);
    });

    expect(container.textContent).toContain('Goal paused');
    expect(container.textContent).toContain('Finish the migration');
    expect(container.querySelector('[data-blade-goal-status="paused"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Resume goal"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Pause goal"]')).toBeNull();

    await act(async () => {
      container
        .querySelector('[aria-label="Expand goal details"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('1.3K / 10.0K tokens');
    expect(container.textContent).toContain('1m 35s');
    expect(container.textContent).toContain('3 continuations');
    expect(container.textContent).toContain('paused by user');
  });

  it('pauses an active goal from the toolbar', async () => {
    (sessionState.goal as { status: string }).status = 'active';
    act(() => {
      root.render(<GoalControlBar />);
    });

    expect(container.querySelector('[aria-label="Pause goal"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Resume goal"]')).toBeNull();
    await act(async () => {
      container
        .querySelector('[aria-label="Pause goal"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(sessionState.pauseGoal).toHaveBeenCalledOnce();
  });

  it('fails a stale goal action closed after entering history-only mode', async () => {
    (sessionState.goal as { status: string }).status = 'active';
    act(() => root.render(<GoalControlBar />));
    const stalePause = container.querySelector<HTMLButtonElement>(
      '[aria-label="Pause goal"]'
    );
    expect(stalePause).toBeTruthy();
    sessionState.historySurfaceSelection = { mode: 'history-only' };

    await act(async () => stalePause?.click());

    expect(sessionState.pauseGoal).not.toHaveBeenCalled();
    expect(sessionState.setError).toHaveBeenCalledWith('session_surface_read_only');
  });

  it('projects durable premature-stop recovery state for automation', async () => {
    (sessionState.goal as { status: string }).status = 'active';
    sessionState.goal.prematureStop = {
      pattern: 'internal_wait',
      consecutiveCount: 2,
      detectedAt: '2026-08-22T00:00:00.000Z',
    };

    act(() => {
      root.render(<GoalControlBar />);
    });

    expect(
      container.querySelector(
        '[data-blade-goal-recovery="2"][data-blade-goal-recovery-pattern="internal_wait"]'
      )
    ).toBeTruthy();
    await act(async () => {
      container
        .querySelector('[aria-label="Expand goal details"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Recovery nudge 2');
    expect(container.textContent).toContain('internal wait');
  });

  it('renders durable independent verification evidence', async () => {
    (sessionState.goal as { status: string }).status = 'verifying';
    sessionState.goal.statusReason =
      'independent completion verification returned partial';
    sessionState.goal.completionVerification = {
      attempt: 2,
      status: 'partial',
      requestedAt: '2026-08-04T00:01:00.000Z',
      completedAt: '2026-08-04T00:01:30.000Z',
      verifierSessionId: 'verifier-session-123456',
      summary: 'The restart assertion is still missing.',
      evidenceSha256: 'a'.repeat(64),
    };
    sessionState.goal.verificationStall = {
      feedbackSha256: 'b'.repeat(64),
      consecutiveCount: 2,
      detectedAt: '2026-08-23T00:00:00.000Z',
    };
    act(() => {
      root.render(<GoalControlBar />);
    });

    expect(container.textContent).toContain('Verifying');
    expect(container.querySelector('[aria-label="Pause goal"]')).toBeTruthy();
    await act(async () => {
      container
        .querySelector('[aria-label="Expand goal details"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.querySelector('[data-goal-verification="partial"]')).toBeTruthy();
    expect(
      container.querySelector('[data-blade-goal-verification-stall="2"]')
    ).toBeTruthy();
    expect(container.textContent).toContain('#2 · PARTIAL');
    expect(container.textContent).toContain('repeat 2/3');
    expect(container.textContent).toContain('verifier-ses');
    expect(container.textContent).toContain('The restart assertion is still missing.');
    expect(container.textContent).toContain('sha256:aaaaaaaaaaaa');
  });

  it('projects bounded execution frontier attributes for GUI recovery checks', () => {
    (sessionState.goal as { status: string }).status = 'active';
    sessionState.goal.executionFrontier = {
      taskListId: 'goal:goal-session:goal-1',
      total: 3,
      completed: 1,
      inProgress: 1,
      pending: 1,
      blocked: 0,
      nextTask: { id: '3', subject: 'Run tests', priority: 'high' },
      digestSha256: 'a'.repeat(64),
      observedAt: '2026-08-28T00:00:00.000Z',
    };
    sessionState.goal.frontierStall = {
      category: 'same_task_no_effect',
      consecutiveCount: 2,
      digestSha256: 'a'.repeat(64),
      detectedAt: '2026-08-28T00:00:00.000Z',
    };

    act(() => {
      root.render(<GoalControlBar />);
    });

    const section = container.querySelector('[data-blade-goal-status="active"]');
    expect(section).toMatchObject({
      dataset: {
        bladeGoalFrontierTaskList: 'goal:goal-session:goal-1',
        bladeGoalFrontierTotal: '3',
        bladeGoalFrontierCompleted: '1',
        bladeGoalFrontierInProgress: '1',
        bladeGoalFrontierPending: '1',
        bladeGoalFrontierBlocked: '0',
        bladeGoalFrontierNextTask: '3',
        bladeGoalFrontierStall: 'same_task_no_effect',
        bladeGoalFrontierStallCount: '2',
      },
    });
  });

  it('renders durable execution-host recovery without private diagnostics', async () => {
    (sessionState.goal as { status: string }).status = 'active';
    sessionState.goal.executionHostFailure = {
      category: 'spawn',
      consecutiveCount: 2,
      detectedAt: '2026-09-06T00:00:00.000Z',
    };

    act(() => root.render(<GoalControlBar />));

    expect(
      container.querySelector(
        '[data-blade-goal-execution-host-failure="spawn"]' +
          '[data-blade-goal-execution-host-failure-count="2"]'
      )
    ).toBeTruthy();
    await act(async () => {
      container
        .querySelector('[aria-label="Expand goal details"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Execution host recovery');
    expect(container.textContent).toContain('Spawn · 2/3');
  });

  it('projects and renders durable Goal turn lineage without stale root text', async () => {
    sessionState.goal.turnLineage = {
      rootTurnId: 'root-turn-123456',
      currentTurnId: 'current-turn-987654',
      parentTurnId: 'parent-turn-abcdef',
    };
    act(() => root.render(<GoalControlBar />));

    let section = container.querySelector('[data-blade-goal-status="paused"]');
    expect(section).toMatchObject({
      dataset: {
        bladeGoalRootTurn: 'root-turn-123456',
        bladeGoalCurrentTurn: 'current-turn-987654',
        bladeGoalParentTurn: 'parent-turn-abcdef',
      },
    });
    await act(async () => {
      container
        .querySelector('[aria-label="Expand goal details"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Origin');
    expect(container.textContent).toContain('root-turn-123456');
    expect(container.textContent).toContain('Current');
    expect(container.textContent).toContain('current-turn-987654');
    expect(container.textContent).toContain('Parent');
    expect(container.textContent).toContain('parent-turn-abcdef');

    sessionState.goal.turnLineage = { currentTurnId: 'edited-turn' };
    act(() => root.render(<GoalControlBar />));
    section = container.querySelector('[data-blade-goal-status="paused"]');

    expect(container.textContent).not.toContain('root-turn-123456');
    expect(section?.getAttribute('data-blade-goal-root-turn')).toBeNull();
    expect(section?.getAttribute('data-blade-goal-current-turn')).toBe('edited-turn');
    expect(section?.getAttribute('data-blade-goal-parent-turn')).toBeNull();
  });

  it('localizes the Goal turn lineage labels in Chinese', async () => {
    setLocale('zh');
    sessionState.goal.turnLineage = {
      currentTurnId: 'current-turn',
      parentTurnId: 'parent-turn',
    };
    act(() => root.render(<GoalControlBar />));

    await act(async () => {
      container
        .querySelector('[aria-label="展开目标详情"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('起点');
    expect(container.textContent).toContain('当前');
    expect(container.textContent).toContain('上一步');
  });

  it('edits without resuming and exposes resume as a separate action', async () => {
    act(() => {
      root.render(<GoalControlBar />);
    });

    await act(async () => {
      container
        .querySelector('[aria-label="Edit goal"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    const textarea = container.querySelector(
      '#goal-objective'
    ) as HTMLTextAreaElement | null;
    expect(textarea).toBeTruthy();
    await act(async () => {
      if (textarea) {
        const setValue = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        setValue?.call(textarea, 'Ship the revised migration safely.');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await Promise.resolve();
    });

    const save = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Save'
    );
    await act(async () => {
      save?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(sessionState.editGoal).toHaveBeenCalledWith(
      'Ship the revised migration safely.'
    );
    expect(sessionState.resumeGoal).not.toHaveBeenCalled();

    await act(async () => {
      container
        .querySelector('[aria-label="Resume goal"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(sessionState.resumeGoal).toHaveBeenCalledOnce();
  });

  it('requires confirmation before deleting the goal', async () => {
    act(() => {
      root.render(<GoalControlBar />);
    });

    await act(async () => {
      container
        .querySelector('[aria-label="Delete goal"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain('Delete this goal?');
    expect(sessionState.clearGoal).not.toHaveBeenCalled();

    const confirm = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Delete goal'
    );
    await act(async () => {
      confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(sessionState.clearGoal).toHaveBeenCalledOnce();
  });
});
