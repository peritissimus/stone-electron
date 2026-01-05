/**
 * ML Status Store - Zustand state management for ML service status
 *
 * Tracks embedding service initialization and classification operations
 */

import { create } from 'zustand';
import type {
  MLServiceState,
  MLOperation,
  MLStatusChangedPayload,
  MLOperationStartedPayload,
  MLOperationProgressPayload,
  MLOperationCompletedPayload,
  MLOperationErrorPayload,
} from '@shared/types/mlStatus';
import { EVENTS } from '@shared/constants/ipcChannels';

const MAX_RECENT_OPERATIONS = 10;

interface MLStatusState {
  // State
  serviceState: MLServiceState;
  currentOperation: MLOperation | null;
  recentOperations: MLOperation[];

  // Actions
  setServiceStatus: (payload: MLStatusChangedPayload) => void;
  startOperation: (payload: MLOperationStartedPayload) => void;
  updateProgress: (payload: MLOperationProgressPayload) => void;
  completeOperation: (payload: MLOperationCompletedPayload) => void;
  failOperation: (payload: MLOperationErrorPayload) => void;
  reset: () => void;

  // Computed
  isInitializing: () => boolean;
  isReady: () => boolean;
  hasError: () => boolean;
  isRunning: () => boolean;
  getProgressPercent: () => number | null;
}

const initialState = {
  serviceState: { status: 'idle' as const },
  currentOperation: null,
  recentOperations: [],
};

export const useMLStatusStore = create<MLStatusState>((set, get) => ({
  ...initialState,

  setServiceStatus: (payload) =>
    set({
      serviceState: {
        status: payload.status,
        error: payload.error,
        model: payload.model,
      },
    }),

  startOperation: (payload) =>
    set({
      currentOperation: {
        id: payload.id,
        type: payload.type,
        status: 'running',
        progress: payload.totalItems
          ? { current: 0, total: payload.totalItems, message: payload.message }
          : undefined,
        startedAt: Date.now(),
      },
    }),

  updateProgress: (payload) =>
    set((state) => {
      if (state.currentOperation?.id !== payload.id) return state;

      return {
        currentOperation: {
          ...state.currentOperation,
          progress: {
            current: payload.current,
            total: payload.total,
            message: payload.message,
          },
        },
      };
    }),

  completeOperation: (payload) =>
    set((state) => {
      if (state.currentOperation?.id !== payload.id) return state;

      const completed: MLOperation = {
        ...state.currentOperation,
        status: 'completed',
        completedAt: Date.now(),
      };

      const recentOperations = [completed, ...state.recentOperations].slice(
        0,
        MAX_RECENT_OPERATIONS
      );

      return {
        currentOperation: null,
        recentOperations,
      };
    }),

  failOperation: (payload) =>
    set((state) => {
      if (state.currentOperation?.id !== payload.id) return state;

      const failed: MLOperation = {
        ...state.currentOperation,
        status: 'error',
        error: payload.error,
        completedAt: Date.now(),
      };

      const recentOperations = [failed, ...state.recentOperations].slice(
        0,
        MAX_RECENT_OPERATIONS
      );

      return {
        currentOperation: null,
        recentOperations,
      };
    }),

  reset: () => set(initialState),

  // Computed
  isInitializing: () => get().serviceState.status === 'initializing',
  isReady: () => get().serviceState.status === 'ready',
  hasError: () => get().serviceState.status === 'error',
  isRunning: () => get().currentOperation?.status === 'running',

  getProgressPercent: () => {
    const progress = get().currentOperation?.progress;
    if (!progress || progress.total === 0) return null;
    return Math.round((progress.current / progress.total) * 100);
  },
}));

/**
 * Subscribe to ML status events from main process
 * Call this once during app initialization
 */
export function subscribeToMLStatusEvents(): () => void {
  const unsubscribers: (() => void)[] = [];
  const store = useMLStatusStore.getState();

  // Service status changes
  unsubscribers.push(
    window.electron.on(EVENTS.ML_STATUS_CHANGED, (payload) => {
      store.setServiceStatus(payload as MLStatusChangedPayload);
    })
  );

  // Operation started
  unsubscribers.push(
    window.electron.on(EVENTS.ML_OPERATION_STARTED, (payload) => {
      store.startOperation(payload as MLOperationStartedPayload);
    })
  );

  // Operation progress
  unsubscribers.push(
    window.electron.on(EVENTS.ML_OPERATION_PROGRESS, (payload) => {
      store.updateProgress(payload as MLOperationProgressPayload);
    })
  );

  // Operation completed
  unsubscribers.push(
    window.electron.on(EVENTS.ML_OPERATION_COMPLETED, (payload) => {
      store.completeOperation(payload as MLOperationCompletedPayload);
    })
  );

  // Operation error
  unsubscribers.push(
    window.electron.on(EVENTS.ML_OPERATION_ERROR, (payload) => {
      store.failOperation(payload as MLOperationErrorPayload);
    })
  );

  // Return cleanup function
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
