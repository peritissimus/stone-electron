/**
 * ML Service Status Types
 *
 * Shared types for tracking embedding and classification operations
 */

export type MLServiceStatus = 'idle' | 'initializing' | 'ready' | 'error';

export type MLOperationType =
  | 'model-loading'
  | 'classify-note'
  | 'classify-all'
  | 'reclassify-all'
  | 'semantic-search'
  | 'compute-centroids';

export interface MLServiceState {
  status: MLServiceStatus;
  error?: string;
  model?: {
    name: string;
    dims: number;
  };
}

export interface MLOperation {
  id: string;
  type: MLOperationType;
  status: 'pending' | 'running' | 'completed' | 'error';
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
  startedAt: number;
  completedAt?: number;
  error?: string;
}

export interface MLStatusUpdate {
  service: MLServiceState;
  currentOperation?: MLOperation;
  recentOperations: MLOperation[];
}

// Event payloads
export interface MLStatusChangedPayload {
  status: MLServiceStatus;
  error?: string;
  model?: { name: string; dims: number };
}

export interface MLOperationStartedPayload {
  id: string;
  type: MLOperationType;
  totalItems?: number;
  message?: string;
}

export interface MLOperationProgressPayload {
  id: string;
  current: number;
  total: number;
  message?: string;
}

/** Per-file download progress while a local model's weights are fetched. */
export interface MLModelDownloadProgressPayload {
  /** Which model is downloading. */
  model: 'embedding' | 'whisper' | 'reranker';
  /** File within the model repo (the .onnx weights dominate). */
  file: string;
  /** Bytes downloaded so far for this file. */
  loaded: number;
  /** Total bytes for this file (0 if unknown). */
  total: number;
}

export interface MLOperationCompletedPayload {
  id: string;
  type: MLOperationType;
  results?: unknown;
}

export interface MLOperationErrorPayload {
  id: string;
  type: MLOperationType;
  error: string;
}
