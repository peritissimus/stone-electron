import { z } from 'zod';
import { EVENTS } from '@shared/constants/ipcChannels';
import { subscribe } from '@renderer/lib/events';

const NotePayloadSchema = z
  .object({
    id: z.string().optional(),
    journalDate: z.string().optional(),
    note: z.object({ id: z.string() }).passthrough().optional(),
  })
  .passthrough()
  .refine((payload) => Boolean(payload.id ?? payload.note?.id));

const FilePayloadSchema = z
  .object({
    path: z.string(),
    workspaceId: z.string().optional(),
  })
  .passthrough();

export type InvalidationEvent =
  | {
      source: 'note';
      action: 'created' | 'updated' | 'deleted';
      noteId?: string;
      journalDate?: string;
      payload: z.infer<typeof NotePayloadSchema>;
    }
  | {
      source: 'file';
      action: 'changed';
      path: string;
      workspaceId?: string;
      payload: z.infer<typeof FilePayloadSchema>;
    };

export interface InvalidationSubscription {
  sources: ReadonlyArray<InvalidationEvent['source']>;
  actions?: ReadonlyArray<InvalidationEvent['action']>;
  debounceMs?: number;
  filter?: (event: InvalidationEvent) => boolean;
  guard?: () => boolean;
  invalidate: (event: InvalidationEvent) => void | Promise<void>;
}

interface RegisteredSubscription extends InvalidationSubscription {
  timer: ReturnType<typeof setTimeout> | null;
  pending: InvalidationEvent | null;
}

const subscriptions = new Map<number, RegisteredSubscription>();
let nextId = 0;
let stopSourceSubscriptions: (() => void) | null = null;

export function subscribeInvalidation(subscription: InvalidationSubscription): () => void {
  const id = ++nextId;
  subscriptions.set(id, { ...subscription, timer: null, pending: null });
  ensureSourceSubscriptions();

  return () => {
    const registered = subscriptions.get(id);
    if (registered?.timer) clearTimeout(registered.timer);
    subscriptions.delete(id);
    if (subscriptions.size === 0) {
      stopSourceSubscriptions?.();
      stopSourceSubscriptions = null;
    }
  };
}

function ensureSourceSubscriptions(): void {
  if (stopSourceSubscriptions) return;
  const unsubscribers = [
    subscribe(EVENTS.NOTE_CREATED, (payload) => emitNote('created', payload)),
    subscribe(EVENTS.NOTE_UPDATED, (payload) => emitNote('updated', payload)),
    subscribe(EVENTS.NOTE_DELETED, (payload) => emitNote('deleted', payload)),
    subscribe(EVENTS.FILE_CHANGED, (payload) => emitFile(payload)),
  ];
  stopSourceSubscriptions = () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

function emitNote(action: 'created' | 'updated' | 'deleted', raw: unknown): void {
  const parsed = NotePayloadSchema.safeParse(raw);
  if (!parsed.success) return;
  dispatch({
    source: 'note',
    action,
    noteId: parsed.data.id ?? parsed.data.note?.id,
    journalDate: parsed.data.journalDate,
    payload: parsed.data,
  });
}

function emitFile(raw: unknown): void {
  const parsed = FilePayloadSchema.safeParse(raw);
  if (!parsed.success) return;
  dispatch({
    source: 'file',
    action: 'changed',
    path: parsed.data.path,
    workspaceId: parsed.data.workspaceId,
    payload: parsed.data,
  });
}

function dispatch(event: InvalidationEvent): void {
  for (const subscription of subscriptions.values()) {
    if (!subscription.sources.includes(event.source)) continue;
    if (subscription.actions && !subscription.actions.includes(event.action)) continue;
    if (subscription.filter && !subscription.filter(event)) continue;

    subscription.pending = event;
    if (subscription.timer) clearTimeout(subscription.timer);
    const run = () => {
      subscription.timer = null;
      const pending = subscription.pending;
      subscription.pending = null;
      if (!pending || (subscription.guard && !subscription.guard())) return;
      void subscription.invalidate(pending);
    };

    if ((subscription.debounceMs ?? 0) > 0) {
      subscription.timer = setTimeout(run, subscription.debounceMs);
    } else {
      run();
    }
  }
}

/** Test-only reset for the singleton source subscription and pending timers. */
export function resetInvalidationForTests(): void {
  for (const subscription of subscriptions.values()) {
    if (subscription.timer) clearTimeout(subscription.timer);
  }
  subscriptions.clear();
  stopSourceSubscriptions?.();
  stopSourceSubscriptions = null;
  nextId = 0;
}
