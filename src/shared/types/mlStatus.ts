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
