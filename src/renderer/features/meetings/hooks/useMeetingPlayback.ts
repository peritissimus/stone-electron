/**
 * useMeetingPlayback — load a meeting's WAV tracks and play them back.
 *
 * Mic and system are separate tracks (per-source transcription), so playback
 * runs both HTMLAudioElements in lock-step: play/pause/seek apply to both, with
 * the mic element as the clock. Audio arrives as bytes over IPC and becomes blob
 * URLs (revoked on cleanup). `available` is false once the audio was deleted
 * after a successful finalize.
 *
 * Command/service hook — owns only local playback state, so it calls the API
 * directly per the renderer architecture rules.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { meetingAPI } from '@renderer/api';

export interface MeetingPlayback {
  available: boolean;
  isPlaying: boolean;
  currentMs: number;
  durationMs: number;
  toggle: () => void;
  seek: (ms: number) => void;
}

export function useMeetingPlayback(recordingId: string, fallbackDurationMs = 0): MeetingPlayback {
  const [available, setAvailable] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(fallbackDurationMs);

  const micRef = useRef<HTMLAudioElement | null>(null);
  const systemRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setAvailable(false);
    setIsPlaying(false);
    setCurrentMs(0);
    setDurationMs(fallbackDurationMs);

    void (async () => {
      const res = await meetingAPI.getAudio(recordingId);
      if (cancelled || !res.success || !res.data?.mic) return;

      const toUrl = (bytes: Uint8Array): string => {
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/wav' }));
        urls.push(url);
        return url;
      };

      const mic = new Audio(toUrl(res.data.mic));
      micRef.current = mic;
      if (res.data.system) {
        systemRef.current = new Audio(toUrl(res.data.system));
      }
      mic.addEventListener('timeupdate', () => setCurrentMs(mic.currentTime * 1000));
      mic.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(mic.duration)) {
          setDurationMs((d) => Math.max(d, mic.duration * 1000));
        }
      });
      mic.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentMs(0);
        systemRef.current?.pause();
      });
      setAvailable(true);
    })();

    return () => {
      cancelled = true;
      micRef.current?.pause();
      systemRef.current?.pause();
      micRef.current = null;
      systemRef.current = null;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [recordingId, fallbackDurationMs]);

  const toggle = useCallback(() => {
    const mic = micRef.current;
    if (!mic) return;
    if (mic.paused) {
      void mic.play();
      void systemRef.current?.play();
      setIsPlaying(true);
    } else {
      mic.pause();
      systemRef.current?.pause();
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((ms: number) => {
    const mic = micRef.current;
    if (!mic) return;
    const seconds = Math.max(0, ms / 1000);
    mic.currentTime = seconds;
    if (systemRef.current) systemRef.current.currentTime = seconds;
    setCurrentMs(ms);
  }, []);

  return { available, isPlaying, currentMs, durationMs, toggle, seek };
}
