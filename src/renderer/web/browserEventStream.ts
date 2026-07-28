/**
 * Receives pushed domain events over SSE and dispatches them the way
 * `window.electron.on` does in the desktop app.
 *
 * One EventSource is shared by every subscriber: browsers cap concurrent
 * connections per origin, and the server broadcasts the same set of events to
 * all of them anyway. The connection opens on the first subscriber and closes
 * when the last one goes away.
 */

type Listener = (payload: unknown) => void;

const listeners = new Map<string, Set<Listener>>();
let source: EventSource | null = null;

const resolveUrl = (): string => {
  const base = import.meta.env?.VITE_API_BASE_URL ?? '';
  return `${String(base).replace(/\/$/, '')}/api/events`;
};

function handleMessage(event: MessageEvent<string>): void {
  let parsed: { channel?: string; payload?: unknown };
  try {
    parsed = JSON.parse(event.data);
  } catch {
    return;
  }
  if (!parsed.channel) return;
  for (const listener of listeners.get(parsed.channel) ?? []) {
    try {
      listener(parsed.payload);
    } catch {
      // A failing subscriber must not take down the stream for the others.
    }
  }
}

function ensureConnected(): void {
  if (source) return;
  // EventSource reconnects on its own; the server sends a retry hint.
  source = new EventSource(resolveUrl());
  source.addEventListener('message', handleMessage as EventListener);
}

function disconnectIfIdle(): void {
  if (listeners.size > 0) return;
  source?.close();
  source = null;
}

export function subscribe(channel: string, listener: Listener): () => void {
  const existing = listeners.get(channel) ?? new Set<Listener>();
  existing.add(listener);
  listeners.set(channel, existing);
  ensureConnected();

  return () => {
    const current = listeners.get(channel);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(channel);
    disconnectIfIdle();
  };
}

export function subscribeOnce(channel: string, listener: Listener): void {
  const unsubscribe = subscribe(channel, (payload) => {
    unsubscribe();
    listener(payload);
  });
}

export function unsubscribe(channel: string, listener: Listener): void {
  const current = listeners.get(channel);
  if (!current) return;
  current.delete(listener);
  if (current.size === 0) listeners.delete(channel);
  disconnectIfIdle();
}
