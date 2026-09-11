// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSelectedSideQuestionPrompt,
  captureChatTextSelection,
  MAX_CHAT_SELECTION_CHARS,
} from '../../src/lib/chatSelection';

function selectText(root: HTMLElement, start: Text, end: Text): Selection {
  if (!root.isConnected) document.body.appendChild(root);
  const range = document.createRange();
  range.setStart(start, 0);
  range.setEnd(end, end.data.length);
  Object.defineProperties(range, {
    getBoundingClientRect: {
      value: () => ({
        left: 100,
        top: 40,
        right: 260,
        bottom: 72,
        width: 160,
        height: 32,
      }),
    },
    getClientRects: { value: () => [] },
  });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return selection!;
}

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('chatSelection', () => {
  it('captures text only when the selection stays inside one chat message', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <article data-chat-message-id="assistant-1" data-chat-role="assistant">
        <p>First paragraph</p><p>Second paragraph</p>
      </article>
    `;
    const paragraphs = root.querySelectorAll('p');
    const selection = selectText(
      root,
      paragraphs[0]!.firstChild as Text,
      paragraphs[1]!.firstChild as Text
    );

    expect(captureChatTextSelection(root, selection)).toMatchObject({
      messageId: 'assistant-1',
      role: 'assistant',
      text: 'First paragraphSecond paragraph',
      tooLarge: false,
    });
  });

  it('rejects selections crossing message boundaries or starting in controls', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <article data-chat-message-id="assistant-1" data-chat-role="assistant">
        <p>First</p><button type="button">Copy</button>
      </article>
      <article data-chat-message-id="assistant-2" data-chat-role="assistant">
        <p>Second</p>
      </article>
    `;
    const paragraphs = root.querySelectorAll('p');
    const crossMessage = selectText(
      root,
      paragraphs[0]!.firstChild as Text,
      paragraphs[1]!.firstChild as Text
    );
    expect(captureChatTextSelection(root, crossMessage)).toBeNull();

    const buttonText = root.querySelector('button')!.firstChild as Text;
    const controlSelection = selectText(root, buttonText, buttonText);
    expect(captureChatTextSelection(root, controlSelection)).toBeNull();
  });

  it('marks oversized selections without truncating them', () => {
    const root = document.createElement('div');
    const message = document.createElement('article');
    message.dataset.chatMessageId = 'assistant-large';
    message.dataset.chatRole = 'assistant';
    const text = document.createTextNode('x'.repeat(MAX_CHAT_SELECTION_CHARS + 1));
    message.appendChild(text);
    root.appendChild(message);
    const selection = selectText(root, text, text);

    expect(captureChatTextSelection(root, selection)).toMatchObject({
      text: 'x'.repeat(MAX_CHAT_SELECTION_CHARS + 1),
      tooLarge: true,
    });
  });

  it('escapes selected text and carries bounded side-chat history', () => {
    expect(
      buildSelectedSideQuestionPrompt('Why?', '<unsafe>&', [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
      ])
    ).toBe(
      [
        '<selected_conversation_text trust="untrusted">',
        '&lt;unsafe&gt;&amp;',
        '</selected_conversation_text>',
        '',
        '<side_conversation_history>',
        '<user>',
        'Earlier question',
        '</user>',
        '<assistant>',
        'Earlier answer',
        '</assistant>',
        '</side_conversation_history>',
        '',
        'Why?',
      ].join('\n')
    );
  });
});
