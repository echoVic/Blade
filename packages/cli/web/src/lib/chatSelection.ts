import {
  MAX_SELECTED_CONVERSATION_TEXT_CHARS,
  type SelectedConversationAnnotation,
} from '@api/schemas';

export const MAX_CHAT_SELECTION_CHARS = MAX_SELECTED_CONVERSATION_TEXT_CHARS;

export interface ChatSelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ChatTextSelection {
  messageId: string;
  role: 'user' | 'assistant';
  text: string;
  rect: ChatSelectionRect;
  tooLarge: boolean;
}

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, [contenteditable="true"], [data-chat-selection-exclude]';

function elementForNode(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

function messageForNode(node: Node, root: HTMLElement): HTMLElement | null {
  const element = elementForNode(node);
  const message = element?.closest<HTMLElement>('[data-chat-message-id]') ?? null;
  return message && root.contains(message) ? message : null;
}

function selectionRect(range: Range): ChatSelectionRect | null {
  const rect = range.getBoundingClientRect();
  const fallback = [...range.getClientRects()].find(
    (candidate) => candidate.width > 0 || candidate.height > 0
  );
  const resolved = rect.width > 0 || rect.height > 0 ? rect : fallback;
  if (!resolved) return null;
  return {
    left: resolved.left,
    top: resolved.top,
    right: resolved.right,
    bottom: resolved.bottom,
    width: resolved.width,
    height: resolved.height,
  };
}

export function captureChatTextSelection(
  root: HTMLElement,
  selection: Selection | null
): ChatTextSelection | null {
  if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const startMessage = messageForNode(range.startContainer, root);
  const endMessage = messageForNode(range.endContainer, root);
  if (!startMessage || startMessage !== endMessage) return null;

  const startElement = elementForNode(range.startContainer);
  const endElement = elementForNode(range.endContainer);
  if (
    startElement?.closest(INTERACTIVE_SELECTOR) ||
    endElement?.closest(INTERACTIVE_SELECTOR)
  ) {
    return null;
  }

  const role = startMessage.dataset.chatRole;
  if (role !== 'user' && role !== 'assistant') return null;
  const text = selection.toString().replaceAll('\r\n', '\n').trim();
  if (!text) return null;
  const rect = selectionRect(range);
  if (!rect) return null;

  return {
    messageId: startMessage.dataset.chatMessageId ?? '',
    role,
    text,
    rect,
    tooLarge: text.length > MAX_CHAT_SELECTION_CHARS,
  };
}

export function selectedConversationAnnotationsFromMetadata(
  metadata: Record<string, unknown> | undefined
): SelectedConversationAnnotation[] {
  const value = metadata?.selectedConversationAnnotations;
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return [];
    }
    const annotation = candidate as Partial<SelectedConversationAnnotation>;
    if (
      typeof annotation.id !== 'string' ||
      typeof annotation.text !== 'string' ||
      typeof annotation.sourceMessageId !== 'string' ||
      (annotation.sourceRole !== 'user' && annotation.sourceRole !== 'assistant') ||
      (annotation.comment !== undefined && typeof annotation.comment !== 'string')
    ) {
      return [];
    }
    return [annotation as SelectedConversationAnnotation];
  });
}

function escapeXmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function buildSelectedSideQuestionPrompt(
  question: string,
  selectedText?: string,
  history: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }> = []
): string {
  const normalizedQuestion = question.trim();
  const normalizedSelection = selectedText?.trim();
  if (!normalizedSelection && history.length === 0) return normalizedQuestion;
  return [
    ...(normalizedSelection
      ? [
          '<selected_conversation_text trust="untrusted">',
          escapeXmlText(normalizedSelection),
          '</selected_conversation_text>',
          '',
        ]
      : []),
    ...(history.length > 0
      ? [
          '<side_conversation_history>',
          ...history.flatMap((message) => [
            `<${message.role}>`,
            escapeXmlText(message.content),
            `</${message.role}>`,
          ]),
          '</side_conversation_history>',
          '',
        ]
      : []),
    normalizedQuestion,
  ].join('\n');
}
