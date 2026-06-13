/**
 * Browser-side helper: encode raw mono PCM (captured from Web Audio via
 * pcmRecorder) into a 16-bit WAV at the rate the Whisper worker expects.
 *
 * Lives in lib/ (not in stores or hooks) because it's pure browser-API
 * plumbing that doesn't own any app state.
 */

export async function pcmToWavArrayBuffer(
  samples: Float32Array,
  fromSampleRate: number,
  targetSampleRate: number,
): Promise<ArrayBuffer> {
  if (samples.length === 0) {
    throw new Error(
      'No audio was captured. Check that your microphone is working and not in use by another app, then try again.',
    );
  }
  const resampled = await resamplePcm(samples, fromSampleRate, targetSampleRate);
  return encodeWav(resampled, targetSampleRate);
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
