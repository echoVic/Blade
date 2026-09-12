import { MAX_SELECTED_CONVERSATION_COMMENT_CHARS } from '@api/schemas';
import {
  CornerDownLeft,
  MessageCircleQuestion,
  MessageSquarePlus,
  MessageSquareQuote,
} from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/i18n';
import {
  type ChatSelectionRect,
  type ChatTextSelection,
  captureChatTextSelection,
} from '@/lib/chatSelection';
import { appendComposerDraftAnnotation } from '@/lib/composerDraft';

type EditorMode = 'actions' | 'comment';

interface OverlayPosition {
  left: number;
  top: number;
}

interface ChatSelectionToolbarProps {
  rootRef: RefObject<HTMLElement | null>;
  draftKey: string;
  canAskSideConversation: boolean;
  onOpenSideConversation: (selectedText: string) => boolean;
}

const VIEWPORT_PADDING = 8;
const SELECTION_GAP = 10;

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'input, textarea, select, [contenteditable="true"], [role="textbox"]'
      )
    )
  );
}

function viewportBounds() {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}

export function positionSelectionOverlay(
  selection: ChatSelectionRect,
  overlayWidth: number,
  overlayHeight: number
): OverlayPosition {
  const viewport = viewportBounds();
  const minLeft = viewport.left + VIEWPORT_PADDING;
  const maxLeft = viewport.left + viewport.width - overlayWidth - VIEWPORT_PADDING;
  const centeredLeft = selection.left + selection.width / 2 - overlayWidth / 2;
  const left = Math.max(minLeft, Math.min(Math.max(minLeft, maxLeft), centeredLeft));
  const below = selection.bottom + SELECTION_GAP;
  const above = selection.top - overlayHeight - SELECTION_GAP;
  const maxTop = viewport.top + viewport.height - overlayHeight - VIEWPORT_PADDING;
  const top =
    below <= maxTop
      ? below
      : Math.max(viewport.top + VIEWPORT_PADDING, Math.min(maxTop, above));
  return { left, top };
}

