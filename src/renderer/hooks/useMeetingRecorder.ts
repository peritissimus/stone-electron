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
  const error = useMeetingRecorderStore((s) => s.error);
  const lastRecording = useMeetingRecorderStore((s) => s.lastRecording);

  const openDock = useMeetingRecorderStore((s) => s.openDock);
  const closeDock = useMeetingRecorderStore((s) => s.closeDock);
  const reset = useMeetingRecorderStore((s) => s.reset);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopResolveRef = useRef<(() => void) | null>(null);

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
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
  }

  const start = useCallback(async () => {
    const store = useMeetingRecorderStore.getState();
    if (store.phase !== 'idle' && store.phase !== 'done' && store.phase !== 'error') return;

    const slot = await store.reserveSlot();
    if (!slot) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, pickMimeType());
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
      store.markRecordingStarted(slot);
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

    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }

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
