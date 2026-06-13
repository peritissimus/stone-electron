/**
 * ISystemAudioTap — capture system audio output (remote meeting voices)
 * on platforms where the renderer's getDisplayMedia loopback can't
 * (macOS: Electron's loopback grant is Windows-only).
 *
 * Implementation spawns a native helper that writes raw 16 kHz mono s16le
 * PCM to a file for the duration of a recording; the finalize flow mixes
 * that with the microphone WAV before transcription.
 */

export type SystemAudioPermission = 'granted' | 'denied' | 'unsupported';

export interface ISystemAudioTap {
  /** Platform support — false everywhere except macOS 13+. */
  isSupported(): boolean;

  /** Current permission state, without prompting. */
  checkPermission(): Promise<SystemAudioPermission>;

  /** Trigger the OS prompt (first ask only); resolves the resulting state. */
  requestPermission(): Promise<SystemAudioPermission>;

  /**
   * Start capturing system audio for `recordingId`, writing raw PCM to
   * `outputPath`. Resolves once capture is live. Rejects when unsupported,
   * permission-denied, or the helper fails to start.
   */
  start(recordingId: string, outputPath: string): Promise<void>;

  /**
   * Stop the capture for `recordingId` and flush the file. Resolves even
   * if no capture is active (idempotent).
   */
  stop(recordingId: string): Promise<void>;

  /**
   * Subscribe to live capture levels (peak amplitude in [0, 1]) emitted while
   * a recording is active, for the system-audio waveform. Fires ~15×/sec per
   * active session, and once with level 0 when a session ends.
   */
  onLevel(listener: (recordingId: string, level: number) => void): void;
}
