/**
 * ML Events Hook - Subscribe to ML service events from main process
 */

import { useEffect, useRef } from 'react';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import type {
  MLStatusChangedPayload,
  MLOperationStartedPayload,
  MLOperationProgressPayload,
  MLOperationCompletedPayload,
  MLOperationErrorPayload,
} from '@shared/types/mlStatus';

export interface MLEventHandlers {
  onStatusChanged?: (payload: MLStatusChangedPayload) => void;
  onOperationStarted?: (payload: MLOperationStartedPayload) => void;
  onOperationProgress?: (payload: MLOperationProgressPayload) => void;
  onOperationCompleted?: (payload: MLOperationCompletedPayload) => void;
  onOperationError?: (payload: MLOperationErrorPayload) => void;
}

/**
 * Subscribe to ML service events
 *
 * @param handlers - Event handler callbacks
 *
 * @example
 * useMLEvents({
 *   onStatusChanged: (payload) => updateStatus(payload),
 *   onOperationProgress: (payload) => updateProgress(payload),
 * });
 */
export function useMLEvents(handlers: MLEventHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (handlersRef.current.onStatusChanged) {
      unsubscribers.push(
        subscribe(EVENTS.ML_STATUS_CHANGED, (payload) =>
          handlersRef.current.onStatusChanged?.(payload as MLStatusChangedPayload),
        ),
      );
    }

    if (handlersRef.current.onOperationStarted) {
      unsubscribers.push(
        subscribe(EVENTS.ML_OPERATION_STARTED, (payload) =>
          handlersRef.current.onOperationStarted?.(payload as MLOperationStartedPayload),
        ),
      );
    }

    if (handlersRef.current.onOperationProgress) {
      unsubscribers.push(
        subscribe(EVENTS.ML_OPERATION_PROGRESS, (payload) =>
          handlersRef.current.onOperationProgress?.(payload as MLOperationProgressPayload),
        ),
      );
    }

    if (handlersRef.current.onOperationCompleted) {
      unsubscribers.push(
        subscribe(EVENTS.ML_OPERATION_COMPLETED, (payload) =>
          handlersRef.current.onOperationCompleted?.(payload as MLOperationCompletedPayload),
        ),
      );
    }

    if (handlersRef.current.onOperationError) {
      unsubscribers.push(
        subscribe(EVENTS.ML_OPERATION_ERROR, (payload) =>
          handlersRef.current.onOperationError?.(payload as MLOperationErrorPayload),
        ),
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);
}

/**
 * Subscribe to all ML events and update the ML status store
 * This is a convenience hook that wires up all ML events to the store
 *
 * @example
 * // In App.tsx or a top-level component
 * useMLEventsSync();
 */
export function useMLEventsSync(): void {
  // Import store lazily to avoid circular dependencies
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    let disposed = false;

    // Dynamically import to get store actions
    import('@renderer/stores/mlStatusStore').then(({ useMLStatusStore }) => {
      if (disposed) return;

      const store = useMLStatusStore.getState();
      const addSubscription = (unsubscribe: () => void) => {
        if (disposed) {
          unsubscribe();
          return;
        }
        unsubscribers.push(unsubscribe);
      };

      addSubscription(
        subscribe(EVENTS.ML_STATUS_CHANGED, (payload) => {
          store.setServiceStatus(payload as MLStatusChangedPayload);
        }),
      );

      addSubscription(
        subscribe(EVENTS.ML_OPERATION_STARTED, (payload) => {
          store.startOperation(payload as MLOperationStartedPayload);
        }),
      );

      addSubscription(
        subscribe(EVENTS.ML_OPERATION_PROGRESS, (payload) => {
          store.updateProgress(payload as MLOperationProgressPayload);
        }),
      );

      addSubscription(
        subscribe(EVENTS.ML_OPERATION_COMPLETED, (payload) => {
          store.completeOperation(payload as MLOperationCompletedPayload);
        }),
      );

      addSubscription(
        subscribe(EVENTS.ML_OPERATION_ERROR, (payload) => {
          store.failOperation(payload as MLOperationErrorPayload);
        }),
      );

      void useMLStatusStore.getState().hydrateEmbeddingStatus();
    });

    return () => {
      disposed = true;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);
}
