/**
 * MLStatusService - Tracks and broadcasts ML operation status
 *
 * Provides a central place to track embedding service status and
 * classification operations, broadcasting updates to the renderer.
 */

import { BrowserWindow } from 'electron';
import { nanoid } from 'nanoid';
import { EVENTS } from '@shared/constants/ipcChannels';
import {
  MLServiceStatus,
  MLOperationType,
  MLOperation,
  MLServiceState,
  MLStatusChangedPayload,
  MLOperationStartedPayload,
  MLOperationProgressPayload,
  MLOperationCompletedPayload,
  MLOperationErrorPayload,
} from '@shared/types/mlStatus';
import { logger } from '../utils/logger';

const MAX_RECENT_OPERATIONS = 10;

class MLStatusService {
  private serviceState: MLServiceState = {
    status: 'idle',
  };

  private currentOperation: MLOperation | null = null;
  private recentOperations: MLOperation[] = [];

  /**
   * Get current service state
   */
  getServiceState(): MLServiceState {
    return { ...this.serviceState };
  }

  /**
   * Get current operation
   */
  getCurrentOperation(): MLOperation | null {
    return this.currentOperation ? { ...this.currentOperation } : null;
  }

  /**
   * Get recent operations
   */
  getRecentOperations(): MLOperation[] {
    return [...this.recentOperations];
  }

  /**
   * Get full status
   */
  getStatus() {
    return {
      service: this.getServiceState(),
      currentOperation: this.getCurrentOperation(),
      recentOperations: this.getRecentOperations(),
    };
  }

  /**
   * Update service status (e.g., initializing, ready, error)
   */
  setServiceStatus(
    status: MLServiceStatus,
    options?: { error?: string; model?: { name: string; dims: number } }
  ): void {
    this.serviceState = {
      status,
      error: options?.error,
      model: options?.model,
    };

    const payload: MLStatusChangedPayload = {
      status,
      error: options?.error,
      model: options?.model,
    };

    this.broadcast(EVENTS.ML_STATUS_CHANGED, payload);
    logger.info(`[MLStatus] Service status: ${status}`, options);
  }

  /**
   * Start a new operation
   */
  startOperation(type: MLOperationType, options?: { totalItems?: number; message?: string }): string {
    const id = nanoid();

    this.currentOperation = {
      id,
      type,
      status: 'running',
      progress: options?.totalItems
        ? { current: 0, total: options.totalItems, message: options.message }
        : undefined,
      startedAt: Date.now(),
    };

    const payload: MLOperationStartedPayload = {
      id,
      type,
      totalItems: options?.totalItems,
      message: options?.message,
    };

    this.broadcast(EVENTS.ML_OPERATION_STARTED, payload);
    logger.info(`[MLStatus] Operation started: ${type}`, { id, ...options });

    return id;
  }

  /**
   * Update operation progress
   */
  updateProgress(id: string, current: number, total: number, message?: string): void {
    if (this.currentOperation?.id !== id) return;

    this.currentOperation.progress = { current, total, message };

    const payload: MLOperationProgressPayload = { id, current, total, message };
    this.broadcast(EVENTS.ML_OPERATION_PROGRESS, payload);

    // Log progress at intervals
    if (current % 10 === 0 || current === total) {
      logger.debug(`[MLStatus] Progress: ${current}/${total}`, { id, message });
    }
  }

  /**
   * Complete an operation
   */
  completeOperation(id: string, results?: unknown): void {
    if (this.currentOperation?.id !== id) return;

    this.currentOperation.status = 'completed';
    this.currentOperation.completedAt = Date.now();

    // Add to recent operations
    this.recentOperations.unshift({ ...this.currentOperation });
    if (this.recentOperations.length > MAX_RECENT_OPERATIONS) {
      this.recentOperations.pop();
    }

    const payload: MLOperationCompletedPayload = {
      id,
      type: this.currentOperation.type,
      results,
    };

    this.broadcast(EVENTS.ML_OPERATION_COMPLETED, payload);
    logger.info(`[MLStatus] Operation completed: ${this.currentOperation.type}`, {
      id,
      duration: this.currentOperation.completedAt - this.currentOperation.startedAt,
    });

    this.currentOperation = null;
  }

  /**
   * Mark operation as failed
   */
  failOperation(id: string, error: string): void {
    if (this.currentOperation?.id !== id) return;

    this.currentOperation.status = 'error';
    this.currentOperation.error = error;
    this.currentOperation.completedAt = Date.now();

    // Add to recent operations
    this.recentOperations.unshift({ ...this.currentOperation });
    if (this.recentOperations.length > MAX_RECENT_OPERATIONS) {
      this.recentOperations.pop();
    }

    const payload: MLOperationErrorPayload = {
      id,
      type: this.currentOperation.type,
      error,
    };

    this.broadcast(EVENTS.ML_OPERATION_ERROR, payload);
    logger.error(`[MLStatus] Operation failed: ${this.currentOperation.type}`, { id, error });

    this.currentOperation = null;
  }

  /**
   * Broadcast event to all renderer windows
   */
  private broadcast(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }
}

// Singleton instance
let instance: MLStatusService | null = null;

export function getMLStatusService(): MLStatusService {
  instance ??= new MLStatusService();
  return instance;
}

export function createMLStatusService(): MLStatusService {
  return new MLStatusService();
}
