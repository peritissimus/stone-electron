/**
 * useMeetingRecorder — owns the renderer-side capture lifecycle.
 *
 * MediaRecorder and AudioContext live here; all IPC + state lives in
 * meetingRecorderStore so this hook stays a stateful hook by the
 * architecture rules (state hooks go through stores).
 */

import { useCallback, useEffect } from 'react';
import { useMeetingRecorderStore } from '@renderer/stores/meetingRecorderStore';
import { pcmToWavArrayBuffer } from '@renderer/lib/audioEncoding';
import { startPcmRecording, type PcmRecording } from '@renderer/lib/pcmRecorder';
import { describeMicError } from '@renderer/lib/micErrors';
import { subscribe } from '@renderer/lib/events';
import { EVENTS } from '@shared/constants/ipcChannels';
import { logger } from '@renderer/lib/logger';

export type { RecorderPhase } from '@renderer/stores/meetingRecorderStore';

const WHISPER_SAMPLE_RATE = 16_000;

// Recording hardware is a SINGLE shared session, not per-component state. The
// dock and the inline Meetings panel each call useMeetingRecorder(), and
// start() may fire from one surface while stop() fires from another — so these
// must be module-level (a useRef would scope them to one component instance and
// the refs wouldn't line up across start/stop). Mirrors the global store.
const pcmRecorderRef: { current: PcmRecording | null } = { current: null };
const micStreamRef: { current: MediaStream | null } = { current: null };
const systemStreamRef: { current: MediaStream | null } = { current: null };
const mixerCtxRef: { current: AudioContext | null } = { current: null };
const analyserCtxRef: { current: AudioContext | null } = { current: null };
const analyserFrameRef: { current: number | null } = { current: null };
const systemAnalyserCtxRef: { current: AudioContext | null } = { current: null };
const systemAnalyserFrameRef: { current: number | null } = { current: null };

