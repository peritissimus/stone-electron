/**
 * Performance IPC Adapter - Handles performance monitoring IPC channels
 */

import { ipcMain, BrowserWindow } from 'electron';
import { PERFORMANCE_CHANNELS } from '@shared/constants/ipcChannels';
import { handleIpcRequest } from '@main/shared/utils';
import { logger } from '../../../shared';
import type {
  PerformanceSnapshot,
  MemoryMetrics,
  CPUMetrics,
  IPCMetrics,
  DatabaseMetrics,
  StartupMetrics,
} from '../../../domain/ports/out/IPerformanceMonitor';

export interface PerformanceIPCDeps {
  getSnapshot: (sinceMs?: number) => PerformanceSnapshot;
  getMemoryMetrics: () => MemoryMetrics;
  getCPUMetrics: () => CPUMetrics;
  getIPCMetrics: (sinceMs?: number) => IPCMetrics;
  getDatabaseMetrics: (sinceMs?: number) => DatabaseMetrics;
  getStartupMetrics: () => StartupMetrics;
  clearHistory: () => void;
  getRendererMetrics: (window: BrowserWindow | null) => Promise<Record<string, unknown> | null>;
}

let mainWindowRef: BrowserWindow | null = null;

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindowRef = window;
}

export function registerPerformanceHandlers(deps: PerformanceIPCDeps): void {
  const {
    getSnapshot,
    getMemoryMetrics,
    getCPUMetrics,
    getIPCMetrics,
    getDatabaseMetrics,
    getStartupMetrics,
    clearHistory,
    getRendererMetrics,
  } = deps;

  const handleRequest = <T>(fn: () => Promise<T>, context?: Record<string, unknown>) =>
    handleIpcRequest(fn, { loggerPrefix: 'PerformanceIPC', defaultCode: 'INTERNAL_ERROR', context });

  // Get full performance snapshot
  ipcMain.handle(PERFORMANCE_CHANNELS.GET_SNAPSHOT, async (_event, sinceMs?: number) => {
    return handleRequest(
      async () => {
        const mainProcessMetrics = getSnapshot(sinceMs);
        const rendererMetrics = await getRendererMetrics(mainWindowRef);
        return {
          ...mainProcessMetrics,
          renderer: rendererMetrics,
        };
      },
      { channel: PERFORMANCE_CHANNELS.GET_SNAPSHOT },
    );
  });

  // Get memory metrics only
  ipcMain.handle(PERFORMANCE_CHANNELS.GET_MEMORY, async () => {
    return handleRequest(
      async () => getMemoryMetrics(),
      { channel: PERFORMANCE_CHANNELS.GET_MEMORY },
    );
  });

  // Get CPU metrics only
  ipcMain.handle(PERFORMANCE_CHANNELS.GET_CPU, async () => {
    return handleRequest(
      async () => getCPUMetrics(),
      { channel: PERFORMANCE_CHANNELS.GET_CPU },
    );
  });

  // Get IPC statistics
  ipcMain.handle(PERFORMANCE_CHANNELS.GET_IPC_STATS, async (_event, sinceMs?: number) => {
    return handleRequest(
      async () => getIPCMetrics(sinceMs),
      { channel: PERFORMANCE_CHANNELS.GET_IPC_STATS },
    );
  });

  // Get database statistics
  ipcMain.handle(PERFORMANCE_CHANNELS.GET_DB_STATS, async (_event, sinceMs?: number) => {
    return handleRequest(
      async () => getDatabaseMetrics(sinceMs),
      { channel: PERFORMANCE_CHANNELS.GET_DB_STATS },
    );
  });

  // Get startup metrics
  ipcMain.handle(PERFORMANCE_CHANNELS.GET_STARTUP, async () => {
    return handleRequest(
      async () => getStartupMetrics(),
      { channel: PERFORMANCE_CHANNELS.GET_STARTUP },
    );
  });

  // Clear performance history
  ipcMain.handle(PERFORMANCE_CHANNELS.CLEAR_HISTORY, async () => {
    return handleRequest(
      async () => {
        clearHistory();
        return { success: true };
      },
      { channel: PERFORMANCE_CHANNELS.CLEAR_HISTORY },
    );
  });

  logger.info('[IPC] Performance handlers registered');
}

export function unregisterPerformanceHandlers(): void {
  ipcMain.removeHandler(PERFORMANCE_CHANNELS.GET_SNAPSHOT);
  ipcMain.removeHandler(PERFORMANCE_CHANNELS.GET_MEMORY);
  ipcMain.removeHandler(PERFORMANCE_CHANNELS.GET_CPU);
  ipcMain.removeHandler(PERFORMANCE_CHANNELS.GET_IPC_STATS);
  ipcMain.removeHandler(PERFORMANCE_CHANNELS.GET_DB_STATS);
  ipcMain.removeHandler(PERFORMANCE_CHANNELS.GET_STARTUP);
  ipcMain.removeHandler(PERFORMANCE_CHANNELS.CLEAR_HISTORY);
}
