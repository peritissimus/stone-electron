/**
 * Event Subscription Utilities - Centralized event listener management
 *
 * This module provides type-safe wrappers for Electron IPC event subscriptions,
 * abstracting the direct window.electron.on usage.
 */

import { EVENTS } from '@shared/constants/ipcChannels';

/**
 * Event handler function type
 */
export type EventHandler = (...args: unknown[]) => void;

/**
 * Unsubscribe function returned when subscribing to an event
 */
export type Unsubscribe = () => void;

/**
 * Subscribe to an IPC event from the main process
 *
 * @param event - The event name from EVENTS constant
 * @param handler - Callback function to handle the event
 * @returns Unsubscribe function to remove the listener
 *
 * @example
 * useEffect(() => {
 *   const unsubscribe = subscribe(EVENTS.NOTE_UPDATED, (payload) => {
 *     console.log('Note updated:', payload);
 *   });
 *   return unsubscribe;
 * }, []);
 */
export function subscribe(
  event: string,
  handler: EventHandler
): Unsubscribe {
  const off = window.electron.on(event, handler);
  return () => off?.();
}

/**
 * Subscribe to multiple events with a single handler
 *
 * @param events - Array of event names
 * @param handler - Callback function to handle all events
 * @returns Unsubscribe function to remove all listeners
 *
 * @example
 * useEffect(() => {
 *   const unsubscribe = subscribeMany(
 *     [EVENTS.FILE_CREATED, EVENTS.FILE_CHANGED, EVENTS.FILE_DELETED],
 *     () => refreshFileTree()
 *   );
 *   return unsubscribe;
 * }, []);
 */
export function subscribeMany(
  events: string[],
  handler: EventHandler
): Unsubscribe {
  const unsubscribers = events.map((event) => subscribe(event, handler));
  return () => unsubscribers.forEach((unsub) => unsub());
}

/**
 * Pre-configured event subscribers for common events
 */
export const events = {
  /**
   * Subscribe to file system events
   */
  onFileCreated: (handler: EventHandler) =>
    subscribe(EVENTS.FILE_CREATED, handler),

  onFileChanged: (handler: EventHandler) =>
    subscribe(EVENTS.FILE_CHANGED, handler),

  onFileDeleted: (handler: EventHandler) =>
    subscribe(EVENTS.FILE_DELETED, handler),

  /**
   * Subscribe to note events
   */
  onNoteUpdated: (handler: EventHandler) =>
    subscribe(EVENTS.NOTE_UPDATED, handler),

  onNoteDeleted: (handler: EventHandler) =>
    subscribe(EVENTS.NOTE_DELETED, handler),

  /**
   * Subscribe to workspace events
   */
  onWorkspaceUpdated: (handler: EventHandler) =>
    subscribe(EVENTS.WORKSPACE_UPDATED, handler),

  /**
   * Subscribe to all file system events with a single handler
   */
  onFileSystemChange: (handler: EventHandler) =>
    subscribeMany(
      [EVENTS.FILE_CREATED, EVENTS.FILE_CHANGED, EVENTS.FILE_DELETED],
      handler
    ),
};
