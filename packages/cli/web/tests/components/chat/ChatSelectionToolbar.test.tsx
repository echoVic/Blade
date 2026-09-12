// @vitest-environment jsdom

import { act, type ComponentProps, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSelectionToolbar } from '../../../src/components/chat/ChatSelectionToolbar';
import { setLocale } from '../../../src/i18n';
import { clearComposerDraft, readComposerDraft } from '../../../src/lib/composerDraft';

const DRAFT_KEY = 'session:["/workspace/selection","session-1"]';

function Fixture({
  onOpenSideConversation,
  canAskSideConversation = true,
}: {
  onOpenSideConversation: (selectedText: string) => boolean;
  canAskSideConversation?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={rootRef}>
        <article data-chat-message-id="assistant-1" data-chat-role="assistant">
          <p data-selection-text>Selected response text</p>
        </article>
      </div>
      <ChatSelectionToolbar
        rootRef={rootRef}
        draftKey={DRAFT_KEY}
        canAskSideConversation={canAskSideConversation}
        onOpenSideConversation={onOpenSideConversation}
      />
    </>
  );
}

function selectFixtureText(container: HTMLElement): void {
  const text = container.querySelector('[data-selection-text]')?.firstChild as Text;
  const range = document.createRange();
  range.selectNodeContents(text);
  Object.defineProperties(range, {
    getBoundingClientRect: {
      value: () => ({
        left: 100,
        top: 40,
        right: 280,
        bottom: 64,
        width: 180,
        height: 24,
      }),
    },
    getClientRects: { value: () => [] },
  });
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
    textarea,
    value
  );
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

