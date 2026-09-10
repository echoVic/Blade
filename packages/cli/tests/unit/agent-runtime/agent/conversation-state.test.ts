import { describe, expect, it } from 'vitest';
import { ConversationState } from '../../../../src/agent/loop/ConversationState.js';
import type { ChatContext } from '../../../../src/agent/types.js';
import { PermissionMode } from '../../../../src/config/types.js';
import { isClientVisibleMessage } from '../../../../src/services/clientMessageVisibility.js';

function context(): ChatContext {
  return {
    messages: [{ role: 'user', content: 'initial' }],
    userId: 'user-1',
    sessionId: 'session-1',
    workspaceRoot: '/workspace',
    permissionMode: PermissionMode.DEFAULT,
  };
}

describe('ConversationState context revision', () => {
  it('keeps control metadata model-visible without hiding matching user text', () => {
    const chatContext = context();
    const state = new ConversationState(chatContext, 'system');
    const content = 'Please continue the conversation.';
    state.appendUser({ role: 'user', content });
    state.appendControl('user', {
      role: 'user',
      content,
      metadata: { mcpTaskId: 'task-1', mcpTaskRevision: 2 },
    });
    state.writeback();
    expect(
      state.toLLMMessages().filter((message) => message.content === content)
    ).toHaveLength(2);
    expect(chatContext.messages.at(-1)?.metadata).toEqual({
      mcpTaskId: 'task-1',
      mcpTaskRevision: 2,
      clientVisible: false,
    });
    expect(
      chatContext.messages
        .filter(isClientVisibleMessage)
        .map((message) => message.content)
    ).toEqual(['initial', content]);
  });

  it('keeps append-only commits on the same context revision', () => {
    const state = new ConversationState(context(), 'system');

    state.appendAssistant({ role: 'assistant', content: 'response' });
    state.appendToolResult({
      role: 'tool',
      tool_call_id: 'call-1',
      content: 'result',
    });
    state.writeback();

    expect(state.contextRevision).toBe(0);
    expect(state.historyLength).toBe(3);
  });

  it('increments the revision for history replacement and durable restore', () => {
    const state = new ConversationState(context(), 'system');

    state.replaceHistory([{ role: 'user', content: 'replacement' }]);
    expect(state.contextRevision).toBe(1);

    state.restoreDurableHistory([{ role: 'user', content: 'restored' }]);
    expect(state.contextRevision).toBe(2);
  });

  it('keeps additive contextual instructions on the same revision', () => {
    const state = new ConversationState(context(), 'system');

    state.removeMessages(() => false);
    expect(state.contextRevision).toBe(0);

    state.appendContextualProjectInstructions({
      role: 'system',
      content: 'rule',
      metadata: { contextualProjectRules: true },
    });
    expect(state.contextRevision).toBe(0);

    state.removeMessages(
      (message) => typeof message.content === 'string' && message.content === 'initial'
    );
    expect(state.contextRevision).toBe(1);
  });
});
