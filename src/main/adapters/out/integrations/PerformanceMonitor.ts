/**
 * PerformanceMonitor — adapter implementing IPerformanceMonitor.
 *
 * Implements: domain/ports/out/IPerformanceMonitor.ts#IPerformanceMonitor
 */

import { performance, PerformanceObserver } from 'node:perf_hooks';
import type { BrowserWindow } from 'electron';
import type {
  IPerformanceMonitor,
  RendererWindowHandle,
  StartupMetrics,
  MemoryMetrics,
  CPUMetrics,
  EventLoopMetrics,
  IPCMetrics,
  ChannelStats,
  DatabaseMetrics,
  OperationStats,
  PerformanceSnapshot,
} from '../../../domain/ports/out/IPerformanceMonitor';
import { logger } from '../../../shared/utils/logger';

type CpuUsage = ReturnType<typeof process.cpuUsage>;

interface IPCCall {
  channel: string;
  durationMs: number;
  success: boolean;
  timestamp: number;
}

interface DBQuery {
  adapter: string;
  operation: string;
  durationMs: number;
  success: boolean;
  timestamp: number;
}

export class PerformanceMonitor implements IPerformanceMonitor {
  private startupMetrics: StartupMetrics;
  private ipcCalls: IPCCall[] = [];
  private dbQueries: DBQuery[] = [];
  private lastCPUUsage: CpuUsage | null = null;
  private lastCPUTime: number = 0;
  private eventLoopLag: number = 0;
  private lagCheckInterval: ReturnType<typeof setInterval> | null = null;
  private gcObserver: PerformanceObserver | null = null;
  private readonly maxHistorySize = 10000; // Keep last 10k records
  private readonly slowQueryThresholdMs = 100;

