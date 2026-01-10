/**
 * Workspace Events Hook - Subscribe to workspace events from main process
 */

import { useEffect, useRef } from 'react';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';

export interface WorkspaceEventHandlers {
  onCreated?: (payload: unknown) => void;
  onUpdated?: (payload: unknown) => void;
  onDeleted?: (payload: unknown) => void;
  onSwitched?: (payload: unknown) => void;
  onScanned?: (payload: unknown) => void;
}

/**
 * Subscribe to workspace events
 *
 * @param handlers - Event handler callbacks
 *
 * @example
 * useWorkspaceEvents({
 *   onUpdated: () => refreshWorkspace(),
 *   onSwitched: (payload) => handleWorkspaceSwitch(payload),
 * });
 */
export function useWorkspaceEvents(handlers: WorkspaceEventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (handlersRef.current.onCreated) {
      unsubscribers.push(
        subscribe(EVENTS.WORKSPACE_CREATED, (payload) => handlersRef.current.onCreated?.(payload)),
      );
    }

    if (handlersRef.current.onUpdated) {
      unsubscribers.push(
        subscribe(EVENTS.WORKSPACE_UPDATED, (payload) => handlersRef.current.onUpdated?.(payload)),
      );
    }

    if (handlersRef.current.onDeleted) {
      unsubscribers.push(
        subscribe(EVENTS.WORKSPACE_DELETED, (payload) => handlersRef.current.onDeleted?.(payload)),
      );
    }

    if (handlersRef.current.onSwitched) {
      unsubscribers.push(
        subscribe(EVENTS.WORKSPACE_SWITCHED, (payload) =>
          handlersRef.current.onSwitched?.(payload),
        ),
      );
    }

    if (handlersRef.current.onScanned) {
      unsubscribers.push(
        subscribe(EVENTS.WORKSPACE_SCANNED, (payload) => handlersRef.current.onScanned?.(payload)),
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);
}
