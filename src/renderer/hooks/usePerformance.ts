/**
 * Performance Hook - React hook for performance monitoring
 *
 * Provides access to both main process and renderer performance metrics.
 * Supports polling for real-time updates.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { performanceAPI } from '@renderer/api';
import type {
  PerformanceSnapshot,
  StartupMetrics,
  MemoryMetrics,
  CPUMetrics,
  IPCMetrics,
  DatabaseMetrics,
} from '@renderer/api/performanceAPI';
import {
  startRendererMonitoring,
  stopRendererMonitoring,
  getRendererPerformance,
  getWebVitals,
} from '@renderer/lib/performance';
import { logger } from '@renderer/lib/logger';

interface UsePerformanceState {
  snapshot: PerformanceSnapshot | null;
  loading: boolean;
  error: string | null;
  isPolling: boolean;
}

interface UsePerformanceOptions {
  /** Auto-start polling on mount */
  autoStart?: boolean;
  /** Polling interval in milliseconds */
  pollInterval?: number;
  /** Only include stats from last N milliseconds */
  sinceMs?: number;
}

const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds

export function usePerformance(options: UsePerformanceOptions = {}) {
  const {
    autoStart = false,
    pollInterval = DEFAULT_POLL_INTERVAL,
    sinceMs,
  } = options;

  const [state, setState] = useState<UsePerformanceState>({
    snapshot: null,
    loading: false,
    error: null,
    isPolling: false,
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Fetch performance snapshot
  const fetchSnapshot = useCallback(async (): Promise<PerformanceSnapshot | null> => {
    if (!isMountedRef.current) return null;

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const response = await performanceAPI.getSnapshot(sinceMs);
      if (!isMountedRef.current) return null;

      if (response.success && response.data) {
        // Add local renderer metrics
        const rendererPerf = getRendererPerformance();
        const webVitals = getWebVitals();
        const snapshot: PerformanceSnapshot = {
          ...response.data,
          renderer: {
            memory: {
              usedJSHeapSize: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0,
              totalJSHeapSize: (performance as unknown as { memory?: { totalJSHeapSize: number } }).memory?.totalJSHeapSize ?? 0,
              jsHeapSizeLimit: (performance as unknown as { memory?: { jsHeapSizeLimit: number } }).memory?.jsHeapSizeLimit ?? 0,
            },
            navigation: {
              domContentLoaded: webVitals.dcl ?? 0,
              loadComplete: webVitals.load ?? 0,
              domInteractive: webVitals.domInteractive ?? 0,
            },
            fps: rendererPerf.fps,
            longTasks: rendererPerf.longTasks,
          },
        };
        setState((s) => ({ ...s, snapshot, loading: false }));
        return snapshot;
      } else {
        setState((s) => ({
          ...s,
          loading: false,
          error: response.error?.message || 'Failed to fetch performance data',
        }));
        return null;
      }
    } catch (err) {
      logger.error('[usePerformance.fetchSnapshot] Error:', err);
      if (isMountedRef.current) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch performance data',
        }));
      }
      return null;
    }
  }, [sinceMs]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return;

    // Start renderer monitoring
    startRendererMonitoring();

    setState((s) => ({ ...s, isPolling: true }));

    // Initial fetch
    fetchSnapshot();

    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      fetchSnapshot();
    }, pollInterval);

    logger.debug('[usePerformance] Polling started');
  }, [fetchSnapshot, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    stopRendererMonitoring();
    setState((s) => ({ ...s, isPolling: false }));

    logger.debug('[usePerformance] Polling stopped');
  }, []);

  // Toggle polling
  const togglePolling = useCallback(() => {
    if (state.isPolling) {
      stopPolling();
    } else {
      startPolling();
    }
  }, [state.isPolling, startPolling, stopPolling]);

  // Fetch startup metrics only
  const fetchStartup = useCallback(async (): Promise<StartupMetrics | null> => {
    try {
      const response = await performanceAPI.getStartup();
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      logger.error('[usePerformance.fetchStartup] Error:', err);
      return null;
    }
  }, []);

  // Fetch memory metrics only
  const fetchMemory = useCallback(async (): Promise<MemoryMetrics | null> => {
    try {
      const response = await performanceAPI.getMemory();
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      logger.error('[usePerformance.fetchMemory] Error:', err);
      return null;
    }
  }, []);

  // Fetch CPU metrics only
  const fetchCPU = useCallback(async (): Promise<CPUMetrics | null> => {
    try {
      const response = await performanceAPI.getCPU();
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      logger.error('[usePerformance.fetchCPU] Error:', err);
      return null;
    }
  }, []);

  // Fetch IPC stats only
  const fetchIPCStats = useCallback(async (since?: number): Promise<IPCMetrics | null> => {
    try {
      const response = await performanceAPI.getIPCStats(since);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      logger.error('[usePerformance.fetchIPCStats] Error:', err);
      return null;
    }
  }, []);

  // Fetch DB stats only
  const fetchDBStats = useCallback(async (since?: number): Promise<DatabaseMetrics | null> => {
    try {
      const response = await performanceAPI.getDBStats(since);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      logger.error('[usePerformance.fetchDBStats] Error:', err);
      return null;
    }
  }, []);

  // Clear history
  const clearHistory = useCallback(async (): Promise<boolean> => {
    try {
      const response = await performanceAPI.clearHistory();
      return response.success;
    } catch (err) {
      logger.error('[usePerformance.clearHistory] Error:', err);
      return false;
    }
  }, []);

  // Auto-start polling on mount if enabled
  useEffect(() => {
    isMountedRef.current = true;

    if (autoStart) {
      startPolling();
    }

    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [autoStart, startPolling, stopPolling]);

  return {
    // State
    snapshot: state.snapshot,
    loading: state.loading,
    error: state.error,
    isPolling: state.isPolling,

    // Derived data
    memory: state.snapshot?.memory ?? null,
    cpu: state.snapshot?.cpu ?? null,
    eventLoop: state.snapshot?.eventLoop ?? null,
    ipc: state.snapshot?.ipc ?? null,
    database: state.snapshot?.database ?? null,
    startup: state.snapshot?.startup ?? null,
    renderer: state.snapshot?.renderer ?? null,
    uptime: state.snapshot?.uptime ?? null,

    // Actions
    fetchSnapshot,
    fetchStartup,
    fetchMemory,
    fetchCPU,
    fetchIPCStats,
    fetchDBStats,
    clearHistory,
    startPolling,
    stopPolling,
    togglePolling,
    clearError: () => setState((s) => ({ ...s, error: null })),
  };
}
