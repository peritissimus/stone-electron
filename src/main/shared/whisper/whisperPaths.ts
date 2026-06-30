/**
 * whisperPaths — shared resolution of the whisper binaries, model directory,
 * and model/VAD file locations, used by both the batch transcriber
 * (WhisperCppTranscriber) and the resident live server (WhisperServer).
 *
 * Centralised so the two adapters can't drift on model names or bundle paths.
 */

import os from 'node:os';
import path from 'node:path';

let app: { isPackaged?: boolean; getPath?: (n: string) => string } | null = null;
try {
  app = require('electron').app;
} catch {
  // Outside Electron (tests/standalone) — fall back to cwd/tmp.
}

/** Default transcription model: large-v3-turbo, quantized q5_0 (~547 MB).
 *  This is whisper's distilled "efficient large" (4 decoder layers, near-large
 *  accuracy) — used by both the live draft and the finalize pass. */
export const WHISPER_MODEL = 'large-v3-turbo-q5_0';

/** The live draft uses the SAME full-quality model — not a downgrade. It's kept
 *  efficient instead: language is pinned after the first chunk (skips a per-chunk
 *  detection pass), VAD skips silence, and threads are bounded. See WhisperServer. */
export const LIVE_WHISPER_MODEL = WHISPER_MODEL;

export const WHISPER_MODEL_URL = (model: string) =>
  `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`;

export const VAD_MODEL_FILE = 'ggml-silero-v5.1.2.bin';
export const VAD_MODEL_URL =
  'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin';

export type WhisperBinary = 'whisper-cli' | 'whisper-server';

/** Path to a bundled whisper binary (packaged) or the dev build output. */
export function whisperBinaryPath(name: WhisperBinary, override?: string): string {
  if (override) return override;
  if (app?.isPackaged) return path.join(process.resourcesPath, 'whisper', name);
  return path.join(process.cwd(), 'vendor', 'whisper', 'bin', name);
}

/** Directory holding the ggml model + VAD files. */
export function whisperModelDir(override?: string): string {
  if (override) return override;
  const base = app?.getPath?.('userData') ?? path.join(os.tmpdir(), 'stone');
  return path.join(base, 'whisper-models');
}

export function whisperModelPath(model: string, dirOverride?: string): string {
  return path.join(whisperModelDir(dirOverride), `ggml-${model}.bin`);
}

export function vadModelPath(dirOverride?: string): string {
  return path.join(whisperModelDir(dirOverride), VAD_MODEL_FILE);
}
