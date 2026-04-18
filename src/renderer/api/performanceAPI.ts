/**
 * Performance API - IPC channel wrappers for performance monitoring
 *
 * Pure functions that wrap IPC channels. No React, no stores.
 * No spec counterpart: dev/diagnostic telemetry, not a cross-platform contract.
 */

import { z } from 'zod';
import { invokeIpc } from '@renderer/lib/ipc';
import { PERFORMANCE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';
import { validateResponse } from './validation';
import {
  PerformanceSnapshotSchema,
  MemoryMetricsSchema,
  CPUMetricsSchema,
  IPCMetricsSchema,
  DatabaseMetricsSchema,
  StartupMetricsSchema,
} from './schemas';

// ============================================================================
// Types
// ============================================================================

export interface StartupMetrics {
  appStartTime: number;
  dbInitTime?: number;
  containerInitTime?: number;
  ipcRegistrationTime?: number;
  windowCreationTime?: number;
  totalStartupTime?: number;
  windowReadyTime?: number;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  heapUsedMB: number;
  rssMB: number;
}

export interface CPUMetrics {
  user: number;
  system: number;
  percentCPU: number;
}

export interface EventLoopMetrics {
  lagMs: number;
  utilizationPercent: number;
}

export interface ChannelStats {
  calls: number;
  errors: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
}

export interface IPCMetrics {
  totalCalls: number;
  totalErrors: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  callsByChannel: Record<string, ChannelStats>;
}

export interface OperationStats {
  count: number;
  errors: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
}

export interface DatabaseMetrics {
  totalQueries: number;
  totalErrors: number;
  avgDurationMs: number;
  slowQueries: number;
  queriesByOperation: Record<string, OperationStats>;
}

export interface RendererMemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface RendererNavigationMetrics {
  domContentLoaded: number;
  loadComplete: number;
  domInteractive: number;
}

export interface RendererMetrics {
  memory: RendererMemoryMetrics;
  navigation: RendererNavigationMetrics;
  fps: number | null;
  longTasks: LongTaskEntry[];
}

export interface LongTaskEntry {
  name: string;
  startTime: number;
  duration: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  uptime: number;
  startup: StartupMetrics;
  memory: MemoryMetrics;
  cpu: CPUMetrics;
  eventLoop: EventLoopMetrics;
  ipc: IPCMetrics;
  database: DatabaseMetrics;
  renderer?: RendererMetrics | null;
}

// ============================================================================
// API
// ============================================================================

export const performanceAPI = {
  /**
   * Get full performance snapshot (main process + renderer)
   * @param sinceMs - Only include IPC/DB stats from last N milliseconds
   */
  getSnapshot: async (sinceMs?: number): Promise<IpcResponse<PerformanceSnapshot>> => {
    const response = await invokeIpc(PERFORMANCE_CHANNELS.GET_SNAPSHOT, sinceMs);
    return validateResponse(response, PerformanceSnapshotSchema);
  },

  /**
   * Get memory metrics only
   */
  getMemory: async (): Promise<IpcResponse<MemoryMetrics>> => {
    const response = await invokeIpc(PERFORMANCE_CHANNELS.GET_MEMORY, {});
    return validateResponse(response, MemoryMetricsSchema);
  },

  /**
   * Get CPU metrics only
   */
  getCPU: async (): Promise<IpcResponse<CPUMetrics>> => {
    const response = await invokeIpc(PERFORMANCE_CHANNELS.GET_CPU, {});
    return validateResponse(response, CPUMetricsSchema);
  },

  /**
   * Get IPC call statistics
   * @param sinceMs - Only include stats from last N milliseconds
   */
  getIPCStats: async (sinceMs?: number): Promise<IpcResponse<IPCMetrics>> => {
    const response = await invokeIpc(PERFORMANCE_CHANNELS.GET_IPC_STATS, sinceMs);
    return validateResponse(response, IPCMetricsSchema);
  },

  /**
   * Get database query statistics
   * @param sinceMs - Only include stats from last N milliseconds
   */
  getDBStats: async (sinceMs?: number): Promise<IpcResponse<DatabaseMetrics>> => {
    const response = await invokeIpc(PERFORMANCE_CHANNELS.GET_DB_STATS, sinceMs);
    return validateResponse(response, DatabaseMetricsSchema);
  },

  /**
   * Get startup timing metrics
   */
  getStartup: async (): Promise<IpcResponse<StartupMetrics>> => {
    const response = await invokeIpc(PERFORMANCE_CHANNELS.GET_STARTUP, {});
    return validateResponse(response, StartupMetricsSchema);
  },

  /**
   * Clear performance history (resets IPC/DB stats)
   */
  clearHistory: async (): Promise<IpcResponse<{ success: boolean }>> => {
    const response = await invokeIpc(PERFORMANCE_CHANNELS.CLEAR_HISTORY, {});
    return validateResponse(response, z.object({ success: z.boolean() }));
  },
};
