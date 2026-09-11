import {
  MAX_SELECTED_CONVERSATION_ANNOTATIONS,
  type SelectedConversationAnnotation,
} from '@api/schemas';

export interface ComposerDraftAttachment {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface ComposerDraftSnapshot {
  content: string;
  attachments: ComposerDraftAttachment[];
  annotations?: SelectedConversationAnnotation[];
  outputSchema?: string;
}

export interface ComposerDraftAppendEvent {
  key: string;
  draft: ComposerDraftSnapshot;
}

const STORAGE_PREFIX = 'blade.composer.draft.';
const drafts = new Map<string, ComposerDraftSnapshot>();
const appendListeners = new Set<(event: ComposerDraftAppendEvent) => void>();
const STORAGE_VERSION = 2;

function validAnnotations(value: unknown): SelectedConversationAnnotation[] {
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

function storage(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

export function readComposerDraft(key?: string): ComposerDraftSnapshot {
  if (!key) {
    return {
      content: '',
      attachments: [],
      annotations: [],
      outputSchema: undefined,
    };
  }
  const memoryDraft = drafts.get(key);
  if (memoryDraft) {
    return {
      content: memoryDraft.content,
      attachments: [...memoryDraft.attachments],
      annotations: [...(memoryDraft.annotations ?? [])],
      outputSchema: memoryDraft.outputSchema,
    };
  }

  try {
    const raw = storage()?.getItem(storageKey(key)) ?? '';
    if (!raw) {
      return {
        content: '',
        attachments: [],
        annotations: [],
        outputSchema: undefined,
      };
    }
    try {
      const value = JSON.parse(raw) as Record<string, unknown>;
      if (
        (value.version === 1 || value.version === STORAGE_VERSION) &&
        typeof value.content === 'string' &&
        (value.outputSchema === undefined || typeof value.outputSchema === 'string')
      ) {
        return {
          content: value.content,
          attachments: [],
          annotations: validAnnotations(value.annotations),
          outputSchema: value.outputSchema as string | undefined,
        };
      }
    } catch {
      // Legacy drafts stored the raw composer text.
    }
    return {
      content: raw,
      attachments: [],
      annotations: [],
      outputSchema: undefined,
    };
  } catch {
    return {
      content: '',
      attachments: [],
      annotations: [],
      outputSchema: undefined,
    };
  }
}

export function writeComposerDraft(
  key: string | undefined,
  draft: ComposerDraftSnapshot
): void {
  if (!key) return;
  const current = drafts.get(key) ?? readComposerDraft(key);
  const outputSchema = draft.outputSchema ?? current?.outputSchema;
  const annotations = draft.annotations ?? current.annotations ?? [];
  if (
    !draft.content &&
    draft.attachments.length === 0 &&
    annotations.length === 0 &&
    !outputSchema
  ) {
    clearComposerDraft(key);
    return;
  }

  drafts.set(key, {
    content: draft.content,
    attachments: [...draft.attachments],
    annotations: [...annotations],
    outputSchema,
  });
  try {
    if (draft.content || annotations.length > 0 || outputSchema) {
      storage()?.setItem(
        storageKey(key),
        JSON.stringify({
          version: STORAGE_VERSION,
          content: draft.content,
          annotations,
          ...(outputSchema ? { outputSchema } : {}),
        })
      );
    } else {
      storage()?.removeItem(storageKey(key));
    }
  } catch {
    // In-memory isolation still works when browser storage is unavailable.
  }
}

export function clearComposerDraft(key?: string): void {
  if (!key) return;
  drafts.delete(key);
  try {
    storage()?.removeItem(storageKey(key));
  } catch {
    // Browser storage may be disabled or full.
  }
}

export function appendComposerDraftContext(
  key: string | undefined,
  context: string
): boolean {
  const addition = context.trim();
  if (!key || !addition) return false;
  const current = readComposerDraft(key);
  const separator =
    current.content.length === 0 ? '' : current.content.endsWith('\n') ? '\n' : '\n\n';
  const draft = {
    ...current,
    content: `${current.content}${separator}${addition}`,
  };
  writeComposerDraft(key, draft);
  const event = {
    key,
    draft: {
      ...draft,
      attachments: [...draft.attachments],
      annotations: [...(draft.annotations ?? [])],
    },
  };
  for (const listener of appendListeners) listener(event);
  return true;
}

function publishDraft(key: string, draft: ComposerDraftSnapshot): void {
  writeComposerDraft(key, draft);
  const event = {
    key,
    draft: {
      ...draft,
      attachments: [...draft.attachments],
      annotations: [...(draft.annotations ?? [])],
    },
  };
  for (const listener of appendListeners) listener(event);
}

export function appendComposerDraftAnnotation(
  key: string | undefined,
  annotation: SelectedConversationAnnotation
): boolean {
  if (!key || !annotation.text.trim()) return false;
  const current = readComposerDraft(key);
  const currentAnnotations = current.annotations ?? [];
  if (
    !currentAnnotations.some((candidate) => candidate.id === annotation.id) &&
    currentAnnotations.length >= MAX_SELECTED_CONVERSATION_ANNOTATIONS
  ) {
    return false;
  }
  const annotations = [
    ...currentAnnotations.filter((candidate) => candidate.id !== annotation.id),
    annotation,
  ];
  publishDraft(key, { ...current, annotations });
  return true;
}

export function removeComposerDraftAnnotation(
  key: string | undefined,
  annotationId: string
): boolean {
  if (!key) return false;
  const current = readComposerDraft(key);
  const annotations = (current.annotations ?? []).filter(
    (annotation) => annotation.id !== annotationId
  );
  if (annotations.length === (current.annotations ?? []).length) return false;
  publishDraft(key, { ...current, annotations });
  return true;
}

export function subscribeComposerDraftAppend(
  listener: (event: ComposerDraftAppendEvent) => void
): () => void {
  appendListeners.add(listener);
  return () => appendListeners.delete(listener);
}
