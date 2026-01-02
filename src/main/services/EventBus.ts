/**
 * EventBus - Centralized event emission for IPC
 *
 * Provides a clean abstraction over Electron's BrowserWindow event broadcasting.
 * All handlers should use this instead of directly calling BrowserWindow.getAllWindows().
 */

import { BrowserWindow } from 'electron';
import { logger } from '../utils/logger';

type EventData = Record<string, unknown>;

/**
 * EventBus handles all IPC event broadcasting
 */
class EventBus {
  private debugMode = false;

  /**
   * Enable/disable debug logging for events
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Emit an event to all renderer windows
   */
  emit(eventName: string, data?: EventData): void {
    const windows = BrowserWindow.getAllWindows();

    if (windows.length === 0) {
      if (this.debugMode) {
        logger.debug(`[EventBus] No windows to emit "${eventName}"`);
      }
      return;
    }

    if (this.debugMode) {
      logger.debug(`[EventBus] Emitting "${eventName}" to ${windows.length} window(s)`);
    }

    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(eventName, data);
      }
    }
  }

  /**
   * Emit an event to a specific window
   */
  emitTo(windowId: number, eventName: string, data?: EventData): void {
    const window = BrowserWindow.fromId(windowId);

    if (!window || window.isDestroyed()) {
      logger.warn(`[EventBus] Window ${windowId} not found for event "${eventName}"`);
      return;
    }

    if (this.debugMode) {
      logger.debug(`[EventBus] Emitting "${eventName}" to window ${windowId}`);
    }

    window.webContents.send(eventName, data);
  }

  /**
   * Emit an event to the focused window only
   */
  emitToFocused(eventName: string, data?: EventData): void {
    const window = BrowserWindow.getFocusedWindow();

    if (!window || window.isDestroyed()) {
      if (this.debugMode) {
        logger.debug(`[EventBus] No focused window for event "${eventName}"`);
      }
      return;
    }

    if (this.debugMode) {
      logger.debug(`[EventBus] Emitting "${eventName}" to focused window`);
    }

    window.webContents.send(eventName, data);
  }

  // ==========================================================================
  // Convenience Methods for Common Events
  // ==========================================================================

  /**
   * Emit entity created event
   */
  emitCreated(entityType: string, eventName: string, entity: EventData): void {
    this.emit(eventName, { [entityType]: entity });
  }

  /**
   * Emit entity updated event
   */
  emitUpdated(entityType: string, eventName: string, entity: EventData): void {
    this.emit(eventName, { [entityType]: entity });
  }

  /**
   * Emit entity deleted event
   */
  emitDeleted(eventName: string, id: string): void {
    this.emit(eventName, { id });
  }
}

// Singleton instance
let instance: EventBus | null = null;

export function getEventBus(): EventBus {
  instance ??= new EventBus();
  return instance;
}

export { EventBus };