export function ChatSelectionToolbar({
  rootRef,
  draftKey,
  canAskSideConversation,
  onOpenSideConversation,
}: ChatSelectionToolbarProps) {
  const t = useT();
  const overlayRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const modeRef = useRef<EditorMode>('actions');
  const [selection, setSelection] = useState<ChatTextSelection | null>(null);
  const [mode, setMode] = useState<EditorMode>('actions');
  const [editorValue, setEditorValue] = useState('');
  const [position, setPosition] = useState<OverlayPosition | null>(null);

  const setEditorMode = useCallback((next: EditorMode) => {
    composingRef.current = false;
    modeRef.current = next;
    setMode(next);
    setEditorValue('');
  }, []);

  const dismiss = useCallback(() => {
    composingRef.current = false;
    modeRef.current = 'actions';
    setMode('actions');
    setEditorValue('');
    setSelection(null);
    setPosition(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const addToChat = useCallback(
    (comment?: string) => {
      if (!selection || selection.tooLarge) return;
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `selection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const normalizedComment = comment?.trim();
      const appended = appendComposerDraftAnnotation(draftKey, {
        id,
        text: selection.text,
        sourceMessageId: selection.messageId,
        sourceRole: selection.role,
        ...(normalizedComment ? { comment: normalizedComment } : {}),
      });
      if (appended) dismiss();
    },
    [dismiss, draftKey, selection]
  );

  const openSideConversation = useCallback(() => {
    if (!selection || selection.tooLarge || !canAskSideConversation) return;
    if (onOpenSideConversation(selection.text)) dismiss();
  }, [canAskSideConversation, dismiss, onOpenSideConversation, selection]);

  const captureSelection = useCallback(() => {
    if (modeRef.current !== 'actions') return;
    const root = rootRef.current;
    if (!root) return;
    const captured = captureChatTextSelection(root, window.getSelection());
    setSelection(captured);
    setPosition(null);
  }, [rootRef]);

  useEffect(() => {
    let frame = 0;
    const scheduleCapture = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(captureSelection);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (overlayRef.current?.contains(event.target as Node)) return;
      if (selection) {
        composingRef.current = false;
        modeRef.current = 'actions';
        setMode('actions');
        setEditorValue('');
        setSelection(null);
      }
    };
    const handleScroll = (event: Event) => {
      if (overlayRef.current?.contains(event.target as Node)) return;
      dismiss();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        !selection ||
        composingRef.current ||
        event.isComposing ||
        event.keyCode === 229
      )
        return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
        return;
      }
      if (modeRef.current !== 'actions' || isEditableTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setEditorMode('comment');
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        addToChat();
      }
    };

    document.addEventListener('selectionchange', scheduleCapture);
    document.addEventListener('pointerup', scheduleCapture);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', dismiss);
    window.visualViewport?.addEventListener('resize', dismiss);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', scheduleCapture);
      document.removeEventListener('pointerup', scheduleCapture);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', dismiss);
      window.visualViewport?.removeEventListener('resize', dismiss);
    };
  }, [addToChat, captureSelection, dismiss, selection, setEditorMode]);

  useLayoutEffect(() => {
    if (!selection || !overlayRef.current) return;
    const overlay = overlayRef.current.getBoundingClientRect();
    setPosition(
      positionSelectionOverlay(selection.rect, overlay.width, overlay.height)
    );
  }, [mode, selection]);

  useEffect(() => {
    if (mode !== 'actions') {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  }, [mode]);

  if (!selection || typeof document === 'undefined') return null;

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/u.test(navigator.userAgent);
  const commentShortcut = isMac ? '⌘ J' : 'Ctrl J';
  const disabledReason = selection.tooLarge
    ? t('chat.selection.tooLarge')
    : !canAskSideConversation
      ? t('chat.selection.sideUnavailable')
      : undefined;
  const style = {
    left: position?.left ?? 0,
    top: position?.top ?? 0,
    visibility: position ? ('visible' as const) : ('hidden' as const),
  };

  const editorKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
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
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    addToChat(editorValue);
  };

  return createPortal(
    <div
      ref={overlayRef}
      data-chat-selection-overlay
      style={style}
      className="fixed z-50 max-w-[calc(100vw-1rem)]"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {mode === 'actions' ? (
        <div
          role="toolbar"
          aria-label={t('chat.selection.toolbar')}
          className="grid min-w-[250px] overflow-hidden rounded-lg border border-[hsl(var(--deck-border-strong))] bg-[hsl(var(--deck-surface))]/98 text-[hsl(var(--deck-ink))] shadow-xl backdrop-blur-md divide-y divide-[hsl(var(--deck-border))] sm:flex sm:min-w-0 sm:divide-x sm:divide-y-0"
          onPointerDown={(event) => event.preventDefault()}
        >
          <button
            type="button"
            aria-keyshortcuts="Meta+J Control+J"
            disabled={selection.tooLarge}
            onClick={() => setEditorMode('comment')}
            className="flex min-h-11 items-center gap-2 whitespace-nowrap px-3 text-left text-[12px] transition-colors hover:bg-[hsl(var(--deck-surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--deck-accent))] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessageSquareQuote aria-hidden className="h-4 w-4 shrink-0" />
            <span>{t('chat.selection.comment')}</span>
            <kbd className="ml-auto font-mono text-[10px] text-[hsl(var(--deck-ink-faint))]">
              {commentShortcut}
            </kbd>
          </button>
          <button
            type="button"
            aria-keyshortcuts="Enter"
            disabled={selection.tooLarge}
            onClick={() => addToChat()}
            className="flex min-h-11 items-center gap-2 whitespace-nowrap px-3 text-left text-[12px] transition-colors hover:bg-[hsl(var(--deck-surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--deck-accent))] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessageSquarePlus aria-hidden className="h-4 w-4 shrink-0" />
            <span>{t('chat.selection.add')}</span>
            <kbd className="ml-auto font-mono text-[11px] text-[hsl(var(--deck-ink-faint))]">
              ↵
            </kbd>
          </button>
          <button
            type="button"
            disabled={Boolean(disabledReason)}
            title={disabledReason}
            onClick={openSideConversation}
            className="flex min-h-11 items-center gap-2 whitespace-nowrap px-3 text-left text-[12px] transition-colors hover:bg-[hsl(var(--deck-surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--deck-accent))] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessageCircleQuestion aria-hidden className="h-4 w-4 shrink-0" />
            <span>{t('chat.selection.askSide')}</span>
          </button>
        </div>
      ) : (
        <form
          role="dialog"
          aria-label={t('chat.selection.commentDialog')}
          className="w-[min(360px,calc(100vw-1rem))] rounded-lg border border-[hsl(var(--deck-border-strong))] bg-[hsl(var(--deck-surface))] p-2 shadow-xl"
          onSubmit={(event) => {
            event.preventDefault();
            addToChat(editorValue);
          }}
        >
          <div className="mb-2 line-clamp-2 border-l-2 border-[hsl(var(--deck-accent)/0.55)] pl-2 font-mono text-[10.5px] leading-4 text-[hsl(var(--deck-ink-muted))]">
            {selection.text}
          </div>
          <textarea
            ref={editorRef}
            name="selected-conversation-comment"
            maxLength={MAX_SELECTED_CONVERSATION_COMMENT_CHARS}
            rows={3}
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onBlur={() => {
              composingRef.current = false;
            }}
            onKeyDown={editorKeyDown}
            aria-label={t('chat.selection.commentInput')}
            placeholder={t('chat.selection.commentPlaceholder')}
            className="block max-h-32 min-h-[72px] w-full resize-none rounded-md border border-[hsl(var(--deck-border))] bg-[hsl(var(--deck-canvas))] px-2.5 py-2 text-[12px] leading-5 text-[hsl(var(--deck-ink))] placeholder:text-[hsl(var(--deck-ink-faint))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--deck-accent))]"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="h-8 rounded-md px-2.5 text-[11px] text-[hsl(var(--deck-ink-muted))] transition-colors hover:bg-[hsl(var(--deck-surface-2))] hover:text-[hsl(var(--deck-ink))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--deck-accent))]"
            >
              {t('chat.selection.cancel')}
            </button>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[hsl(var(--deck-accent))] px-3 text-[11px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--deck-accent))] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t('chat.selection.add')}
              <CornerDownLeft aria-hidden className="h-3 w-3" />
            </button>
          </div>
        </form>
      )}
    </div>,
    document.body
  );
}
