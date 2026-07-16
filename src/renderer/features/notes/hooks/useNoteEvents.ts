/**
 * Note Events Hook - Subscribe to note events from main process
 */

import { useEffect, useRef } from 'react';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';

export interface NoteEventHandlers {
  onCreated?: (payload: unknown) => void;
  onUpdated?: (payload: unknown) => void;
  onDeleted?: (payload: unknown) => void;
  onVersionRestored?: (payload: unknown) => void;
}

/**
 * Subscribe to note events
 *
 * @param handlers - Event handler callbacks
 *
 * @example
 * useNoteEvents({
 *   onUpdated: (payload) => handleNoteUpdate(payload),
 *   onDeleted: (payload) => handleNoteDelete(payload),
 * });
 */
export function useNoteEvents(handlers: NoteEventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (handlersRef.current.onCreated) {
      unsubscribers.push(
        subscribe(EVENTS.NOTE_CREATED, (payload) => handlersRef.current.onCreated?.(payload)),
      );
    }

    if (handlersRef.current.onUpdated) {
      unsubscribers.push(
        subscribe(EVENTS.NOTE_UPDATED, (payload) => handlersRef.current.onUpdated?.(payload)),
      );
    }

    if (handlersRef.current.onDeleted) {
      unsubscribers.push(
        subscribe(EVENTS.NOTE_DELETED, (payload) => handlersRef.current.onDeleted?.(payload)),
      );
    }

    if (handlersRef.current.onVersionRestored) {
      unsubscribers.push(
        subscribe(EVENTS.NOTE_VERSION_RESTORED, (payload) =>
          handlersRef.current.onVersionRestored?.(payload),
        ),
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);
}
