import { EVENTS } from '@shared/constants/ipcChannels';

type ScratchOpenHandler = (path: string) => void;

const handlers = new Set<ScratchOpenHandler>();
let pendingPath: string | null = null;

function deliver(path: string): void {
  if (handlers.size === 0) {
    pendingPath = path;
    return;
  }
  for (const handler of handlers) handler(path);
}

// Register at module load, before React effects run. Desktop open-file events
// can arrive as soon as the renderer reaches DOMContentLoaded, so an effect-only
// listener has a race where the first event is lost.
window.electron.on(EVENTS.SCRATCH_OPEN_PATH, (payload: unknown) => {
  if (typeof payload === 'string' && payload) deliver(payload);
});

export function subscribeToScratchOpen(handler: ScratchOpenHandler): () => void {
  handlers.add(handler);

  if (pendingPath) {
    const path = pendingPath;
    pendingPath = null;
    queueMicrotask(() => deliver(path));
  }

  return () => handlers.delete(handler);
}
