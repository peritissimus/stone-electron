/**
 * Embedding Worker - Runs transformers.js in a worker thread
 *
 * Worker threads have `self` defined (like browsers), so no polyfill needed.
 * This isolates heavy ML operations from the main Electron process.
 */

import { parentPort, workerData } from 'worker_threads';

// Types for messages
interface InitMessage {
  type: 'init';
  id: string;
}

interface EmbedMessage {
  type: 'embed';
  id: string;
  text: string;
}

interface BatchEmbedMessage {
  type: 'batchEmbed';
  id: string;
  texts: string[];
}

interface PingMessage {
  type: 'ping';
  id: string;
}

interface ShutdownMessage {
  type: 'shutdown';
  id: string;
}

type WorkerMessage = InitMessage | EmbedMessage | BatchEmbedMessage | PingMessage | ShutdownMessage;

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Model configuration
const MODEL_NAME = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIMS = 384;

// Pipeline instance
type Pipeline = Awaited<ReturnType<(typeof import('@xenova/transformers'))['pipeline']>>;
let pipeline: Pipeline | null = null;
let initialized = false;

/**
 * Initialize the embedding model
 */
async function initialize(): Promise<{ model: string; dims: number }> {
  if (initialized && pipeline) {
    return { model: MODEL_NAME, dims: EMBEDDING_DIMS };
  }

  const { pipeline: createPipeline, env } = await import('@xenova/transformers');

  // Configure for Node.js environment
  env.allowLocalModels = true;
  env.useBrowserCache = false;

  // Default cache dir is inside the package install path, which lives in
  // app.asar in packaged builds and is read-only. Main process passes a
  // writable userData path via workerData.
  const cacheDir = (workerData as { cacheDir?: string } | null)?.cacheDir;
  if (cacheDir) {
    env.cacheDir = cacheDir;
  }

  // Create feature extraction pipeline with quantized model
  pipeline = await createPipeline('feature-extraction', MODEL_NAME, {
    quantized: true,
  });

  initialized = true;
  return { model: MODEL_NAME, dims: EMBEDDING_DIMS };
}

/**
 * Generate embedding for a single text
 */
async function getEmbedding(text: string): Promise<number[]> {
  if (!initialized || !pipeline) {
    await initialize();
  }

  if (!text || text.trim().length === 0) {
    return new Array(EMBEDDING_DIMS).fill(0);
  }

  const output = await pipeline!(text, {
    pooling: 'mean',
    normalize: true,
  } as any);

  const tensor = output as { data: Float32Array };
  return Array.from(tensor.data);
}

/**
 * Generate embeddings for multiple texts
 */
async function batchEmbed(texts: string[]): Promise<number[][]> {
  if (!initialized || !pipeline) {
    await initialize();
  }

  if (texts.length === 0) {
    return [];
  }

  // Track non-empty texts
  const nonEmptyIndices: number[] = [];
  const nonEmptyTexts: string[] = [];

  texts.forEach((text, i) => {
    if (text && text.trim().length > 0) {
      nonEmptyIndices.push(i);
      nonEmptyTexts.push(text);
    }
  });

  if (nonEmptyTexts.length === 0) {
    return texts.map(() => new Array(EMBEDDING_DIMS).fill(0));
  }

  // Process texts
  const outputs = await Promise.all(
    nonEmptyTexts.map((text) =>
      pipeline!(text, {
        pooling: 'mean',
        normalize: true,
      } as any),
    ),
  );

  // Reconstruct with zero vectors for empty texts
  const result: number[][] = texts.map(() => new Array(EMBEDDING_DIMS).fill(0));

  outputs.forEach((output, i) => {
    const originalIndex = nonEmptyIndices[i];
    const tensor = output as { data: Float32Array };
    result[originalIndex] = Array.from(tensor.data);
  });

  return result;
}

/**
 * Send response back to main thread
 */
function respond(response: WorkerResponse): void {
  parentPort?.postMessage(response);
}

/**
 * Handle incoming messages from main thread
 */
parentPort?.on('message', async (message: WorkerMessage) => {
  const { type, id } = message;

  try {
    switch (type) {
      case 'init': {
        const result = await initialize();
        respond({ id, success: true, data: result });
        break;
      }

      case 'embed': {
        const embedding = await getEmbedding((message as EmbedMessage).text);
        respond({ id, success: true, data: embedding });
        break;
      }

      case 'batchEmbed': {
        const embeddings = await batchEmbed((message as BatchEmbedMessage).texts);
        respond({ id, success: true, data: embeddings });
        break;
      }

      case 'ping': {
        const info = initialized ? { model: MODEL_NAME, dims: EMBEDDING_DIMS } : await initialize();
        respond({ id, success: true, data: info });
        break;
      }

      case 'shutdown': {
        pipeline = null;
        initialized = false;
        respond({ id, success: true });
        break;
      }

      default:
        respond({ id, success: false, error: `Unknown message type: ${type}` });
    }
  } catch (error) {
    respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Signal ready
parentPort?.postMessage({ type: 'ready' });
