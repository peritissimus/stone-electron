import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../../../src/shared/constants/ipcChannels';
import {
  resetInvalidationForTests,
  subscribeInvalidation,
} from '../../../src/renderer/services/invalidation/invalidation';

const handlers = new Map<string, (...args: unknown[]) => void>();

beforeEach(() => {
  vi.useFakeTimers();
  handlers.clear();
  vi.stubGlobal('window', {
    electron: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler);
        return () => handlers.delete(event);
      }),
    },
  });
});

afterEach(() => {
  resetInvalidationForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('renderer invalidation', () => {
  it('validates typed payloads and coalesces bursts in one scheduler', async () => {
    const invalidate = vi.fn();
    subscribeInvalidation({
      sources: ['note'],
      debounceMs: 100,
      invalidate,
    });

    handlers.get(EVENTS.NOTE_UPDATED)?.({ id: 'note-1' });
    handlers.get(EVENTS.NOTE_UPDATED)?.({ id: 'note-2' });
    handlers.get(EVENTS.NOTE_UPDATED)?.({ invalid: true });
    await vi.advanceTimersByTimeAsync(100);

    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'note', action: 'updated', noteId: 'note-2' }),
    );
  });

  it('checks dirty-state guards when scheduled invalidation executes', async () => {
    let clean = true;
    const invalidate = vi.fn();
    subscribeInvalidation({
      sources: ['note'],
      debounceMs: 100,
      guard: () => clean,
      invalidate,
    });

    handlers.get(EVENTS.NOTE_UPDATED)?.({ id: 'note-1' });
    clean = false;
    await vi.advanceTimersByTimeAsync(100);

    expect(invalidate).not.toHaveBeenCalled();
  });
});
