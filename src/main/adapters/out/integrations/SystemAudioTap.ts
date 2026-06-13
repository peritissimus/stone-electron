/**
 * SystemAudioTap — drives the bundled stone-audio-tap Swift helper
 * (ScreenCaptureKit) to capture macOS system audio as raw 16 kHz mono
 * s16le PCM. Implements ISystemAudioTap.
 *
 * Lifecycle per recording: start() spawns `stone-audio-tap record <path>`
 * and resolves when the helper reports it is live; stop() SIGTERMs it and
 * waits for a clean exit so the file is flushed.
 *
 * Permission is macOS "Screen & System Audio Recording", attributed to the
 * responsible app (Stone packaged, Electron in dev).
 */

import { spawn, execFile, type ChildProcess } from 'child_process';
import path from 'path';
import type { ISystemAudioTap, SystemAudioPermission } from '../../../domain';
import { logger } from '../../../shared';

let app: any = null;
try {
  app = require('electron').app;
} catch {
  // Outside Electron (standalone server/tests) — helper path falls back to cwd.
}

const START_TIMEOUT_MS = 5000;
const STOP_TIMEOUT_MS = 3000;

export class SystemAudioTap implements ISystemAudioTap {
  private readonly sessions = new Map<string, ChildProcess>();
  private readonly levelListeners = new Set<(recordingId: string, level: number) => void>();

  onLevel(listener: (recordingId: string, level: number) => void): void {
    this.levelListeners.add(listener);
  }

  private emitLevel(recordingId: string, level: number): void {
    for (const listener of this.levelListeners) listener(recordingId, level);
  }

  private helperPath(): string {
    if (app?.isPackaged) {
      return path.join(process.resourcesPath, 'native', 'stone-audio-tap');
    }
    return path.join(process.cwd(), 'native', 'bin', 'stone-audio-tap');
  }

  isSupported(): boolean {
    return process.platform === 'darwin';
  }

  private async runCheck(command: 'check' | 'request'): Promise<SystemAudioPermission> {
    if (!this.isSupported()) return 'unsupported';
    return new Promise((resolve) => {
      execFile(this.helperPath(), [command], { timeout: 15_000 }, (error, stdout) => {
        if (error && !stdout) {
          logger.warn('[SystemAudioTap] helper check failed', error);
          resolve('unsupported');
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed.permission === 'granted' ? 'granted' : 'denied');
        } catch {
          resolve('unsupported');
        }
      });
    });
  }

  checkPermission(): Promise<SystemAudioPermission> {
    return this.runCheck('check');
  }

  requestPermission(): Promise<SystemAudioPermission> {
    return this.runCheck('request');
  }

  async start(recordingId: string, outputPath: string): Promise<void> {
    if (!this.isSupported()) {
      throw new Error('System audio capture is only supported on macOS');
    }
    if (this.sessions.has(recordingId)) return;

    const child = spawn(this.helperPath(), ['record', outputPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // The helper emits newline-delimited JSON on stdout: one {"recording":true}
    // readiness line, then a stream of {"level":x} peaks while capturing. Parse
    // line-by-line and keep parsing for the whole session — the level stream
    // drives the live waveform.
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        settle(() => reject(new Error('system audio helper did not start in time')));
      }, START_TIMEOUT_MS);

      let stderr = '';
      child.stderr?.on('data', (d) => {
        stderr += String(d);
      });

      let buffer = '';
      child.stdout?.on('data', (d) => {
        buffer += String(d);
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          if (line.includes('"level"')) {
            try {
              const level = JSON.parse(line).level;
              if (typeof level === 'number') this.emitLevel(recordingId, level);
            } catch {
              // ignore malformed level line
            }
          } else if (line.includes('"recording"')) {
            settle(resolve);
          }
        }
      });
      child.on('exit', (code) => {
        settle(() =>
          reject(new Error(`system audio helper exited (${code}): ${stderr.trim()}`)),
        );
      });
      child.on('error', (err) => {
        settle(() => reject(err));
      });
    });

    // Startup settled — keep the stdout level parser running, swap exit
    // handling to passive cleanup, and zero the meter when the session ends.
    child.removeAllListeners('exit');
    child.on('exit', () => {
      this.sessions.delete(recordingId);
      this.emitLevel(recordingId, 0);
    });
    this.sessions.set(recordingId, child);
    logger.info('[SystemAudioTap] capture started', { recordingId });
  }

  async stop(recordingId: string): Promise<void> {
    const child = this.sessions.get(recordingId);
    if (!child) return;
    this.sessions.delete(recordingId);

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, STOP_TIMEOUT_MS);
      child.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      child.kill('SIGTERM');
    });
    logger.info('[SystemAudioTap] capture stopped', { recordingId });
  }
}
