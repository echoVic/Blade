import {
  AlertCircle,
  Clock3,
  Loader2,
  MessageCircleQuestion,
  Plus,
  Send,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useT } from '@/i18n';
import { useSessionStore } from '@/store/session';
import type {
  SideConversationMessage,
  SideConversationState,
} from '@/store/session/types';

const MarkdownRenderer = lazy(() =>
  import('./MarkdownRenderer').then((module) => ({
    default: module.MarkdownRenderer,
  }))
);

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function legacyMessages(
  question: string,
  response: string | undefined
): SideConversationMessage[] {
  if (!question) return [];
  return [
    { id: 'legacy-user', role: 'user', content: question },
    ...(response
      ? [{ id: 'legacy-assistant', role: 'assistant' as const, content: response }]
      : []),
  ];
}

function sideDraftOwner(side: SideConversationState | null): string | null {
  return side
    ? JSON.stringify([
        side.sessionRef.projectPath,
        side.sessionRef.sessionId,
        side.requestId,
      ])
    : null;
}

export function SideConversationPanel() {
  const t = useT();
  const sideConversation = useSessionStore((state) => state.sideConversation);
  const ask = useSessionStore((state) => state.askSideConversation);
  const startNew = useSessionStore((state) => state.openSideConversation);
  const dismiss = useSessionStore((state) => state.dismissSideConversation);
  const owner = sideDraftOwner(sideConversation);
  const [draftState, setDraftState] = useState({ owner, text: '' });
  const draft = draftState.owner === owner ? draftState.text : '';
  if (draftState.owner !== owner) setDraftState({ owner, text: '' });
  const setDraft = (text: string) => setDraftState({ owner, text });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messages = useMemo(
    () =>
      sideConversation?.messages ??
      legacyMessages(sideConversation?.question ?? '', sideConversation?.response),
    [sideConversation?.messages, sideConversation?.question, sideConversation?.response]
  );

  useEffect(() => {
    composingRef.current = false;
    if (!sideConversation || sideConversation.status === 'loading') return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [
    sideConversation?.sessionRef,
    sideConversation?.selectedText,
    sideConversation?.status,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages.length, sideConversation?.status]);

  if (!sideConversation) return null;

  const submit = () => {
    const question = draft.trim();
    if (!question || sideConversation.status === 'loading') return;
    setDraft('');
    const pending = ask(question);
    const requestOwner = sideDraftOwner(useSessionStore.getState().sideConversation);
    void pending.then((accepted) => {
      if (
        !accepted &&
        requestOwner !== null &&
        sideDraftOwner(useSessionStore.getState().sideConversation) === requestOwner
      ) {
        setDraftState({ owner: requestOwner, text: question });
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229)
      return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'a') {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.select();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <aside
      aria-label={t('chat.side.title')}
      data-blade-side-conversation
      data-status={sideConversation.status}
      className="absolute inset-0 z-30 flex min-h-0 flex-col bg-[hsl(var(--deck-canvas))] md:relative md:inset-auto md:w-[min(420px,42vw)] md:shrink-0 md:border-l md:border-[hsl(var(--deck-hairline))]"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[hsl(var(--deck-hairline))] px-3">
        <MessageCircleQuestion
          aria-hidden
          className="h-4 w-4 shrink-0 text-[hsl(var(--deck-accent))]"
        />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-medium text-[hsl(var(--deck-ink))]">
          {t('chat.side.title')}
        </h2>
        {sideConversation.durationMs !== undefined && (
          <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-[hsl(var(--deck-ink-faint))]">
            <Clock3 aria-hidden className="h-3 w-3" />
            {formatDuration(sideConversation.durationMs)}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setDraft('');
            startNew();
          }}
          aria-label={t('chat.side.new')}
          title={t('chat.side.new')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[hsl(var(--deck-ink-faint))] transition-colors hover:bg-[hsl(var(--deck-surface-2))] hover:text-[hsl(var(--deck-ink))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--deck-accent))]"
        >
          <Plus aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('chat.side.dismiss')}
          title={t('chat.side.dismiss')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[hsl(var(--deck-ink-faint))] transition-colors hover:bg-[hsl(var(--deck-surface-2))] hover:text-[hsl(var(--deck-ink))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--deck-accent))]"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </header>

      <div
        aria-live="polite"
        aria-busy={sideConversation.status === 'loading'}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {sideConversation.selectedText && (
          <details className="group">
            <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-[hsl(var(--deck-border-strong))] bg-[hsl(var(--deck-surface))] px-2.5 font-mono text-[10.5px] text-[hsl(var(--deck-ink-muted))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--deck-accent))]">
              <MessageCircleQuestion aria-hidden className="h-3.5 w-3.5" />
              {t('chat.side.selectedText')}
            </summary>
            <blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-[hsl(var(--deck-accent)/0.45)] pl-3 font-mono text-[11px] leading-5 text-[hsl(var(--deck-ink-muted))]">
              {sideConversation.selectedText}
            </blockquote>
          </details>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[88%] rounded-lg bg-[hsl(var(--deck-surface-2))] px-3 py-2 text-[12px] leading-5 text-[hsl(var(--deck-ink))]">
                {message.content}
              </div>
            </div>
          ) : (
            <div key={message.id} className="min-w-0">
              <Suspense
                fallback={
                  <div className="whitespace-pre-wrap break-words text-[12px] leading-5 text-[hsl(var(--deck-ink))]">
                    {message.content}
                  </div>
                }
              >
                <MarkdownRenderer
                  content={message.content}
                  className="text-[12px] leading-5 [&_h1]:text-[14px] [&_h2]:text-[13px] [&_h3]:text-[12px]"
                />
              </Suspense>
            </div>
          )
        )}

        {sideConversation.status === 'loading' && (
          <div
            role="status"
            className="flex min-h-9 items-center gap-2 text-[11px] text-[hsl(var(--deck-ink-muted))]"
          >
            <Loader2
              aria-hidden
              className="h-3.5 w-3.5 animate-spin text-[hsl(var(--deck-accent))]"
            />
            {t('chat.side.loading')}
          </div>
        )}
        {sideConversation.status === 'error' && (
          <div
            role="alert"
            className="flex min-h-9 items-start gap-2 text-[11px] leading-5 text-red-700 dark:text-red-300"
          >
            <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">
              {sideConversation.error ?? t('chat.side.failed')}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-[hsl(var(--deck-hairline))] p-3">
        <div className="rounded-lg border border-[hsl(var(--deck-border))] bg-[hsl(var(--deck-surface))] focus-within:border-[hsl(var(--deck-border-strong))] focus-within:ring-1 focus-within:ring-[hsl(var(--deck-border-strong))]">
          <textarea
            ref={inputRef}
            name="side-conversation-composer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onBlur={() => {
              composingRef.current = false;
            }}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={sideConversation.status === 'loading'}
            aria-label={t('chat.side.input')}
            placeholder={t('chat.side.placeholder')}
            className="block max-h-40 min-h-[88px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-5 text-[hsl(var(--deck-ink))] placeholder:text-[hsl(var(--deck-ink-faint))] focus:outline-none disabled:cursor-wait disabled:opacity-60"
          />
          <div className="flex items-center justify-end px-2 pb-2">
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || sideConversation.status === 'loading'}
              aria-label={t('chat.side.send')}
              title={t('chat.side.send')}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--deck-ink))] text-[hsl(var(--deck-canvas))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--deck-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Send aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