/** Run a smoothed peak-level meter on a stream, writing each frame via setLevel. */
function runAnalyser(
  stream: MediaStream,
  setLevel: (level: number) => void,
  ctxRef: { current: AudioContext | null },
  frameRef: { current: number | null },
): void {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  ctxRef.current = ctx;

  const buffer = new Uint8Array(analyser.frequencyBinCount);
  let smoothed = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(buffer);
    // RMS-style peak — deviation from 128 (silence midpoint).
    let peak = 0;
    for (let i = 0; i < buffer.length; i += 1) {
      const v = Math.abs(buffer[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    smoothed = smoothed * 0.7 + peak * 0.3;
    setLevel(Math.min(1, smoothed));
    frameRef.current = requestAnimationFrame(tick);
  };
  frameRef.current = requestAnimationFrame(tick);
}

export function useMeetingRecorder() {
  const phase = useMeetingRecorderStore((s) => s.phase);
  const dock = useMeetingRecorderStore((s) => s.dock);
  const elapsedMs = useMeetingRecorderStore((s) => s.elapsedMs);
  const audioLevel = useMeetingRecorderStore((s) => s.audioLevel);
  const systemAudioLevel = useMeetingRecorderStore((s) => s.systemAudioLevel);
  const captureMode = useMeetingRecorderStore((s) => s.captureMode);
  const error = useMeetingRecorderStore((s) => s.error);
  const lastRecording = useMeetingRecorderStore((s) => s.lastRecording);

  const openDock = useMeetingRecorderStore((s) => s.openDock);
  const closeDock = useMeetingRecorderStore((s) => s.closeDock);
  const reset = useMeetingRecorderStore((s) => s.reset);

  // Live system-audio levels arrive from the native tap (main process) — the
  // renderer has no system stream to analyse on macOS. Feed them to the store
  // so the dock's teal waveform can render them.
  useEffect(() => {
    return subscribe(EVENTS.MEETING_SYSTEM_AUDIO_LEVEL, (payload: unknown) => {
      const level = (payload as { level?: number } | undefined)?.level;
      if (typeof level === 'number') {
        useMeetingRecorderStore.getState().setSystemAudioLevel(level);
      }
    });
  }, []);

  // Tick the elapsed timer while recording. Reads the shared startedAt from the
  // store so every mounted surface (dock + inline panel) agrees on the time —
  // and so the timer survives navigation between them.
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = window.setInterval(() => {
      const startedAt = useMeetingRecorderStore.getState().startedAt;
      if (startedAt !== null) {
        useMeetingRecorderStore.getState().tickElapsed(Date.now() - startedAt);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  // NOTE: no unmount cleanup. Hardware is a shared singleton released on
  // stop()/cancel() — releasing it when a transient surface (the inline panel)
  // unmounts would kill an in-flight recording the user navigated away from.

  function releaseHardware() {
    if (pcmRecorderRef.current) {
      pcmRecorderRef.current.stop();
      pcmRecorderRef.current = null;
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
    pcmRecorderRef.current = null;
  }

  // Drive the green (mic) and teal (system) waveforms from the renderer
  // streams. Both sources are now MediaStreams in the renderer (system audio
  // via getDisplayMedia loopback), so each gets its own analyser.
  function startLevelMeter(micStream: MediaStream, systemStream: MediaStream | null) {
    runAnalyser(
      micStream,
      (level) => useMeetingRecorderStore.getState().setAudioLevel(level),
      analyserCtxRef,
      analyserFrameRef,
    );
    if (systemStream) {
      runAnalyser(
        systemStream,
        (level) => useMeetingRecorderStore.getState().setSystemAudioLevel(level),
        systemAnalyserCtxRef,
        systemAnalyserFrameRef,
      );
    }
  }

  function stopLevelMeter() {
    for (const [ctxRef, frameRef] of [
      [analyserCtxRef, analyserFrameRef],
      [systemAnalyserCtxRef, systemAnalyserFrameRef],
    ] as const) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (ctxRef.current) {
        void ctxRef.current.close();
        ctxRef.current = null;
      }
    }
    useMeetingRecorderStore.getState().setAudioLevel(0);
    useMeetingRecorderStore.getState().setSystemAudioLevel(0);
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

      // System audio via getDisplayMedia loopback — now enabled on macOS too
      // (Chromium ScreenCaptureKit/Core Audio tap, gated by the feature flags
      // set in main). setDisplayMediaRequestHandler auto-grants the request, so
      // there's no picker. Null when unsupported or the user denied Screen
      // Recording → we fall back to mic-only.
      const systemStream = await tryCaptureSystemAudio();
      systemStreamRef.current = systemStream;

      const { recordedStream, mixerCtx, captureMode: rendererMode } = buildRecordedStream(
        micStream,
        systemStream,
      );
      if (mixerCtx) mixerCtxRef.current = mixerCtx;
      const captureMode: 'mic-only' | 'mic+system' =
        rendererMode === 'mic+system' || slot.systemAudio ? 'mic+system' : 'mic-only';

      pcmRecorderRef.current = startPcmRecording(recordedStream);
      // Green meter follows the mic, teal follows the system stream.
      startLevelMeter(micStream, systemStream);
      store.markRecordingStarted({ ...slot, captureMode });
    } catch (err) {
      logger.error('[useMeetingRecorder] start failed', err);
      releaseHardware();
      store.markError(describeMicError(err));
    }
  }, []);

  const stop = useCallback(async () => {
    const store = useMeetingRecorderStore.getState();
    if (store.phase !== 'recording') return;
    const durationMs = store.elapsedMs;

    // Stop PCM capture first so the tail of audio is flushed before the
    // stream and context are torn down.
    const captured = pcmRecorderRef.current?.stop() ?? null;
    pcmRecorderRef.current = null;

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
      if (!captured) throw new Error('Recording did not start correctly. Try again.');
      const wavBuffer = await pcmToWavArrayBuffer(
        captured.samples,
        captured.sampleRate,
        WHISPER_SAMPLE_RATE,
      );
      await store.uploadAndFinalize(wavBuffer, durationMs);
    } catch (err) {
      logger.error('[useMeetingRecorder] finalize failed', err);
      store.markError(err instanceof Error ? err.message : 'Recording failed');
    } finally {
      pcmRecorderRef.current = null;
    }
  }, []);

  const cancel = useCallback(async () => {
    releaseHardware();
    await useMeetingRecorderStore.getState().cancelActive();
  }, []);

  return {
    phase,
    dock,
    elapsedMs,
    audioLevel,
    systemAudioLevel,
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
