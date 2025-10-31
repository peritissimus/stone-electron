/**
 * Preload Script for Electron
 * Exposes IPC to the renderer process in a secure way
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IpcResponse } from '@shared/types';

/**
 * Exposed API for renderer process
 */
const api = {
  /**
   * Invoke an IPC handler
   */
  invoke: <T = unknown>(channel: string, ...args: unknown[]): Promise<IpcResponse<T>> => {
    return ipcRenderer.invoke(channel, ...args);
  },

  /**
   * Listen to an IPC event
   */
  on: (channel: string, listener: (...args: unknown[]) => void) => {
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
