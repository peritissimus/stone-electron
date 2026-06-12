/**
 * IPC Instrumentation
 *
 * Patches ipcMain.handle so every handler registered afterward reports its
 * duration and outcome to the performance monitor. Must be installed before
 * any IPC handlers are registered.
 */

import { ipcMain } from 'electron';
import { PERFORMANCE_CHANNELS } from '@shared/constants/ipcChannels';

type IpcRecordCallback = (channel: string, durationMs: number, success: boolean) => void;

// Performance polling itself would dominate the stats (one snapshot every 2s
// while the Performance tab is open), so the monitor's own channels are skipped.
const EXCLUDED_CHANNELS = new Set<string>(Object.values(PERFORMANCE_CHANNELS));

let installed = false;
let record: IpcRecordCallback | null = null;

export function instrumentIpcHandlers(callback: IpcRecordCallback): void {
  // The callback is swapped on re-initialization (e.g. container reset) so
  // records always reach the live monitor; ipcMain is only patched once.
  record = callback;
  if (installed) return;
  installed = true;

  const originalHandle = ipcMain.handle.bind(ipcMain);

  ipcMain.handle = (channel: string, listener: Parameters<typeof originalHandle>[1]): void => {
    if (EXCLUDED_CHANNELS.has(channel)) {
      originalHandle(channel, listener);
      return;
    }

    originalHandle(channel, async (event, ...args) => {
      const start = performance.now();
      try {
        const result = await listener(event, ...args);
        // Handlers report failures via a { success: false } envelope rather
        // than throwing, so the envelope is the source of truth when present.
        const success =
          typeof result === 'object' && result !== null && 'success' in result
            ? (result as { success: unknown }).success !== false
            : true;
        record?.(channel, performance.now() - start, success);
        return result;
      } catch (error) {
        record?.(channel, performance.now() - start, false);
        throw error;
      }
    });
  };
}
