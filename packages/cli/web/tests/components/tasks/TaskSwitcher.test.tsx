// @vitest-environment jsdom

import type { Session } from '@api/schemas';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskSwitcher } from '../../../src/components/tasks/TaskSwitcher';
import { useAppStore } from '../../../src/store/AppStore';
import { useSessionStore } from '../../../src/store/session';
import type { SessionSurfaceSelection } from '../../../src/store/session/types';

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'task-1',
    projectPath: '/workspace/blade',
    rootId: 'task-1',
    title: 'Queued parser migration',
    taskStatus: 'queued',
    taskQueuePosition: 2,
    taskQueueDepth: 4,
    messageCount: 1,
    firstMessageTime: '2026-08-07T09:00:00.000Z',
    lastMessageTime: '2026-08-07T10:00:00.000Z',
    hasErrors: false,
    ...overrides,
  };
}

function historySelection(): SessionSurfaceSelection {
  return {
    locator: {
      version: 2,
      sessionId: 'remote-session',
      workspace: {
        kind: 'acp-remote',
        workspaceRef: `acp-remote-workspace:${'A'.repeat(43)}`,
      },
    },
    displayCwd: '/remote/project',
    mode: 'history-only',
    capabilities: {
      connection: 'online',
      history: { read: true, fork: true },
      turn: { start: false, reason: 'history-only' },
      files: {
        readText: false,
        writeText: false,
        browse: 'none',
        reason: 'history-only',
      },
      terminal: { mode: 'none', owner: 'none', reason: 'history-only' },
    },
  };
}

