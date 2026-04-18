/**
 * IPerformanceMonitor — Port for performance metrics collection.
 *
 * The app needs the ability to observe its own runtime: startup phases, memory,
 * CPU, event-loop lag, IPC throughput, DB query latency. The concrete adapter
 * lives in adapters/out/services/PerformanceMonitor.
 */

import type { BrowserWindow } from 'electron';

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

export interface PerformanceSnapshot {
  timestamp: number;
  uptime: number;
  startup: StartupMetrics;
  memory: MemoryMetrics;
  cpu: CPUMetrics;
  eventLoop: EventLoopMetrics;
  ipc: IPCMetrics;
  database: DatabaseMetrics;
}

export interface IPerformanceMonitor {
  // Startup
  markStartupPhase(phase: keyof Omit<StartupMetrics, 'appStartTime' | 'totalStartupTime'>): void;
  markStartupComplete(): void;
  markWindowReady(): void;

  // Recording
  recordIPCCall(channel: string, durationMs: number, success: boolean): void;
  recordDBQuery(adapter: string, operation: string, durationMs: number, success: boolean): void;

  // Lifecycle
  startMonitoring(): void;
  stopMonitoring(): void;

  // Metrics
  getMemoryMetrics(): MemoryMetrics;
  getCPUMetrics(): CPUMetrics;
  getEventLoopMetrics(): EventLoopMetrics;
  getIPCMetrics(sinceMs?: number): IPCMetrics;
  getDatabaseMetrics(sinceMs?: number): DatabaseMetrics;
  getSnapshot(sinceMs?: number): PerformanceSnapshot;
  getRendererMetrics(window: BrowserWindow | null): Promise<Record<string, unknown> | null>;

  clearHistory(): void;
}
