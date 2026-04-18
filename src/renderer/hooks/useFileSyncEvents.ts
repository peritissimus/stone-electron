/**
 * File Sync Events Hook - Subscribe to file watcher events
 *
 * Listens for file system changes detected by the file watcher
 * and triggers appropriate UI updates.
 */

import { useEffect, useRef } from 'react';
import { subscribe } from '@renderer/lib/events';
import { logger } from '@renderer/utils/logger';

export type FileSyncOperation = 'created' | 'updated' | 'deleted';

export interface FileSyncEvent {
  timestamp: string;
  file_path: string;
  operation: FileSyncOperation;
}

export interface FileSyncEventHandlers {
  onFileUpdated?: (event: FileSyncEvent) => void;
  onFileCreated?: (event: FileSyncEvent) => void;
  onFileDeleted?: (event: FileSyncEvent) => void;
}

export function useFileSyncEvents(handlers: FileSyncEventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const unsubscribe = subscribe('file:synced', (payload: unknown) => {
      const event = payload as FileSyncEvent;

      logger.info('[useFileSyncEvents] File sync event received', {
        file_path: event.file_path,
        operation: event.operation,
      });

      switch (event.operation) {
        case 'created':
          handlersRef.current.onFileCreated?.(event);
          break;
        case 'updated':
          handlersRef.current.onFileUpdated?.(event);
          break;
        case 'deleted':
          handlersRef.current.onFileDeleted?.(event);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
