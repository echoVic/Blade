import { describe, expect, it } from 'vitest';
import type {
  AgentResponseContent,
  Message,
  ToolCallInfo,
} from '@/store/session/types';
import {
  getAgentTimeline,
  projectTimelineForDisplay,
} from '@/store/session/utils/agentTimeline';
import { projectMessagesForDisplay } from '@/store/session/utils/displayMessages';

function tool(id: string): ToolCallInfo {
  return {
    toolCallId: id,
    toolName: 'Bash',
    status: 'running',
    startTime: 1,
  };
}

function agent(
  timeline: AgentResponseContent['timeline'],
  toolIds: string[]
): AgentResponseContent {
  return {
    timeline,
    textBefore: '',
    toolCalls: toolIds.map(tool),
    textAfter: '',
    thinkingContent: '',
    tasks: [],
    subagent: null,
    subagents: [],
    confirmation: null,
    question: null,
    elicitation: null,
  };
}

function assistant(id: string, content: AgentResponseContent): Message {
  return {
    id,
    role: 'assistant',
    content: '',
    timestamp: 1,
    agentContent: content,
  };
}

describe('projectMessagesForDisplay', () => {
  it('folds model-loop assistant records before timeline projection', () => {
    const projected = projectMessagesForDisplay([
      {
        id: 'user-1',
        role: 'user',
        content: 'Inspect the model constants',
        timestamp: 0,
      },
      assistant(
        'assistant-1',
        agent(
          [
            {
              id: 'text-0',
              type: 'text',
              content: 'The second search missed, checking again.',
            },
            {
              id: 'tool-group-1',
              type: 'tool_group',
              toolCallIds: ['bash-1', 'bash-2', 'bash-3', 'bash-4'],
            },
            { id: 'thinking-2', type: 'thinking', content: 'inspect' },
          ],
          ['bash-1', 'bash-2', 'bash-3', 'bash-4']
        )
      ),
      assistant(
        'assistant-2',
        agent(
          [
            {
              id: 'tool-group-0',
              type: 'tool_group',
              toolCallIds: ['bash-5', 'bash-6'],
            },
          ],
          ['bash-5', 'bash-6']
        )
      ),
      assistant(
        'assistant-3',
        agent(
          [
            {
              id: 'tool-group-0',
              type: 'tool_group',
              toolCallIds: ['bash-7', 'bash-8'],
            },
            { id: 'thinking-1', type: 'thinking', content: 'verify' },
          ],
          ['bash-7', 'bash-8']
        )
      ),
    ]);

    expect(projected).toHaveLength(2);
    const merged = projected[1];
    expect(merged.id).toBe('assistant-1');
    expect(merged.displaySourceMessageIds).toEqual([
      'assistant-1',
      'assistant-2',
      'assistant-3',
    ]);
    expect(merged.agentContent?.toolCalls).toHaveLength(8);
    expect(
      projectTimelineForDisplay(
        getAgentTimeline(merged.agentContent as AgentResponseContent)
      )
    ).toEqual([
      expect.objectContaining({
        type: 'text',
        content: 'The second search missed, checking again.',
      }),
      expect.objectContaining({
        type: 'tool_group',
        toolCallIds: [
          'bash-1',
          'bash-2',
          'bash-3',
          'bash-4',
          'bash-5',
          'bash-6',
          'bash-7',
          'bash-8',
        ],
      }),
      expect.objectContaining({
        type: 'thinking',
        content: 'inspect\n\nverify',
      }),
    ]);
  });

  it('keeps user turns and interactive assistant records as boundaries', () => {
    const timelineAssistant = assistant(
      'assistant-timeline',
      agent(
        [
          {
            id: 'tool-group-0',
            type: 'tool_group',
            toolCallIds: ['bash-1'],
          },
        ],
        ['bash-1']
      )
    );
    const interactiveAssistant = assistant('assistant-question', {
      ...agent([], []),
      question: {
        toolCallId: 'question-1',
        questions: [],
        status: 'pending',
      },
    });

    const projected = projectMessagesForDisplay([
      timelineAssistant,
      interactiveAssistant,
      {
        id: 'user-2',
        role: 'user',
        content: 'Continue',
        timestamp: 2,
      },
      assistant(
        'assistant-next',
        agent(
          [
            {
              id: 'tool-group-0',
              type: 'tool_group',
              toolCallIds: ['bash-2'],
            },
          ],
          ['bash-2']
        )
      ),
    ]);

    expect(projected.map((message) => message.id)).toEqual([
      'assistant-timeline',
      'assistant-question',
      'user-2',
      'assistant-next',
    ]);
  });
});
