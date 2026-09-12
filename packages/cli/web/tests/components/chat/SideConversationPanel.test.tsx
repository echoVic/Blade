// @vitest-environment jsdom

import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/components/chat/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="side-markdown">{content}</div>
  ),
}));

import { SideConversationPanel } from '../../../src/components/chat/SideConversationPanel';
import { setLocale } from '../../../src/i18n';
import { useSessionStore } from '../../../src/store/session';

const actualAskSideConversation = useSessionStore.getState().askSideConversation;
const actualOpenSideConversation = useSessionStore.getState().openSideConversation;

describe('SideConversationPanel', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    setLocale('en');
    useSessionStore.setState({ sideConversation: null });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    useSessionStore.setState({
      askSideConversation: actualAskSideConversation,
      openSideConversation: actualOpenSideConversation,
      sideConversation: null,
    });
    container.remove();
  });

  it('renders and dismisses a completed side conversation', async () => {
    useSessionStore.setState({
      sideConversation: {
        requestId: 'side-1',
        sessionRef: {
          sessionId: 'session-1',
          projectPath: '/tmp/project',
        },
        question: 'What failed?',
        selectedText: 'The request stopped after the timeout.',
        status: 'completed',
        response: 'The provider timed out.',
        durationMs: 1400,
      },
    });

    await act(async () => {
      root.render(<SideConversationPanel />);
    });

    const panel = container.querySelector('[data-blade-side-conversation]');
    expect(panel?.getAttribute('data-status')).toBe('completed');
    expect(panel?.textContent).toContain('What failed?');
    expect(panel?.textContent).toContain('The request stopped after the timeout.');
    expect(panel?.textContent).toContain('The provider timed out.');
    expect(panel?.textContent).toContain('1.4s');

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Dismiss side conversation"]'
        )
        ?.click();
    });
    expect(useSessionStore.getState().sideConversation).toBeNull();
    expect(container.querySelector('[data-blade-side-conversation]')).toBeNull();
  });

  it('announces loading and error states without adding chat messages', async () => {
    const messages = useSessionStore.getState().messages;
    useSessionStore.setState({
      sideConversation: {
        requestId: 'side-2',
        sessionRef: {
          sessionId: 'session-1',
          projectPath: '/tmp/project',
        },
        question: 'Is the main task running?',
        status: 'loading',
      },
    });

    await act(async () => {
      root.render(<SideConversationPanel />);
    });
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Answering side question'
    );

    act(() => {
      useSessionStore.setState({
        sideConversation: {
          requestId: 'side-2',
          sessionRef: {
            sessionId: 'session-1',
            projectPath: '/tmp/project',
          },
          question: 'Is the main task running?',
          status: 'error',
          error: 'Provider unavailable',
        },
      });
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Provider unavailable'
    );
    expect(useSessionStore.getState().messages).toBe(messages);
  });

  it.each(
    (['native', 'legacy', 'lifecycle'] as const).flatMap((composition) =>
      ['Enter', 'Escape'].map((key) => ({ composition, key }))
    )
  )('leaves $key to the $composition input method', async ({ composition, key }) => {
    const askSideConversation = vi.fn(async () => true);
    const sideConversation = {
      requestId: 'side-ime',
      sessionRef: { sessionId: 'session-ime', projectPath: '/tmp/project' },
      question: '',
      messages: [],
      status: 'idle' as const,
    };
    useSessionStore.setState({ askSideConversation, sideConversation });
    await act(async () => root.render(<SideConversationPanel />));
    const textarea = container.querySelector('textarea');
    if (!textarea) throw new Error('Side composer missing');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      setter?.call(textarea, '解释这个错误');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      if (composition === 'lifecycle') {
        textarea.dispatchEvent(
          new CompositionEvent('compositionstart', { bubbles: true })
        );
      }
    });
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      isComposing: composition === 'native',
      keyCode: composition === 'legacy' ? 229 : 0,
    });
    await act(async () => textarea.dispatchEvent(event));
    expect(askSideConversation).not.toHaveBeenCalled();
    expect(useSessionStore.getState().sideConversation).toBe(sideConversation);
    expect(textarea.value).toBe('解释这个错误');
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(['compositionend', 'blur', 'reopen'] as const)(
    'allows a deliberate Enter after %s clears composition ownership',
    async (ending) => {
      const askSideConversation = vi.fn(async () => true);
      const sideConversation = {
        requestId: 'side-ime-end',
        sessionRef: { sessionId: 'session-ime', projectPath: '/tmp/project' },
        question: '',
        messages: [],
        status: 'idle' as const,
      };
      useSessionStore.setState({ askSideConversation, sideConversation });
      await act(async () => root.render(<SideConversationPanel />));
      const initialTextarea = container.querySelector('textarea');
      if (!initialTextarea) throw new Error('Side composer missing');
      let textarea = initialTextarea;
      await act(async () => {
        textarea.dispatchEvent(
          new CompositionEvent('compositionstart', { bubbles: true })
        );
      });
      if (ending === 'reopen') {
        await act(async () => useSessionStore.setState({ sideConversation: null }));
        await act(async () => useSessionStore.setState({ sideConversation }));
        const reopenedTextarea = container.querySelector('textarea');
        if (!reopenedTextarea) throw new Error('Reopened side composer missing');
        textarea = reopenedTextarea;
      } else {
        await act(async () => {
          textarea.dispatchEvent(
            ending === 'blur'
              ? new FocusEvent('focusout', { bubbles: true })
              : new CompositionEvent('compositionend', { bubbles: true })
          );
        });
      }
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      await act(async () => {
        setter?.call(textarea, '解释这个错误');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
      if (ending === 'compositionend') {
        await act(async () => {
          textarea.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              keyCode: 229,
              bubbles: true,
              cancelable: true,
            })
          );
        });
        expect(askSideConversation).not.toHaveBeenCalled();
      }
      await act(async () => {
        textarea.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
      });
      expect(askSideConversation).toHaveBeenCalledExactlyOnceWith('解释这个错误');
    }
  );

  it('owns a side-chat composer with native select-all and follow-up submission', async () => {
    const askSideConversation = vi.fn(async () => true);
    useSessionStore.setState({
      askSideConversation,
      sideConversation: {
        requestId: 'side-draft',
        sessionRef: {
          sessionId: 'session-1',
          projectPath: '/tmp/project',
        },
        question: '',
        selectedText: 'Selected assistant text',
        messages: [],
        status: 'idle',
      },
    });
    await act(async () => {
      root.render(<SideConversationPanel />);
    });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      setter?.call(textarea, 'Why does this matter?');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.setSelectionRange(4, 4);
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          ctrlKey: true,
          bubbles: true,
        })
      );
    });
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe('Why does this matter?'.length);

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });
    expect(askSideConversation).toHaveBeenCalledWith('Why does this matter?');
  });
});
