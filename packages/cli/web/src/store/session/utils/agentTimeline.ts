import type {
  AgentResponseContent,
  AgentTimelineBlock,
  SubagentProgress,
  ToolCallInfo,
} from '../types';

export function createEmptyAgentContent(): AgentResponseContent {
  return {
    timeline: [],
    textBefore: '',
    toolCalls: [],
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

export function getSubagents(
  content: AgentResponseContent | undefined
): SubagentProgress[] {
  if (!content) return [];
  if (content.subagents && content.subagents.length > 0) {
    return content.subagents;
  }
  return content.subagent ? [content.subagent] : [];
}

export function withSubagents(
  content: AgentResponseContent,
  subagents: SubagentProgress[],
  preferredId?: string
): AgentResponseContent {
  const preferred =
    (preferredId
      ? subagents.find(
          (subagent) =>
            subagent.id === preferredId || subagent.sessionId === preferredId
        )
      : undefined) ??
    subagents[subagents.length - 1] ??
    null;
  return { ...content, subagents, subagent: preferred };
}

export function upsertSubagent(
  content: AgentResponseContent,
  next: SubagentProgress
): AgentResponseContent {
  const subagents = [...getSubagents(content)];
  let index = subagents.findIndex(
    (candidate) =>
      candidate.id === next.id ||
      Boolean(
        candidate.sessionId && next.sessionId && candidate.sessionId === next.sessionId
      )
  );
  if (index === -1 && next.sessionId) {
    index = subagents.findIndex(
      (candidate) =>
        !candidate.sessionId &&
        candidate.status === 'running' &&
        candidate.type === next.type &&
        candidate.description === next.description
    );
  }

  if (index === -1) {
    subagents.push(next);
    return withSubagents(content, subagents, next.id);
  }

  const existing = subagents[index];
  const merged = { ...existing, ...next, id: existing.id };
  subagents[index] = merged;
  return withSubagents(content, subagents, merged.id);
}

function nextBlockId(
  timeline: AgentTimelineBlock[],
  type: AgentTimelineBlock['type']
): string {
  return `${type}-${timeline.length}`;
}

export function appendTimelineText(
  content: AgentResponseContent,
  delta: string
): AgentResponseContent {
  if (!delta) return content;
  const timeline = [...getAgentTimeline(content)];
  const last = timeline[timeline.length - 1];
  if (last?.type === 'text') {
    timeline[timeline.length - 1] = { ...last, content: last.content + delta };
  } else {
    timeline.push({ id: nextBlockId(timeline, 'text'), type: 'text', content: delta });
  }
  return { ...content, timeline };
}

export function appendTimelineThinking(
  content: AgentResponseContent,
  delta: string
): AgentResponseContent {
  if (!delta) return content;
  const timeline = [...getAgentTimeline(content)];
  const last = timeline[timeline.length - 1];
  if (last?.type === 'thinking') {
    timeline[timeline.length - 1] = { ...last, content: last.content + delta };
  } else {
    timeline.push({
      id: nextBlockId(timeline, 'thinking'),
      type: 'thinking',
      content: delta,
    });
  }
  return { ...content, timeline };
}

export function appendTimelineToolCall(
  content: AgentResponseContent,
  toolCall: ToolCallInfo
): AgentResponseContent {
  const existingTool = content.toolCalls.some(
    (candidate) => candidate.toolCallId === toolCall.toolCallId
  );
  const toolCalls = existingTool ? content.toolCalls : [...content.toolCalls, toolCall];
  if (existingTool) return { ...content, toolCalls };

  const timeline = [...getAgentTimeline(content)];
  const last = timeline[timeline.length - 1];
  if (last?.type === 'tool_group') {
    timeline[timeline.length - 1] = {
      ...last,
      toolCallIds: [...last.toolCallIds, toolCall.toolCallId],
    };
  } else {
    timeline.push({
      id: nextBlockId(timeline, 'tool_group'),
      type: 'tool_group',
      toolCallIds: [toolCall.toolCallId],
    });
  }
  return { ...content, timeline, toolCalls };
}

export function getAgentTimeline(content: AgentResponseContent): AgentTimelineBlock[] {
  if (content.timeline && content.timeline.length > 0) return content.timeline;

  const timeline: AgentTimelineBlock[] = [];
  if (content.thinkingContent) {
    timeline.push({
      id: 'legacy-thinking',
      type: 'thinking',
      content: content.thinkingContent,
    });
  }
  if (content.textBefore) {
    timeline.push({
      id: 'legacy-text-before',
      type: 'text',
      content: content.textBefore,
    });
  }
  if (content.toolCalls.length > 0) {
    timeline.push({
      id: 'legacy-tool-group',
      type: 'tool_group',
      toolCallIds: content.toolCalls.map((toolCall) => toolCall.toolCallId),
    });
  }
  if (content.textAfter) {
    timeline.push({
      id: 'legacy-text-after',
      type: 'text',
      content: content.textAfter,
    });
  }
  return timeline;
}

/**
 * Project the durable arrival-order timeline into a tidier presentation without
 * mutating the stored record (which stays the single source of truth for replay
 * and tests). Two collapses happen within each phase — a phase being a run of
 * blocks bounded by assistant prose:
 *
 * 1. Tool groups separated only by thinking (think → act → think → act) merge
 *    into one group so a burst of commands reads as a single "N commands" block
 *    instead of a fragmented stack.
 * 2. Consecutive thinking blocks fold into one, so reasoning stays a single
 *    secondary entry rather than repeated collapsed headers.
 *
 * Prose text always flushes the current phase and passes through untouched,
 * preserving the real "explain → work → explain" narrative order.
 */
export function projectTimelineForDisplay(
  timeline: AgentTimelineBlock[]
): AgentTimelineBlock[] {
  if (timeline.length === 0) return timeline;

  const result: AgentTimelineBlock[] = [];
  // Indices into `result` for the block currently accumulating within a phase.
  let toolGroupIndex = -1;
  let thinkingIndex = -1;

  const resetPhase = () => {
    toolGroupIndex = -1;
    thinkingIndex = -1;
  };

  for (const block of timeline) {
    if (block.type === 'text') {
      result.push(block);
      resetPhase();
      continue;
    }

    if (block.type === 'thinking') {
      if (thinkingIndex >= 0) {
        const existing = result[thinkingIndex] as Extract<
          AgentTimelineBlock,
          { type: 'thinking' }
        >;
        result[thinkingIndex] = {
          ...existing,
          content: `${existing.content}\n\n${block.content}`,
        };
      } else {
        thinkingIndex = result.length;
        result.push(block);
      }
      continue;
    }

    // tool_group
    if (toolGroupIndex >= 0) {
      const existing = result[toolGroupIndex] as Extract<
        AgentTimelineBlock,
        { type: 'tool_group' }
      >;
      result[toolGroupIndex] = {
        ...existing,
        toolCallIds: [...existing.toolCallIds, ...block.toolCallIds],
      };
    } else {
      toolGroupIndex = result.length;
      result.push(block);
    }
  }

  return result;
}

export function getTimelineText(content: AgentResponseContent): string {
  return getAgentTimeline(content)
    .filter(
      (block): block is Extract<AgentTimelineBlock, { type: 'text' }> =>
        block.type === 'text'
    )
    .map((block) => block.content)
    .filter(Boolean)
    .join('\n\n');
}
