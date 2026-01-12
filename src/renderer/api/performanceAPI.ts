/**
 * Performance API - IPC channel wrappers for performance monitoring
 *
 * Pure functions that wrap IPC channels. No React, no stores.
 */

import { invokeIpc } from '@renderer/lib/ipc';
import { PERFORMANCE_CHANNELS } from '@shared/constants/ipcChannels';
import type { IpcResponse } from '@shared/types';

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
  getSnapshot: (sinceMs?: number): Promise<IpcResponse<PerformanceSnapshot>> =>
    invokeIpc(PERFORMANCE_CHANNELS.GET_SNAPSHOT, sinceMs),

  /**
   * Get memory metrics only
   */
  getMemory: (): Promise<IpcResponse<MemoryMetrics>> =>
    invokeIpc(PERFORMANCE_CHANNELS.GET_MEMORY, {}),

  /**
   * Get CPU metrics only
   */
  getCPU: (): Promise<IpcResponse<CPUMetrics>> =>
    invokeIpc(PERFORMANCE_CHANNELS.GET_CPU, {}),

  /**
   * Get IPC call statistics
   * @param sinceMs - Only include stats from last N milliseconds
   */
  getIPCStats: (sinceMs?: number): Promise<IpcResponse<IPCMetrics>> =>
    invokeIpc(PERFORMANCE_CHANNELS.GET_IPC_STATS, sinceMs),

  /**
   * Get database query statistics
   * @param sinceMs - Only include stats from last N milliseconds
   */
  getDBStats: (sinceMs?: number): Promise<IpcResponse<DatabaseMetrics>> =>
    invokeIpc(PERFORMANCE_CHANNELS.GET_DB_STATS, sinceMs),

  /**
   * Get startup timing metrics
   */
  getStartup: (): Promise<IpcResponse<StartupMetrics>> =>
    invokeIpc(PERFORMANCE_CHANNELS.GET_STARTUP, {}),

  /**
   * Clear performance history (resets IPC/DB stats)
   */
  clearHistory: (): Promise<IpcResponse<{ success: boolean }>> =>
    invokeIpc(PERFORMANCE_CHANNELS.CLEAR_HISTORY, {}),
};
