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
const ALLOWED_CHANNELS = new Set<string>(Object.values(ALL_CHANNELS));
const ALLOWED_EVENTS = new Set<string>(Object.values(ALL_EVENTS));

const api = {
  /**
   * Invoke an IPC handler
   */
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> => {
    if (!ALLOWED_CHANNELS.has(channel)) {
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
