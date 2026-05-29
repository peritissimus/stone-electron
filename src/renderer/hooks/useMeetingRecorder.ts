/**
 * useMeetingRecorder — owns the renderer-side capture lifecycle.
 *
 * MediaRecorder and AudioContext live here; all IPC + state lives in
 * meetingRecorderStore so this hook stays a stateful hook by the
 * architecture rules (state hooks go through stores).
 */

import { useCallback, useEffect, useRef } from 'react';
import { useMeetingRecorderStore } from '@renderer/stores/meetingRecorderStore';
import { blobToWavArrayBuffer, pickMimeType } from '@renderer/lib/audioEncoding';
import { logger } from '@renderer/lib/logger';

export type { RecorderPhase } from '@renderer/stores/meetingRecorderStore';

const WHISPER_SAMPLE_RATE = 16_000;

export function useMeetingRecorder() {
  const phase = useMeetingRecorderStore((s) => s.phase);
  const dock = useMeetingRecorderStore((s) => s.dock);
  const elapsedMs = useMeetingRecorderStore((s) => s.elapsedMs);
  const audioLevel = useMeetingRecorderStore((s) => s.audioLevel);
  const captureMode = useMeetingRecorderStore((s) => s.captureMode);
  const error = useMeetingRecorderStore((s) => s.error);
  const lastRecording = useMeetingRecorderStore((s) => s.lastRecording);

  const openDock = useMeetingRecorderStore((s) => s.openDock);
  const closeDock = useMeetingRecorderStore((s) => s.closeDock);
  const reset = useMeetingRecorderStore((s) => s.reset);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** Mic stream (always present when recording). */
  const micStreamRef = useRef<MediaStream | null>(null);
  /** System / loopback stream (optional; null when only mic was granted). */
  const systemStreamRef = useRef<MediaStream | null>(null);
  /** AudioContext that mixes mic + system into one stream for MediaRecorder. */
  const mixerCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserFrameRef = useRef<number | null>(null);

  // Tick the elapsed timer while recording.
  useEffect(() => {
    if (phase !== 'recording') {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      useMeetingRecorderStore.getState().tickElapsed(Date.now() - startedAt);
    }, 200);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase]);

  // Safety net: stop hardware on unmount.
  useEffect(() => {
    return () => {
      releaseHardware();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function releaseHardware() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // already stopping
      }
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) track.stop();
      micStreamRef.current = null;
    }
    if (systemStreamRef.current) {
      for (const track of systemStreamRef.current.getTracks()) track.stop();
      systemStreamRef.current = null;
    }
    if (mixerCtxRef.current) {
      void mixerCtxRef.current.close();
      mixerCtxRef.current = null;
    }
    stopLevelMeter();
    recorderRef.current = null;
    chunksRef.current = [];
  }

  function startLevelMeter(stream: MediaStream) {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    analyserCtxRef.current = ctx;

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let smoothed = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      // RMS-style peak — read deviation from 128 (silence midpoint).
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = Math.abs(buffer[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      // Smooth so the bar doesn't twitch at small volumes.
      smoothed = smoothed * 0.7 + peak * 0.3;
      useMeetingRecorderStore.getState().setAudioLevel(Math.min(1, smoothed));
      analyserFrameRef.current = requestAnimationFrame(tick);
    };
    analyserFrameRef.current = requestAnimationFrame(tick);
  }

  function stopLevelMeter() {
    if (analyserFrameRef.current !== null) {
      cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }
    if (analyserCtxRef.current) {
      void analyserCtxRef.current.close();
      analyserCtxRef.current = null;
    }
    useMeetingRecorderStore.getState().setAudioLevel(0);
  }

  const start = useCallback(async () => {
    const store = useMeetingRecorderStore.getState();
    if (store.phase !== 'idle' && store.phase !== 'done' && store.phase !== 'error') return;

    const slot = await store.reserveSlot();
    if (!slot) return;

    try {
      // Mic is required — fail the whole start if it's denied.
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      // System audio is optional — request it, but fall back to
      // mic-only if the user denies the macOS Screen Recording prompt
      // or the platform doesn't support it (Linux, older macOS).
      const systemStream = await tryCaptureSystemAudio();
      systemStreamRef.current = systemStream;

      const { recordedStream, mixerCtx, captureMode } = buildRecordedStream(
        micStream,
        systemStream,
      );
      if (mixerCtx) mixerCtxRef.current = mixerCtx;

      const recorder = new MediaRecorder(recordedStream, pickMimeType());
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopResolveRef.current?.();
        stopResolveRef.current = null;
      };

      recorder.start(1000);
      // Level meter watches the mic only — system audio levels would
      // distract from the "is my voice being picked up" question that
      // the dock's meter is really answering.
      startLevelMeter(micStream);
      store.markRecordingStarted({ ...slot, captureMode });
    } catch (err) {
      logger.error('[useMeetingRecorder] start failed', err);
      releaseHardware();
      store.markError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, []);

  const stop = useCallback(async () => {
    const store = useMeetingRecorderStore.getState();
    if (store.phase !== 'recording') return;
    const durationMs = store.elapsedMs;

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        stopResolveRef.current = resolve;
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
    }

    // Stop both source streams + the mixer if it was used.
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) track.stop();
      micStreamRef.current = null;
    }
    if (systemStreamRef.current) {
      for (const track of systemStreamRef.current.getTracks()) track.stop();
      systemStreamRef.current = null;
    }
    if (mixerCtxRef.current) {
      void mixerCtxRef.current.close();
      mixerCtxRef.current = null;
    }
    stopLevelMeter();

    try {
      const blob = new Blob(chunksRef.current, {
        type: chunksRef.current[0]?.type ?? 'audio/webm',
      });
      chunksRef.current = [];
      const wavBuffer = await blobToWavArrayBuffer(blob, WHISPER_SAMPLE_RATE);
      await store.uploadAndFinalize(wavBuffer, durationMs);
    } catch (err) {
      logger.error('[useMeetingRecorder] finalize failed', err);
      store.markError(err instanceof Error ? err.message : 'Recording failed');
    } finally {
      recorderRef.current = null;
    }
  }, []);

  const cancel = useCallback(async () => {
    releaseHardware();
    chunksRef.current = [];
    await useMeetingRecorderStore.getState().cancelActive();
  }, []);

  return {
    phase,
    dock,
    elapsedMs,
    audioLevel,
    captureMode,
    error,
    lastRecording,
    start,
    stop,
    cancel,
    openDock,
    closeDock,
    reset,
  };
}

