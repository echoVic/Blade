// @vitest-environment jsdom

import type { Key } from 'ink';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SideConversationState } from '../../../../../src/store/types.js';
import type { InputBuffer } from '../../../../../src/ui/hooks/useInputBuffer.js';
import type { TerminalInputHandler } from '../../../../../src/ui/input/TerminalInputRouter.js';

const state = vi.hoisted(() => ({
  handler: undefined as TerminalInputHandler | undefined,
  sideConversation: null as SideConversationState | null,
  completion: { hasQuery: false, suggestions: [] as string[] },
}));

vi.mock('../../../../../src/ui/input/TerminalInputRouter.js', () => ({
  useTerminalInput: (handler: TerminalInputHandler, options: { isActive: boolean }) => {
    state.handler = options.isActive ? handler : undefined;
  },
}));
vi.mock('../../../../../src/store/selectors/index.js', () => ({
  useCurrentFocus: () => 'main-input',
  useSessionActions: () => ({}),
  useAppActions: () => ({}),
  useCurrentModel: () => undefined,
  useWorkspaceRoot: () => '/workspace',
  useSideConversation: () => state.sideConversation,
}));
vi.mock('../../../../../src/slash-commands/index.js', () => ({
  getFuzzyCommandSuggestions: () => [],
}));
vi.mock('../../../../../src/ui/hooks/useAtCompletion.js', () => ({
  useAtCompletion: () => state.completion,
  applySuggestion: vi.fn(),
}));
vi.mock('../../../../../src/ui/hooks/useCtrlCHandler.js', () => ({
  useCtrlCHandler: () => vi.fn(),
}));

import { useMainInput } from '../../../../../src/ui/hooks/useMainInput.js';

const escapeKey: Key = {
  upArrow: false,
  downArrow: false,
  leftArrow: false,
  rightArrow: false,
  pageDown: false,
  pageUp: false,
  return: false,
  escape: true,
  ctrl: false,
  shift: false,
  tab: false,
  backspace: false,
  delete: false,
  meta: false,
};

const buffer: InputBuffer = {
  value: '',
  cursorPosition: 0,
  setValue: vi.fn(),
  setCursorPosition: vi.fn(),
  clear: vi.fn(),
  pasteMap: new Map(),
  addPasteMapping: () => 1,
  addImagePasteMapping: () => 1,
  restorePasteMappings: vi.fn(),
  resolveInput: (text) => ({ displayText: text, text, images: [], parts: [] }),
};

function Harness({
  processing,
  onAbort,
}: {
  processing: boolean;
  onAbort: () => void;
}) {
  useMainInput(
    buffer,
    vi.fn(),
    () => null,
    () => null,
    vi.fn(),
    onAbort,
    processing
  );
  return null;
}

function loadingSide(requestId: string): SideConversationState {
  return { requestId, question: 'Explain this task', status: 'loading' };
}

describe('useMainInput cancellation ownership', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onAbort: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    state.handler = undefined;
    state.sideConversation = null;
    onAbort = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function render(processing = true): Promise<void> {
    await act(async () =>
      root.render(<Harness processing={processing} onAbort={onAbort} />)
    );
  }

  function pressEscape(): void {
    act(() => {
      state.handler?.('', escapeKey);
    });
  }

  it('allows Escape to stop the main turn after dismissing its side question', async () => {
    state.sideConversation = loadingSide('side-1');
    await render();
    pressEscape();
    expect(onAbort).toHaveBeenCalledTimes(1);
    state.sideConversation = null;
    await render();
    pressEscape();
    expect(onAbort).toHaveBeenCalledTimes(2);
  });

  it('allows Escape for a replacement side question while the main turn stays busy', async () => {
    state.sideConversation = loadingSide('side-1');
    await render();
    pressEscape();
    state.sideConversation = loadingSide('side-2');
    await render();
    pressEscape();
    expect(onAbort).toHaveBeenCalledTimes(2);
  });

  it('allows Escape for the main turn when a side request settles without disappearing', async () => {
    state.sideConversation = loadingSide('side-1');
    await render();
    pressEscape();
    state.sideConversation = {
      ...loadingSide('side-1'),
      status: 'completed',
      response: 'Done',
    };
    await render();
    pressEscape();
    expect(onAbort).toHaveBeenCalledTimes(2);
  });

  it('deduplicates repeated Escape for the same side request across rerenders', async () => {
    state.sideConversation = loadingSide('side-1');
    await render();
    pressEscape();
    state.sideConversation = { ...loadingSide('side-1') };
    await render();
    pressEscape();
    pressEscape();
    expect(onAbort).toHaveBeenCalledOnce();
  });

  it('deduplicates the main turn and rearms when a new busy period begins', async () => {
    await render();
    pressEscape();
    await render();
    pressEscape();
    expect(onAbort).toHaveBeenCalledOnce();
    await render(false);
    pressEscape();
    expect(onAbort).toHaveBeenCalledOnce();
    await render();
    pressEscape();
    expect(onAbort).toHaveBeenCalledTimes(2);
  });
});
