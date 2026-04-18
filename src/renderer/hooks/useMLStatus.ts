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

  // Computed values using selectors
  const isInitializing = useMLStatusStore((s) => s.serviceState.status === 'initializing');
  const isReady = useMLStatusStore((s) => s.serviceState.status === 'ready');
  const hasError = useMLStatusStore((s) => s.serviceState.status === 'error');
  const isRunning = useMLStatusStore((s) => s.currentOperation?.status === 'running');
  const progressPercent = useMLStatusStore((s) => {
    const progress = s.currentOperation?.progress;
    if (!progress || progress.total === 0) return null;
    return Math.round((progress.current / progress.total) * 100);
  });

  return {
    // State
    serviceState,
    currentOperation,
    recentOperations,

    // Computed
    isInitializing,
    isReady,
    hasError,
    isRunning,
    progressPercent,
  };
}

/**
 * ML Service state hook - just the service status
 */
export function useMLServiceState() {
  const serviceState = useMLStatusStore((s) => s.serviceState);
  const isInitializing = useMLStatusStore((s) => s.serviceState.status === 'initializing');
  const isReady = useMLStatusStore((s) => s.serviceState.status === 'ready');
  const hasError = useMLStatusStore((s) => s.serviceState.status === 'error');

  return {
    serviceState,
    isInitializing,
    isReady,
    hasError,
  };
}

/**
 * ML Operation hook - current operation and progress
 */
export function useMLOperation() {
  const currentOperation = useMLStatusStore((s) => s.currentOperation);
  const recentOperations = useMLStatusStore((s) => s.recentOperations);
  const isRunning = useMLStatusStore((s) => s.currentOperation?.status === 'running');
  const progressPercent = useMLStatusStore((s) => {
    const progress = s.currentOperation?.progress;
    if (!progress || progress.total === 0) return null;
    return Math.round((progress.current / progress.total) * 100);
  });

  return {
    currentOperation,
    recentOperations,
    isRunning,
    progressPercent,
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