describe('TaskSwitcher', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  const cancelTask = vi.fn().mockResolvedValue(undefined);
  const retryTask = vi.fn().mockResolvedValue(undefined);
  const selectSession =
    vi.fn<ReturnType<typeof useSessionStore.getState>['selectSession']>();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
    cancelTask.mockReset().mockResolvedValue(undefined);
    retryTask.mockReset().mockResolvedValue(undefined);
    selectSession.mockReset().mockResolvedValue(undefined);
    useAppStore.setState({
      isTaskSwitcherOpen: true,
      taskSwitcherMode: 'tasks',
      isSettingsOpen: false,
      settingsSection: 'general',
    });
    useSessionStore.setState({
      sessions: [createSession()],
      historySurfaceSelection: null,
      isLoading: false,
      catalogLoadState: 'ready',
      catalogError: null,
      currentSessionRef: null,
      unreadTaskKeys: [],
      boundProjects: [],
      selectedProjectPath: '/workspace/blade',
      taskWorkspaceInfo: null,
      cancellingTaskKeys: [],
      retryingTaskKeys: [],
      cancelTask,
      retryTask,
      selectProject: vi.fn(),
      selectSession,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useAppStore.setState({ isTaskSwitcherOpen: false });
  });

  async function renderSwitcher(): Promise<void> {
    await act(async () => {
      root.render(<TaskSwitcher />);
      await Promise.resolve();
    });
  }

  async function clickAction(label: string): Promise<void> {
    const action = document.body.querySelector<HTMLButtonElement>(
      `button[aria-label="${label}"]`
    );
    expect(action).not.toBeNull();
    await act(async () => {
      action?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function pressKey(key: string): Promise<void> {
    const input = document.body.querySelector<HTMLInputElement>(
      'input[role="combobox"]'
    );
    expect(input).not.toBeNull();
    await act(async () => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    });
  }

  function highlightedTitle(): string | null {
    return (
      document.body.querySelector('[role="option"][aria-selected="true"]')
        ?.textContent ?? null
    );
  }

  it('keeps the highlighted compound SessionRef when live attention reorders tasks', async () => {
    const target = createSession({
      sessionId: 'shared-task',
      title: 'Keep this workspace',
      projectPath: '/workspace/target',
      taskStatus: 'running',
      lastMessageTime: '2026-08-07T11:00:00.000Z',
    });
    const sibling = createSession({
      sessionId: 'shared-task',
      title: 'Other workspace',
      projectPath: '/workspace/sibling',
      taskStatus: 'running',
    });
    useSessionStore.setState({ sessions: [target, sibling] });
    await renderSwitcher();
    expect(highlightedTitle()).toContain(target.title);

    await act(async () => {
      useSessionStore.setState({
        sessions: [
          target,
          {
            ...sibling,
            pendingInteraction: {
              type: 'permission',
              requestId: 'reordered-permission',
            },
          },
        ],
      });
    });

    expect(document.body.querySelector('[role="option"]')?.textContent).toContain(
      sibling.title
    );
    expect(highlightedTitle()).toContain(target.title);
    await pressKey('Enter');
    expect(selectSession).toHaveBeenCalledExactlyOnceWith({
      sessionId: target.sessionId,
      projectPath: target.projectPath,
    });
  });

  it('keeps keyboard selection when a running task completes and moves down', async () => {
    const first = createSession({
      sessionId: 'first',
      title: 'First task',
      taskStatus: 'running',
      lastMessageTime: '2026-08-07T11:00:00.000Z',
    });
    const selected = createSession({
      sessionId: 'selected',
      title: 'Selected task',
      taskStatus: 'running',
    });
    const queued = createSession({ sessionId: 'queued', title: 'Queued task' });
    useSessionStore.setState({ sessions: [first, selected, queued] });
    await renderSwitcher();
    await pressKey('ArrowDown');
    expect(highlightedTitle()).toContain(selected.title);

    await act(async () => {
      useSessionStore.setState({
        sessions: [first, { ...selected, taskStatus: 'completed' }, queued],
      });
    });

    expect(highlightedTitle()).toContain(selected.title);
    await pressKey('ArrowUp');
    expect(highlightedTitle()).toContain(queued.title);
  });

  it('selects the first remaining task when the highlighted task is removed', async () => {
    const first = createSession({ sessionId: 'first', title: 'First task' });
    const removed = createSession({ sessionId: 'removed', title: 'Removed task' });
    useSessionStore.setState({ sessions: [first, removed] });
    await renderSwitcher();
    await pressKey('ArrowDown');
    expect(highlightedTitle()).toContain(removed.title);

    await act(async () => {
      useSessionStore.setState({ sessions: [first] });
    });

    expect(highlightedTitle()).toContain(first.title);
    await pressKey('Enter');
    expect(selectSession).toHaveBeenCalledExactlyOnceWith({
      sessionId: first.sessionId,
      projectPath: first.projectPath,
    });
  });

  it('resets search selection and handles an empty result set without opening a task', async () => {
    const first = createSession({ sessionId: 'first', title: 'First task' });
    const second = createSession({ sessionId: 'second', title: 'Second task' });
    useSessionStore.setState({ sessions: [first, second] });
    await renderSwitcher();
    await pressKey('ArrowDown');
    expect(highlightedTitle()).toContain(second.title);
    const input = document.body.querySelector<HTMLInputElement>(
      'input[role="combobox"]'
    );
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    expect(input).not.toBeNull();
    expect(setValue).toBeDefined();

    await act(async () => {
      setValue?.call(input, 'no matching task');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(input?.hasAttribute('aria-activedescendant')).toBe(false);
    await pressKey('ArrowDown');
    await pressKey('ArrowUp');
    await pressKey('Enter');
    expect(selectSession).not.toHaveBeenCalled();

    await act(async () => {
      setValue?.call(input, 'task');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(highlightedTitle()).toContain(first.title);
    await pressKey('ArrowUp');
    expect(highlightedTitle()).toContain(second.title);
    await pressKey('ArrowDown');
    expect(highlightedTitle()).toContain(first.title);
  });

  it('starts at the first task after closing and reopening the switcher', async () => {
    const first = createSession({ sessionId: 'first', title: 'First task' });
    const second = createSession({ sessionId: 'second', title: 'Second task' });
    useSessionStore.setState({ sessions: [first, second] });
    await renderSwitcher();
    await pressKey('ArrowDown');
    expect(highlightedTitle()).toContain(second.title);
    await pressKey('Escape');
    await act(async () => {
      useAppStore.getState().setTaskSwitcherOpen(true);
    });
    expect(highlightedTitle()).toContain(first.title);
  });

  it('shows exact queue position and stops a task without closing the switcher', async () => {
    await renderSwitcher();

    expect(document.body.textContent).toContain('#2/4 queued');
    await clickAction('Stop Queued parser migration');

    expect(cancelTask).toHaveBeenCalledWith({
      sessionId: 'task-1',
      projectPath: '/workspace/blade',
    });
    expect(useAppStore.getState().isTaskSwitcherOpen).toBe(true);
  });

  it('closes and hides the task switcher while history-only is selected', async () => {
    useSessionStore.setState({ historySurfaceSelection: historySelection() });

    await renderSwitcher();

    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(useAppStore.getState().isTaskSwitcherOpen).toBe(false);
  });

  it('keeps action failures visible inside the switcher', async () => {
    cancelTask.mockRejectedValueOnce(new Error('Task owner unavailable'));
    await renderSwitcher();

    await clickAction('Stop Queued parser migration');

    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain(
      'Task owner unavailable'
    );
    expect(useAppStore.getState().isTaskSwitcherOpen).toBe(true);
  });

  it('retries a recoverable task and closes after the new task is selected', async () => {
    useSessionStore.setState({
      sessions: [
        createSession({
          title: 'Failed parser migration',
          taskStatus: 'failed',
          taskQueuePosition: undefined,
          taskQueueDepth: undefined,
          taskRetryAvailable: true,
        }),
      ],
    });
    await renderSwitcher();

    await clickAction('Retry Failed parser migration');

    expect(retryTask).toHaveBeenCalledWith({
      sessionId: 'task-1',
      projectPath: '/workspace/blade',
    });
    expect(useAppStore.getState().isTaskSwitcherOpen).toBe(false);
  });

  it('prioritizes tasks that need user action and labels the interaction', async () => {
    useSessionStore.setState({
      sessions: [
        createSession({
          sessionId: 'recent-running',
          title: 'Recent running task',
          taskStatus: 'running',
          taskQueuePosition: undefined,
          taskQueueDepth: undefined,
          lastMessageTime: '2026-08-07T11:00:00.000Z',
        }),
        createSession({
          sessionId: 'needs-approval',
          title: 'Approve migration',
          taskStatus: 'running',
          taskQueuePosition: undefined,
          taskQueueDepth: undefined,
          pendingInteraction: {
            type: 'permission',
            requestId: 'permission-1',
          },
          lastMessageTime: '2026-08-07T10:00:00.000Z',
        }),
      ],
    });

    await renderSwitcher();

    const results = Array.from(
      document.body.querySelectorAll<HTMLElement>('[data-session-ref]')
    );
    expect(results[0]?.textContent).toContain('Approve migration');
    expect(results[0]?.textContent).toContain('Needs approval');
    expect(document.body.textContent).toContain('1 need action');
  });

  it('runs cross-panel actions with arrow keys and Enter', async () => {
    useAppStore.setState({ taskSwitcherMode: 'commands' });
    await renderSwitcher();

    const input = document.body.querySelector<HTMLInputElement>(
      'input[aria-label="Search actions"]'
    );
    expect(input).not.toBeNull();
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(9);

    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        input?.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
            cancelable: true,
          })
        );
      });
    }
    await act(async () => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        })
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(useAppStore.getState()).toMatchObject({
      isTaskSwitcherOpen: false,
      isSettingsOpen: true,
      settingsSection: 'models',
    });
  });
});
