import type { SocketReadyState } from 'node:net';
import { PassThrough } from 'node:stream';
import { render } from 'ink';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSurfaceSummary } from '../../../src/api/sessionSurfaceSchemas.js';
import type { Message } from '../../../src/services/ChatServiceInterface.js';
import type { SessionMetadata } from '../../../src/services/SessionService.js';
import { FocusId } from '../../../src/store/types.js';
import { getState, vanillaStore } from '../../../src/store/vanilla.js';
import { SessionSelector } from '../../../src/ui/components/SessionSelector.js';
import {
  commitLocalTaskAttention,
  getTaskAttentionKey,
} from '../../../src/ui/components/sessionSelectorModel.js';
import type { ResolvedInput } from '../../../src/ui/hooks/useInputBuffer.js';
import { processSlashCommand } from '../../../src/ui/utils/slashCommandRouter.js';
import { getCwd } from '../../../src/utils/cwd.js';

const activationMocks = vi.hoisted(() => ({
  activateSessionSelection: vi.fn(),
}));

const sessionServiceMocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
}));

vi.mock('../../../src/ui/utils/sessionActivation.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/ui/utils/sessionActivation.js')
  >('../../../src/ui/utils/sessionActivation.js');
  return {
    ...actual,
    activateSessionSelection: activationMocks.activateSessionSelection,
  };
});

vi.mock('../../../src/services/SessionService.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../../src/services/SessionService.js')
  >('../../../src/services/SessionService.js');
  return {
    ...actual,
    SessionService: {
      ...actual.SessionService,
      listSessions: sessionServiceMocks.listSessions,
    },
  };
});

class TestInputStream extends PassThrough {
  public isTTY = true;
  public isRaw = false;
  public isRawMode = false;
  public bytesRead = 0;
  public bytesWritten = 0;
  public connecting = false;
  public destroyed = false;
  public pending = false;
  public bufferSize = 0;
  public readyState: SocketReadyState = 'open';
  public autoSelectFamilyAttemptedAddresses: string[] = [];
  public localAddress = '127.0.0.1';
  public localPort = 0;
  public remoteAddress = '127.0.0.1';
  public remoteFamily: string = 'IPv4';
  public remotePort = 0;

  setRawMode(mode: boolean): this {
    this.isRaw = mode;
    this.isRawMode = mode;
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }

  address(): {} {
    return {};
  }

  setEncoding(_encoding: BufferEncoding): this {
    return this;
  }

  pause(): this {
    return super.pause();
  }

  resume(): this {
    return super.resume();
  }

  isPaused(): boolean {
    return super.isPaused();
  }

  setTimeout(_timeout: number, callback?: () => void): this {
    callback?.();
    return this;
  }

  destroySoon(): void {
    // no-op for typed test stream compatibility
  }

  connect(): this {
    return this;
  }

  setNoDelay(_noDelay?: boolean): this {
    return this;
  }

  setKeepAlive(_enable?: boolean, _initialDelay?: number): this {
    return this;
  }

  resetAndDestroy(): this {
    this.destroy();
    return this;
  }

  write(
    chunk: string | Uint8Array,
    cb?: (error: Error | null | undefined) => void
  ): boolean;
  write(
    chunk: string | Uint8Array,
    encoding?: BufferEncoding,
    cb?: (error: Error | null | undefined) => void
  ): boolean;
  write(
    chunk: string | Uint8Array,
    encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
    cb?: (error: Error | null | undefined) => void
  ): boolean {
    this.bytesWritten +=
      typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength;
    if (typeof encoding === 'function') {
      return super.write(chunk, encoding);
    }
    if (cb) {
      return encoding ? super.write(chunk, encoding, cb) : super.write(chunk, cb);
    }
    return encoding ? super.write(chunk, encoding) : super.write(chunk);
  }
}

class TestOutputStream extends PassThrough {
  public columns = 120;
  public rows = 40;
  public isTTY = true;
  public output = '';
  public bytesRead = 0;
  public bytesWritten = 0;
  public connecting = false;
  public destroyed = false;
  public pending = false;
  public bufferSize = 0;
  public readyState: SocketReadyState = 'open';
  public autoSelectFamilyAttemptedAddresses: string[] = [];
  public localAddress = '127.0.0.1';
  public localPort = 0;
  public remoteAddress = '127.0.0.1';
  public remoteFamily: string = 'IPv4';
  public remotePort = 0;

