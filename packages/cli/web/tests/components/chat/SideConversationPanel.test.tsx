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
import { sessionService } from '../../../src/services/sessionService';
import { useSessionStore } from '../../../src/store/session';

const actualAskSideConversation = useSessionStore.getState().askSideConversation;
const actualOpenSideConversation = useSessionStore.getState().openSideConversation;

describe('SideConversationPanel', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  let previousStore: ReturnType<typeof useSessionStore.getState>;

  beforeEach(() => {
    previousStore = useSessionStore.getState();
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
    useSessionStore.setState(previousStore, true);
    vi.restoreAllMocks();
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

  it.each(['reopen', 'replacement', 'session', 'workspace', 'same-tick'] as const)(
    'does not carry an unsent draft across %s',
    async (transition) => {
      if (transition === 'same-tick') vi.spyOn(Date, 'now').mockReturnValue(1234);
      const ref = { sessionId: 'draft-owner', projectPath: '/tmp/draft-owner' };
      useSessionStore.setState({
        currentSessionRef: ref,
        currentSessionId: ref.sessionId,
        isTemporarySession: false,
      });
      expect(useSessionStore.getState().openSideConversation('Original context')).toBe(
        true
      );
      await act(async () => root.render(<SideConversationPanel />));
      const textarea = container.querySelector('textarea');
      if (!textarea) throw new Error('Draft composer missing');
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value'
        )?.set?.call(textarea, 'Old workspace draft');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
      if (transition === 'reopen') {
        await act(async () => useSessionStore.getState().dismissSideConversation());
      }
      await act(async () => {
        if (transition === 'session' || transition === 'workspace') {
          const next =
            transition === 'session'
              ? { ...ref, sessionId: 'other-session' }
              : { ...ref, projectPath: '/tmp/other-workspace' };
          useSessionStore.setState({
            currentSessionRef: next,
            currentSessionId: next.sessionId,
          });
        }
        useSessionStore.getState().openSideConversation('Replacement context');
      });
      expect(container.querySelector('textarea')?.value).toBe('');
      expect(container.textContent).toContain('Replacement context');
    }
  );

  it.each([
    'reopen',
    'new-button',
    'selection',
    'session',
    'workspace',
    'dismissed',
  ] as const)('does not restore a late failed draft into %s', async (transition) => {
    let rejectRequest!: (error: Error) => void;
    const response = new Promise<
      Awaited<ReturnType<typeof sessionService.askSideQuestion>>
    >((_resolve, reject) => {
      rejectRequest = reject;
    });
    const ask = vi
      .spyOn(sessionService, 'askSideQuestion')
      .mockReturnValueOnce(response);
    const ref = { sessionId: 'request-owner', projectPath: '/tmp/request-owner' };
    useSessionStore.setState({
      currentSessionRef: ref,
      currentSessionId: ref.sessionId,
      isTemporarySession: false,
    });
    useSessionStore.getState().openSideConversation();
    await act(async () => root.render(<SideConversationPanel />));
    const textarea = container.querySelector('textarea');
    if (!textarea) throw new Error('Request composer missing');
    const setValue = (input: HTMLTextAreaElement, value: string) => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    await act(async () => {
      setValue(textarea, 'Old pending question');
    });
    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
      );
    });
    expect(ask).toHaveBeenCalledOnce();
    expect(useSessionStore.getState().sideConversation?.status).toBe('loading');
    await act(async () => {
      if (transition === 'new-button') {
        container
          .querySelector<HTMLButtonElement>(
            'button[aria-label="New side conversation"]'
          )
          ?.click();
      } else {
        if (transition === 'reopen' || transition === 'dismissed')
          useSessionStore.getState().dismissSideConversation();
        if (transition === 'session' || transition === 'workspace') {
          const next =
            transition === 'session'
              ? { ...ref, sessionId: 'new-session' }
              : { ...ref, projectPath: '/tmp/new-workspace' };
          useSessionStore.setState({
            currentSessionRef: next,
            currentSessionId: next.sessionId,
          });
        }
        if (transition !== 'dismissed')
          useSessionStore.getState().openSideConversation('New context');
      }
    });
    if (transition !== 'dismissed') {
      const input = container.querySelector('textarea');
      if (!input) throw new Error('Replacement composer missing');
      await act(async () => {
        setValue(input, 'New unsent question');
      });
    }
    await act(async () => {
      rejectRequest(new Error('Late request failure'));
      await response.catch(() => undefined);
    });
    if (transition === 'dismissed') {
      expect(container.querySelector('textarea')).toBeNull();
      await act(async () => {
        useSessionStore.getState().openSideConversation();
      });
      expect(container.querySelector('textarea')?.value).toBe('');
    } else {
      expect(container.querySelector('textarea')?.value).toBe('New unsent question');
      expect(useSessionStore.getState().sideConversation?.status).toBe('idle');
    }
    expect(container.textContent).not.toContain('Late request failure');
  });

  it.each(['rejected', 'validation', 'accepted'] as const)(
    'keeps same-panel draft semantics when a request is %s',
    async (outcome) => {
      const ref = { sessionId: 'same-owner', projectPath: '/tmp/same-owner' };
      useSessionStore.setState({
        currentSessionRef: ref,
        currentSessionId: ref.sessionId,
        isTemporarySession: false,
      });
      useSessionStore.getState().openSideConversation();
      const ask = vi.spyOn(sessionService, 'askSideQuestion');
      if (outcome === 'accepted')
        ask.mockResolvedValueOnce({
          response: 'ANSWER',
          durationMs: 1,
          modelId: 'test-model',
        });
      else ask.mockRejectedValueOnce(new Error('Current request failure'));
      const question =
        outcome === 'validation' ? 'x'.repeat(40_000) : 'Current question';
      await act(async () => root.render(<SideConversationPanel />));
      const input = container.querySelector('textarea');
      if (!input) throw new Error('Same-panel composer missing');
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value'
        )?.set?.call(input, question);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await act(async () => {
        input.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
      });
      expect(container.querySelector('textarea')?.value).toBe(
        outcome === 'accepted' ? '' : question
      );
      if (outcome === 'validation') expect(ask).not.toHaveBeenCalled();
      if (outcome === 'accepted') expect(container.textContent).toContain('ANSWER');
      if (outcome === 'rejected')
        expect(container.querySelector('[role="alert"]')?.textContent).toContain(
          'Current request failure'
        );
    }
  );

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
