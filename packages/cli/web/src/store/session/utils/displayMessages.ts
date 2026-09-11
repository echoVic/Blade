import type {
  AgentResponseContent,
  AgentTimelineBlock,
  Message,
  ToolCallInfo,
} from '../types';
import { getAgentTimeline, getSubagents } from './agentTimeline';

function hasSpecialProjection(message: Message): boolean {
  return Boolean(message.metadata?.codeReview || message.metadata?.structuredOutput);
}

function isTimelineOnlyAssistant(message: Message): boolean {
  const agent = message.agentContent;
  return Boolean(
    message.role === 'assistant' &&
      agent &&
      !hasSpecialProjection(message) &&
      agent.tasks.length === 0 &&
      getSubagents(agent).length === 0 &&
      !agent.confirmation &&
      !agent.question &&
      !agent.elicitation
  );
}

function scopeTimeline(
  messageId: string,
  timeline: AgentTimelineBlock[]
): AgentTimelineBlock[] {
  return timeline.map((block, index) => ({
    ...block,
    id: `${messageId}:${index}:${block.id}`,
  }));
}

function prepareTimelineAssistant(message: Message): Message {
  if (!isTimelineOnlyAssistant(message) || !message.agentContent) return message;
  return {
    ...message,
    displaySourceMessageIds: [message.id],
    agentContent: {
      ...message.agentContent,
      timeline: scopeTimeline(message.id, getAgentTimeline(message.agentContent)),
    },
  };
}

function mergeToolCalls(left: ToolCallInfo[], right: ToolCallInfo[]): ToolCallInfo[] {
  const result = left.map((tool) => ({ ...tool }));
  const indexById = new Map(result.map((tool, index) => [tool.toolCallId, index]));
  for (const tool of right) {
    const existingIndex = indexById.get(tool.toolCallId);
    if (existingIndex === undefined) {
      indexById.set(tool.toolCallId, result.length);
      result.push({ ...tool });
    } else {
      result[existingIndex] = { ...result[existingIndex], ...tool };
    }
  }
  return result;
}

function joinLegacyText(left: string, right: string): string {
  return [left, right].filter(Boolean).join('\n\n');
}

function mergeTimelineAssistants(left: Message, right: Message): Message {
  const leftAgent = left.agentContent as AgentResponseContent;
  const rightAgent = right.agentContent as AgentResponseContent;
  return {
    ...left,
    ...(left.metadata || right.metadata
      ? { metadata: { ...left.metadata, ...right.metadata } }
      : {}),
    displaySourceMessageIds: [
      ...(left.displaySourceMessageIds ?? [left.id]),
      ...(right.displaySourceMessageIds ?? [right.id]),
    ],
    agentContent: {
      ...leftAgent,
      timeline: [...getAgentTimeline(leftAgent), ...getAgentTimeline(rightAgent)],
      textBefore: joinLegacyText(leftAgent.textBefore, rightAgent.textBefore),
      toolCalls: mergeToolCalls(leftAgent.toolCalls, rightAgent.toolCalls),
      textAfter: joinLegacyText(leftAgent.textAfter, rightAgent.textAfter),
      thinkingContent: joinLegacyText(
        leftAgent.thinkingContent,
        rightAgent.thinkingContent
      ),
      tasks: [],
      subagent: null,
      subagents: [],
      confirmation: null,
      question: null,
      elicitation: null,
    },
  };
}

/**
 * Fold model-loop assistant records into one visual response per user turn.
 * Durable messages remain unchanged; interactive assistant records keep their
 * own identity because permission and question replies target that message.
 */
export function projectMessagesForDisplay(messages: Message[]): Message[] {
  const result: Message[] = [];

  for (const message of messages) {
    const prepared = prepareTimelineAssistant(message);
    const previous = result[result.length - 1];
    if (
      previous &&
      isTimelineOnlyAssistant(previous) &&
      isTimelineOnlyAssistant(prepared)
    ) {
      result[result.length - 1] = mergeTimelineAssistants(previous, prepared);
    } else {
      result.push(prepared);
    }
  }

  return result;
}
