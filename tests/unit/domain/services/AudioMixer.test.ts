/**
 * AudioMixer — pure PCM/WAV buffer ops behind the mic + system-audio merge.
 * The WAV codec must round-trip exactly (this file feeds Whisper), and the
 * mix must clamp instead of wrapping on overflow.
 */

import { describe, it, expect } from 'vitest';
import { AudioMixer } from '../../../../src/main/domain/services/AudioMixer';

const mixer = new AudioMixer();

describe('AudioMixer', () => {
  describe('WAV codec', () => {
    it('round-trips samples exactly', () => {
      const samples = new Int16Array([0, 1, -1, 32767, -32768, 1234, -4321]);
      const decoded = mixer.decodeWav(mixer.encodeWav(samples));
      expect(Array.from(decoded)).toEqual(Array.from(samples));
    });

    it('writes a header the strict decoder accepts (16kHz mono s16)', () => {
      const bytes = mixer.encodeWav(new Int16Array([5, 10]));
      // RIFF/WAVE magic + sizes
      expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
      expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
      expect(bytes.length).toBe(44 + 4);
    });

    it('rejects non-16kHz WAVs', () => {
      const bytes = mixer.encodeWav(new Int16Array([1, 2, 3]));
      // Corrupt the sample rate field (offset 24 in the canonical header).
      new DataView(bytes.buffer).setUint32(24, 44_100, true);
      expect(() => mixer.decodeWav(bytes)).toThrow(/expected 16kHz/);
    });

    it('rejects non-WAV bytes', () => {
      expect(() => mixer.decodeWav(new Uint8Array(100))).toThrow();
    });
  });

  describe('decodeRawPcm', () => {
    it('reads little-endian s16 pairs', () => {
      const bytes = new Uint8Array([0x01, 0x00, 0xff, 0xff, 0x00, 0x80]);
      expect(Array.from(mixer.decodeRawPcm(bytes))).toEqual([1, -1, -32768]);
    });

    it('ignores a trailing odd byte', () => {
      expect(mixer.decodeRawPcm(new Uint8Array([1, 0, 9])).length).toBe(1);
    });
  });

  describe('mix', () => {
    it('adds sample-wise', () => {
      const out = mixer.mix(new Int16Array([100, -50]), new Int16Array([25, 25]));
      expect(Array.from(out)).toEqual([125, -25]);
    });

    it('clamps instead of wrapping on overflow', () => {
      const out = mixer.mix(
        new Int16Array([32000, -32000]),
        new Int16Array([32000, -32000]),
      );
      expect(Array.from(out)).toEqual([32767, -32768]);
    });

    it('spans the longer input when lengths differ', () => {
      const out = mixer.mix(new Int16Array([1, 1, 1, 1]), new Int16Array([2]));
      expect(Array.from(out)).toEqual([3, 1, 1, 1]);
      // Symmetric — order must not matter.
      const flipped = mixer.mix(new Int16Array([2]), new Int16Array([1, 1, 1, 1]));
      expect(Array.from(flipped)).toEqual([3, 1, 1, 1]);
    });
  });

  it('end-to-end: mic WAV + raw system PCM → mixed WAV decodes correctly', () => {
    const mic = new Int16Array([1000, 2000, 3000]);
    const system = new Int16Array([10, 20, 30, 40]);
    const systemBytes = new Uint8Array(system.buffer.slice(0));

    const mixed = mixer.mix(mixer.decodeWav(mixer.encodeWav(mic)), mixer.decodeRawPcm(systemBytes));
    const final = mixer.decodeWav(mixer.encodeWav(mixed));

    expect(Array.from(final)).toEqual([1010, 2020, 3030, 40]);
  });
});
