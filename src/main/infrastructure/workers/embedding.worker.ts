/**
 * Embedding Worker - Runs transformers.js in a worker thread
 *
 * Worker threads have `self` defined (like browsers), so no polyfill needed.
 * This isolates heavy ML operations from the main Electron process.
 */

import { parentPort, workerData } from 'worker_threads';
import { promises as fs } from 'node:fs';

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

interface InitTranscriberMessage {
  type: 'initTranscriber';
  id: string;
}

interface TranscribeMessage {
  type: 'transcribe';
  id: string;
  /** Absolute path to a 16kHz mono 16-bit PCM WAV file. */
  audioPath: string;
}

type WorkerMessage =
  | InitMessage
  | EmbedMessage
  | BatchEmbedMessage
  | PingMessage
  | ShutdownMessage
  | InitRerankerMessage
  | RerankMessage
  | InitTranscriberMessage
  | TranscribeMessage;

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
const TRANSCRIBER_MODEL_NAME = 'Xenova/whisper-base.en';
// Whisper expects 16kHz mono Float32 PCM in [-1, 1].
const WHISPER_SAMPLE_RATE = 16_000;

// Pipeline instances. Three models share the worker — the embedder is loaded
// eagerly on first request, the reranker + transcriber lazy-load on first
// call so users who never hit the AI surface don't pay the memory cost.
type Pipeline = Awaited<ReturnType<(typeof import('@xenova/transformers'))['pipeline']>>;
let pipeline: Pipeline | null = null;
let rerankerPipeline: Pipeline | null = null;
let transcriberPipeline: Pipeline | null = null;
let initialized = false;
let rerankerInitialized = false;
let transcriberInitialized = false;

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
 * Initialize the transcriber model (Whisper). Lazy-loaded for the same
 * reason as the reranker — first transcribe request pays the ~80MB
 * weight download (cached after).
 */
async function initializeTranscriber(): Promise<{ model: string }> {
  if (transcriberInitialized && transcriberPipeline) {
    return { model: TRANSCRIBER_MODEL_NAME };
  }

  const { pipeline: createPipeline, env } = await import('@xenova/transformers');

  env.allowLocalModels = true;
  env.useBrowserCache = false;
  const cacheDir = (workerData as { cacheDir?: string } | null)?.cacheDir;
  if (cacheDir) {
    env.cacheDir = cacheDir;
  }

  transcriberPipeline = await createPipeline(
    'automatic-speech-recognition',
    TRANSCRIBER_MODEL_NAME,
    { quantized: true },
  );

  transcriberInitialized = true;
  return { model: TRANSCRIBER_MODEL_NAME };
}

interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

interface TranscribeResultData {
  text: string;
  segments: Array<{ text: string; startMs: number; endMs: number }>;
  durationMs: number;
}

/**
 * Read a 16-bit PCM WAV file and decode to Float32Array samples in [-1, 1].
 * Renderer is responsible for producing the right format (16kHz mono),
 * so this parser is intentionally strict — anything else throws.
 */
async function loadPcmFromWav(audioPath: string): Promise<Float32Array> {
  const buf = await fs.readFile(audioPath);
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' ||
      buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('audio file is not a RIFF/WAVE container');
  }
  // Walk the chunks; we only care about 'fmt ' and 'data'.
  let offset = 12;
  let fmt: { channels: number; sampleRate: number; bitsPerSample: number } | null = null;
  let dataOffset = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      const audioFormat = buf.readUInt16LE(offset + 8);
      if (audioFormat !== 1) throw new Error(`expected PCM (1), got format ${audioFormat}`);
      fmt = {
        channels: buf.readUInt16LE(offset + 10),
        sampleRate: buf.readUInt32LE(offset + 12),
        bitsPerSample: buf.readUInt16LE(offset + 22),
      };
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size + (size % 2); // chunks are word-aligned
  }
  if (!fmt || dataOffset < 0) throw new Error('WAV missing fmt or data chunk');
  if (fmt.channels !== 1) throw new Error(`expected mono, got ${fmt.channels} channels`);
  if (fmt.sampleRate !== WHISPER_SAMPLE_RATE) {
    throw new Error(`expected ${WHISPER_SAMPLE_RATE}Hz, got ${fmt.sampleRate}Hz`);
  }
  if (fmt.bitsPerSample !== 16) {
    throw new Error(`expected 16-bit PCM, got ${fmt.bitsPerSample}-bit`);
  }

  const sampleCount = Math.floor(dataLen / 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    out[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
  }
  return out;
}

/**
 * Run Whisper over the audio file. Whisper's chunking + timestamps live
 * in the pipeline options; we just remap the output to our wire shape.
 */
async function transcribe(audioPath: string): Promise<TranscribeResultData> {
  if (!transcriberInitialized || !transcriberPipeline) {
    await initializeTranscriber();
  }

  const samples = await loadPcmFromWav(audioPath);
  const durationMs = Math.round((samples.length / WHISPER_SAMPLE_RATE) * 1000);

  // The Pipeline union doesn't narrow on call-site shape; cast through any.
  const call = transcriberPipeline! as unknown as (
    input: Float32Array,
    options: Record<string, unknown>,
  ) => Promise<{ text: string; chunks?: WhisperChunk[] }>;
  const output = await call(samples, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  });

  const segments = (output.chunks ?? []).map((c) => {
    const start = c.timestamp[0] ?? 0;
    const end = c.timestamp[1] ?? start;
    return {
      text: c.text,
      startMs: Math.round(start * 1000),
      endMs: Math.round(end * 1000),
    };
  });

  return {
    text: output.text ?? '',
    segments,
    durationMs,
  };
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
        transcriberPipeline = null;
        transcriberInitialized = false;
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

      case 'initTranscriber': {
        const result = await initializeTranscriber();
        respond({ id, success: true, data: result });
        break;
      }

      case 'transcribe': {
        const msg = message as TranscribeMessage;
        const result = await transcribe(msg.audioPath);
        respond({ id, success: true, data: result });
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
