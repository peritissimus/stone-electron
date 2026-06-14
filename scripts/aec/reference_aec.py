#!/usr/bin/env python3
"""
Reference implementation of Stone's acoustic echo canceller.

This is the validated Python prototype that the production TypeScript adapter
(src/main/adapters/out/integrations/OnnxEchoCanceller.ts) was ported from. Keep
the two in sync — if you change the feature pipeline here, mirror it there.

Model: ICASSP-2022 AEC Challenge baseline (resources/aec/dec-baseline-icassp2022.onnx),
a streaming recurrent mask network. Per 20 ms frame it takes the log-power
spectra of the mic and far-end reference (161 bins each) plus two GRU states,
and emits a 161-bin suppression mask applied to the mic spectrum. Frame 320 /
hop 160, sqrt-Hann window, overlap-add reconstruction.

Usage:
    python reference_aec.py <mic.wav> <reference.wav> <out.wav> [model.onnx]

Requires: onnxruntime, numpy. Audio must be 16 kHz mono PCM16.
"""
import sys
import wave
import numpy as np
import onnxruntime as ort

N, H, EPS = 320, 160, 1e-12


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


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    mic_path, ref_path, out_path = sys.argv[1:4]
    model = sys.argv[4] if len(sys.argv) > 4 else "resources/aec/dec-baseline-icassp2022.onnx"

    mic, far = load(mic_path), load(ref_path)
    n = min(len(mic), len(far))
    mic, far = mic[:n], far[:n]
    win = np.sqrt(np.hanning(N + 1)[:-1]).astype(np.float32)

    def frames(x):
        m = (len(x) - N) // H + 1
        return np.array([x[i * H : i * H + N] for i in range(m)])

    Fm, Ff = frames(mic), frames(far)
    T = min(len(Fm), len(Ff))
    sess = ort.InferenceSession(model)
    h01 = np.zeros((1, 1, 322), np.float32)
    h02 = np.zeros((1, 1, 322), np.float32)
    out = np.zeros(n + N)
    norm = np.zeros(n + N)
    for t in range(T):
        Xm = np.fft.rfft(Fm[t] * win)
        Xf = np.fft.rfft(Ff[t] * win)
        feat = (
            np.concatenate([np.log(np.abs(Xm) ** 2 + EPS), np.log(np.abs(Xf) ** 2 + EPS)])
            .reshape(1, 1, 322)
            .astype(np.float32)
        )
        r = sess.run(None, {"input": feat, "h01": h01, "h02": h02})
        mask, h01, h02 = r[0].reshape(-1), r[1], r[2]
        fr = np.fft.irfft(mask * Xm) * win
        out[t * H : t * H + N] += fr
        norm[t * H : t * H + N] += win ** 2
    norm[norm < 1e-8] = 1e-8
    save(out_path, (out / norm)[:n])
    print(f"wrote {out_path} ({T} frames)")


if __name__ == "__main__":
    main()
