/**
 * ML Status Hook - React hooks for ML service status access
 *
 * Components should use these hooks instead of importing useMLStatusStore directly.
 * Note: useMLEventsSync() should be called once at app level to sync ML events to store.
 */

import { useMLStatusStore } from '@renderer/stores/mlStatusStore';
import type { MLServiceState, MLOperation } from '@shared/types/mlStatus';

/**
 * Main ML Status hook - provides access to ML service state
 */
export function useMLStatus() {
  // State
  const serviceState = useMLStatusStore((s) => s.serviceState);
  const currentOperation = useMLStatusStore((s) => s.currentOperation);
  const recentOperations = useMLStatusStore((s) => s.recentOperations);

  // Computed values (call these as functions in the store)
  const store = useMLStatusStore.getState();

  return {
    // State
    serviceState,
    currentOperation,
    recentOperations,

    // Computed
    isInitializing: store.isInitializing(),
    isReady: store.isReady(),
    hasError: store.hasError(),
    isRunning: store.isRunning(),
    progressPercent: store.getProgressPercent(),
  };
}

/**
 * ML Service state hook - just the service status
 */
export function useMLServiceState() {
  const serviceState = useMLStatusStore((s) => s.serviceState);
  const store = useMLStatusStore.getState();

  return {
    serviceState,
    isInitializing: store.isInitializing(),
    isReady: store.isReady(),
    hasError: store.hasError(),
  };
}

/**
 * ML Operation hook - current operation and progress
 */
export function useMLOperation() {
  const currentOperation = useMLStatusStore((s) => s.currentOperation);
  const recentOperations = useMLStatusStore((s) => s.recentOperations);
  const store = useMLStatusStore.getState();

  return {
    currentOperation,
    recentOperations,
    isRunning: store.isRunning(),
    progressPercent: store.getProgressPercent(),
  };
}

/**
 * Simple boolean hooks for common status checks
 */
export function useMLIsReady(): boolean {
  const status = useMLStatusStore((s) => s.serviceState.status);
  return status === 'ready';
}

export function useMLIsInitializing(): boolean {
  const status = useMLStatusStore((s) => s.serviceState.status);
  return status === 'initializing';
}

export function useMLHasError(): boolean {
  const status = useMLStatusStore((s) => s.serviceState.status);
  return status === 'error';
}

export function useMLIsRunningOperation(): boolean {
  const currentOperation = useMLStatusStore((s) => s.currentOperation);
  return currentOperation?.status === 'running';
}

// Re-export types for convenience
export type { MLServiceState, MLOperation };
