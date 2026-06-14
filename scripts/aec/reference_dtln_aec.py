#!/usr/bin/env python3
"""
Reference implementation of Stone's acoustic echo canceller (DTLN-aec).

This is the validated Python prototype that the production TypeScript adapter
(src/main/adapters/out/integrations/OnnxEchoCanceller.ts) was ported from. Keep
the two in sync — if you change the pipeline here, mirror it there.

DTLN-aec is a two-stage model (resources/aec/dtln_aec_512_{1,2}.onnx):
  stage 1 predicts a spectral mask on the mic from the mic + far-end magnitudes;
  stage 2 refines the masked signal in the time domain. Block 512 / hop 128,
  two GRU states per stage, overlap-add.

The production adapter additionally estimates and compensates the loopback
capture delay (the system reference is captured a few tens of ms out of sync
with the mic's echo). This reference takes an explicit --advance for experiments.

Usage:
    python reference_dtln_aec.py <mic.wav> <reference.wav> <out.wav> [--advance N]

Requires: onnxruntime, numpy. Audio must be 16 kHz mono PCM16.
"""
import sys
import wave
import numpy as np
import onnxruntime as ort

MODEL_DIR = "resources/aec"
B, S = 512, 128


def load(path):
    w = wave.open(path, "rb")
    d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    w.close()
    return d


def save(path, x):
    x = np.clip(x * 32768.0, -32768, 32767).astype(np.int16)
    w = wave.open(path, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(16000)
    w.writeframes(x.tobytes())
    w.close()


def aec(mic, lpb, advance=0):
    n = min(len(mic), len(lpb))
    mic, lpb = mic[:n].copy(), lpb[:n].copy()
    if advance > 0:
        lpb = np.concatenate([lpb[advance:], np.zeros(advance, np.float32)])
    m1 = ort.InferenceSession(f"{MODEL_DIR}/dtln_aec_512_1.onnx")
    m2 = ort.InferenceSession(f"{MODEL_DIR}/dtln_aec_512_2.onnx")
    inb = np.zeros(B, np.float32)
    lpbb = np.zeros(B, np.float32)
    outb = np.zeros(B, np.float32)
    s1 = np.zeros((1, 2, 512, 2), np.float32)
    s2 = np.zeros((1, 2, 512, 2), np.float32)
    out = np.zeros(n)
    for k in range((n - B) // S + 1):
        inb = np.roll(inb, -S)
        inb[-S:] = mic[k * S : k * S + S]
        lpbb = np.roll(lpbb, -S)
        lpbb[-S:] = lpb[k * S : k * S + S]
        fft = np.fft.rfft(inb)
        mag = np.abs(fft).astype(np.float32)[None, None]
        lmag = np.abs(np.fft.rfft(lpbb)).astype(np.float32)[None, None]
        r = m1.run(None, {"input_3": mag, "input_4": lmag, "input_5": s1})
        mask, s1 = r[0], r[1]
        est = np.fft.irfft(fft * mask.squeeze()).astype(np.float32)[None, None]
        r = m2.run(None, {"input_6": est, "input_7": lpbb[None, None].astype(np.float32), "input_8": s2})
        ob, s2 = r[0].squeeze(), r[1]
        outb = np.roll(outb, -S)
        outb[-S:] = 0.0
        outb += ob
        out[k * S : k * S + S] = outb[:S]
    return out


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    mic_path, ref_path, out_path = sys.argv[1:4]
    advance = int(sys.argv[sys.argv.index("--advance") + 1]) if "--advance" in sys.argv else 0
    out = aec(load(mic_path), load(ref_path), advance)
    save(out_path, out)
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
