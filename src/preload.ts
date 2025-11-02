/**
 * Preload Script for Electron
 * Exposes IPC to the renderer process in a secure way
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IpcResponse } from '@shared/types';
import { ALL_CHANNELS, ALL_EVENTS } from '@shared/constants/ipcChannels';

/**
 * Exposed API for renderer process
 */
const ALLOWED_CHANNELS = new Set<string>(ALL_CHANNELS);
const ALLOWED_EVENTS = new Set<string>(ALL_EVENTS);

// Debug logging
console.log('[PRELOAD] ALL_CHANNELS:', ALL_CHANNELS);
console.log('[PRELOAD] ALLOWED_CHANNELS size:', ALLOWED_CHANNELS.size);
console.log(
  '[PRELOAD] ALLOWED_CHANNELS contains notes:getAll:',
  ALLOWED_CHANNELS.has('notes:getAll'),
);
console.log('[PRELOAD] First 10 allowed channels:', Array.from(ALLOWED_CHANNELS).slice(0, 10));

const api = {
  /**
   * Invoke an IPC handler
   */
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> => {
    console.log(`[PRELOAD] Checking channel: ${channel}, allowed:`, ALLOWED_CHANNELS.has(channel));
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.error(
        `[PRELOAD] Blocked channel: ${channel}. Available channels:`,
        Array.from(ALLOWED_CHANNELS),
      );
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Listen to an IPC event
   */
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_EVENTS.has(channel)) {
      return () => {};
    }
    const subscription = (_event: unknown, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, subscription as any);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription as any);
    };
  },

  /**
   * Send a one-time IPC listener
   */
  once: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_EVENTS.has(channel)) return;
    ipcRenderer.once(channel, (_event: unknown, ...args: unknown[]) => {
      listener(...args);
    });
  },

  /**
   * Remove an IPC listener
   */
  off: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

/**
 * Expose API to window object
 */
contextBridge.exposeInMainWorld('electron', api);

/**
 * Type declaration for window.electron
 */
declare global {
  interface Window {
    electron: typeof api;
  }
}
