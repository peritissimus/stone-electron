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

interface InitRerankerMessage {
  type: 'initReranker';
  id: string;
}

interface RerankMessage {
  type: 'rerank';
  id: string;
  query: string;
  texts: string[];
}

type WorkerMessage =
  | InitMessage
  | EmbedMessage
  | BatchEmbedMessage
  | PingMessage
  | ShutdownMessage
  | InitRerankerMessage
  | RerankMessage;

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// Model configuration
const MODEL_NAME = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIMS = 384;
const RERANKER_MODEL_NAME = 'Xenova/ms-marco-MiniLM-L-6-v2';

// Pipeline instances. Two models share the worker — the embedder is loaded
// eagerly on first request, the reranker lazy-loads on first rerank call so
// users who never hit the AI surface don't pay the memory cost.
type Pipeline = Awaited<ReturnType<(typeof import('@xenova/transformers'))['pipeline']>>;
let pipeline: Pipeline | null = null;
let rerankerPipeline: Pipeline | null = null;
let initialized = false;
let rerankerInitialized = false;

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
 * Initialize the reranker model (lazy — only when the first rerank request
 * arrives, to avoid loading ~30MB of weights for users who never trigger
 * the AI surface).
 */
async function initializeReranker(): Promise<{ model: string }> {
  if (rerankerInitialized && rerankerPipeline) {
    return { model: RERANKER_MODEL_NAME };
  }

  const { pipeline: createPipeline, env } = await import('@xenova/transformers');

  env.allowLocalModels = true;
  env.useBrowserCache = false;
  const cacheDir = (workerData as { cacheDir?: string } | null)?.cacheDir;
  if (cacheDir) {
    env.cacheDir = cacheDir;
  }

  rerankerPipeline = await createPipeline('text-classification', RERANKER_MODEL_NAME, {
    quantized: true,
  });

  rerankerInitialized = true;
  return { model: RERANKER_MODEL_NAME };
}

/**
 * Score (query, text) pairs with the cross-encoder. Higher score = more
 * relevant. ms-marco-MiniLM emits a single-class logit per pair.
 */
async function rerank(query: string, texts: string[]): Promise<number[]> {
  if (!rerankerInitialized || !rerankerPipeline) {
    await initializeReranker();
  }

  if (texts.length === 0) return [];

  // Feed the pair as "query [SEP] text" — transformers.js's text-classification
  // pipeline accepts a `text_pair` option for cross-encoder usage.
  const scores: number[] = [];
  for (const text of texts) {
    const result = (await rerankerPipeline!(query, {
      text_pair: text,
    } as any)) as Array<{ label: string; score: number }> | { label: string; score: number };

    // Pipeline can return either a single object or an array depending on
    // model config; normalize to the highest-scoring entry's raw score.
    const top = Array.isArray(result) ? result[0] : result;
    scores.push(top?.score ?? 0);
  }

  return scores;
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
        rerankerPipeline = null;
        rerankerInitialized = false;
        respond({ id, success: true });
        break;
      }

      case 'initReranker': {
        const result = await initializeReranker();
        respond({ id, success: true, data: result });
        break;
      }

      case 'rerank': {
        const msg = message as RerankMessage;
        const scores = await rerank(msg.query, msg.texts);
        respond({ id, success: true, data: scores });
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
