/**
 * whisperModelDownload — shared download of the ggml whisper + VAD models,
 * used by both the batch transcriber (WhisperCppTranscriber) and the resident
 * live server (WhisperServer) so the two can't drift on download behaviour.
 *
 * Models are fetched once to userData; a model that already exists is a no-op.
 */

import { promises as fs } from 'node:fs';
import { logger } from '../utils';
import {
  WHISPER_MODEL_URL,
  VAD_MODEL_FILE,
  VAD_MODEL_URL,
  vadModelPath,
  whisperModelDir,
  whisperModelPath,
} from './whisperPaths';

export interface ModelDownloadProgress {
  file: string;
  loaded: number;
  total: number;
}

export type OnModelDownloadProgress = (info: ModelDownloadProgress) => void;

/** Ensure the ggml whisper model is present, downloading it if missing. */
export async function ensureWhisperModel(
  model: string,
  modelDir?: string,
  onProgress?: OnModelDownloadProgress,
): Promise<void> {
  await fs.mkdir(whisperModelDir(modelDir), { recursive: true });
  await downloadIfMissing(
    WHISPER_MODEL_URL(model),
    whisperModelPath(model, modelDir),
    `ggml-${model}.bin`,
    onProgress,
  );
}

/**
 * Ensure the VAD model is present — best-effort. If the download fails,
 * transcription still runs (without silence-skipping) rather than breaking.
 */
export async function ensureVadModel(modelDir?: string): Promise<void> {
  await fs.mkdir(whisperModelDir(modelDir), { recursive: true });
  await downloadIfMissing(VAD_MODEL_URL, vadModelPath(modelDir), VAD_MODEL_FILE).catch((err) =>
    logger.warn(`[whisper] VAD model unavailable, continuing without it: ${err}`),
  );
}

/** Download `url` to `dest` if it's missing, optionally reporting progress. */
async function downloadIfMissing(
  url: string,
  dest: string,
  file: string,
  onProgress?: OnModelDownloadProgress,
): Promise<void> {
  try {
    const stat = await fs.stat(dest);
    if (stat.size > 0) return; // already downloaded
  } catch {
    // missing — download below
  }

  const tmp = `${dest}.download`;
  logger.info(`[whisper] downloading ${file}`);

  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${file} (${res.status})`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const handle = await fs.open(tmp, 'w');
  try {
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await handle.write(value);
      loaded += value.length;
      onProgress?.({ file, loaded, total });
    }
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, dest);
  logger.info(`[whisper] ready: ${dest}`);
}