  constructor() {
    this.startupMetrics = {
      appStartTime: performance.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Startup Tracking
  // --------------------------------------------------------------------------

  markStartupPhase(phase: keyof Omit<StartupMetrics, 'appStartTime' | 'totalStartupTime'>): void {
    const elapsed = performance.now() - this.startupMetrics.appStartTime;
    (this.startupMetrics as unknown as Record<string, number>)[phase] = elapsed;
    logger.debug(`[Perf] Startup phase "${phase}" completed in ${elapsed.toFixed(2)}ms`);
  }

  markStartupComplete(): void {
    this.startupMetrics.totalStartupTime = performance.now() - this.startupMetrics.appStartTime;
    logger.info('[Perf] Startup complete', {
      totalMs: this.startupMetrics.totalStartupTime.toFixed(2),
      phases: this.startupMetrics,
    });
  }

  markWindowReady(): void {
    this.startupMetrics.windowReadyTime = performance.now() - this.startupMetrics.appStartTime;
    logger.info(`[Perf] Window ready in ${this.startupMetrics.windowReadyTime.toFixed(2)}ms`);
  }

  // --------------------------------------------------------------------------
  // IPC Tracking
  // --------------------------------------------------------------------------

  recordIPCCall(channel: string, durationMs: number, success: boolean): void {
    this.ipcCalls.push({
      channel,
      durationMs,
      success,
      timestamp: Date.now(),
    });

    // Trim history if needed
    if (this.ipcCalls.length > this.maxHistorySize) {
      this.ipcCalls = this.ipcCalls.slice(-this.maxHistorySize);
    }
  }

  // --------------------------------------------------------------------------
  // Database Tracking
  // --------------------------------------------------------------------------

  recordDBQuery(adapter: string, operation: string, durationMs: number, success: boolean): void {
    this.dbQueries.push({
      adapter,
      operation,
      durationMs,
      success,
      timestamp: Date.now(),
    });

    // Log slow queries
    if (durationMs > this.slowQueryThresholdMs) {
      logger.warn(`[Perf] Slow query: ${adapter}.${operation} took ${durationMs.toFixed(2)}ms`);
    }

    // Trim history if needed
    if (this.dbQueries.length > this.maxHistorySize) {
      this.dbQueries = this.dbQueries.slice(-this.maxHistorySize);
    }
  }

  // --------------------------------------------------------------------------
  // Continuous Monitoring
  // --------------------------------------------------------------------------

  startMonitoring(): void {
    // Event loop lag monitoring
    this.lagCheckInterval = setInterval(() => {
      const start = performance.now();
      setImmediate(() => {
        this.eventLoopLag = performance.now() - start;
      });
    }, 1000);

    // GC monitoring (if available)
    try {
      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            logger.debug(`[Perf] GC: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
          }
        }
      });
      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch {
      // GC observation not available
    }

    logger.info('[Perf] Performance monitoring started');
  }

  stopMonitoring(): void {
    if (this.lagCheckInterval) {
      clearInterval(this.lagCheckInterval);
      this.lagCheckInterval = null;
    }
    if (this.gcObserver) {
      this.gcObserver.disconnect();
      this.gcObserver = null;
    }
    logger.info('[Perf] Performance monitoring stopped');
  }

  // --------------------------------------------------------------------------
  // Metrics Collection
  // --------------------------------------------------------------------------

  getMemoryMetrics(): MemoryMetrics {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
      arrayBuffers: mem.arrayBuffers,
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
    };
  }

  getCPUMetrics(): CPUMetrics {
    const cpuUsage = process.cpuUsage(this.lastCPUUsage ?? undefined);
    const now = performance.now();
    const elapsed = this.lastCPUTime ? now - this.lastCPUTime : 1000;

    this.lastCPUUsage = process.cpuUsage();
    this.lastCPUTime = now;

    // Convert microseconds to milliseconds
    const userMs = cpuUsage.user / 1000;
    const systemMs = cpuUsage.system / 1000;
    const totalMs = userMs + systemMs;

    // Calculate CPU percentage (relative to elapsed time)
    const percentCPU = Math.min(100, (totalMs / elapsed) * 100);

    return {
      user: userMs,
      system: systemMs,
      percentCPU: Math.round(percentCPU * 100) / 100,
    };
  }

  getEventLoopMetrics(): EventLoopMetrics {
    // Event loop utilization (Node 14+)
    let utilization = 0;
    try {
      const elu = (performance as unknown as { eventLoopUtilization?: () => { utilization: number } })
        .eventLoopUtilization?.();
      if (elu) {
        utilization = elu.utilization * 100;
      }
    } catch {
      // Not available
    }

    return {
      lagMs: Math.round(this.eventLoopLag * 100) / 100,
      utilizationPercent: Math.round(utilization * 100) / 100,
    };
  }

  getIPCMetrics(sinceMs?: number): IPCMetrics {
    const cutoff = sinceMs ? Date.now() - sinceMs : 0;
    const calls = this.ipcCalls.filter((c) => c.timestamp >= cutoff);

    const durations = calls.map((c) => c.durationMs).sort((a, b) => a - b);
    const totalCalls = calls.length;
    const totalErrors = calls.filter((c) => !c.success).length;

    const callsByChannel: Record<string, ChannelStats> = {};
    for (const call of calls) {
      if (!callsByChannel[call.channel]) {
        callsByChannel[call.channel] = {
          calls: 0,
          errors: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          minDurationMs: Infinity,
          maxDurationMs: 0,
        };
      }
      const stats = callsByChannel[call.channel];
      stats.calls++;
      if (!call.success) stats.errors++;
      stats.totalDurationMs += call.durationMs;
      stats.minDurationMs = Math.min(stats.minDurationMs, call.durationMs);
      stats.maxDurationMs = Math.max(stats.maxDurationMs, call.durationMs);
    }

    // Calculate averages
    for (const channel in callsByChannel) {
      const stats = callsByChannel[channel];
      stats.avgDurationMs = stats.calls > 0 ? stats.totalDurationMs / stats.calls : 0;
      if (stats.minDurationMs === Infinity) stats.minDurationMs = 0;
    }

    return {
      totalCalls,
      totalErrors,
      avgDurationMs: totalCalls > 0 ? durations.reduce((a, b) => a + b, 0) / totalCalls : 0,
      p50DurationMs: this.percentile(durations, 50),
      p95DurationMs: this.percentile(durations, 95),
      p99DurationMs: this.percentile(durations, 99),
      callsByChannel,
    };
  }

  getDatabaseMetrics(sinceMs?: number): DatabaseMetrics {
    const cutoff = sinceMs ? Date.now() - sinceMs : 0;
    const queries = this.dbQueries.filter((q) => q.timestamp >= cutoff);

    const totalQueries = queries.length;
    const totalErrors = queries.filter((q) => !q.success).length;
    const slowQueries = queries.filter((q) => q.durationMs > this.slowQueryThresholdMs).length;
    const durations = queries.map((q) => q.durationMs);

    const queriesByOperation: Record<string, OperationStats> = {};
    for (const query of queries) {
      const key = `${query.adapter}.${query.operation}`;
      if (!queriesByOperation[key]) {
        queriesByOperation[key] = {
          count: 0,
          errors: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          minDurationMs: Infinity,
          maxDurationMs: 0,
        };
      }
      const stats = queriesByOperation[key];
      stats.count++;
      if (!query.success) stats.errors++;
      stats.totalDurationMs += query.durationMs;
      stats.minDurationMs = Math.min(stats.minDurationMs, query.durationMs);
      stats.maxDurationMs = Math.max(stats.maxDurationMs, query.durationMs);
    }

    // Calculate averages
    for (const op in queriesByOperation) {
      const stats = queriesByOperation[op];
      stats.avgDurationMs = stats.count > 0 ? stats.totalDurationMs / stats.count : 0;
      if (stats.minDurationMs === Infinity) stats.minDurationMs = 0;
    }

    return {
      totalQueries,
      totalErrors,
      avgDurationMs: totalQueries > 0 ? durations.reduce((a, b) => a + b, 0) / totalQueries : 0,
      slowQueries,
      queriesByOperation,
    };
  }

  // --------------------------------------------------------------------------
  // Full Snapshot
  // --------------------------------------------------------------------------

  getSnapshot(sinceMs?: number): PerformanceSnapshot {
    return {
      timestamp: Date.now(),
      uptime: process.uptime(),
      startup: { ...this.startupMetrics },
      memory: this.getMemoryMetrics(),
      cpu: this.getCPUMetrics(),
      eventLoop: this.getEventLoopMetrics(),
      ipc: this.getIPCMetrics(sinceMs),
      database: this.getDatabaseMetrics(sinceMs),
    };
  }

  // --------------------------------------------------------------------------
  // Renderer Metrics
  // --------------------------------------------------------------------------

  async getRendererMetrics(
    handle: RendererWindowHandle | null,
  ): Promise<Record<string, unknown> | null> {
    const window = handle as BrowserWindow | null;
    if (!window || window.isDestroyed()) return null;

    try {
      // Get process metrics from Electron
      const metrics = await window.webContents.executeJavaScript(`
        (function() {
          const perf = window.performance;
          const memory = perf.memory || {};
          const timing = perf.timing || {};
          const entries = perf.getEntriesByType('navigation')[0] || {};

          return {
            memory: {
              usedJSHeapSize: memory.usedJSHeapSize || 0,
              totalJSHeapSize: memory.totalJSHeapSize || 0,
              jsHeapSizeLimit: memory.jsHeapSizeLimit || 0,
            },
            navigation: {
              domContentLoaded: entries.domContentLoadedEventEnd - entries.fetchStart,
              loadComplete: entries.loadEventEnd - entries.fetchStart,
              domInteractive: entries.domInteractive - entries.fetchStart,
            },
            fps: window.__STONE_PERF__?.fps || null,
            longTasks: window.__STONE_PERF__?.longTasks || [],
          };
        })()
      `);
      return metrics;
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  clearHistory(): void {
    this.ipcCalls = [];
    this.dbQueries = [];
    logger.info('[Perf] Performance history cleared');
  }
}

// Export singleton
let instance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!instance) {
    instance = new PerformanceMonitor();
  }
  return instance;
}