  constructor() {
    super();
    this.on('data', (chunk: string | Buffer) => {
      this.output += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });
  }

  addListener(event: 'resize', listener: () => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this;
  addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.addListener(event, listener);
  }

  on(event: 'resize', listener: () => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  once(event: 'resize', listener: () => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.once(event, listener);
  }

  off(event: 'resize', listener: () => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  removeListener(event: 'resize', listener: () => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.removeListener(event, listener);
  }

  address(): {} {
    return {};
  }

  clearLine(_dir: -1 | 0 | 1, callback?: () => void): boolean {
    callback?.();
    return true;
  }

  clearScreenDown(callback?: () => void): boolean {
    callback?.();
    return true;
  }

  cursorTo(_x: number, _y?: number | (() => void), callback?: () => void): boolean {
    if (typeof _y === 'function') {
      _y();
      return true;
    }
    callback?.();
    return true;
  }

  moveCursor(_dx: number, _dy: number, callback?: () => void): boolean {
    callback?.();
    return true;
  }

  getColorDepth(): number {
    return 24;
  }

  hasColors(): boolean {
    return true;
  }

  getWindowSize(): [number, number] {
    return [this.columns, this.rows];
  }

  setDefaultEncoding(_encoding: BufferEncoding): this {
    return this;
  }

  _write(
    chunk: Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.bytesWritten += chunk.byteLength;
    super._write(chunk, encoding, callback);
  }

  setTimeout(_timeout: number, callback?: () => void): this {
    callback?.();
    return this;
  }

  destroySoon(): void {
    // no-op for typed test stream compatibility
  }

  connect(): this {
    return this;
  }

  setNoDelay(_noDelay?: boolean): this {
    return this;
  }

  setKeepAlive(_enable?: boolean, _initialDelay?: number): this {
    return this;
  }

  resetAndDestroy(): this {
    this.destroy();
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }
}

function createResolvedInput(text: string): ResolvedInput {
  return {
    displayText: text,
    text,
    images: [],
    parts: [{ type: 'text', text }],
  };
}

const workspaceLabel = getCwd().split('/').pop() || getCwd();

function createSessionMetadata(
  overrides: Partial<SessionMetadata> = {}
): SessionMetadata {
  const workspace = getCwd();
  return {
    sessionId: 'ordinary-session-12345678',
    projectPath: workspace,
    gitBranch: 'main',
    rootId: 'root-parent',
    parentId: undefined,
    relationType: undefined,
    title: 'Ordinary Session',
    agentType: 'default',
    model: 'gpt-5',
    taskStatus: 'completed',
    messageCount: 12,
    firstMessageTime: '2026-08-01T10:00:00.000Z',
    lastMessageTime: '2026-08-03T11:00:00.000Z',
    hasErrors: false,
    ...overrides,
  };
}

function createLocalSurfaceSummary(metadata: SessionMetadata): SessionSurfaceSummary {
  return {
    locator: {
      version: 2,
      sessionId: metadata.sessionId,
      workspace: { kind: 'local', projectPath: metadata.projectPath },
    },
    displayCwd: metadata.projectPath,
    title: metadata.title,
    rootId: metadata.rootId,
    parentId: metadata.parentId,
    relationType: metadata.relationType,
    taskStatus: metadata.taskStatus,
    messageCount: metadata.messageCount,
    firstMessageTime: metadata.firstMessageTime,
    lastMessageTime: metadata.lastMessageTime,
    hasErrors: metadata.hasErrors,
    archivedAt: metadata.archivedAt,
    selectedModelId: metadata.selectedModelId,
    capabilities: {
      connection: 'local',
      history: { read: true, fork: metadata.archivedAt === undefined },
      turn: metadata.archivedAt
        ? { start: false, reason: 'archived' }
        : { start: true },
      files: metadata.archivedAt
        ? { readText: false, writeText: false, browse: 'none', reason: 'archived' }
        : { readText: true, writeText: true, browse: 'tree' },
      terminal: metadata.archivedAt
        ? { mode: 'none', owner: 'none', reason: 'archived' }
        : { mode: 'interactive', owner: 'local' },
    },
  };
}

function createRemoteSurfaceSummary(): SessionSurfaceSummary {
  return {
    ...createLocalSurfaceSummary(createSessionMetadata()),
    locator: {
      version: 2,
      sessionId: 'remote-session-12345678',
      workspace: {
        kind: 'acp-remote',
        workspaceRef: `acp-remote-workspace:${'R'.repeat(43)}`,
      },
    },
    displayCwd: 'C:\\Remote\\Repo',
    title: 'Remote Session',
    capabilities: {
      connection: 'offline',
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

function resetStore(): void {
  vanillaStore.setState((state) => ({
    ...state,
    app: {
      ...state.app,
      activeModal: 'none',
      sessionSelectorData: undefined,
      sessionHistoryViewerData: undefined,
    },
    focus: {
      ...state.focus,
      currentFocus: FocusId.MAIN_INPUT,
      previousFocus: null,
    },
    session: {
      ...state.session,
      messages: [],
      restoredContextMessages: null,
      restoredVisibleMessageCount: 0,
      error: null,
    },
  }));
}

async function waitForAssertion(
  assertion: () => void,
  getDebugState?: () => string
): Promise<void> {
  const deadline = Date.now() + 5000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }
  }
  const details = getDebugState ? `\n${getDebugState()}` : '';
  throw new Error(
    `${lastError instanceof Error ? lastError.message : String(lastError)}${details}`
  );
}

async function waitForNextTick(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe('session selector fork integration', () => {
  beforeEach(() => {
    activationMocks.activateSessionSelection.mockReset();
    sessionServiceMocks.listSessions.mockReset();
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('never acknowledges the source and marks only the child visible after a fork commits', async () => {
    const source = createLocalSurfaceSummary(createSessionMetadata());
    const childLocator = {
      version: 2 as const,
      sessionId: 'fork-child-session',
      workspace: { kind: 'local' as const, projectPath: getCwd() },
    };
    const attention = {
      acknowledge: vi.fn(async (_summary: SessionSurfaceSummary) => undefined),
      setVisibleLocator: vi.fn(
        async (_locator: SessionSurfaceSummary['locator']) => undefined
      ),
    };

    await commitLocalTaskAttention('fork', source, attention, childLocator);

    expect(attention.acknowledge).not.toHaveBeenCalled();
    expect(attention.setVisibleLocator).toHaveBeenCalledWith(childLocator);
  });

  it.each(['resume', 'fork'] as const)(
    'refreshes an open %s selector from a complete attention catalog',
    (intent) => {
      const initial = createLocalSurfaceSummary(createSessionMetadata());
      const updated = { ...initial, taskStatus: 'failed' as const };
      const actions = getState().app.actions;
      actions.showSessionSelector([initial], intent);
      actions.projectTaskAttentionState('ready', ['unread-task'], [updated]);

      expect(getState().app.sessionSelectorData).toEqual({
        intent,
        sessions: [updated],
      });
      expect(getState().app.activeModal).toBe('sessionSelector');
      expect(getState().app.taskAttentionUnreadKeys).toEqual(['unread-task']);
    }
  );

  it('retains selector candidates during incomplete refreshes without reopening a closed selector', () => {
    const session = createLocalSurfaceSummary(createSessionMetadata());
    const actions = getState().app.actions;
    actions.showSessionSelector([session], 'resume');
    const previous = getState().app.sessionSelectorData;
    actions.projectTaskAttentionState('loading', [], []);
    expect(getState().app.sessionSelectorData).toBe(previous);
    actions.projectTaskAttentionState('error', [], []);
    expect(getState().app.sessionSelectorData).toBe(previous);
    actions.closeModal();
    actions.projectTaskAttentionState('ready', [], [session]);
    expect(getState().app.activeModal).toBe('none');
    expect(getState().app.sessionSelectorData).toBeUndefined();
  });

  it.each(['metadata', 'reorder', 'insert'])(
    'preserves the selected locator after a %s catalog update',
    async (change) => {
      const first = createLocalSurfaceSummary(
        createSessionMetadata({
          sessionId: 'shared-session',
          projectPath: `${getCwd()}/first`,
          title: 'First candidate',
        })
      );
      const selected = createLocalSurfaceSummary(
        createSessionMetadata({
          sessionId: 'shared-session',
          projectPath: `${getCwd()}/selected`,
          title: 'Selected candidate',
        })
      );
      const updated = { ...selected, title: 'Updated selected candidate' };
      const incoming =
        change === 'metadata'
          ? [first, updated]
          : change === 'reorder'
            ? [updated, first]
            : [createRemoteSurfaceSummary(), first, updated];
      const onSelect = vi.fn<(session: SessionSurfaceSummary) => void>();
      const stdin = new TestInputStream();
      const stdout = new TestOutputStream();
      const stderr = new TestOutputStream();
      getState().focus.actions.setFocus(FocusId.SESSION_SELECTOR);
      const app = render(
        <SessionSelector
          intent="resume"
          sessions={[first, selected]}
          onSelect={onSelect}
        />,
        { stdin, stdout, stderr, debug: true, exitOnCtrlC: false, patchConsole: false }
      );
      const exit = app.waitUntilExit();
      try {
        await waitForAssertion(() =>
          expect(stdout.output).toContain('First candidate')
        );
        const movedAt = stdout.output.length;
        stdin.write('\u001b[B');
        await waitForAssertion(() =>
          expect(stdout.output.slice(movedAt)).toContain('> [DONE] Selected candidate')
        );
        app.rerender(
          <SessionSelector intent="resume" sessions={incoming} onSelect={onSelect} />
        );
        await waitForAssertion(() => expect(stdout.output).toContain(updated.title));
        await waitForNextTick();
        stdin.write('\r');
        await waitForAssertion(() => expect(onSelect).toHaveBeenCalledOnce());
        expect(onSelect).toHaveBeenCalledWith(updated);
      } finally {
        app.unmount();
        await exit;
        app.cleanup();
        stdin.end();
        stdout.end();
        stderr.end();
      }
    }
  );

  it('keeps a selected session on its new page after catalog insertion', async () => {
    const sessions = Array.from({ length: 21 }, (_, index) =>
      createLocalSurfaceSummary(
        createSessionMetadata({
          sessionId: `page-session-${index}`,
          title: `Page candidate ${index}`,
        })
      )
    );
    const target = sessions[20];
    if (!target) throw new Error('Missing page candidate');
    const stdin = new TestInputStream();
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();
    const onSelect = vi.fn<(session: SessionSurfaceSummary) => void>();
    getState().focus.actions.setFocus(FocusId.SESSION_SELECTOR);
    const app = render(
      <SessionSelector intent="resume" sessions={sessions} onSelect={onSelect} />,
      { stdin, stdout, stderr, debug: true, exitOnCtrlC: false, patchConsole: false }
    );
    const exit = app.waitUntilExit();
    try {
      await waitForAssertion(() => expect(stdout.output).toContain('第 1/2 页'));
      stdin.write('\u001b[C');
      await waitForAssertion(() =>
        expect(stdout.output).toContain('> [DONE] Page candidate 20')
      );
      const updated = { ...target, title: 'Updated page candidate' };
      const outputAt = stdout.output.length;
      app.rerender(
        <SessionSelector
          intent="resume"
          sessions={[createRemoteSurfaceSummary(), ...sessions.slice(0, 20), updated]}
          onSelect={onSelect}
        />
      );
      await waitForAssertion(() =>
        expect(stdout.output.slice(outputAt)).toContain('共 22 个会话')
      );
      await waitForNextTick();
      stdin.write('\r');
      await waitForAssertion(() => expect(onSelect).toHaveBeenCalledOnce());
      expect(onSelect).toHaveBeenCalledWith(updated);
    } finally {
      app.unmount();
      await exit;
      app.cleanup();
      stdin.end();
      stdout.end();
      stderr.end();
    }
  });

  it.each(['removed', 'empty'])(
    'keeps selection safe when the current catalog becomes %s',
    async (change) => {
      const first = createLocalSurfaceSummary(
        createSessionMetadata({ title: 'Remaining candidate' })
      );
      const selected = createRemoteSurfaceSummary();
      const onSelect = vi.fn<(session: SessionSurfaceSummary) => void>();
      const onCancel = vi.fn();
      const stdin = new TestInputStream();
      const stdout = new TestOutputStream();
      const stderr = new TestOutputStream();
      getState().focus.actions.setFocus(FocusId.SESSION_SELECTOR);
      const app = render(
        <SessionSelector
          intent="resume"
          sessions={[first, selected]}
          onSelect={onSelect}
          onCancel={onCancel}
        />,
        { stdin, stdout, stderr, debug: true, exitOnCtrlC: false, patchConsole: false }
      );
      const exit = app.waitUntilExit();
      try {
        await waitForAssertion(() =>
          expect(stdout.output).toContain('Remaining candidate')
        );
        stdin.write('j');
        await waitForAssertion(() => expect(stdout.output).toContain('> [remote'));
        const outputAt = stdout.output.length;
        app.rerender(
          <SessionSelector
            intent="resume"
            sessions={change === 'empty' ? [] : [first]}
            onSelect={onSelect}
            onCancel={onCancel}
          />
        );
        await waitForAssertion(() =>
          expect(stdout.output.slice(outputAt)).toContain(
            change === 'empty' ? '没有找到历史会话' : '> [DONE] Remaining candidate'
          )
        );
        stdin.write('\r');
        await waitForNextTick();
        if (change === 'empty') {
          expect(onSelect).not.toHaveBeenCalled();
          stdin.write('\u001b');
          await waitForAssertion(() => expect(onCancel).toHaveBeenCalledOnce());
        } else {
          await waitForAssertion(() => expect(onSelect).toHaveBeenCalledWith(first));
        }
      } finally {
        app.unmount();
        await exit;
        app.cleanup();
        stdin.end();
        stdout.end();
        stderr.end();
      }
    }
  );

  it('retains page shortcuts, in-page wraparound, and numeric activation', async () => {
    const sessions = Array.from({ length: 22 }, (_, index) =>
      createLocalSurfaceSummary(
        createSessionMetadata({
          sessionId: `shortcut-${index}`,
          title: `Shortcut candidate ${index}`,
        })
      )
    );
    const onSelect = vi.fn<(session: SessionSurfaceSummary) => void>();
    const stdin = new TestInputStream();
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();
    getState().focus.actions.setFocus(FocusId.SESSION_SELECTOR);
    const app = render(
      <SessionSelector intent="resume" sessions={sessions} onSelect={onSelect} />,
      { stdin, stdout, stderr, debug: true, exitOnCtrlC: false, patchConsole: false }
    );
    const exit = app.waitUntilExit();
    try {
      await waitForAssertion(() => expect(stdout.output).toContain('第 1/2 页'));
      for (const [key, title] of [
        ['l', 'Shortcut candidate 20'],
        ['k', 'Shortcut candidate 21'],
        ['j', 'Shortcut candidate 20'],
        ['h', 'Shortcut candidate 0'],
        ['k', 'Shortcut candidate 19'],
        ['j', 'Shortcut candidate 0'],
        ['L', 'Shortcut candidate 20'],
      ]) {
        const outputAt = stdout.output.length;
        stdin.write(key);
        await waitForAssertion(
          () => expect(stdout.output.slice(outputAt)).toContain(`> [DONE] ${title}`),
          () => `key=${key} output=${JSON.stringify(stdout.output.slice(outputAt))}`
        );
      }
      stdin.write('9');
      await waitForNextTick();
      expect(onSelect).not.toHaveBeenCalled();
      stdin.write('2');
      await waitForAssertion(() => expect(onSelect).toHaveBeenCalledWith(sessions[21]));
    } finally {
      app.unmount();
      await exit;
      app.cleanup();
      stdin.end();
      stdout.end();
      stderr.end();
    }
  });

  it('retains a remote locator rather than another workspace sharing its session id', async () => {
    const selected = createRemoteSurfaceSummary();
    const other = {
      ...selected,
      locator: {
        ...selected.locator,
        workspace: {
          kind: 'acp-remote' as const,
          workspaceRef: `acp-remote-workspace:${'S'.repeat(43)}`,
        },
      },
      title: 'Other remote workspace',
    };
    const updated = { ...selected, title: 'Updated remote workspace' };
    const onSelect = vi.fn<(session: SessionSurfaceSummary) => void>();
    const stdin = new TestInputStream();
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();
    getState().focus.actions.setFocus(FocusId.SESSION_SELECTOR);
    const app = render(
      <SessionSelector
        intent="resume"
        sessions={[selected, other]}
        onSelect={onSelect}
      />,
      { stdin, stdout, stderr, debug: true, exitOnCtrlC: false, patchConsole: false }
    );
    const exit = app.waitUntilExit();
    try {
      await waitForAssertion(() =>
        expect(stdout.output).toContain('> [remote · offline · history] Remote Session')
      );
      app.rerender(
        <SessionSelector
          intent="resume"
          sessions={[other, updated]}
          onSelect={onSelect}
        />
      );
      await waitForAssertion(() =>
        expect(stdout.output).toContain(
          '> [remote · offline · history] Updated remote workspace'
        )
      );
      stdin.write('\r');
      await waitForAssertion(() => expect(onSelect).toHaveBeenCalledWith(updated));
    } finally {
      app.unmount();
      await exit;
      app.cleanup();
      stdin.end();
      stdout.end();
      stderr.end();
    }
  });

  it('locks selection synchronously while activation is pending and ignores Escape', async () => {
    const session = createSessionMetadata();
    const activation = createDeferred();
    const onSelect = vi.fn(() => activation.promise);
    const onCancel = vi.fn();
    const stdin = new TestInputStream();
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();

    vanillaStore.setState((state) => ({
      ...state,
      focus: {
        ...state.focus,
        currentFocus: FocusId.SESSION_SELECTOR,
      },
    }));

    const app = render(
      <SessionSelector
        intent="fork"
        sessions={[createLocalSurfaceSummary(session)]}
        onSelect={onSelect}
        onCancel={onCancel}
      />,
      {
        stdin,
        stdout,
        stderr,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
      }
    );
    const exitPromise = app.waitUntilExit();

    try {
      await waitForAssertion(() => {
        expect(stdout.output).toContain('选择要 fork 的会话:');
      });

      stdin.write(String.fromCharCode(13));
      await waitForAssertion(() => {
        expect(onSelect).toHaveBeenCalledOnce();
        expect(stdout.output).toContain('Forking…');
      });

      stdin.write(String.fromCharCode(13));
      stdin.write(String.fromCharCode(27));
      await waitForNextTick();

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onCancel).not.toHaveBeenCalled();
    } finally {
      activation.resolve();
      await waitForNextTick();
      app.unmount();
      await exitPromise;
      app.cleanup();
      stdin.end();
      stdout.end();
      stderr.end();
    }
  });

  it('captures synchronous selection errors and unlocks for a retry', async () => {
    const session = createSessionMetadata();
    const onSelect = vi.fn(() => {
      throw new Error('activation failed synchronously');
    });
    const stdin = new TestInputStream();
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();

    vanillaStore.setState((state) => ({
      ...state,
      focus: {
        ...state.focus,
        currentFocus: FocusId.SESSION_SELECTOR,
      },
    }));

    const app = render(
      <SessionSelector
        intent="resume"
        sessions={[createLocalSurfaceSummary(session)]}
        onSelect={onSelect}
      />,
      {
        stdin,
        stdout,
        stderr,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
      }
    );
    const exitPromise = app.waitUntilExit();

    try {
      await waitForAssertion(() => {
        expect(stdout.output).toContain('选择要恢复的会话:');
      });

      stdin.write(String.fromCharCode(13));
      await waitForAssertion(() => {
        expect(onSelect).toHaveBeenCalledTimes(1);
      });
      await waitForNextTick();

      stdin.write(String.fromCharCode(13));
      await waitForAssertion(() => {
        expect(onSelect).toHaveBeenCalledTimes(2);
      });
    } finally {
      app.unmount();
      await exitPromise;
      app.cleanup();
      stdin.end();
      stdout.end();
      stderr.end();
    }
  });

  it('renders fork-specific copy, filters subagents, and returns the full selected row', async () => {
    const ordinary = createSessionMetadata();
    const subagent = createSessionMetadata({
      sessionId: 'subagent-session-12345678',
      rootId: 'root-subagent',
      relationType: 'subagent',
      title: 'Subagent Session',
    });
    const forked = createSessionMetadata({
      sessionId: 'forked-session-abcdefgh',
      rootId: 'root-fork',
      relationType: 'fork',
      title: 'Forked Session',
      taskStatus: 'queued',
      taskIsolation: 'worktree',
      taskSourceProjectPath: getCwd(),
      taskWorktreeBranch: 'blade-worktree-task-demo',
      taskQueuePosition: 2,
      taskQueueDepth: 4,
      taskConcurrencyLimit: 3,
      taskDiffStat: {
        changedFiles: 2,
        additions: 7,
        deletions: 1,
        commits: 0,
      },
      taskDelivery: {
        status: 'applied',
        updatedAt: '2026-08-07T12:00:00.000Z',
      },
    });
    const selections: SessionSurfaceSummary[] = [];
    const stdin = new TestInputStream();
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();

    vanillaStore.setState((state) => ({
      ...state,
      focus: {
        ...state.focus,
        currentFocus: FocusId.SESSION_SELECTOR,
      },
    }));

    const app = render(
      <SessionSelector
        intent="fork"
        sessions={[ordinary, subagent, forked].map(createLocalSurfaceSummary)}
        taskAttentionUnreadKeys={[
          getTaskAttentionKey(createLocalSurfaceSummary(ordinary)),
          getTaskAttentionKey(createLocalSurfaceSummary(forked)),
        ]}
        onSelect={(session) => {
          selections.push(session);
        }}
      />,
      {
        stdin,
        stdout,
        stderr,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
      }
    );
    const exitPromise = app.waitUntilExit();

    try {
      await waitForAssertion(
        () => {
          const output = stdout.output;
          expect(output).toContain('选择要 fork 的会话:');
          expect(output).toContain('Enter to confirm');
          expect(output).toContain(workspaceLabel);
          expect(output).toContain('[DONE]');
          expect(output).toContain('[QUEUED]');
          expect(output).not.toContain('[NEW]');
          expect(output).toContain('↳ fork');
          expect(output).not.toContain('↳ subagent');
        },
        () =>
          `output=${JSON.stringify(stdout.output)} stderr=${JSON.stringify(stderr.output)}`
      );

      const outputLengthBeforeMove = stdout.output.length;
      stdin.write('\u001b[B');
      await waitForAssertion(
        () => {
          const selectedChunk = stdout.output.slice(outputLengthBeforeMove);
          expect(stdout.output.length).toBeGreaterThan(outputLengthBeforeMove);
          expect(selectedChunk).toContain('> [QUEUED]');
          expect(selectedChunk).toContain(workspaceLabel);
          expect(selectedChunk).toContain('[QUEUED]');
          expect(selectedChunk.replace(/\s+/g, ' ')).toContain(
            `${workspaceLabel} | 12 条消息 ↳ fork`
          );
        },
        () =>
          `output=${JSON.stringify(stdout.output)} stderr=${JSON.stringify(stderr.output)}`
      );

      await waitForNextTick();
      stdin.write('\r');

      await waitForAssertion(
        () => {
          expect(selections).toEqual([createLocalSurfaceSummary(forked)]);
        },
        () =>
          `output=${JSON.stringify(stdout.output)} selections=${JSON.stringify(selections)}`
      );
    } finally {
      app.unmount();
      await exitPromise;
      app.cleanup();
      stdin.end();
      stdout.end();
      stderr.end();
    }
  });

  it('routes /fork through the real command registry into selector state and selection callback wiring', async () => {
    const ordinary = createSessionMetadata();
    const subagent = createSessionMetadata({
      sessionId: 'subagent-session-12345678',
      rootId: 'root-subagent',
      relationType: 'subagent',
    });
    const forked = createSessionMetadata({
      sessionId: 'forked-session-abcdefgh',
      rootId: 'root-fork',
      relationType: 'fork',
    });
    sessionServiceMocks.listSessions.mockResolvedValue([ordinary, subagent, forked]);
    activationMocks.activateSessionSelection.mockResolvedValue({
      sessionId: 'child-session-abcdefgh',
      messages: [] as Message[],
      projectPath: getCwd(),
    });

    const appActions = getState().app.actions;
    const sessionActions = getState().session.actions;
    const cleanupAgent = vi.fn(async () => undefined);
    const routeResult = await processSlashCommand(
      createResolvedInput('/fork'),
      appActions,
      sessionActions,
      new AbortController().signal,
      cleanupAgent
    );

    expect(routeResult).toEqual({
      type: 'handled',
      commandResult: { success: true },
    });
    expect(getState().app.activeModal).toBe('sessionSelector');
    expect(getState().focus.currentFocus).toBe(FocusId.MAIN_INPUT);
    expect(getState().app.sessionSelectorData).toEqual({
      intent: 'fork',
      sessions: [ordinary, forked].map(createLocalSurfaceSummary),
    });

    const selectorState = getState().app.sessionSelectorData;
    const stdin = new TestInputStream();
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();

    if (!selectorState) {
      throw new Error('session selector state was not created');
    }

    const handleSelection = async (session: SessionSurfaceSummary) => {
      await activationMocks.activateSessionSelection(
        {
          intent: selectorState.intent,
          session: session.locator.sessionId === forked.sessionId ? forked : ordinary,
        },
        process.cwd(),
        sessionActions,
        cleanupAgent
      );
    };

    vanillaStore.setState((state) => ({
      ...state,
      focus: {
        ...state.focus,
        currentFocus: FocusId.SESSION_SELECTOR,
      },
    }));

    const app = render(
      <SessionSelector
        intent={selectorState.intent}
        sessions={selectorState.sessions}
        onSelect={(session) => {
          void handleSelection(session);
        }}
      />,
      {
        stdin,
        stdout,
        stderr,
        debug: true,
        exitOnCtrlC: false,
        patchConsole: false,
      }
    );
    const exitPromise = app.waitUntilExit();

    try {
      await waitForAssertion(
        () => {
          const output = stdout.output;
          expect(output).toContain('选择要 fork 的会话:');
          expect(output).toContain(workspaceLabel);
          expect(output).toContain('↳ fork');
        },
        () =>
          `output=${JSON.stringify(stdout.output)} stderr=${JSON.stringify(stderr.output)}`
      );

      const outputLengthBeforeMove = stdout.output.length;
      stdin.write('\u001b[B');
      await waitForAssertion(
        () => {
          const selectedChunk = stdout.output.slice(outputLengthBeforeMove);
          expect(stdout.output.length).toBeGreaterThan(outputLengthBeforeMove);
          expect(selectedChunk).toContain('> ');
          expect(selectedChunk).toContain(workspaceLabel);
          expect(selectedChunk).toContain('| 12 条消息 ↳ fork');
        },
        () =>
          `output=${JSON.stringify(stdout.output)} stderr=${JSON.stringify(stderr.output)}`
      );

      await waitForNextTick();
      stdin.write('\r');

      await waitForAssertion(
        () => {
          expect(activationMocks.activateSessionSelection).toHaveBeenCalledWith(
            { intent: 'fork', session: forked },
            process.cwd(),
            sessionActions,
            cleanupAgent
          );
        },
        () =>
          `output=${JSON.stringify(stdout.output)} calls=${JSON.stringify(
            activationMocks.activateSessionSelection.mock.calls
          )}`
      );
    } finally {
      app.unmount();
      await exitPromise;
      app.cleanup();
      stdin.end();
      stdout.end();
      stderr.end();
    }
  });

  it('routes a remote /resume id through the owned surface catalog only', async () => {
    const remote = createRemoteSurfaceSummary();
    const appActions = getState().app.actions;
    const cleanupAgent = vi.fn(async () => undefined);
    const sessionSurfaces = { list: vi.fn(async () => [remote]) };

    const routeResult = await processSlashCommand(
      createResolvedInput('/resume remote-session-12345678'),
      appActions,
      getState().session.actions,
      new AbortController().signal,
      cleanupAgent,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      getCwd(),
      undefined,
      sessionSurfaces
    );

    expect(routeResult).toEqual({
      type: 'handled',
      commandResult: { success: true },
    });
    expect(sessionSurfaces.list).toHaveBeenCalledOnce();
    expect(sessionServiceMocks.listSessions).not.toHaveBeenCalled();
    expect(getState().app.activeModal).toBe('sessionHistoryViewer');
    expect(getState().app.sessionHistoryViewerData).toEqual({
      intent: 'resume',
      session: remote,
    });
    expect(activationMocks.activateSessionSelection).not.toHaveBeenCalled();
    expect(cleanupAgent).not.toHaveBeenCalled();
  });

  it('routes a remote /fork id to a history-only fork intent', async () => {
    const remote = createRemoteSurfaceSummary();
    const appActions = getState().app.actions;
    const cleanupAgent = vi.fn(async () => undefined);
    const sessionSurfaces = { list: vi.fn(async () => [remote]) };

    const routeResult = await processSlashCommand(
      createResolvedInput('/fork remote-session-12345678'),
      appActions,
      getState().session.actions,
      new AbortController().signal,
      cleanupAgent,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      getCwd(),
      undefined,
      sessionSurfaces
    );

    expect(routeResult).toEqual({
      type: 'handled',
      commandResult: { success: true },
    });
    expect(getState().app.sessionHistoryViewerData).toEqual({
      intent: 'fork',
      session: remote,
    });
    expect(activationMocks.activateSessionSelection).not.toHaveBeenCalled();
    expect(cleanupAgent).not.toHaveBeenCalled();
  });
});