// ============================================================================
// System audio capture + mixing
// ============================================================================

/**
 * Try to grab the system-audio stream via getDisplayMedia. We request
 * video too because Electron / browsers require at least one of the
 * two — but we immediately stop the video tracks once we have the
 * stream, since we only want audio. Returns null on any failure
 * (user denied, platform doesn't support, etc.).
 */
async function tryCaptureSystemAudio(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });
    // We only want audio. Drop the video tracks immediately so the
    // composite engine isn't capturing pixels.
    for (const track of stream.getVideoTracks()) {
      track.stop();
      stream.removeTrack(track);
    }
    // If the platform handed us a stream with no audio at all, treat
    // as a fallback case rather than a partial success.
    if (stream.getAudioTracks().length === 0) {
      for (const track of stream.getTracks()) track.stop();
      return null;
    }
    return stream;
  } catch (err) {
    logger.warn('[useMeetingRecorder] system audio unavailable; falling back to mic-only', err);
    return null;
  }
}

/**
 * Builds the MediaStream MediaRecorder will record from. When only mic
 * is present we just hand the mic stream straight through (no extra
 * AudioContext, no overhead). When system audio is also present we mix
 * both via Web Audio's createMediaStreamSource + a shared destination.
 */
function buildRecordedStream(
  micStream: MediaStream,
  systemStream: MediaStream | null,
): {
  recordedStream: MediaStream;
  mixerCtx: AudioContext | null;
  captureMode: 'mic-only' | 'mic+system';
} {
  if (!systemStream) {
    return { recordedStream: micStream, mixerCtx: null, captureMode: 'mic-only' };
  }
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const destination = ctx.createMediaStreamDestination();
  ctx.createMediaStreamSource(micStream).connect(destination);
  ctx.createMediaStreamSource(systemStream).connect(destination);
  return {
    recordedStream: destination.stream,
    mixerCtx: ctx,
    captureMode: 'mic+system',
  };
}
