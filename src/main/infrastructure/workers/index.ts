/**
 * Infrastructure Workers Module
 *
 * Worker threads for CPU-intensive operations that need to run
 * isolated from the main Electron process.
 */

// Worker files are built separately via vite.worker.config.ts
// This index provides documentation and type exports

export interface WorkerMessage {
  type: string;
  id: string;
  [key: string]: unknown;
}

export interface WorkerResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Embedding worker message types
export interface EmbedMessage extends WorkerMessage {
  type: 'embed';
  text: string;
}

export interface BatchEmbedMessage extends WorkerMessage {
  type: 'batchEmbed';
  texts: string[];
}

export interface InitMessage extends WorkerMessage {
  type: 'init';
}

export interface PingMessage extends WorkerMessage {
  type: 'ping';
}

export interface ShutdownMessage extends WorkerMessage {
  type: 'shutdown';
}

export type EmbeddingWorkerMessage =
  | EmbedMessage
  | BatchEmbedMessage
  | InitMessage
  | PingMessage
  | ShutdownMessage;