async function renderSelectedFixture(
  root: ReactDOM.Root,
  container: HTMLElement,
  props: ComponentProps<typeof Fixture>
): Promise<void> {
  await act(async () => {
    root.render(<Fixture {...props} />);
  });
  await act(async () => {
    selectFixtureText(container);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

describe('ChatSelectionToolbar', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    setLocale('en');
    clearComposerDraft(DRAFT_KEY);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    clearComposerDraft(DRAFT_KEY);
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
  });

  it('adds selected text to the active composer as a quote', async () => {
    await renderSelectedFixture(root, container, {
      onOpenSideConversation: vi.fn(() => true),
    });

    const toolbar = document.querySelector('[data-chat-selection-overlay]');
    expect(toolbar?.getAttribute('style')).toContain('visibility: visible');
    const addButton = Array.from(toolbar?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.includes('Add to chat')
    );
    await act(async () => addButton?.click());

    expect(readComposerDraft(DRAFT_KEY)).toMatchObject({
      content: '',
      annotations: [
        {
          text: 'Selected response text',
          sourceMessageId: 'assistant-1',
          sourceRole: 'assistant',
        },
      ],
    });
    expect(document.querySelector('[data-chat-selection-overlay]')).toBeNull();
  });

  it('opens the comment editor with Mod+J and appends the comment', async () => {
    await renderSelectedFixture(root, container, {
      onOpenSideConversation: vi.fn(() => true),
    });

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true })
      );
    });
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea?.placeholder).toContain('optional comment');
    await act(async () => {
      setTextareaValue(textarea, 'Challenge this claim');
      textarea.setSelectionRange(5, 5);
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          ctrlKey: true,
          bubbles: true,
        })
      );
    });
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe('Challenge this claim'.length);

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });

    expect(readComposerDraft(DRAFT_KEY).annotations).toEqual([
      expect.objectContaining({
        text: 'Selected response text',
        comment: 'Challenge this claim',
      }),
    ]);
  });

  it.each(
    (['native', 'legacy', 'lifecycle'] as const).flatMap((composition) =>
      ['Enter', 'Escape'].map((key) => ({ composition, key }))
    )
  )(
    'keeps the annotation editor during IME $composition $key',
    async ({ composition, key }) => {
      await renderSelectedFixture(root, container, {
        onOpenSideConversation: vi.fn(() => true),
      });
      await act(async () => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true })
        );
      });
      const textarea = document.querySelector('textarea');
      if (!textarea) throw new Error('Annotation editor missing');
      await act(async () => {
        setTextareaValue(textarea, '请解释这里');
        if (composition === 'lifecycle')
          textarea.dispatchEvent(
            new CompositionEvent('compositionstart', { bubbles: true })
          );
      });
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        isComposing: composition === 'native',
        keyCode: composition === 'legacy' ? 229 : 0,
      });
      await act(async () => {
        textarea.dispatchEvent(event);
      });
      expect(document.querySelector('textarea')).toBe(textarea);
      expect(textarea.value).toBe('请解释这里');
      expect(readComposerDraft(DRAFT_KEY).annotations ?? []).toEqual([]);
      expect(event.defaultPrevented).toBe(false);
    }
  );

  it.each(['compositionend', 'blur', 'reopen', 'outside-click'] as const)(
    'permits deliberate annotation submission after %s',
    async (ending) => {
      const props = { onOpenSideConversation: vi.fn(() => true) };
      await renderSelectedFixture(root, container, props);
      const openEditor = async () => {
        await act(async () => {
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true })
          );
        });
        const textarea = document.querySelector('textarea');
        if (!textarea) throw new Error('Annotation editor missing');
        return textarea;
      };
      let textarea = await openEditor();
      await act(async () => {
        textarea.dispatchEvent(
          new CompositionEvent('compositionstart', { bubbles: true })
        );
      });
      if (ending === 'reopen' || ending === 'outside-click') {
        await act(async () => {
          container.dispatchEvent(
            new Event(ending === 'reopen' ? 'scroll' : 'pointerdown', { bubbles: true })
          );
        });
        await renderSelectedFixture(root, container, props);
        textarea = await openEditor();
      } else {
        await act(async () => {
          textarea.dispatchEvent(
            ending === 'blur'
              ? new FocusEvent('focusout', { bubbles: true })
              : new CompositionEvent('compositionend', { bubbles: true })
          );
        });
      }
      await act(async () => {
        setTextareaValue(textarea, '请解释这里');
      });
      if (ending === 'compositionend') {
        await act(async () => {
          textarea.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true })
          );
        });
        expect(document.querySelector('textarea')).toBe(textarea);
      }
      await act(async () => {
        textarea.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true })
        );
      });
      expect(readComposerDraft(DRAFT_KEY).annotations ?? []).toEqual([]);
      await act(async () => {
        textarea.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
      });
      expect(readComposerDraft(DRAFT_KEY).annotations).toEqual([
        expect.objectContaining({
          text: 'Selected response text',
          comment: '请解释这里',
        }),
      ]);
    }
  );

  it('opens a side conversation with the selected text', async () => {
    const onOpenSideConversation = vi.fn(() => true);
    await renderSelectedFixture(root, container, {
      onOpenSideConversation,
    });

    const askButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Ask in side conversation')
    );
    await act(async () => askButton?.click());

    expect(onOpenSideConversation).toHaveBeenCalledWith('Selected response text');
    expect(readComposerDraft(DRAFT_KEY).content).toBe('');
  });

  it('disables side questions when no durable session is available', async () => {
    await renderSelectedFixture(root, container, {
      canAskSideConversation: false,
      onOpenSideConversation: vi.fn(() => true),
    });

    const askButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Ask in side conversation')
    );
    expect(askButton?.disabled).toBe(true);
    expect(askButton?.title).toBe('Start or select a session first.');
  });

  it('dismisses the overlay when the conversation scrolls', async () => {
    await renderSelectedFixture(root, container, {
      onOpenSideConversation: vi.fn(() => true),
    });
    expect(document.querySelector('[data-chat-selection-overlay]')).toBeTruthy();

    await act(async () => {
      container.dispatchEvent(new Event('scroll'));
    });

    expect(document.querySelector('[data-chat-selection-overlay]')).toBeNull();
  });
});
