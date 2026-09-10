import { describe, expect, it } from 'vitest';
import type { AgentTimelineBlock } from '@/store/session/types';
import {
  appendTimelineText,
  appendTimelineThinking,
  appendTimelineToolCall,
  createEmptyAgentContent,
  getAgentTimeline,
  projectTimelineForDisplay,
} from '@/store/session/utils/agentTimeline';

describe('agentTimeline', () => {
  it('preserves interleaved thinking, prose, and tool groups', () => {
    let content = createEmptyAgentContent();
    content = appendTimelineThinking(content, 'inspect');
    content = appendTimelineText(content, 'first explanation');
    content = appendTimelineToolCall(content, {
      toolCallId: 'read-1',
      toolName: 'Read',
      status: 'success',
      startTime: 1,
    });
    content = appendTimelineToolCall(content, {
      toolCallId: 'read-2',
      toolName: 'Read',
      status: 'success',
      startTime: 2,
    });
    content = appendTimelineText(content, 'second explanation');
    content = appendTimelineToolCall(content, {
      toolCallId: 'bash-1',
      toolName: 'Bash',
      status: 'running',
      startTime: 3,
    });

    expect(getAgentTimeline(content)).toEqual([
      expect.objectContaining({ type: 'thinking', content: 'inspect' }),
      expect.objectContaining({ type: 'text', content: 'first explanation' }),
      expect.objectContaining({
        type: 'tool_group',
        toolCallIds: ['read-1', 'read-2'],
      }),
      expect.objectContaining({ type: 'text', content: 'second explanation' }),
      expect.objectContaining({ type: 'tool_group', toolCallIds: ['bash-1'] }),
    ]);
  });

  it('derives an ordered fallback for legacy agent content', () => {
    expect(
      getAgentTimeline({
        textBefore: 'before',
        toolCalls: [
          {
            toolCallId: 'legacy-tool',
            toolName: 'Read',
            status: 'success',
            startTime: 1,
          },
        ],
        textAfter: 'after',
        thinkingContent: 'thinking',
        tasks: [],
        subagent: null,
        confirmation: null,
        question: null,
      }).map((block) => block.type)
    ).toEqual(['thinking', 'text', 'tool_group', 'text']);
  });
});

describe('projectTimelineForDisplay', () => {
  it('merges tool groups separated only by thinking into one group', () => {
    const timeline: AgentTimelineBlock[] = [
      { id: 'thinking-0', type: 'thinking', content: 'plan a' },
      { id: 'tool_group-1', type: 'tool_group', toolCallIds: ['read-1'] },
      { id: 'thinking-2', type: 'thinking', content: 'plan b' },
      { id: 'tool_group-3', type: 'tool_group', toolCallIds: ['read-2', 'read-3'] },
      { id: 'thinking-4', type: 'thinking', content: 'plan c' },
      { id: 'tool_group-5', type: 'tool_group', toolCallIds: ['bash-1'] },
    ];

    expect(projectTimelineForDisplay(timeline)).toEqual([
      expect.objectContaining({
        type: 'thinking',
        content: 'plan a\n\nplan b\n\nplan c',
      }),
      expect.objectContaining({
        type: 'tool_group',
        toolCallIds: ['read-1', 'read-2', 'read-3', 'bash-1'],
      }),
    ]);
  });

  it('keeps prose as a phase boundary and preserves narrative order', () => {
    const timeline: AgentTimelineBlock[] = [
      { id: 'thinking-0', type: 'thinking', content: 'inspect' },
      { id: 'tool_group-1', type: 'tool_group', toolCallIds: ['read-1'] },
      { id: 'text-2', type: 'text', content: 'here is what I found' },
      { id: 'thinking-3', type: 'thinking', content: 'now fix' },
      { id: 'tool_group-4', type: 'tool_group', toolCallIds: ['edit-1'] },
    ];

    expect(projectTimelineForDisplay(timeline).map((block) => block.type)).toEqual([
      'thinking',
      'tool_group',
      'text',
      'thinking',
      'tool_group',
    ]);
  });

  it('does not merge tool groups split by prose', () => {
    const timeline: AgentTimelineBlock[] = [
      { id: 'tool_group-0', type: 'tool_group', toolCallIds: ['read-1'] },
      { id: 'text-1', type: 'text', content: 'explanation' },
      { id: 'tool_group-2', type: 'tool_group', toolCallIds: ['bash-1'] },
    ];

    expect(projectTimelineForDisplay(timeline)).toEqual([
      expect.objectContaining({ type: 'tool_group', toolCallIds: ['read-1'] }),
      expect.objectContaining({ type: 'text', content: 'explanation' }),
      expect.objectContaining({ type: 'tool_group', toolCallIds: ['bash-1'] }),
    ]);
  });

  it('returns the input unchanged when there is nothing to collapse', () => {
    expect(projectTimelineForDisplay([])).toEqual([]);
    const single: AgentTimelineBlock[] = [
      { id: 'text-0', type: 'text', content: 'only prose' },
    ];
    expect(projectTimelineForDisplay(single)).toEqual(single);
  });
});
