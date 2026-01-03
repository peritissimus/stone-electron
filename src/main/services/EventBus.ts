/**
 * EventBus - Centralized event emission
 *
 * Transport-aware event bus that works in both Electron and standalone modes.
 * - Electron mode: Broadcasts to BrowserWindow instances
 * - Standalone mode: Uses EventEmitter for in-process events
 *
 * For real-time updates in standalone mode, connect via WebSocket (future enhancement).
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

type EventData = Record<string, unknown>;

/**
 * Get BrowserWindow if available (lazy load for testability)
 */
function getBrowserWindow(): typeof import('electron').BrowserWindow | null {
  try {
    // Dynamic import to avoid errors in standalone mode
    const electron = require('electron');
    if (electron.BrowserWindow) {
      return electron.BrowserWindow;
    }
  } catch {
    // Not in Electron environment
  }
  return null;
}

/**
 * EventBus handles all event broadcasting
 */
class EventBus {
  private debugMode = false;
  private readonly emitter = new EventEmitter();
  private readonly subscribers = new Set<(event: string, data?: EventData) => void>();

  constructor() {
    // Increase max listeners for standalone mode
    this.emitter.setMaxListeners(100);
  }

  /**
   * Enable/disable debug logging for events
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Check if running in Electron mode
   */
  isElectronMode(): boolean {
    return getBrowserWindow() !== null;
  }

  /**
   * Emit an event to all listeners
   * - In Electron: broadcasts to all BrowserWindow instances
   * - In standalone: emits via EventEmitter + notifies subscribers
   */
  emit(eventName: string, data?: EventData): void {
    if (this.debugMode) {
      logger.debug(`[EventBus] Emitting "${eventName}"`);
    }

    // Electron mode: broadcast to windows
    const BrowserWindow = getBrowserWindow();
    if (BrowserWindow) {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(eventName, data);
        }
      }
    }

    // Always emit via EventEmitter (for in-process listeners)
    this.emitter.emit(eventName, data);

    // Notify external subscribers (for WebSocket, SSE, etc.)
    for (const subscriber of this.subscribers) {
      try {
        subscriber(eventName, data);
      } catch (error) {
        logger.error(`[EventBus] Subscriber error for "${eventName}":`, error);
      }
    }
  }

  /**
   * Emit an event to a specific window (Electron only)
   */
  emitTo(windowId: number, eventName: string, data?: EventData): void {
    const BrowserWindow = getBrowserWindow();
    if (!BrowserWindow) {
      logger.warn(`[EventBus] emitTo() called in standalone mode`);
      return;
    }

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
   * Emit an event to the focused window only (Electron only)
   */
  emitToFocused(eventName: string, data?: EventData): void {
    const BrowserWindow = getBrowserWindow();
    if (!BrowserWindow) {
      logger.warn(`[EventBus] emitToFocused() called in standalone mode`);
      return;
    }

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

  /**
   * Subscribe to events (for in-process listeners)
   */
  on(eventName: string, listener: (data?: EventData) => void): void {
    this.emitter.on(eventName, listener);
  }

  /**
   * Unsubscribe from events
   */
  off(eventName: string, listener: (data?: EventData) => void): void {
    this.emitter.off(eventName, listener);
  }

  /**
   * Subscribe to ALL events (useful for WebSocket/SSE broadcasting)
   */
  subscribe(callback: (event: string, data?: EventData) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
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

// ==========================================================================
// Singleton for backward compatibility (IPC handlers)
// ==========================================================================

let instance: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!instance) {
    instance = new EventBus();
  }
  return instance;
}

/**
 * Create EventBus instance (for DI container)
 */
export function createEventBus(): EventBus {
  return new EventBus();
}

export { EventBus };
