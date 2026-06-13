/**
 * useVoiceCapture — owns the mic hardware for the quick "speak → journal"
 * flow. Mic-only sibling of useMeetingRecorder: MediaRecorder + level meter
 * live here; phase/IPC live in voiceCaptureStore so any surface can open
 * the dock. The dock component is the single mounter of this hook.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useVoiceCaptureStore } from '@renderer/stores/voiceCaptureStore';
import { pcmToWavArrayBuffer } from '@renderer/lib/audioEncoding';
import { startPcmRecording, type PcmRecording } from '@renderer/lib/pcmRecorder';
import { describeMicError } from '@renderer/lib/micErrors';
import { toNote } from '@renderer/navigation';
import { logger } from '@renderer/lib/logger';

export type { VoiceCapturePhase } from '@renderer/stores/voiceCaptureStore';

const WHISPER_SAMPLE_RATE = 16_000;

export function useVoiceCapture() {
  const open = useVoiceCaptureStore((s) => s.open);
  const phase = useVoiceCaptureStore((s) => s.phase);
  const elapsedMs = useVoiceCaptureStore((s) => s.elapsedMs);
  const audioLevel = useVoiceCaptureStore((s) => s.audioLevel);
  const error = useVoiceCaptureStore((s) => s.error);

  const requestOpen = useVoiceCaptureStore((s) => s.requestOpen);
  const close = useVoiceCaptureStore((s) => s.close);
  const reset = useVoiceCaptureStore((s) => s.reset);

  const navigate = useNavigate();

  const pcmRecorderRef = useRef<PcmRecording | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
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
      useVoiceCaptureStore.getState().tickElapsed(Date.now() - startedAt);
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
  }, []);

  function releaseHardware() {
    if (pcmRecorderRef.current) {
      pcmRecorderRef.current.stop();
      pcmRecorderRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    stopLevelMeter();
    pcmRecorderRef.current = null;
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
      let peak = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const v = Math.abs(buffer[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      smoothed = smoothed * 0.7 + peak * 0.3;
      useVoiceCaptureStore.getState().setAudioLevel(Math.min(1, smoothed));
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
    useVoiceCaptureStore.getState().setAudioLevel(0);
  }

  const start = useCallback(async () => {
    const store = useVoiceCaptureStore.getState();
    if (store.phase !== 'idle' && store.phase !== 'error') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      pcmRecorderRef.current = startPcmRecording(stream);
      startLevelMeter(stream);
      store.markRecordingStarted();
    } catch (err) {
      logger.error('[useVoiceCapture] start failed', err);
      releaseHardware();
      store.markError(describeMicError(err));
    }
  }, []);

  const stop = useCallback(async () => {
    const store = useVoiceCaptureStore.getState();
    if (store.phase !== 'recording') return;

    const captured = pcmRecorderRef.current?.stop() ?? null;
    pcmRecorderRef.current = null;

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    stopLevelMeter();

    try {
      if (!captured) throw new Error('Recording did not start correctly. Try again.');
      const wavBuffer = await pcmToWavArrayBuffer(
        captured.samples,
        captured.sampleRate,
        WHISPER_SAMPLE_RATE,
      );
      const saved = await store.transcribeAndAppend(wavBuffer);
      if (saved) {
        toast.success('Saved to journal', {
          description: saved.text.length > 80 ? `${saved.text.slice(0, 80)}…` : saved.text,
          action: {
            label: 'Open',
            onClick: () => navigate(toNote(saved.noteId)),
          },
        });
      }
    } catch (err) {
      logger.error('[useVoiceCapture] transcribe failed', err);
      store.markError(err instanceof Error ? err.message : 'Voice capture failed');
    } finally {
      pcmRecorderRef.current = null;
    }
  }, [navigate]);

  const cancel = useCallback(() => {
    releaseHardware();
    useVoiceCaptureStore.getState().close();
  }, []);

  return {
    open,
    phase,
    elapsedMs,
    audioLevel,
    error,
    start,
    stop,
    cancel,
    requestOpen,
    close,
    reset,
  };
}

/**
 * Lightweight trigger for surfaces that only need to open the dock
 * (the dock itself owns the recorder hardware via useVoiceCapture).
 */
export function useVoiceCaptureTrigger() {
  const requestOpen = useVoiceCaptureStore((s) => s.requestOpen);
  return { openVoiceCapture: requestOpen };
}
