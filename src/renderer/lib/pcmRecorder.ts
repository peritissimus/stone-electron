/**
 * pcmRecorder — capture mono PCM straight from a MediaStream via Web Audio.
 *
 * MediaRecorder produces empty/corrupt blobs on some Electron/Chromium builds
 * even when the microphone is live (the AnalyserNode driving the dock's
 * waveform sees audio while MediaRecorder yields nothing). Tapping the same
 * Web Audio graph with a ScriptProcessorNode sidesteps that — and avoids
 * decodeAudioData on the way back out — so capture is reliable.
 */

export interface PcmRecording {
  /** Stop capture and return the accumulated mono PCM + the context's rate. */
  stop(): { samples: Float32Array; sampleRate: number };
  /**
   * Return the samples captured since the last drain (for live streaming),
   * without disturbing the full buffer that stop() returns. Empty until new
   * audio arrives.
   */
  drain(): { samples: Float32Array; sampleRate: number };
}

export function startPcmRecording(stream: MediaStream): PcmRecording {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  // Route through a silent gain so onaudioprocess keeps firing without echoing
  // the mic back through the speakers.
  const sink = ctx.createGain();
  sink.gain.value = 0;

  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    chunks.push(copy);
  };

  source.connect(processor);
  processor.connect(sink);
  sink.connect(ctx.destination);

  let stopped = false;
  let drainedChunks = 0;
  const concat = (from: number): Float32Array => {
    let n = 0;
    for (let i = from; i < chunks.length; i += 1) n += chunks[i].length;
    const out = new Float32Array(n);
    let offset = 0;
    for (let i = from; i < chunks.length; i += 1) {
      out.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    return out;
  };
  return {
    drain() {
      const samples = concat(drainedChunks);
      drainedChunks = chunks.length;
      return { samples, sampleRate: ctx.sampleRate };
    },
    stop() {
      const sampleRate = ctx.sampleRate;
      if (!stopped) {
        stopped = true;
        try {
          processor.disconnect();
          source.disconnect();
          sink.disconnect();
        } catch {
          // already torn down
        }
        processor.onaudioprocess = null;
        void ctx.close();
      }
      return { samples: concat(0), sampleRate };
    },
  };
}
