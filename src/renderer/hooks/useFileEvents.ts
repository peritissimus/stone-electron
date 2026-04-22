/**
 * File Events Hook - Subscribe to file system events from main process
 */

import { useEffect, useRef } from 'react';
import { events } from '@renderer/lib/events';

export interface FileEventHandlers {
  onCreated?: (payload: unknown) => void;
  onChanged?: (payload: unknown) => void;
  onDeleted?: (payload: unknown) => void;
}

/**
 * Subscribe to file system events
 *
 * @param handlers - Event handler callbacks
 *
 * @example
 * useFileEvents({
 *   onCreated: () => refreshList(),
 *   onChanged: () => refreshList(),
 *   onDeleted: () => refreshList(),
 * });
 */
export function useFileEvents(handlers: FileEventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (handlersRef.current.onCreated) {
      unsubscribers.push(
        events.onFileCreated((payload) => handlersRef.current.onCreated?.(payload)),
      );
    }

    if (handlersRef.current.onChanged) {
      unsubscribers.push(
        events.onFileChanged((payload) => handlersRef.current.onChanged?.(payload)),
      );
    }

    if (handlersRef.current.onDeleted) {
      unsubscribers.push(
        events.onFileDeleted((payload) => handlersRef.current.onDeleted?.(payload)),
      );
    }

    // FILE_SYNCED is the unified watcher event. Re-dispatch to the op-specific
    // handlers with a normalized `{ path }` shape so consumers written against
    // the legacy FILE_CREATED/CHANGED/DELETED channels keep working.
    unsubscribers.push(
      events.onFileSynced((payload) => {
        const data = (payload ?? {}) as { filePath?: string; operation?: 'created' | 'updated' | 'deleted' };
        const forwarded = { path: data.filePath };
        if (data.operation === 'created') handlersRef.current.onCreated?.(forwarded);
        else if (data.operation === 'updated') handlersRef.current.onChanged?.(forwarded);
        else if (data.operation === 'deleted') handlersRef.current.onDeleted?.(forwarded);
      }),
    );

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);
}

/**
 * Subscribe to all file system events with a single handler
 *
 * @param handler - Handler called for any file system event
 *
 * @example
 * useFileEventsAll(() => refreshFileTree());
 */
export function useFileEventsAll(handler: (payload: unknown) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = events.onFileSystemChange((payload) => handlerRef.current(payload));
    return unsub;
  }, []);
}
