/**
 * Browser-side helpers for converting a MediaRecorder webm Blob into a
 * 16-bit PCM mono WAV at the rate the Whisper worker expects.
 *
 * Lives in lib/ (not in stores or hooks) because it's pure browser-API
 * plumbing that doesn't own any app state.
 */

export async function blobToWavArrayBuffer(
  blob: Blob,
  targetSampleRate: number,
): Promise<ArrayBuffer> {
  // A near-empty blob means no audio reached the recorder — the mic produced
  // nothing (silent input, in use by another app, or a track that ended).
  // decodeAudioData would throw a cryptic "Unable to decode audio data"; give
  // the real reason instead. A valid recording is many KB even when short; a
  // header-only WebM fragment is only a few hundred bytes.
  if (blob.size < 1024) {
    throw new Error(
      'No audio was captured. Check that your microphone is working and not in use by another app, then try again.',
    );
  }

  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error(
      `Could not decode the recording (${(blob.size / 1024).toFixed(0)} KB, ${blob.type || 'unknown format'}). The audio may be corrupt or in an unsupported format.`,
    );
  } finally {
    void ctx.close();
  }

  const mono = downmixToMono(decoded);
  const resampled = await resamplePcm(mono, decoded.sampleRate, targetSampleRate);
  return encodeWav(resampled, targetSampleRate);
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) out[i] += data[i];
  }
  const inv = 1 / buffer.numberOfChannels;
  for (let i = 0; i < length; i += 1) out[i] *= inv;
  return out;
}

async function resamplePcm(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Promise<Float32Array> {
  if (fromRate === toRate) return samples;
  const OfflineCtx =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const targetLength = Math.ceil((samples.length * toRate) / fromRate);
  const ctx = new OfflineCtx(1, targetLength, toRate);
  const source = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, samples.length, fromRate);
  const copy = new Float32Array(samples.length);
  copy.set(samples);
  buffer.copyToChannel(copy, 0);
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0);
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

export function pickMimeType(): MediaRecorderOptions {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return { mimeType: type };
    }
  }
  return {};
}
