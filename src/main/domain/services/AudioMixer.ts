/**
 * AudioMixer — pure PCM/WAV buffer operations for the recording pipeline.
 *
 * Everything here is 16 kHz mono s16le: the renderer encodes the mic that
 * way (Whisper's required format), and the system-audio tap is configured
 * to emit the same. Mixing is sample-wise addition with clamping; streams
 * of different lengths mix over the longer one (the tail plays solo).
 *
 * Pure domain service — operates on byte buffers only, no I/O.
 */

const WAV_HEADER_BYTES = 44;
const SAMPLE_RATE = 16_000;

export class AudioMixer {
  /**
   * Decode a 16 kHz mono s16le WAV into samples. Strict: anything else
   * throws (mirrors the transcriber worker's parser — same contract).
   */
  decodeWav(bytes: Uint8Array): Int16Array {
    if (bytes.length < WAV_HEADER_BYTES) throw new Error('WAV too short');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tag = (offset: number) =>
      String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');

    // Walk chunks to find fmt + data (some encoders insert extra chunks).
    let offset = 12;
    let dataOffset = -1;
    let dataLength = 0;
    let channels = 0;
    let sampleRate = 0;
    let bitsPerSample = 0;
    while (offset + 8 <= bytes.length) {
      const chunkId = tag(offset);
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === 'fmt ') {
        channels = view.getUint16(offset + 10, true);
        sampleRate = view.getUint32(offset + 12, true);
        bitsPerSample = view.getUint16(offset + 22, true);
      } else if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataLength = chunkSize;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (dataOffset < 0) throw new Error('WAV has no data chunk');
    if (channels !== 1 || sampleRate !== SAMPLE_RATE || bitsPerSample !== 16) {
      throw new Error(
        `expected 16kHz mono s16 WAV, got ${sampleRate}Hz ${channels}ch ${bitsPerSample}bit`,
      );
    }
    const end = Math.min(dataOffset + dataLength, bytes.length);
    const samples = new Int16Array(Math.floor((end - dataOffset) / 2));
    for (let i = 0; i < samples.length; i++) {
      samples[i] = view.getInt16(dataOffset + i * 2, true);
    }
    return samples;
  }

  /** Interpret raw s16le bytes (the tap helper's output) as samples. */
  decodeRawPcm(bytes: Uint8Array): Int16Array {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Int16Array(Math.floor(bytes.byteLength / 2));
    for (let i = 0; i < samples.length; i++) {
      samples[i] = view.getInt16(i * 2, true);
    }
    return samples;
  }

  /** Sample-wise additive mix with clamping; output spans the longer input. */
  mix(a: Int16Array, b: Int16Array): Int16Array {
    const longer = a.length >= b.length ? a : b;
    const shorter = a.length >= b.length ? b : a;
    const out = new Int16Array(longer.length);
    out.set(longer);
    for (let i = 0; i < shorter.length; i++) {
      const sum = out[i] + shorter[i];
      out[i] = sum > 32767 ? 32767 : sum < -32768 ? -32768 : sum;
    }
    return out;
  }

  /** Encode samples as a 16 kHz mono s16le WAV. */
  encodeWav(samples: Int16Array): Uint8Array {
    const dataLength = samples.length * 2;
    const bytes = new Uint8Array(WAV_HEADER_BYTES + dataLength);
    const view = new DataView(bytes.buffer);
    const writeTag = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
    };
    writeTag(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeTag(8, 'WAVE');
    writeTag(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeTag(36, 'data');
    view.setUint32(40, dataLength, true);
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(WAV_HEADER_BYTES + i * 2, samples[i], true);
    }
    return bytes;
  }
}
